"""
A.W.A.R.E. API (AI Waste Analysis & Reconnaissance Engine): a FastAPI service around
backend/pipeline.py.
The contract is documented in docs/BACKEND_CONTRACT.md.

    uvicorn backend.app.main:app --port 8000      (from the repository root)
"""
import logging
import re
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import quote

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend import pipeline
from backend.pipeline import PipelineError

from .config import Settings
from .errors import ApiError, not_found, validation_error
from .jobs import Job, JobManager, new_observation_id
from .logging_setup import configure_logging, request_id_var
from .store import FILE_NAMES, ObservationStore, StoredObservation

log = logging.getLogger("backend.api")

ACCEPTED_EXTENSIONS = (".tif", ".tiff")
# Browsers often send no type, or a generic one, for TIFF files; anything else is refused.
ACCEPTED_CONTENT_TYPES = ("image/tiff", "image/tif", "image/geotiff", "application/octet-stream", "")
CHUNK_BYTES = 1024 * 1024


def _safe_file_name(name: str) -> str:
    """Keep the stem (MARIDA patch names are recognised by it), drop anything path-like."""
    base = Path(name.replace("\\", "/")).name
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", base).strip("._") or "upload.tif"
    return cleaned[:120]


def _iso_utc(value: str) -> str:
    """ISO 8601 with an explicit offset, as the frontend schema requires. Naive times are UTC."""
    text = value.strip()
    parsed = datetime.fromisoformat(text[:-1] + "+00:00" if text.endswith("Z") else text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _public(item: StoredObservation, base: str, with_detections: bool) -> Dict[str, Any]:
    """
    The stored observation with absolute file URLs. Summaries carry a detection count instead of
    the detections, and leave out the density grid (its cells list detection ids); they keep the
    density level and the hotspots.
    """
    observation = dict(item.observation)
    prefix = f"{base}/files/{quote(item.id, safe='')}/"
    preview = f"{prefix}preview.png" if item.has_file("preview.png") else ""
    observation["previewUrl"] = preview
    observation["imageUrl"] = preview
    for key, name in (
        ("maskUrl", "classes.png"),
        ("classMapUrl", "classes.png"),
        ("referenceUrl", "reference.png"),
        ("segmentationUrl", "segmentation.tif"),
        ("segmentationPreviewUrl", "segmentation.png"),
        ("sceneImageUrl", "scene.png"),
    ):
        if item.has_file(name):
            observation[key] = f"{prefix}{name}"
        else:
            observation.pop(key, None)
    if not with_detections:
        detections = observation.pop("detections", [])
        observation["detectionCount"] = len(detections)
        observation.pop("densityGrid", None)
    return observation


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    settings = settings or Settings.from_env()
    configure_logging()
    store = ObservationStore(settings.store_dir, settings.samples_dir)
    jobs = JobManager(store, settings)
    model_info: Dict[str, str] = {}

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        # Load the model once, before the first request, on CUDA when available.
        _, device, version = await run_in_threadpool(pipeline.load_model)
        model_info.update(modelName=pipeline.MODEL_NAME, modelVersion=version, device=str(device))
        log.info("Model %s loaded on %s", version, device)
        store.load(include_samples=settings.load_samples)
        jobs.start()
        yield
        jobs.stop()

    app = FastAPI(title="A.W.A.R.E. API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.store = store
    app.state.jobs = jobs

    @app.middleware("http")
    async def request_ids(request: Request, call_next):  # type: ignore[no-untyped-def]
        incoming = request.headers.get("X-Request-ID", "")
        request_id = incoming if re.fullmatch(r"[A-Za-z0-9._-]{1,64}", incoming) else uuid.uuid4().hex[:12]
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            log.info(
                "%s %s %s %.0f ms",
                request.method,
                request.url.path,
                response.status_code,
                (time.perf_counter() - started) * 1000,
            )
            return response
        finally:
            request_id_var.reset(token)

    # Added last, so it wraps everything above, error responses included.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    def error_response(error: ApiError) -> JSONResponse:
        return JSONResponse(error.body(request_id_var.get()), status_code=error.status)

    @app.exception_handler(ApiError)
    async def on_api_error(_: Request, error: ApiError) -> JSONResponse:
        return error_response(error)

    @app.exception_handler(RequestValidationError)
    async def on_invalid_request(_: Request, error: RequestValidationError) -> JSONResponse:
        fields = ", ".join(".".join(str(p) for p in e.get("loc", ())[1:]) for e in error.errors())
        return error_response(
            validation_error("INVALID_REQUEST", f"The request is missing or has invalid fields: {fields}.")
        )

    @app.exception_handler(StarletteHTTPException)
    async def on_http_error(_: Request, error: StarletteHTTPException) -> JSONResponse:
        if error.status_code == 404:
            return error_response(ApiError(404, "NOT_FOUND", "There is nothing at this address.", False))
        return error_response(ApiError(error.status_code, "BAD_REQUEST", str(error.detail), False))

    @app.exception_handler(Exception)
    async def on_unexpected(_: Request, error: Exception) -> JSONResponse:
        log.exception("Unhandled error")  # the trace stays in the server log
        return error_response(
            ApiError(500, "SERVER_ERROR", "Something went wrong on the server. Try again.", True)
        )

    def base_url(request: Request) -> str:
        return (settings.public_base_url or str(request.base_url)).rstrip("/")

    # -- routes ------------------------------------------------------------------------------------

    @app.get("/health")
    def health() -> Dict[str, Any]:
        # `status` per docs/BACKEND_CONTRACT.md; `ok` is what the frontend's health check reads.
        return {"status": "ok", "ok": True, **model_info}

    @app.get("/api/observations")
    def list_observations(request: Request) -> Any:
        base = base_url(request)
        return [_public(item, base, with_detections=False) for item in store.all_newest_first()]

    @app.get("/api/observations/{observation_id}")
    def get_observation(observation_id: str, request: Request) -> Any:
        item = store.get(observation_id)
        if not item:
            raise not_found("Observation", observation_id)
        return _public(item, base_url(request), with_detections=True)

    @app.post("/api/observations", status_code=202)
    async def create_observation(
        request: Request,
        file: UploadFile = File(...),
        source: str = Form("satellite"),
        region: Optional[str] = Form(None),
        capturedAt: Optional[str] = Form(None),  # noqa: N803 - the contract's field name
    ) -> Any:
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > settings.max_upload_bytes + CHUNK_BYTES:
            raise _too_large(settings)
        name = _safe_file_name(file.filename or "")
        content_type = (file.content_type or "").split(";")[0].strip().lower()
        if not name.lower().endswith(ACCEPTED_EXTENSIONS) or content_type not in ACCEPTED_CONTENT_TYPES:
            raise validation_error(
                "UNSUPPORTED_FILE",
                "Only 11-band Sentinel-2 GeoTIFF files (.tif) can be analysed. Choose a GeoTIFF and try again.",
            )
        if source != "satellite":
            raise validation_error(
                "UNSUPPORTED_SOURCE",
                "The current model reads Sentinel-2 satellite images only; drone imagery is not supported.",
            )
        captured_at = None
        if capturedAt:
            try:
                captured_at = _iso_utc(capturedAt)
            except ValueError:
                raise validation_error(
                    "INVALID_REQUEST", "capturedAt must be an ISO 8601 date and time, for example 2020-12-22T15:30:00Z."
                ) from None

        job_id = f"job-{uuid.uuid4().hex[:12]}"
        incoming = settings.store_dir / "_incoming" / job_id
        incoming.mkdir(parents=True, exist_ok=True)
        path = incoming / name
        try:
            size = 0
            with open(path, "wb") as out:
                while True:
                    chunk = await file.read(CHUNK_BYTES)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > settings.max_upload_bytes:
                        raise _too_large(settings)
                    out.write(chunk)
            if size == 0:
                raise validation_error("UNREADABLE", "The file is empty. Choose the image again.")
            # Refuse bad files now, while the person is still on the form, not halfway through a job.
            try:
                await run_in_threadpool(pipeline.read_scene, path)
            except PipelineError as error:
                raise validation_error(error.code, error.message) from None
            job = Job(
                id=job_id,
                observation_id=new_observation_id(),
                file_path=path,
                source=source,
                region=region.strip() if region and region.strip() else None,
                captured_at=captured_at,
                request_id=request_id_var.get(),
            )
            jobs.submit(job)
        except Exception:
            shutil.rmtree(incoming, ignore_errors=True)
            raise
        return {"jobId": job_id}

    @app.get("/api/jobs/{job_id}")
    def get_job(job_id: str) -> Any:
        job = jobs.get(job_id)
        if not job:
            raise not_found("Analysis job", job_id)
        return job

    @app.get("/files/{observation_id}/{file_name}")
    def get_file(observation_id: str, file_name: str) -> FileResponse:
        item = store.get(observation_id)
        if not item or file_name not in FILE_NAMES or not item.has_file(file_name):
            raise not_found("File", f"{observation_id}/{file_name}")
        if file_name.endswith(".tif"):
            # Sent as an attachment named after the observation, ready to open in QGIS.
            return FileResponse(
                item.folder / file_name,
                media_type="image/tiff",
                filename=f"{observation_id}_{file_name}",
            )
        return FileResponse(item.folder / file_name, media_type="image/png")

    return app


def _too_large(settings: Settings) -> ApiError:
    return validation_error(
        "TOO_LARGE",
        f"The file is larger than {settings.max_upload_mb} MB. Crop the image to the area of interest and upload it again.",
    )


app = create_app()
