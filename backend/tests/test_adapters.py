"""
Tests for input adapters: GeoTIFF, Sentinel-2 SAFE, MultiBandRaster, and Adapter Registry.
"""
from pathlib import Path
import tempfile
import zipfile
import numpy as np
import pytest

import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine

from backend.adapters.base import CANONICAL_BANDS, CanonicalScene
from backend.adapters.geotiff import GeoTIFFAdapter
from backend.adapters.sentinel2_safe import Sentinel2SafeAdapter
from backend.adapters.multiband_raster import MultiBandRasterAdapter
from backend.adapters.registry import registry, AdapterRegistry


@pytest.fixture
def synthetic_11band_tif(tmp_path):
    """Create a small 11-band synthetic GeoTIFF."""
    tif_path = tmp_path / "synthetic_11band.tif"
    height, width = 64, 64
    count = 11
    crs = CRS.from_epsg(32630)
    transform = Affine(10.0, 0.0, 500000.0, 0.0, -10.0, 2000000.0)

    data = np.random.uniform(0.01, 0.5, (count, height, width)).astype(np.float32)
    # Put a NaN in pixel (0,0)
    data[:, 0, 0] = np.nan

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

    return tif_path


def test_geotiff_adapter_valid(synthetic_11band_tif):
    adapter = GeoTIFFAdapter()
    assert adapter.can_read(synthetic_11band_tif) is True

    val = adapter.inspect(synthetic_11band_tif)
    assert val.is_valid is True
    assert val.source_type == "geotiff"
    assert val.width == 64
    assert val.height == 64

    scene = adapter.read(synthetic_11band_tif)
    assert isinstance(scene, CanonicalScene)
    assert scene.image.shape == (11, 64, 64)
    assert len(scene.bands) == 11
    assert scene.bands == CANONICAL_BANDS
    assert scene.crs.to_epsg() == 32630


def test_geotiff_adapter_invalid_bands(tmp_path):
    tif_path = tmp_path / "invalid_3band.tif"
    with rasterio.open(
        tif_path,
        "w",
        driver="GTiff",
        height=32,
        width=32,
        count=3,
        dtype="float32",
        crs=CRS.from_epsg(4326),
        transform=Affine(0.0001, 0, 10, 0, -0.0001, 20),
    ) as dst:
        dst.write(np.zeros((3, 32, 32), dtype=np.float32))

    adapter = GeoTIFFAdapter()
    val = adapter.inspect(tif_path)
    assert val.is_valid is False
    assert any(e.code == "INVALID_BAND_COUNT" for e in val.errors)


def test_registry_detection(synthetic_11band_tif):
    val = registry.inspect(synthetic_11band_tif)
    assert val.is_valid is True
    assert val.source_type == "geotiff"

    scene = registry.read(synthetic_11band_tif)
    assert scene.width == 64
    assert scene.height == 64


def test_registry_unsupported_rgb(tmp_path):
    png_path = tmp_path / "photo.png"
    png_path.write_bytes(b"\x89PNG\r\n\x1a\nfake png content")

    val = registry.inspect(png_path)
    assert val.is_valid is False
    assert any(e.code == "NON_SPECTRAL_IMAGE" for e in val.errors)


def test_sentinel2_safe_zip_security(tmp_path):
    """Test path traversal prevention in ZIP archives."""
    zip_path = tmp_path / "malicious.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("../../etc/passwd", "root:x:0:0:")

    adapter = Sentinel2SafeAdapter()
    val = adapter.inspect(zip_path)
    assert val.is_valid is False
    assert any(e.code == "PATH_TRAVERSAL_DETECTED" for e in val.errors)
