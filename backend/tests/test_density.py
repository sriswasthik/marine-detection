"""Density grid and hotspots (backend/pipeline.py, section 5): synthetic rasters and real patches."""
import warnings
from pathlib import Path

import numpy as np
import pytest
from rasterio.crs import CRS
from rasterio.transform import Affine

from backend import pipeline
from backend.pipeline import Scene, compute_density, find_hotspots, level_for_coverage, run_pipeline

REPO_ROOT = Path(__file__).resolve().parents[2]
HAITI = REPO_ROOT / "data" / "patches" / "S2_22-12-20_18QYF" / "S2_22-12-20_18QYF_0.tif"


def scene(height=100, width=100):
    """A 10 m UTM zone 16N grid near the samples, north up."""
    transform = Affine(10, 0, 500000, 0, -10, 1750000)
    image = np.zeros((11, height, width), dtype=np.float32)
    return Scene(Path("synthetic.tif"), image, CRS.from_epsg(32616), transform, width, height)


def detection(n, confidence=0.5):
    return {"id": f"x-d{n:03d}", "confidence": confidence, "densityLevel": None}


def density(raster, detections, valid=None):
    valid = np.ones(raster.shape, dtype=bool) if valid is None else valid
    s = scene(*raster.shape)
    return compute_density(raster, valid, detections, s, pixel_area_m2=100.0, resolution_m=10.0)


# --- Levels ---------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "coverage, level",
    [(0.01, "low"), (1.999, "low"), (2, "moderate"), (7.99, "moderate"), (8, "high"), (19.9, "high"), (20, "critical"), (100, "critical")],
)
def test_level_thresholds(coverage, level):
    assert level_for_coverage(coverage) == level


# --- Grid on synthetic rasters --------------------------------------------------------------------


def test_grid_layout_rows_count_from_the_south():
    raster = np.zeros((100, 100), dtype=np.int32)
    raster[0:5, 0:5] = 1  # 25 px in the north-west block
    grid, _, level = density(raster, [detection(1)])
    assert (grid["rows"], grid["cols"], grid["cellSizeM"], grid["cellSizePx"]) == (4, 4, 250, 25)
    (cell,) = grid["cells"]
    assert (cell["id"], cell["row"], cell["col"]) == ("r3c0", 3, 0)
    assert cell["areaM2"] == 62500 and cell["debrisAreaM2"] == 2500
    assert cell["coveragePercent"] == 4.0 and cell["level"] == "moderate" and level == "moderate"
    # The block's bounds hold the debris pixels' corner, reprojected to WGS84.
    b = cell["bounds"]
    assert b["south"] < b["north"] and b["west"] < b["east"]
    assert b["north"] - b["south"] == pytest.approx(250 / 111_000, rel=0.02)


def test_coverage_is_relative_to_imaged_pixels_and_edge_blocks():
    raster = np.zeros((60, 60), dtype=np.int32)  # blocks of 25, 25 and 10 px
    raster[55:60, 55:60] = 1  # 25 px in the 10 x 10 south-east corner block
    grid, _, _ = density(raster, [detection(1)])
    (cell,) = grid["cells"]
    assert cell["id"] == "r0c2" and cell["areaM2"] == 10000
    assert cell["coveragePercent"] == 25.0 and cell["level"] == "critical"

    valid = np.ones((60, 60), dtype=bool)
    valid[50:55, 50:60] = False  # half the corner block has no data
    grid, _, _ = density(raster, [detection(1)], valid)
    assert grid["cells"][0]["areaM2"] == 5000 and grid["cells"][0]["coveragePercent"] == 50.0


def test_detection_split_between_cells_takes_the_level_of_its_largest_share():
    raster = np.zeros((50, 50), dtype=np.int32)
    raster[0:2, 15:25] = 1  # 20 px in block r1c0 (north-west): 3.2 %, moderate
    raster[0:2, 25:28] = 1  # 6 px in block r1c1
    raster[10:21, 30:50] = 2  # 220 px in block r1c1: with the 6 above, 36.16 %, critical
    detections = [detection(1, 0.4), detection(2, 0.8)]
    grid, hotspots, level = density(raster, detections)
    cells = {c["id"]: c for c in grid["cells"]}
    assert cells["r1c0"]["detectionAreasM2"] == {"x-d001": 2000}
    assert cells["r1c1"]["detectionAreasM2"] == {"x-d001": 600, "x-d002": 22000}
    assert cells["r1c0"]["level"] == "moderate" and cells["r1c1"]["level"] == "critical"
    # x-d001 has 20 px in r1c0 and 6 in r1c1, so it is Moderate even though r1c1 is Critical.
    assert [d["densityLevel"] for d in detections] == ["moderate", "critical"]
    assert level == "critical"
    # Only the Critical cell forms a hotspot; it touches both detections.
    (hotspot,) = hotspots
    assert hotspot["cellIds"] == ["r1c1"] and hotspot["detectionIds"] == ["x-d001", "x-d002"]
    assert hotspot["totalAreaM2"] == 22600 and hotspot["meanConfidence"] == pytest.approx(0.6)
    assert hotspot["priorityScore"] == pytest.approx(22600 * 0.6 * 4)


def test_no_debris_gives_an_empty_grid_no_level_and_no_hotspots():
    grid, hotspots, level = density(np.zeros((50, 50), dtype=np.int32), [])
    assert grid["cells"] == [] and hotspots == [] and level is None


# --- Hotspots -------------------------------------------------------------------------------------


def cell(row, col, level, area, ids):
    return {
        "id": f"r{row}c{col}",
        "row": row,
        "col": col,
        "bounds": {"south": row, "north": row + 1, "west": col, "east": col + 1},
        "level": level,
        "debrisAreaM2": area,
        "detectionAreasM2": {i: area / len(ids) for i in ids},
    }


def grid_of(*cells, cols=10):
    return {c["row"] * cols + c["col"]: c for c in cells}


def test_diagonal_cells_join_and_hotspots_rank_by_priority():
    cells = grid_of(
        cell(0, 0, "high", 1000, ["a"]),
        cell(1, 1, "critical", 1000, ["b"]),  # diagonal neighbour of r0c0
        cell(5, 5, "high", 9000, ["c"]),
        cell(3, 3, "moderate", 50000, ["d"]),  # not eligible while High cells exist
    )
    hotspots = find_hotspots(cells, rows=10, cols=10, confidences={"a": 0.5, "b": 1.0, "c": 0.5, "d": 1.0})
    assert [h["cellIds"] for h in hotspots] == [["r5c5"], ["r0c0", "r1c1"]]
    assert [h["id"] for h in hotspots] == ["hotspot-1", "hotspot-2"]
    joined = hotspots[1]
    assert joined["level"] == "critical" and joined["totalAreaM2"] == 2000
    assert joined["priorityScore"] == pytest.approx(2000 * 0.75 * 4)  # 6000 < 9000 * 0.5 * 3
    assert joined["bounds"] == {"north": 2, "south": 0, "east": 2, "west": 0}
    assert joined["centroid"] == {"lat": 1.0, "lng": 1.0}


def test_moderate_cells_form_hotspots_only_without_severe_ones_and_low_forms_none():
    moderate = grid_of(cell(0, 0, "moderate", 1500, ["a"]), cell(4, 4, "low", 100, ["b"]))
    (hotspot,) = find_hotspots(moderate, 10, 10, {"a": 0.5, "b": 0.5})
    assert hotspot["level"] == "moderate" and hotspot["cellIds"] == ["r0c0"]
    assert find_hotspots(grid_of(cell(0, 0, "low", 100, ["a"])), 10, 10, {"a": 0.5}) == []


# --- Real patches ---------------------------------------------------------------------------------


def check_consistency(observation):
    grid = observation["densityGrid"]
    detections = {d["id"]: d for d in observation["detections"]}
    cells = grid["cells"]
    assert grid["thresholds"] == pipeline.DENSITY_THRESHOLDS
    # Every debris pixel of a kept detection is in exactly one cell.
    assert sum(c["debrisAreaM2"] for c in cells) == pytest.approx(observation["debrisAreaM2"])
    per_detection = {}
    for c in cells:
        assert c["debrisAreaM2"] == pytest.approx(sum(c["detectionAreasM2"].values()))
        assert c["coveragePercent"] == pytest.approx(100 * c["debrisAreaM2"] / c["areaM2"], abs=1e-4)
        assert c["level"] == level_for_coverage(100 * c["debrisAreaM2"] / c["areaM2"])
        b, o = c["bounds"], observation["bounds"]
        assert o["south"] <= b["south"] < b["north"] <= o["north"]
        assert o["west"] <= b["west"] < b["east"] <= o["east"]
        for i, area in c["detectionAreasM2"].items():
            per_detection.setdefault(i, []).append((area, c))
    assert set(per_detection) == set(detections)
    for i, shares in per_detection.items():
        assert sum(a for a, _ in shares) == pytest.approx(detections[i]["areaM2"])
        largest = max(a for a, _ in shares)
        assert detections[i]["densityLevel"] in {c["level"] for a, c in shares if a == largest}
    levels = [c["level"] for c in cells]
    expected = max(levels, key=pipeline.DENSITY_LEVELS.index) if levels else None
    assert observation["densityLevel"] == expected
    scores = [h["priorityScore"] for h in observation["hotspots"]]
    assert scores == sorted(scores, reverse=True)
    assert [h["rank"] for h in observation["hotspots"]] == list(range(1, len(scores) + 1))


def test_sample_patch_density_is_consistent(sample_result):
    observation = sample_result.observation
    check_consistency(observation)
    assert observation["densityGrid"]["rows"] == observation["densityGrid"]["cols"] == 11
    assert observation["hotspots"], "the sample has Moderate cells, so it has hotspots"


def test_haiti_patch_has_high_hotspots_and_the_stripe_is_not_counted():
    if not HAITI.exists():
        pytest.skip("MARIDA patches are not present")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        result = run_pipeline(HAITI)
    observation = result.observation
    check_consistency(observation)
    assert observation["densityLevel"] == "high"
    assert {h["level"] for h in observation["hotspots"]} == {"high"}
    stripe = observation["suppressedRegions"][0]
    counted = sum(c["debrisAreaM2"] for c in observation["densityGrid"]["cells"])
    assert counted == pytest.approx(int((result.class_map == 1).sum()) * 100 - stripe["areaM2"])
