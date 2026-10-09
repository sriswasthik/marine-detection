import sys
import warnings
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

SAMPLE = REPO_ROOT / "semantic_segmentation" / "unet" / "sample_data" / "S2_9-10-17_16PEC_0.tif"


@pytest.fixture(scope="session")
def sample_path() -> Path:
    return SAMPLE


@pytest.fixture(scope="session")
def sample_result():
    from backend.pipeline import run_pipeline

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return run_pipeline(SAMPLE)
