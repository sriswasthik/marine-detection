"""
Backend unit & API tests for Phase 3 features:
- Analyst Review Store & Endpoints
- Monitoring Area Store & Endpoints
- Temporal Comparison Service & Endpoints
"""
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.config import Settings
from backend.app.review_store import ReviewStore
from backend.app.monitoring_store import MonitoringStore
from backend.app.comparison_service import compare_observations, evaluate_comparability


@pytest.fixture
def app_client(tmp_path):
    store_dir = tmp_path / "store"
    samples_dir = tmp_path / "samples"
    store_dir.mkdir(parents=True, exist_ok=True)
    samples_dir.mkdir(parents=True, exist_ok=True)

    settings = Settings(
        store_dir=store_dir,
        samples_dir=samples_dir,
        load_samples=False,
        max_upload_bytes=100 * 1024 * 1024,
    )
    app = create_app(settings)
    with TestClient(app) as client:
        yield client, store_dir


def test_review_store(tmp_path):
    file_path = tmp_path / "reviews.json"
    store = ReviewStore(file_path)

    # Initial state
    assert len(store.list_all_reviews()) == 0

    # Save review
    rec = store.save_review("obs-1", "det-1", "confirmed", notes="Verified plastic debris", reviewer_name="Analyst A")
    assert rec.status == "confirmed"
    assert rec.notes == "Verified plastic debris"

    # Reload store
    store2 = ReviewStore(file_path)
    rec2 = store2.get_review("obs-1", "det-1")
    assert rec2 is not None
    assert rec2.status == "confirmed"
    assert rec2.reviewer_name == "Analyst A"

    summary = store2.get_summary_counts("obs-1")
    assert summary["confirmed"] == 1
    assert summary["false_positive"] == 0


def test_monitoring_store(tmp_path):
    file_path = tmp_path / "monitoring_areas.json"
    store = MonitoringStore(file_path)

    geo = {
        "type": "Polygon",
        "coordinates": [[[10.0, 10.0], [11.0, 10.0], [11.0, 11.0], [10.0, 11.0], [10.0, 10.0]]],
    }

    area = store.create_area(name="Bay of Bengal AOI", geometry=geo, description="Coastal monitoring zone")
    assert area.name == "Bay of Bengal AOI"
    assert area.area_m2 > 0

    areas = store.list_areas()
    assert len(areas) == 1

    # Reload store
    store2 = MonitoringStore(file_path)
    area2 = store2.get_area(area.id)
    assert area2 is not None
    assert area2.name == "Bay of Bengal AOI"


def test_comparison_service():
    obs_a = {
        "id": "obs-a",
        "name": "Scene 2020-01-01",
        "capturedAt": "2020-01-01T12:00:00Z",
        "debrisAreaM2": 500.0,
        "bounds": {"north": 11.0, "south": 10.0, "east": 11.0, "west": 10.0},
        "resolutionM": 10.0,
        "detections": [
            {
                "id": "det-a1",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[10.1, 10.1], [10.2, 10.1], [10.2, 10.2], [10.1, 10.2], [10.1, 10.1]]],
                },
                "areaM2": 100.0,
                "confidence": 0.85,
            }
        ],
    }

    obs_b = {
        "id": "obs-b",
        "name": "Scene 2020-02-01",
        "capturedAt": "2020-02-01T12:00:00Z",
        "debrisAreaM2": 800.0,
        "bounds": {"north": 11.0, "south": 10.0, "east": 11.0, "west": 10.0},
        "resolutionM": 10.0,
        "detections": [
            {
                "id": "det-b1",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[10.1, 10.1], [10.2, 10.1], [10.2, 10.2], [10.1, 10.2], [10.1, 10.1]]],
                },
                "areaM2": 100.0,
                "confidence": 0.90,
            },
            {
                "id": "det-b2",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[10.5, 10.5], [10.6, 10.5], [10.6, 10.6], [10.5, 10.6], [10.5, 10.5]]],
                },
                "areaM2": 300.0,
                "confidence": 0.75,
            },
        ],
    }

    res = compare_observations(obs_a, obs_b)
    assert res["isComparable"] is True
    assert res["baselineAreaM2"] == 500.0
    assert res["comparisonAreaM2"] == 800.0
    assert res["absoluteChangeM2"] == 300.0
    assert res["percentChange"] == 60.0
    assert res["matchedDetectionsCount"] == 1
    assert res["comparisonOnlyCount"] == 1
    assert len(res["changeGeoJson"]["features"]) == 2
