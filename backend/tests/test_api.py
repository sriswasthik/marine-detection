"""API tests with FastAPI's TestClient, against a temporary store and the exported sample scenes."""
import time
import warnings
from pathlib import Path

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from rasterio.transform import Affine

from backend.app.config import Settings
from backend.app.main import create_app

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLE = REPO_ROOT / "semantic_segmentation" / "unet" / "sample_data" / "S2_9-10-17_16PEC_0.tif"
SAMPLES_DIR = REPO_ROOT / "frontend" / "public" / "samples"
ORIGIN = "http://localhost:5173"


@pytest.fixture()
def client(tmp_path):
    settings = Settings(
        store_dir=tmp_path / "store",
        samples_dir=SAMPLES_DIR if SAMPLES_DIR.is_dir() else None,
        cors_origins=(ORIGIN,),
        max_upload_mb=5,
        load_samples=True,
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client


def _geotiff(path, count, size=32):
    profile = {
        "driver": "GTiff",
        "width": size,
        "height": size,
        "count": count,
        "dtype": "float32",
        "crs": "EPSG:32616",
        "transform": Affine(10, 0, 500000, 0, -10, 1750000),
    }
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with rasterio.open(path, "w", **profile) as out:
            out.write(np.full((count, size, size), 0.05, dtype=np.float32))
    return path


def _upload(client, path, name=None, content_type="image/tiff", **fields):
    with open(path, "rb") as handle:
        return client.post(
            "/api/observations",
            files={"file": (name or Path(path).name, handle, content_type)},
            data={"source": "satellite", **fields},
        )


def _wait(client, job_id, timeout=60.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("completed", "failed"):
            return job
        time.sleep(0.1)
    raise AssertionError(f"Job {job_id} did not finish in {timeout} s")


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["ok"] is True
    assert body["modelName"] == "U-Net marine debris segmentation"
    assert len(body["modelVersion"]) == 12
    assert body["device"] in ("cpu", "cuda", "cuda:0")


def test_list_has_samples_newest_first_without_detections(client):
    if not SAMPLES_DIR.is_dir():
        pytest.skip("No exported samples")
    items = client.get("/api/observations").json()
    assert len(items) >= 1
    dates = [item["capturedAt"] for item in items]
    assert dates == sorted(dates, reverse=True)
    for item in items:
        assert "detections" not in item and item["detectionCount"] >= 0
        assert item["previewUrl"].startswith("http://testserver/files/")


def test_get_observation_with_file_urls(client):
    if not SAMPLES_DIR.is_dir():
        pytest.skip("No exported samples")
    body = client.get("/api/observations/S2_22-12-20_18QYF_0").json()
    assert body["id"] == "S2_22-12-20_18QYF_0"
    assert body["detections"][0]["geometry"]["type"] in ("Polygon", "MultiPolygon")
    for key in ("previewUrl", "classMapUrl", "maskUrl", "referenceUrl"):
        url = body[key]
        assert url.startswith("http://testserver/files/S2_22-12-20_18QYF_0/")
        image = client.get(url.replace("http://testserver", ""))
        assert image.status_code == 200 and image.headers["content-type"] == "image/png"
        assert image.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_upload_job_result_flow(client, tmp_path):
    response = _upload(client, SAMPLE, region="La Ceiba coast", capturedAt="2017-10-09T16:20:00Z")
    assert response.status_code == 202
    job_id = response.json()["jobId"]
    job = _wait(client, job_id)
    assert job["status"] == "completed", job
    assert job["progress"] == 100 and job["step"] == "map"
    observation = client.get(f"/api/observations/{job['observationId']}").json()
    assert observation["region"] == "La Ceiba coast"
    assert observation["capturedAt"] == "2017-10-09T16:20:00.000Z"
    assert sum(d["sourcePixelCount"] for d in observation["detections"]) == 183
    assert observation["maridaPatch"]["id"] == "S2_9-10-17_16PEC_0"
    assert client.get(observation["previewUrl"].replace("http://testserver", "")).status_code == 200
    # The segmentation GeoTIFF downloads as an attachment named after the observation.
    tif = client.get(observation["segmentationUrl"].replace("http://testserver", ""))
    assert tif.status_code == 200 and tif.headers["content-type"] == "image/tiff"
    assert f'{job["observationId"]}_segmentation.tif' in tif.headers["content-disposition"]
    assert tif.content[:4] in (b"II*\x00", b"MM\x00*")
    for key in ("segmentationPreviewUrl", "sceneImageUrl"):
        image = client.get(observation[key].replace("http://testserver", ""))
        assert image.status_code == 200 and image.content[:4] == b"\x89PNG"
    assert observation["geospatial"]["debrisPixels"] == 183
    # Density and hotspots come from the service, keyed to this job's detection ids.
    assert observation["densityLevel"] == "moderate"
    assert all(d["densityLevel"] for d in observation["detections"])
    ids_in_cells = {i for c in observation["densityGrid"]["cells"] for i in c["detectionAreasM2"]}
    assert ids_in_cells == {d["id"] for d in observation["detections"]}
    assert all(i.startswith(job["observationId"]) for i in ids_in_cells)
    assert observation["hotspots"] and observation["hotspots"][0]["rank"] == 1
    summary = next(i for i in client.get("/api/observations").json() if i["id"] == job["observationId"])
    assert summary["densityLevel"] == "moderate" and "densityGrid" not in summary
    assert len(summary["hotspots"]) == len(observation["hotspots"])
    # Persisted atomically under the store, and listed.
    stored = tmp_path / "store" / job["observationId"] / "observation.json"
    assert stored.is_file()
    ids = [item["id"] for item in client.get("/api/observations").json()]
    assert job["observationId"] in ids
    # The upload's temporary copy is gone.
    assert not any((tmp_path / "store" / "_incoming").glob("*/*"))


def test_three_band_upload_is_invalid_bands(client, tmp_path):
    response = _upload(client, _geotiff(tmp_path / "rgb.tif", 3))
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "INVALID_BANDS" and error["recoverable"] is True
    assert "3 bands" in error["message"]


def test_non_geotiff_is_refused(client, tmp_path):
    png = tmp_path / "photo.png"
    png.write_bytes(b"\x89PNG\r\n\x1a\nnot really")
    response = _upload(client, png, content_type="image/png")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNSUPPORTED_FILE"
    fake = tmp_path / "fake.tif"
    fake.write_bytes(b"this is not a tiff")
    response = _upload(client, fake)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNREADABLE"


def test_too_large_upload(client, tmp_path):
    big = tmp_path / "big.tif"
    big.write_bytes(b"\0" * (5 * 1024 * 1024 + 1))
    response = _upload(client, big)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "TOO_LARGE"


def test_unknown_ids_return_typed_404(client):
    for path in ("/api/observations/nope", "/api/jobs/nope", "/files/nope/preview.png", "/no/such/route"):
        response = client.get(path)
        assert response.status_code == 404, path
        error = response.json()["error"]
        assert error["code"] == "NOT_FOUND" and error["recoverable"] is False
        assert error["requestId"] == response.headers["X-Request-ID"]


def test_cors_headers(client):
    response = client.get("/health", headers={"Origin": ORIGIN})
    assert response.headers["access-control-allow-origin"] == ORIGIN
    preflight = client.options(
        "/api/observations",
        headers={"Origin": ORIGIN, "Access-Control-Request-Method": "POST"},
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == ORIGIN
    other = client.get("/health", headers={"Origin": "https://elsewhere.example"})
    assert "access-control-allow-origin" not in other.headers


def test_request_id_is_echoed(client):
    response = client.get("/health", headers={"X-Request-ID": "demo-123"})
    assert response.headers["X-Request-ID"] == "demo-123"


def test_model_failure_is_typed_and_hides_the_trace(client, monkeypatch):
    from backend import pipeline

    def explode(*args, **kwargs):
        raise RuntimeError("CUDA out of memory at /secret/path.py:42")

    monkeypatch.setattr(pipeline, "run_pipeline", explode)
    job = _wait(client, _upload(client, SAMPLE).json()["jobId"])
    assert job["status"] == "failed"
    assert job["error"]["code"] == "MODEL_FAILURE" and job["error"]["recoverable"] is True
    assert "secret" not in job["error"]["message"] and "CUDA" not in job["error"]["message"]


def test_by_default_only_analysed_images_are_listed_and_they_survive_a_restart(tmp_path, monkeypatch):
    for name in ("LOAD_SAMPLES", "SAMPLES_DIR", "STORE_DIR"):
        monkeypatch.delenv(name, raising=False)
    defaults = Settings.from_env()
    assert defaults.load_samples is False
    settings = Settings(store_dir=tmp_path / "store", samples_dir=defaults.samples_dir, cors_origins=(ORIGIN,))
    with TestClient(create_app(settings)) as client:
        # The exported sample scenes exist on disk but are not listed.
        assert client.get("/api/observations").json() == []
        assert client.get("/api/observations/S2_22-12-20_18QYF_0").status_code == 404
        job = _wait(client, _upload(client, SAMPLE).json()["jobId"])
        assert job["status"] == "completed", job
        assert [o["id"] for o in client.get("/api/observations").json()] == [job["observationId"]]
    with TestClient(create_app(settings)) as client:
        assert [o["id"] for o in client.get("/api/observations").json()] == [job["observationId"]]


def test_demo_min_stage_seconds_makes_each_stage_visible(tmp_path):
    settings = Settings(
        store_dir=tmp_path / "store",
        samples_dir=None,
        cors_origins=(ORIGIN,),
        demo_min_stage_seconds=0.4,
    )
    with TestClient(create_app(settings)) as client:
        started = time.monotonic()
        job_id = _upload(client, SAMPLE).json()["jobId"]
        seen = []
        while True:
            job = client.get(f"/api/jobs/{job_id}").json()
            if not seen or seen[-1] != (job["step"], job["progress"]):
                seen.append((job["step"], job["progress"]))
            if job["status"] in ("completed", "failed"):
                break
            time.sleep(0.05)
        assert job["status"] == "completed"
        assert time.monotonic() - started >= 3 * 0.4
        steps = [step for step, _ in seen]
        for step in ("preprocess", "detect", "map"):
            assert step in steps
        progress = [p for _, p in seen]
        assert progress == sorted(progress) and progress[-1] == 100
