"""
Stage 3 validation tests for DataValidator layer.
"""
from pathlib import Path
import numpy as np
import pytest

import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine

from backend.adapters.base import CanonicalScene, ValidationResult
from backend.validation import DataValidator


def test_validator_valid_scene():
    data = np.random.uniform(0.01, 0.5, (11, 32, 32)).astype(np.float32)
    valid_mask = np.ones((32, 32), dtype=bool)

    scene = CanonicalScene(
        path=Path("dummy.tif"),
        image=data,
        crs=CRS.from_epsg(32630),
        transform=Affine(10, 0, 500000, 0, -10, 2000000),
        width=32,
        height=32,
        valid_mask=valid_mask,
        source_format="geotiff",
    )

    res = DataValidator.validate_scene(scene)
    assert res.is_valid is True
    assert len(res.errors) == 0


def test_validator_missing_crs():
    data = np.random.uniform(0.01, 0.5, (11, 32, 32)).astype(np.float32)
    scene = CanonicalScene(
        path=Path("nocrs.tif"),
        image=data,
        crs=None,
        transform=Affine(10, 0, 0, 0, -10, 0),
        width=32,
        height=32,
        source_format="geotiff",
    )

    res = DataValidator.validate_scene(scene)
    assert res.is_valid is False
    assert any(e.code == "MISSING_CRS" for e in res.errors)


def test_validator_all_nodata():
    data = np.full((11, 32, 32), np.nan, dtype=np.float32)
    valid_mask = np.zeros((32, 32), dtype=bool)

    scene = CanonicalScene(
        path=Path("nodata.tif"),
        image=data,
        crs=CRS.from_epsg(4326),
        transform=Affine(0.001, 0, 10, 0, -0.001, 20),
        width=32,
        height=32,
        valid_mask=valid_mask,
        source_format="geotiff",
    )

    res = DataValidator.validate_scene(scene)
    assert res.is_valid is False
    assert any(e.code == "ALL_NODATA" for e in res.errors)


def test_validator_infinite_values():
    data = np.random.uniform(0.01, 0.5, (11, 32, 32)).astype(np.float32)
    data[0, 5, 5] = np.inf

    scene = CanonicalScene(
        path=Path("inf.tif"),
        image=data,
        crs=CRS.from_epsg(32630),
        transform=Affine(10, 0, 500000, 0, -10, 2000000),
        width=32,
        height=32,
        source_format="geotiff",
    )

    res = DataValidator.validate_scene(scene)
    assert res.is_valid is False
    assert any(e.code == "INFINITE_VALUES_DETECTED" for e in res.errors)
