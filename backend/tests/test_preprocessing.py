"""
Stage 1.4 Preprocessing consistency regression test.
Verifies that CanonicalScene preprocessing matches legacy Phase 1 pipeline preprocessing exactly within float tolerance.
"""
from pathlib import Path
import numpy as np
import pytest

import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine

from backend.adapters.geotiff import GeoTIFFAdapter
from backend.pipeline import read_scene, preprocess, bands_mean, bands_std


def test_preprocessing_consistency(tmp_path):
    """Compare CanonicalScene against legacy Phase 1 read_scene and preprocess."""
    tif_path = tmp_path / "test_sample.tif"
    height, width = 64, 64
    count = 11
    crs = CRS.from_epsg(32630)
    transform = Affine(10.0, 0.0, 500000.0, 0.0, -10.0, 2000000.0)

    np.random.seed(42)
    data = np.random.uniform(0.01, 0.5, (count, height, width)).astype(np.float32)
    # Inject NaN in some pixels
    data[:, 10, 10] = np.nan
    data[:, 20, 20] = np.nan

    with rasterio.open(
        tif_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=count,
        dtype="float32",
        crs=crs,
        transform=transform,
        nodata=np.nan,
    ) as dst:
        dst.write(data)

    # Legacy Phase 1 pipeline reading & preprocessing
    legacy_scene = read_scene(tif_path)
    legacy_std, legacy_mask = preprocess(legacy_scene.image)

    # Canonical Phase 2 adapter reading & preprocessing
    adapter = GeoTIFFAdapter()
    canonical_scene = adapter.read(tif_path)
    canonical_std, canonical_mask = preprocess(canonical_scene.image)

    # Numerical equivalence checks
    np.testing.assert_allclose(canonical_scene.image, legacy_scene.image, equal_nan=True, rtol=1e-5)
    np.testing.assert_allclose(canonical_std, legacy_std, rtol=1e-5)
    np.testing.assert_array_equal(canonical_mask, legacy_mask)

    # Check normalization formula explicitly
    # Standardized shape is (11, H, W)
    for b in range(11):
        expected_ch = (data[b] - bands_mean[b]) / bands_std[b]
        # NaN replaced by 0 (since mean - mean = 0)
        expected_ch[np.isnan(expected_ch)] = 0.0
        np.testing.assert_allclose(canonical_std[b], expected_ch, atol=1e-5)
