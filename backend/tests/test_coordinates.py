"""
Coordinate accuracy on every image in semantic_segmentation/unet/sample_data, measured by
backend/coordinate_check.py with its own UTM code (not PROJ), the Sentinel-2 tile in each file
name and the MARIDA annotators' polygons. About 15 s on CPU.

The pipeline writes coordinates with 7 decimals (about 1.1 cm), so positions are held to 1 cm.
"""
import re
import warnings
from functools import lru_cache
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio import warp

from backend.coordinate_check import (
    build_mosaic,
    check_image,
    inside_named_tile,
    mgrs_tile,
    metres_between,
    sentinel2_tile_extent,
    utm_forward,
    utm_inverse,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_DATA = REPO_ROOT / "semantic_segmentation" / "unet" / "sample_data"
SAMPLES = sorted(SAMPLE_DATA.glob("*.tif"), key=lambda p: int(p.stem.rsplit("_", 1)[1]))

POSITION_M = 0.01  # vertices, centroids, cell edges: 7-decimal rounding is at most 0.77 cm
BOUNDS_SLACK_M = 0.02  # bounds are rounded outwards to 1e-7 degrees
GROUND_AREA_PCT = 0.1  # areaM2 is UTM grid area; ground area differs by the scale factor squared
OVERLAY_HIT = 0.99  # red PNG pixels that land on a debris pixel of the image
OVERLAY_COVER = 0.95  # debris pixels whose centre lands on a red PNG pixel (nearest resampling)


@lru_cache(maxsize=None)
def report_for(name):
    return check_image(SAMPLE_DATA / name)


# --- The reference code itself --------------------------------------------------------------------


def test_independent_utm_matches_proj_to_a_micrometre():
    rng = np.random.default_rng(0)
    lng, lat = rng.uniform(-90.5, -83.5, 5000), rng.uniform(0.5, 60, 5000)
    x, y, _ = utm_forward(lng, lat, 16)
    px, py = warp.transform("EPSG:4326", "EPSG:32616", lng.tolist(), lat.tolist())
    assert np.max(np.hypot(x - px, y - py)) < 1e-6
    back_lng, back_lat = utm_inverse(x, y, 16)
    assert np.max(metres_between(lng, lat, back_lng, back_lat)) < 1e-6
    # Southern hemisphere (false northing 10,000 km).
    lng, lat = rng.uniform(102, 108, 500), rng.uniform(-30, -0.5, 500)
    x, y, _ = utm_forward(lng, lat, 48, north=False)
    px, py = warp.transform("EPSG:4326", "EPSG:32748", lng.tolist(), lat.tolist())
    assert np.max(np.hypot(x - px, y - py)) < 1e-6


def test_utm_fixed_points():
    x, y, k = utm_forward(-87.0, 0.0, 16)  # zone 16's central meridian on the equator
    assert (float(x), float(y), float(k)) == pytest.approx((500000.0, 0.0, 0.9996), abs=1e-9)


def test_mgrs_letters_and_sentinel2_tile_extent():
    assert mgrs_tile(513480, 1751580, 16, 15.83) == "16PEC"
    assert mgrs_tile(513480, 1774620, 16, 16.04) == "16QEC"  # north of 16 N: band Q, same square
    assert sentinel2_tile_extent("16PEC") == (16, 500000.0, 609800.0, 1690200.0, 1800000.0)
    assert sentinel2_tile_extent("48MYU") == (48, 700000.0, 809800.0, 9290200.0, 9400000.0)


def test_every_marida_patch_lies_in_its_named_tile():
    patches = [p for p in (REPO_ROOT / "data" / "patches").glob("*/*.tif") if not re.search(r"_(cl|conf)$", p.stem)]
    if not patches:
        pytest.skip("MARIDA patches are not present")
    outside = []
    for tif in patches:
        with rasterio.open(tif) as ds:
            if not inside_named_tile(tif.stem.split("_")[2], ds.crs, tuple(ds.bounds)):
                outside.append(tif.name)
    assert outside == [], f"{len(outside)} of {len(patches)} patches"


# --- An image larger than one prediction window ---------------------------------------------------


def test_large_image_keeps_coordinates_and_overlay_alignment(tmp_path):
    """
    1,400 x 1,400 px of scene S2_14-9-18_16PCC (11 patches, no data between them): prediction runs
    in 1024 px windows and the overlay is warped over 14 km. Before the warp was made exact, 8% of
    the overlay's debris pixels sat one pixel off here.
    """
    if not (REPO_ROOT / "data" / "patches" / "S2_14-9-18_16PCC").is_dir():
        pytest.skip("MARIDA patches are not present")
    path = tmp_path / "mosaic.tif"
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        placed = build_mosaic("S2_14-9-18_16PCC", 365680.0, 1759040.0, path)
        r = check_image(path)
    assert len(placed) == 11
    assert r["outlinePixelsMatch"]
    assert max(r["vertexErrorM"], r["centroidErrorM"], r["cellBoundsErrorM"]) <= POSITION_M
    assert 0 <= r["boundsSlackM"][0] and r["boundsSlackM"][1] <= BOUNDS_SLACK_M
    assert r["overlayHitShare"] >= OVERLAY_HIT and r["overlayCoverShare"] >= OVERLAY_COVER


# --- Each sample image -----------------------------------------------------------------------------


@pytest.mark.parametrize("tif", SAMPLES, ids=[p.stem for p in SAMPLES])
def test_sample_image_coordinates(tif):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        r = report_for(tif.name)

    # Where: inside Sentinel-2 tile 16PEC, as the file name says, off La Ceiba, Honduras.
    assert r["tile"] == "16PEC" and r["insideNamedTile"], r["mgrsAtCentre"]
    lat, lng = r["centre"]
    assert 15.7 < lat < 16.2 and -87.0 < lng < -86.7
    assert r["projAgreementM"] < 1e-6

    # The bounds hold the whole image and are no larger than rounding.
    low, high = r["boundsSlackM"]
    assert 0 <= low and high <= BOUNDS_SLACK_M

    # Detections: on the pixel grid to the centimetre, covering exactly the model's debris pixels.
    assert r["outlinePixelsMatch"], r.get("outlineMismatches")
    assert r["vertexErrorM"] <= POSITION_M
    assert r["centroidErrorM"] <= POSITION_M
    assert r["groundAreaErrorPct"] <= GROUND_AREA_PCT

    # Density cells and hotspots.
    assert r["cellBoundsErrorM"] <= POSITION_M
    assert "cellAreaMismatches" not in r
    assert r["hotspotsInsideCells"]

    # Overlay image: drawn where the debris is.
    if r["overlayDebrisPixels"]:
        assert r["overlayHitShare"] >= OVERLAY_HIT
        assert r["overlayCoverShare"] >= OVERLAY_COVER

    # Human annotations: the label raster matches the annotators' polygons exactly, at no shift.
    annotations = r["annotations"]
    assert annotations["labelledPixels"] > 0
    assert annotations["agreement"] == 1.0
    assert annotations["bestShift"] == (0, 0) and annotations["nextBest"] < 1.0

    # The scene the frontend ships carries the same coordinates.
    if "shippedSampleMatches" in r:
        assert r["shippedSampleMatches"]
