"""
Category A Adapter: GeoTIFF Input Adapter supporting 11-band GeoTIFF rasters.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.errors import RasterioError
from rasterio.transform import Affine

from backend.adapters.base import (
    CANONICAL_BANDS,
    BaseInputAdapter,
    CanonicalScene,
    Diagnostic,
    ValidationResult,
)

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 100 * 1024 * 1024  # 100 MB
MAX_PIXELS = 10980 * 10980  # Max 1 full Sentinel-2 tile


class GeoTIFFAdapter(BaseInputAdapter):
    """Adapter for standard single-file 11-band GeoTIFF rasters."""

    @property
    def adapter_name(self) -> str:
        return "geotiff"

    def can_read(self, path: Path) -> bool:
        if not path.is_file():
            return False
        suffix = path.suffix.lower()
        if suffix not in (".tif", ".tiff"):
            return False
        # Try quick opening with rasterio
        try:
            with rasterio.open(path) as ds:
                return ds.driver.lower() in ("gtiff", "cog")
        except Exception:
            return False

    def inspect(self, path: Path) -> ValidationResult:
        errors: List[Diagnostic] = []
        warnings: List[Diagnostic] = []

        if not path.is_file():
            return ValidationResult(
                is_valid=False,
                source_type="geotiff",
                detected_format="unknown",
                detected_bands=[],
                band_mapping={},
                width=0,
                height=0,
                crs_epsg=None,
                crs_wkt=None,
                pixel_size_m=(0.0, 0.0),
                radiometric_scale=1.0,
                processing_level="UNKNOWN",
                errors=[Diagnostic("FILE_NOT_FOUND", f"File not found: {path}", "ERROR")],
                recommended_action="Ensure the file path exists.",
            )

        file_size = path.stat().st_size
        if file_size > MAX_FILE_BYTES:
            errors.append(
                Diagnostic(
                    "FILE_TOO_LARGE",
                    f"File size {file_size / (1024*1024):.1f} MB exceeds limit of {MAX_FILE_BYTES // (1024*1024)} MB.",
                    "ERROR",
                )
            )

        try:
            with rasterio.open(path) as ds:
                width, height = ds.width, ds.height
                count = ds.count
                crs = ds.crs
                transform = ds.transform

                # Spatial limits
                if width * height > MAX_PIXELS:
                    errors.append(
                        Diagnostic(
                            "PIXELS_TOO_LARGE",
                            f"Image size {width}x{height} exceeds maximum threshold of {MAX_PIXELS} pixels.",
                            "ERROR",
                        )
                    )

                # Geospatial check
                crs_epsg = crs.to_epsg() if crs else None
                crs_wkt = crs.to_wkt() if crs else None
                if not crs or transform.is_identity:
                    errors.append(
                        Diagnostic(
                            "NO_GEOREF",
                            "Raster lacks spatial georeferencing (CRS or Affine transform).",
                            "ERROR",
                        )
                    )

                pixel_size_m = (abs(transform.a), abs(transform.e))

                # Band count & ordering verification
                detected_band_names: List[str] = []
                band_mapping: Dict[str, int] = {}

                # Check band descriptions or tags
                descriptions = [ds.descriptions[i] for i in range(count)] if ds.descriptions else []
                tags = ds.tags()

                has_band_tags = False
                for idx in range(count):
                    bname = descriptions[idx] if idx < len(descriptions) and descriptions[idx] else None
                    if not bname:
                        # Check tags like BAND_1, BAND_B1, etc.
                        bname = tags.get(f"BAND_{idx+1}") or tags.get(f"B{idx+1}")
                    if bname:
                        detected_band_names.append(str(bname).upper())
                        has_band_tags = True
                    else:
                        detected_band_names.append(f"BAND_{idx+1}")

                if count != 11:
                    errors.append(
                        Diagnostic(
                            "INVALID_BAND_COUNT",
                            f"GeoTIFF has {count} bands; exactly 11 bands required ({', '.join(CANONICAL_BANDS)}).",
                            "ERROR",
                        )
                    )
                else:
                    if has_band_tags:
                        # Verify whether tag names match CANONICAL_BANDS
                        matches = 0
                        for target in CANONICAL_BANDS:
                            for idx, bname in enumerate(detected_band_names):
                                if target == bname or target in bname:
                                    band_mapping[target] = idx
                                    matches += 1
                                    break
                        if matches < 11:
                            warnings.append(
                                Diagnostic(
                                    "AMBIGUOUS_BAND_TAGS",
                                    "Band tags present but did not match all 11 required bands. Falling back to default band order.",
                                    "WARNING",
                                )
                            )
                            band_mapping = {b: i for i, b in enumerate(CANONICAL_BANDS)}
                    else:
                        warnings.append(
                            Diagnostic(
                                "NO_BAND_TAGS",
                                "No explicit band names found in GeoTIFF tags. Assuming standard MARIDA positional ordering [B1..B12].",
                                "WARNING",
                            )
                        )
                        band_mapping = {b: i for i, b in enumerate(CANONICAL_BANDS)}

                # Determine processing level & radiometric scale
                processing_level = tags.get("PROCESSING_LEVEL", "UNKNOWN")
                scale = 1.0
                if "10000" in str(tags.get("REFLECTANCE_SCALE", "")) or processing_level in ("L1C", "L2A"):
                    scale = 10000.0

                is_valid = len(errors) == 0
                return ValidationResult(
                    is_valid=is_valid,
                    source_type="geotiff",
                    detected_format="GeoTIFF",
                    detected_bands=detected_band_names,
                    band_mapping=band_mapping,
                    width=width,
                    height=height,
                    crs_epsg=crs_epsg,
                    crs_wkt=crs_wkt,
                    pixel_size_m=pixel_size_m,
                    radiometric_scale=scale,
                    processing_level=processing_level,
                    warnings=warnings,
                    errors=errors,
                    recommended_action="File is valid." if is_valid else "Fix highlighted issues before upload.",
                )
        except (RasterioError, Exception) as exc:
            return ValidationResult(
                is_valid=False,
                source_type="geotiff",
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
                errors=[Diagnostic("UNREADABLE", f"Rasterio error reading GeoTIFF: {exc}", "ERROR")],
                recommended_action="Provide a uncorrupted 11-band GeoTIFF.",
            )

    def read(self, path: Path) -> CanonicalScene:
        val = self.inspect(path)
        if not val.is_valid:
            error_msg = "; ".join([e.message for e in val.errors])
            raise ValueError(f"Cannot read invalid GeoTIFF: {error_msg}")

        with rasterio.open(path) as ds:
            image = ds.read(out_dtype="float32")

            # Apply band mapping if non-standard order
            if val.band_mapping and len(val.band_mapping) == 11:
                ordered_image = np.zeros((11, ds.height, ds.width), dtype=np.float32)
                for idx, bname in enumerate(CANONICAL_BANDS):
                    src_idx = val.band_mapping.get(bname, idx)
                    ordered_image[idx] = image[src_idx]
                image = ordered_image

            # Convert NoData to NaN
            nodata_val = ds.nodata
            if nodata_val is not None and not np.isnan(nodata_val):
                image[image == np.float32(nodata_val)] = np.nan

            # Radiometric scaling (if uint16 scaled by 10000.0)
            if val.radiometric_scale > 1.0:
                image = image / val.radiometric_scale

            valid_mask = ~np.isnan(image[0])
            for ch in range(1, 11):
                valid_mask &= ~np.isnan(image[ch])

            return CanonicalScene(
                path=path,
                image=image,
                crs=ds.crs,
                transform=ds.transform,
                width=ds.width,
                height=ds.height,
                bands=list(CANONICAL_BANDS),
                dtype=str(ds.dtypes[0]),
                source_format="geotiff",
                processing_level=val.processing_level,
                scaling_factor=val.radiometric_scale,
                nodata=nodata_val,
                valid_mask=valid_mask,
                acquisition_date=ds.tags().get("SENSING_TIME"),
                product_id=ds.tags().get("PRODUCT_ID", path.stem),
                diagnostics=val,
                metadata={"tags": ds.tags()},
            )
