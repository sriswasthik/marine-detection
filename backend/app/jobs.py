"""
Analysis jobs: a small queue and one worker thread, so the model runs one image at a time.
Progress comes from the pipeline's own stage callbacks (preprocess, detect, map).
"""
import logging
import queue
import shutil
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from backend import pipeline
from backend.pipeline import PipelineError

from .config import Settings
from .errors import MODEL_FAILURE_MESSAGE, ApiError
from .logging_setup import request_id_var
from .store import ObservationStore

log = logging.getLogger("backend.jobs")

# Share of the progress bar each step starts at. The upload has finished by the time a job exists.
STEP_START = {"upload": 0, "preprocess": 20, "detect": 40, "map": 75}
UPLOADED_PROGRESS = 20


@dataclass
class Job:
    id: str
    observation_id: str
    file_path: Path
    source: str
    region: Optional[str]
    captured_at: Optional[str]
    request_id: Optional[str]
    status: str = "queued"
    step: str = "upload"
    progress: int = UPLOADED_PROGRESS
    error: Optional[Dict[str, Any]] = None
    completed_id: Optional[str] = None
    stage_started: Optional[float] = field(default=None, repr=False)

    def public(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "jobId": self.id,
            "status": self.status,
            "step": self.step,
            "progress": self.progress,
        }
        if self.completed_id:
            body["observationId"] = self.completed_id
        if self.error:
            body["error"] = self.error
        return body


def new_observation_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"obs-{stamp}-{uuid.uuid4().hex[:6]}"


class JobManager:
    def __init__(self, store: ObservationStore, settings: Settings):
        self.store = store
        self.settings = settings
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()
        self._queue: "queue.Queue[Optional[Job]]" = queue.Queue(maxsize=settings.max_queued_jobs)
        self._worker: Optional[threading.Thread] = None

    # -- lifecycle -------------------------------------------------------------------------------

    def start(self) -> None:
        self._worker = threading.Thread(target=self._loop, name="analysis-worker", daemon=True)
        self._worker.start()

    def stop(self) -> None:
        if self._worker and self._worker.is_alive():
            try:
                self._queue.put(None, timeout=1)
            except queue.Full:
                pass
            self._worker.join(timeout=5)

    # -- public ------------------------------------------------------------------------------------

    def submit(self, job: Job) -> Job:
        with self._lock:
            self._jobs[job.id] = job
        try:
            self._queue.put_nowait(job)
        except queue.Full:
            with self._lock:
                del self._jobs[job.id]
            raise ApiError(
                503,
                "QUEUE_FULL",
                "The service is busy with other images. Try again in a minute.",
                recoverable=True,
            )
        log.info("Job %s queued for %s", job.id, job.file_path.name)
        return job

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            job = self._jobs.get(job_id)
            return job.public() if job else None

    # -- worker ------------------------------------------------------------------------------------

    def _set(self, job: Job, **changes: Any) -> None:
        with self._lock:
            for key, value in changes.items():
                setattr(job, key, value)

    def _hold_stage(self, job: Job) -> None:
        """With DEMO_MIN_STAGE_SECONDS set, keep the current stage visible for at least that long."""
        minimum = self.settings.demo_min_stage_seconds
        if minimum and job.stage_started is not None:
            remaining = minimum - (time.monotonic() - job.stage_started)
            if remaining > 0:
                time.sleep(remaining)

    def _loop(self) -> None:
        while True:
            job = self._queue.get()
            if job is None:
                return
            token = request_id_var.set(job.request_id or job.id)
            try:
                self._run(job)
            finally:
                request_id_var.reset(token)
                shutil.rmtree(job.file_path.parent, ignore_errors=True)

    def _run(self, job: Job) -> None:
        def on_stage(stage: str) -> None:
            self._hold_stage(job)
            self._set(job, status="running", step=stage, progress=STEP_START[stage])
            job.stage_started = time.monotonic()
            log.info("Job %s: %s", job.id, stage)

        started = time.perf_counter()
        try:
            result = pipeline.run_pipeline(
                job.file_path,
                source=job.source,
                region=job.region,
                captured_at=job.captured_at,
                observation_id=job.observation_id,
                on_stage=on_stage,
            )
            self._set(job, progress=90)
            self.store.save(job.observation_id, lambda folder: pipeline.write_outputs(result, folder))
            self._hold_stage(job)
            self._set(job, status="completed", progress=100, completed_id=job.observation_id)
            log.info(
                "Job %s completed as %s in %.2f s",
                job.id,
                job.observation_id,
                time.perf_counter() - started,
            )
        except PipelineError as error:
            log.info("Job %s refused: %s", job.id, error.code)
            self._set(job, status="failed", error={**error.to_dict(), "recoverable": True})
        except Exception:  # noqa: BLE001 - any model failure becomes a typed, recoverable error
            log.exception("Job %s failed", job.id)
            self._set(
                job,
                status="failed",
                error={"code": "MODEL_FAILURE", "message": MODEL_FAILURE_MESSAGE, "recoverable": True},
            )
