"""Service settings, read from environment variables once at startup."""
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent

# The deployed frontend's address is not decided yet; replace the placeholder via CORS_ORIGINS.
DEFAULT_CORS_ORIGINS = ("http://localhost:5173", "https://marine-waste-intelligence.vercel.app")


def _float_or_none(value: Optional[str]) -> Optional[float]:
    if value is None or value.strip() == "":
        return None
    number = float(value)
    return number if number > 0 else None


@dataclass
class Settings:
    """Everything configurable. `from_env` reads the environment; tests build one directly."""

    store_dir: Path = BACKEND_DIR / "store"
    samples_dir: Optional[Path] = REPO_ROOT / "frontend" / "public" / "samples"
    cors_origins: Tuple[str, ...] = DEFAULT_CORS_ORIGINS
    max_upload_mb: int = 100
    # Seconds each pipeline stage stays visible at least. Off unless set: inference on a 256 px
    # patch takes well under a second, and a demo stepper should not pretend otherwise by default.
    demo_min_stage_seconds: Optional[float] = None
    # Jobs waiting behind the one running; more are refused with QUEUE_FULL.
    max_queued_jobs: int = 8
    # Absolute base for file URLs in responses; default: the address the request came in on.
    public_base_url: Optional[str] = None
    # Off by default: the list holds only images analysed through this service (backend/store).
    # LOAD_SAMPLES=1 also lists the scenes exported to frontend/public/samples, read only.
    load_samples: bool = False

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @classmethod
    def from_env(cls) -> "Settings":
        env = os.environ
        origins = env.get("CORS_ORIGINS")
        samples = env.get("SAMPLES_DIR")
        return cls(
            store_dir=Path(env.get("STORE_DIR", str(BACKEND_DIR / "store"))),
            samples_dir=Path(samples) if samples else cls.samples_dir,
            cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip())
            if origins
            else DEFAULT_CORS_ORIGINS,
            max_upload_mb=int(env.get("MAX_UPLOAD_MB", "100")),
            demo_min_stage_seconds=_float_or_none(env.get("DEMO_MIN_STAGE_SECONDS")),
            max_queued_jobs=int(env.get("MAX_QUEUED_JOBS", "8")),
            public_base_url=env.get("PUBLIC_BASE_URL") or None,
            load_samples=env.get("LOAD_SAMPLES", "0") in ("1", "true", "True"),
        )
