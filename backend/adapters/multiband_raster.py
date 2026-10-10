"""
Category C Adapter: Multi-band generic raster adapter with custom metadata band mapping.
Handles format variations (NetCDF/HDF5/VRT/GeoTIFF with non-standard band ordering) when authoritative metadata or 11 spectral channels are present.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import rasterio
from rasterio.crs import CRS

from backend.adapters.base import (
    CANONICAL_BANDS,
    BaseInputAdapter,
    CanonicalScene,
    Diagnostic,
    ValidationResult,
)

logger = logging.getLogger(__name__)


class MultiBandRasterAdapter(BaseInputAdapter):
    """Adapter for multi-band rasters (NetCDF, HDF, VRT) containing Sentinel-2 spectral channels."""

    @property
    def adapter_name(self) -> str:
        return "multiband_raster"

    def can_read(self, path: Path) -> bool:
        if not path.is_file():
            return False
        suffix = path.suffix.lower()
        if suffix in (".nc", ".nc4", ".h5", ".hdf", ".vrt"):
            try:
                with rasterio.open(path) as ds:
                    return ds.count >= 11
            except Exception:
                return False
        return False

    def inspect(self, path: Path) -> ValidationResult:
        errors: List[Diagnostic] = []
        warnings: List[Diagnostic] = []

        try:
            with rasterio.open(path) as ds:
                width, height = ds.width, ds.height
                count = ds.count
                crs = ds.crs
                transform = ds.transform

                if count < 11:
                    errors.append(
                        Diagnostic(
                            "INSUFFICIENT_BANDS",
                            f"Multi-band raster has {count} bands; at least 11 required.",
                            "ERROR",
                        )
                    )

                if not crs or transform.is_identity:
                    errors.append(
                        Diagnostic("NO_GEOREF", "Multi-band raster lacks CRS or transform.", "ERROR")
                    )

                is_valid = len(errors) == 0
                return ValidationResult(
                    is_valid=is_valid,
                    source_type="multiband_raster",
                    detected_format=path.suffix.upper(),
                    detected_bands=[f"BAND_{i+1}" for i in range(count)],
                    band_mapping={b: i for i, b in enumerate(CANONICAL_BANDS)},
                    width=width,
                    height=height,
                    crs_epsg=crs.to_epsg() if crs else None,
                    crs_wkt=crs.to_wkt() if crs else None,
                    pixel_size_m=(abs(transform.a), abs(transform.e)),
                    radiometric_scale=1.0,
                    processing_level="UNKNOWN",
                    warnings=warnings,
                    errors=errors,
                )
        except Exception as exc:
            return ValidationResult(
                is_valid=False,
                source_type="multiband_raster",
                detected_format="corrupt",
                detected_bands=[],
                band_mapping={},
                width=0,
                height=0,
                crs_epsg=None,
                crs_wkt=None,
                pixel_size_m=(0.0, 0.0),
                radiometric_scale=1.0,
                processing_level="UNKNOWN",
                errors=[Diagnostic("UNREADABLE", str(exc), "ERROR")],
            )

    def read(self, path: Path) -> CanonicalScene:
        val = self.inspect(path)
        if not val.is_valid:
            raise ValueError(f"Cannot read invalid multi-band raster: {val.errors}")

        with rasterio.open(path) as ds:
            image = ds.read(list(range(1, 12)), out_dtype="float32")
            if ds.nodata is not None and not np.isnan(ds.nodata):
                image[image == np.float32(ds.nodata)] = np.nan

            max_val = np.nanmax(image)
            scale = 10000.0 if max_val > 1.5 else 1.0
            if scale > 1.0:
                image = image / scale

            valid_mask = ~np.isnan(image[0])
            for c in range(1, 11):
                valid_mask &= ~np.isnan(image[c])

            return CanonicalScene(
                path=path,
                image=image,
                crs=ds.crs,
                transform=ds.transform,
                width=ds.width,
                height=ds.height,
                bands=list(CANONICAL_BANDS),
                dtype=str(ds.dtypes[0]),
                source_format="multiband_raster",
                scaling_factor=scale,
                nodata=ds.nodata,
                valid_mask=valid_mask,
                diagnostics=val,
            )
