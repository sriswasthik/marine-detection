"""
Observations on disk: finished uploads under backend/store/<id>/, plus the real sample scenes
exported by backend/scripts/export_samples.py (read only). Each folder holds observation.json and
its PNGs. File URLs are stored as bare file names and made absolute when a response is built.
"""
import json
import logging
import os
import shutil
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

log = logging.getLogger("backend.store")

FILE_NAMES = (
    "preview.png",
    "classes.png",
    "reference.png",
    "segmentation.tif",
    "segmentation.png",
    "scene.png",
)


@dataclass
class StoredObservation:
    observation: Dict[str, Any]
    folder: Path
    origin: str  # "upload" or "sample"

    @property
    def id(self) -> str:
        return str(self.observation["id"])

    def has_file(self, name: str) -> bool:
        return name in FILE_NAMES and (self.folder / name).is_file()


def _read(folder: Path, origin: str) -> Optional[StoredObservation]:
    path = folder / "observation.json"
    try:
        observation = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        log.warning("Skipping %s: %s", path, error)
        return None
    if not isinstance(observation, dict) or not observation.get("id"):
        log.warning("Skipping %s: no observation id", path)
        return None
    return StoredObservation(observation, folder, origin)


def write_json_atomic(path: Path, data: Any) -> None:
    """Write to a temporary file in the same folder, then rename over the target."""
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    os.replace(temporary, path)


class ObservationStore:
    def __init__(self, store_dir: Path, samples_dir: Optional[Path] = None):
        self.store_dir = store_dir
        self.samples_dir = samples_dir
        self._items: Dict[str, StoredObservation] = {}
        self._lock = threading.Lock()

    def load(self, include_samples: bool = True) -> None:
        """Index every observation on disk. Uploads win over samples with the same id."""
        self.store_dir.mkdir(parents=True, exist_ok=True)
        found: Dict[str, StoredObservation] = {}
        if include_samples and self.samples_dir and self.samples_dir.is_dir():
            for folder in sorted(p for p in self.samples_dir.iterdir() if p.is_dir()):
                item = _read(folder, "sample")
                if item:
                    found[item.id] = item
        for folder in sorted(p for p in self.store_dir.iterdir() if p.is_dir()):
            if folder.name.startswith(".") or folder.name == "_incoming":
                continue
            item = _read(folder, "upload")
            if item:
                found[item.id] = item
        with self._lock:
            self._items = found
        log.info(
            "Loaded %d observations (%d samples)",
            len(found),
            sum(1 for i in found.values() if i.origin == "sample"),
        )

    def get(self, observation_id: str) -> Optional[StoredObservation]:
        with self._lock:
            return self._items.get(observation_id)

    def all_newest_first(self) -> List[StoredObservation]:
        with self._lock:
            items = list(self._items.values())
        return sorted(items, key=lambda i: str(i.observation.get("capturedAt", "")), reverse=True)

    def save(self, observation_id: str, write: Callable[[Path], Dict[str, Any]]) -> StoredObservation:
        """
        Atomic save: `write` fills a hidden staging folder, which is then renamed into place, so a
        crash never leaves a half-written observation that the next start would load.
        """
        target = self.store_dir / observation_id
        if target.exists():
            raise FileExistsError(f"Observation {observation_id} is already stored.")
        staging = self.store_dir / f".staging-{observation_id}-{uuid.uuid4().hex[:8]}"
        try:
            observation = write(staging)
            write_json_atomic(staging / "observation.json", observation)
            os.replace(staging, target)
        finally:
            if staging.exists():
                shutil.rmtree(staging, ignore_errors=True)
        item = StoredObservation(observation, target, "upload")
        with self._lock:
            self._items[observation_id] = item
        return item
