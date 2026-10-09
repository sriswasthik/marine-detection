"""Pipeline tests on the repository's own sample patch. CPU, well under a minute."""
import json
import os
import shutil
import subprocess
import warnings
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import Affine
from rasterio.windows import Window

from backend import pipeline
from backend.pipeline import PipelineError, preprocess, run_pipeline, write_outputs

REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND = REPO_ROOT / "frontend"


def run_quiet(path, **kwargs):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return run_pipeline(path, **kwargs)


def rings(geometry):
    if geometry["type"] == "Polygon":
        return list(geometry["coordinates"])
    return [ring for polygon in geometry["coordinates"] for ring in polygon]


def exteriors(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"][0]]
    return [polygon[0] for polygon in geometry["coordinates"]]


def signed_area(ring):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:])) / 2


# --- Inputs and preprocessing -----------------------------------------------------------------


def test_band_statistics_are_imported_from_dataloader_not_copied():
    import dataloader

    assert pipeline.bands_mean is dataloader.bands_mean
    assert pipeline.bands_std is dataloader.bands_std
    source = Path(pipeline.__file__).read_text(encoding="utf-8")
    for value in list(dataloader.bands_mean) + list(dataloader.bands_std):
        assert f"{value:.6f}"[:8] not in source


def test_preprocessing_matches_app_py():
    rng = np.random.default_rng(0)
    image = rng.uniform(0, 0.2, size=(11, 32, 32)).astype(np.float32)
    image[:, 3, 4] = np.nan  # a fully missing pixel
    image[2, 5, 6] = np.nan  # one missing band
    standardised, valid = preprocess(image)
    mean = pipeline.bands_mean[:, None, None]
    std = pipeline.bands_std[:, None, None]
    expected = (np.where(np.isnan(image), np.tile(mean, (1, 32, 32)), image) - mean) / std
    np.testing.assert_allclose(standardised, expected, rtol=1e-6)
    assert standardised[:, 3, 4] == pytest.approx(np.zeros(11), abs=1e-6)
    assert not valid[3, 4] and valid[5, 6]


def test_class_map_and_softmax(sample_result):
    assert sample_result.class_map.shape == (256, 256)
    assert set(np.unique(sample_result.class_map)) <= set(range(1, 12))
    np.testing.assert_allclose(sample_result.probabilities.sum(axis=0), 1.0, atol=1e-4)


# --- Detections ---------------------------------------------------------------------------------


def test_geojson_rings_are_closed_and_lng_lat(sample_result):
    observation = sample_result.observation
    bounds = observation["bounds"]
    assert observation["detections"], "the sample patch has predicted debris"
    eps = 1e-6
    for detection in observation["detections"]:
        geometry = detection["geometry"]
        assert geometry["type"] in ("Polygon", "MultiPolygon")
        for ring in rings(geometry):
            assert len(ring) >= 4
            assert ring[0] == ring[-1]
            for lng, lat in ring:
                # [lng, lat]: the sample lies near 86.86 W, 15.83 N, so the order is unambiguous.
                assert bounds["west"] - eps <= lng <= bounds["east"] + eps
                assert bounds["south"] - eps <= lat <= bounds["north"] + eps
        for ring in exteriors(geometry):
            assert signed_area(ring) > 0, "exterior rings are counter-clockwise (RFC 7946)"
        centroid = detection["centroid"]
        assert bounds["south"] <= centroid["lat"] <= bounds["north"]
        assert bounds["west"] <= centroid["lng"] <= bounds["east"]


def test_area_is_pixel_count_times_100_at_10_m(sample_result):
    observation = sample_result.observation
    assert observation["resolutionM"] == 10
    for detection in observation["detections"]:
        assert detection["areaM2"] == pytest.approx(detection["sourcePixelCount"] * 100)
    total = sum(d["sourcePixelCount"] for d in observation["detections"])
    assert total == int((sample_result.class_map == 1).sum())
    assert observation["debrisAreaM2"] == pytest.approx(total * 100)


def test_confidence_is_mean_debris_probability(sample_result):
    observation = sample_result.observation
    detections = observation["detections"]
    for detection in detections:
        assert 0 <= detection["confidence"] <= 1
    weighted = sum(d["confidence"] * d["sourcePixelCount"] for d in detections) / sum(
        d["sourcePixelCount"] for d in detections
    )
    assert observation["averageConfidence"] == pytest.approx(weighted, abs=1e-4)
    debris_probability = sample_result.probabilities[0][sample_result.class_map == 1]
    assert observation["averageConfidence"] == pytest.approx(float(debris_probability.mean()), abs=1e-3)


def test_ids_are_stable_and_sorted_by_size(sample_result):
    detections = sample_result.observation["detections"]
    assert detections[0]["id"] == "S2_9-10-17_16PEC_0-d001"
    sizes = [d["sourcePixelCount"] for d in detections]
    assert sizes == sorted(sizes, reverse=True)
    assert len({d["id"] for d in detections}) == len(detections)


def test_min_pixels_drops_small_regions(sample_path):
    observation = run_quiet(sample_path, min_pixels=5).observation
    assert observation["detections"]
    assert all(d["sourcePixelCount"] >= 5 for d in observation["detections"])


# --- Observation ----------------------------------------------------------------------------------


def test_observation_fields(sample_result):
    o = sample_result.observation
    assert o["crs"] == "EPSG:32616"
    assert o["status"] == "completed"
    assert o["densityLevel"] in pipeline.DENSITY_LEVELS
    assert all(d["densityLevel"] in pipeline.DENSITY_LEVELS for d in o["detections"])
    assert o["capturedAt"] == "2017-10-09T12:00:00.000Z"
    assert o["region"] == "La Ceiba (16PEC)"
    assert o["name"] == "La Ceiba patch 0"
    assert o["suppressedRegions"] == [] and "STRIPE_ARTEFACT" not in o["warnings"]
    assert o["maridaPatch"] == {"id": "S2_9-10-17_16PEC_0", "tile": "16PEC", "date": "2017-10-09", "split": "train"}
    assert "Clouds" in o["waterAreaDefinition"]
    clouds = int((sample_result.class_map == 6).sum())
    assert o["waterAreaM2"] == pytest.approx((65536 - clouds) * 100)
    assert o["cloudCoveragePercent"] == pytest.approx(100 * clouds / 65536, abs=1e-3)
    assert set(o["processing"]["stagesMs"]) == {"preprocessMs", "detectMs", "mapMs"}
    assert len(o["processing"]["modelVersion"]) == 12
    assert o["modelMetrics"]["isPlaceholder"] is False
    assert o["referenceDebrisPixels"] == 0
    assert ("LOW_CONFIDENCE" in o["warnings"]) == (o["averageConfidence"] < pipeline.LOW_CONFIDENCE_THRESHOLD)


def test_deterministic(sample_path, sample_result):
    again = run_quiet(sample_path)
    np.testing.assert_array_equal(again.class_map, sample_result.class_map)
    assert again.observation["detections"] == sample_result.observation["detections"]
    assert again.observation["bounds"] == sample_result.observation["bounds"]


# --- Stripe artefacts -----------------------------------------------------------------------------


def test_is_stripe_only_flags_thin_grid_aligned_bands():
    assert pipeline.is_stripe(rows=6, cols=246, height=256, width=256)  # horizontal band
    assert pipeline.is_stripe(rows=200, cols=3, height=256, width=256)  # vertical band
    assert not pipeline.is_stripe(rows=6, cols=100, height=256, width=256)  # short
    assert not pipeline.is_stripe(rows=40, cols=240, height=256, width=256)  # diagonal streak
    assert not pipeline.is_stripe(rows=9, cols=256, height=256, width=256)  # too thick


def test_stripe_in_the_haiti_patch_is_set_aside_and_flagged():
    path = REPO_ROOT / "data" / "patches" / "S2_22-12-20_18QYF" / "S2_22-12-20_18QYF_0.tif"
    if not path.exists():
        pytest.skip("MARIDA patches are not present")
    result = run_quiet(path)
    o = result.observation
    assert "STRIPE_ARTEFACT" in o["warnings"]
    assert len(o["suppressedRegions"]) == 1
    stripe = o["suppressedRegions"][0]
    assert stripe["reason"] == "stripe" and stripe["rowSpan"] <= 8 and stripe["colSpan"] > 128
    assert stripe["areaM2"] == pytest.approx(stripe["pixels"] * 100)
    kept = sum(d["sourcePixelCount"] for d in o["detections"])
    assert kept + stripe["pixels"] == int((result.class_map == 1).sum())
    assert o["debrisAreaM2"] == pytest.approx(kept * 100)
    assert o["name"] == "Haiti patch 0"


# --- Sizes: padding and windows -----------------------------------------------------------------


def test_250_px_crop_is_padded_and_cropped_back(sample_path, sample_result, tmp_path):
    crop = tmp_path / "S2_crop_250.tif"
    with rasterio.open(sample_path) as ds:
        window = Window(3, 3, 250, 250)
        profile = ds.profile.copy()
        profile.update(width=250, height=250, transform=ds.window_transform(window))
        with rasterio.open(crop, "w", **profile) as out:
            out.write(ds.read(window=window))
    result = run_quiet(crop)
    assert result.class_map.shape == (250, 250)
    # Not a MARIDA patch name, so the region comes from the image centre.
    assert result.observation["region"] == "Near 15.83° N 86.86° W"
    assert result.probabilities.shape == (11, 250, 250)
    agreement = (result.class_map == sample_result.class_map[3:253, 3:253]).mean()
    assert agreement > 0.9


def test_windowed_prediction_blends_to_the_full_result(sample_path, sample_result):
    tiled = run_quiet(sample_path, tile_size=128, tile_overlap=32)
    np.testing.assert_allclose(tiled.probabilities.sum(axis=0), 1.0, atol=1e-4)
    assert (tiled.class_map == sample_result.class_map).mean() > 0.95


# --- Errors ---------------------------------------------------------------------------------------


def _write(path, count, georeferenced=True, size=32):
    profile = {"driver": "GTiff", "width": size, "height": size, "count": count, "dtype": "float32"}
    if georeferenced:
        profile.update(crs="EPSG:32616", transform=Affine(10, 0, 500000, 0, -10, 1750000))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with rasterio.open(path, "w", **profile) as out:
            out.write(np.full((count, size, size), 0.05, dtype=np.float32))
    return path


def test_three_band_file_is_invalid_bands(tmp_path):
    with pytest.raises(PipelineError) as error:
        run_quiet(_write(tmp_path / "rgb.tif", 3))
    assert error.value.code == "INVALID_BANDS"
    assert "3 bands" in error.value.message


def test_file_without_georeferencing_is_no_georef(tmp_path):
    with pytest.raises(PipelineError) as error:
        run_quiet(_write(tmp_path / "plain.tif", 11, georeferenced=False))
    assert error.value.code == "NO_GEOREF"


def test_unreadable_and_missing_files(tmp_path):
    junk = tmp_path / "junk.tif"
    junk.write_bytes(b"not a tiff")
    for path in (junk, tmp_path / "missing.tif"):
        with pytest.raises(PipelineError) as error:
            run_quiet(path)
        assert error.value.code == "UNREADABLE"


def test_too_large(tmp_path, monkeypatch):
    path = _write(tmp_path / "big.tif", 11)
    monkeypatch.setattr(pipeline, "MAX_FILE_BYTES", 100)
    with pytest.raises(PipelineError) as error:
        run_quiet(path)
    assert error.value.code == "TOO_LARGE"


# --- Outputs ----------------------------------------------------------------------------------------


def test_write_outputs(sample_result, tmp_path):
    from PIL import Image

    observation = write_outputs(sample_result, tmp_path, url_prefix="/samples/x/")
    assert observation["previewUrl"] == "/samples/x/preview.png"
    for name in ("observation.json", "preview.png", "classes.png", "reference.png"):
        assert (tmp_path / name).exists()
    preview = np.array(Image.open(tmp_path / "preview.png"))
    classes = np.array(Image.open(tmp_path / "classes.png"))
    reference = np.array(Image.open(tmp_path / "reference.png"))
    assert preview.shape[2] == classes.shape[2] == 4
    assert preview.shape == classes.shape == reference.shape
    assert (reference[..., 3] > 0).sum() == 0  # no reference debris in this patch
    drawn = int(np.isin(sample_result.class_map, [1, 2, 3, 4, 5, 6, 9]).sum())
    assert abs(int((classes[..., 3] > 0).sum()) - drawn) <= 0.05 * drawn  # water stays transparent
    palette = {entry["id"]: entry for entry in observation["classPalette"]}
    assert all(not palette[c]["drawn"] for c in (7, 8, 10, 11))
    assert palette[1]["color"] == "#C4503A"
    assert json.loads((tmp_path / "observation.json").read_text())["id"] == "S2_9-10-17_16PEC_0"


def test_geospatial_summary(sample_result):
    geo = sample_result.observation["geospatial"]
    assert (geo["width"], geo["height"], geo["bandCount"], geo["dataType"]) == (256, 256, 11, "float32")
    assert geo["crs"] == "EPSG:32616" and geo["crsName"] == "WGS 84 / UTM zone 16N"
    assert (geo["pixelSizeX"], geo["pixelSizeY"], geo["pixelSizeUnit"]) == (10.0, 10.0, "m")
    assert geo["pixelAreaM2"] == 100.0
    assert geo["totalPixels"] == 65536 and geo["sceneAreaM2"] == 6553600.0
    # Debris pixels are the kept detections' pixels, so area and coverage agree with them.
    detections = sample_result.observation["detections"]
    assert geo["debrisPixels"] == sum(d["sourcePixelCount"] for d in detections) == 183
    assert geo["debrisAreaM2"] == sample_result.observation["debrisAreaM2"] == 18300.0
    assert geo["debrisCoveragePercent"] == pytest.approx(100 * 18300 / 6553600, abs=1e-6)
    # The debris centroid is the mean of the debris pixel centres, inside the image bounds.
    rows, cols = np.nonzero(sample_result.class_map == 1)
    x, y = rasterio.transform.xy(sample_result.scene.transform, rows.mean(), cols.mean(), offset="center")
    lng, lat = pipeline._to_wgs84_point(sample_result.scene.crs, x, y)
    assert geo["debrisCentroid"] == {"lat": pytest.approx(lat, abs=1e-7), "lng": pytest.approx(lng, abs=1e-7)}
    bounds = sample_result.observation["bounds"]
    for point in (geo["debrisCentroid"], geo["sceneCentre"]):
        assert bounds["south"] < point["lat"] < bounds["north"]
        assert bounds["west"] < point["lng"] < bounds["east"]


def test_segmentation_geotiff_matches_the_class_map_and_source_grid(sample_result, sample_path, tmp_path):
    from PIL import Image

    observation = write_outputs(sample_result, tmp_path, url_prefix="/samples/x/")
    assert observation["segmentationUrl"] == "/samples/x/segmentation.tif"
    assert observation["segmentationPreviewUrl"] == "/samples/x/segmentation.png"
    assert observation["sceneImageUrl"] == "/samples/x/scene.png"
    with rasterio.open(tmp_path / "segmentation.tif") as out, rasterio.open(sample_path) as source:
        assert (out.count, out.dtypes[0], out.nodata) == (1, "uint8", 0)
        assert out.crs == source.crs and out.transform == source.transform
        assert (out.width, out.height) == (source.width, source.height)
        assert np.array_equal(out.read(1), sample_result.class_map)
        assert out.colormap(1)[1] == (255, 0, 0, 255)  # Marine Debris red, as in the QGIS style
        assert out.tags(1)["CLASS_1"] == "Marine Debris"
    mask = np.array(Image.open(tmp_path / "segmentation.png"))
    scene = np.array(Image.open(tmp_path / "scene.png"))
    assert mask.shape == scene.shape == (256, 256, 4)
    assert np.array_equal(np.all(mask[..., :3] == (255, 0, 0), axis=-1), sample_result.class_map == 1)


def test_qgis_palette_comes_from_the_shipped_style():
    palette = pipeline.qgis_palette()
    assert sorted(palette) == list(range(1, 12))
    assert palette[1] == ("Marine Debris", "#ff0000")
    assert palette[7] == ("Marine Water", "#000080")


def test_exported_json_passes_the_frontend_zod_schema(sample_result, tmp_path):
    npx = shutil.which("npx")
    if npx is None or not (FRONTEND / "node_modules").exists():
        pytest.skip("Node and the frontend dependencies are needed for the schema check")
    write_outputs(sample_result, tmp_path, url_prefix="/samples/x/")
    env = {**os.environ, "OBSERVATION_JSON": str(tmp_path / "observation.json")}
    completed = subprocess.run(
        [npx, "vitest", "run", "src/features/observations/realSamples.test.ts"],
        cwd=FRONTEND,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert completed.returncode == 0, completed.stdout[-2000:] + completed.stderr[-2000:]
