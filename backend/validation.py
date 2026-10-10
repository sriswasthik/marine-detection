"""
Stage 3: Data Quality Validation Layer for A.W.A.R.E.
Distinguishes fatal incompatibilities from non-fatal warnings across file, geospatial, spectral, and resource domains.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from backend.adapters.base import CanonicalScene, Diagnostic, ValidationResult
from backend.adapters.registry import registry

logger = logging.getLogger(__name__)

# Resource Boundaries
MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB
MAX_PIXEL_COUNT = 10980 * 10980       # 1 full Sentinel-2 tile
MIN_VALID_COVERAGE_RATIO = 0.01      # At least 1% valid non-NaN pixels required


class DataValidator:
    """Comprehensive validator for spectral rasters before inference execution."""

    @staticmethod
    def validate_file(path: Path) -> ValidationResult:
        """Run metadata and format inspection on input file/folder."""
        return registry.inspect(path)

    @staticmethod
    def validate_scene(scene: CanonicalScene) -> ValidationResult:
        """Run deep spectral, geospatial, and resource checks on instantiated CanonicalScene."""
        errors: List[Diagnostic] = []
        warnings: List[Diagnostic] = []

        # 1. Geospatial Validation
        if scene.crs is None:
            errors.append(Diagnostic("MISSING_CRS", "Scene lacks a valid Coordinate Reference System (CRS).", "ERROR", field="crs"))
        elif scene.crs.to_epsg() is None and not scene.crs.is_geographic and not scene.crs.is_projected:
            warnings.append(Diagnostic("CUSTOM_CRS", f"Scene uses custom/uncommon CRS: {scene.crs.name}.", "WARNING", field="crs"))

        if scene.transform.is_identity:
            errors.append(Diagnostic("IDENTITY_TRANSFORM", "Scene affine transform is identity matrix; geospatial mapping unavailable.", "ERROR", field="transform"))

        px_w, px_h = abs(scene.transform.a), abs(scene.transform.e)
        if px_w <= 0.0 or px_h <= 0.0:
            errors.append(Diagnostic("INVALID_PIXEL_SIZE", f"Pixel resolution must be positive, got ({px_w}, {px_h}).", "ERROR", field="transform"))
        elif px_w > 100.0 or px_h > 100.0:
            warnings.append(Diagnostic("COARSE_RESOLUTION", f"Pixel size ({px_w:.1f}m x {px_h:.1f}m) is unusually coarse for Sentinel-2.", "WARNING", field="transform"))

        # 2. Spectral & Data Content Validation
        if scene.image.shape[0] != 11:
            errors.append(Diagnostic("BAND_COUNT_MISMATCH", f"Model requires 11 spectral channels, scene has {scene.image.shape[0]}.", "ERROR", field="image"))

        # Check for NaN or Inf counts
        nan_count = np.isnan(scene.image).sum()
        inf_count = np.isinf(scene.image).sum()
        if inf_count > 0:
            errors.append(Diagnostic("INFINITE_VALUES_DETECTED", f"Scene tensor contains {inf_count} infinite float values.", "ERROR", field="image"))

        total_pixels = scene.width * scene.height
        valid_pixel_count = np.count_nonzero(scene.valid_mask)
        valid_ratio = valid_pixel_count / max(1, total_pixels)

        if valid_pixel_count == 0:
            errors.append(Diagnostic("ALL_NODATA", "Scene contains no valid data (100% NoData/NaN pixels).", "ERROR", field="image"))
        elif valid_ratio < MIN_VALID_COVERAGE_RATIO:
            warnings.append(
                Diagnostic(
                    "LOW_VALID_COVERAGE",
                    f"Low valid data coverage: only {valid_ratio*100:.2f}% of pixels contain valid reflectance data.",
                    "WARNING",
                    field="image",
                )
            )

        # Check band reflectance ranges
        for idx, band_name in enumerate(scene.bands):
            band_arr = scene.image[idx]
            valid_band_data = band_arr[~np.isnan(band_arr)]
            if len(valid_band_data) > 0:
                bmin, bmax = float(np.min(valid_band_data)), float(np.max(valid_band_data))
                if bmax > 2.0 or bmin < -0.1:
                    warnings.append(
                        Diagnostic(
                            "UNUSUAL_REFLECTANCE_RANGE",
                            f"Band {band_name} reflectance range [{bmin:.3f}, {bmax:.3f}] is outside expected physical range [0.0, 1.0].",
                            "WARNING",
                            field=f"band_{band_name}",
                        )
                    )

        # 3. Resource Bounds Validation
        if total_pixels > MAX_PIXEL_COUNT:
            errors.append(Diagnostic("EXCESSIVE_DIMENSIONS", f"Image dimensions {scene.width}x{scene.height} ({total_pixels} px) exceed max limit of {MAX_PIXEL_COUNT}.", "ERROR"))

        is_valid = len(errors) == 0
        return ValidationResult(
            is_valid=is_valid,
            source_type=scene.source_format,
            detected_format=scene.source_format.upper(),
            detected_bands=list(scene.bands),
            band_mapping={b: i for i, b in enumerate(scene.bands)},
            width=scene.width,
            height=scene.height,
            crs_epsg=scene.crs.to_epsg() if scene.crs else None,
            crs_wkt=scene.crs.to_wkt() if scene.crs else None,
            pixel_size_m=(px_w, px_h),
            radiometric_scale=scene.scaling_factor,
            processing_level=scene.processing_level,
            warnings=warnings,
            errors=errors,
            recommended_action="Validation passed cleanly." if is_valid else "Correct errors before pipeline execution.",
        )
