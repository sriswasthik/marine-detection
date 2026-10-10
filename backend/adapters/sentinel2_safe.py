"""
Category B Adapter: Sentinel-2 SAFE / Multi-band product adapter for SAFE archives, .SAFE directories, and JP2/TIFF band sets.
Includes zip security validation (path traversal prevention, zip bomb detection, staging cleanup).
"""
from __future__ import annotations

import logging
import os
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import Affine

from backend.adapters.base import (
    CANONICAL_BANDS,
    BaseInputAdapter,
    CanonicalScene,
    Diagnostic,
    ValidationResult,
)

logger = logging.getLogger(__name__)

# Security limits for Zip archives
MAX_ZIP_BYTES = 500 * 1024 * 1024  # 500 MB zip upload limit
MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB total extracted size
MAX_ZIP_FILES = 1000  # Max archive files limit

BAND_FILE_PATTERNS = {
    "B1":  re.compile(r"(?:_B0?1|_B01\.JP2|_B01\.TIF|B01\.jp2|B01\.tif)$", re.IGNORECASE),
    "B2":  re.compile(r"(?:_B0?2|_B02\.JP2|_B02\.TIF|B02\.jp2|B02\.tif)$", re.IGNORECASE),
    "B3":  re.compile(r"(?:_B0?3|_B03\.JP2|_B03\.TIF|B03\.jp2|B03\.tif)$", re.IGNORECASE),
    "B4":  re.compile(r"(?:_B0?4|_B04\.JP2|_B04\.TIF|B04\.jp2|B04\.tif)$", re.IGNORECASE),
    "B5":  re.compile(r"(?:_B0?5|_B05\.JP2|_B05\.TIF|B05\.jp2|B05\.tif)$", re.IGNORECASE),
    "B6":  re.compile(r"(?:_B0?6|_B06\.JP2|_B06\.TIF|B06\.jp2|B06\.tif)$", re.IGNORECASE),
    "B7":  re.compile(r"(?:_B0?7|_B07\.JP2|_B07\.TIF|B07\.jp2|B07\.tif)$", re.IGNORECASE),
    "B8":  re.compile(r"(?:_B0?8|_B08\.JP2|_B08\.TIF|B08\.jp2|B08\.tif)$", re.IGNORECASE),
    "B8A": re.compile(r"(?:_B8A|_B8A\.JP2|_B8A\.TIF|B8A\.jp2|B8A\.tif)$", re.IGNORECASE),
    "B11": re.compile(r"(?:_B11|_B11\.JP2|_B11\.TIF|B11\.jp2|B11\.tif)$", re.IGNORECASE),
    "B12": re.compile(r"(?:_B12|_B12\.JP2|_B12\.TIF|B12\.jp2|B12\.tif)$", re.IGNORECASE),
}


class Sentinel2SafeAdapter(BaseInputAdapter):
    """Adapter for Sentinel-2 SAFE archives, directory trees, or multi-file band bundles."""

    @property
    def adapter_name(self) -> str:
        return "sentinel2_safe"

    def can_read(self, path: Path) -> bool:
        if path.is_dir() and (path.suffix.upper() == ".SAFE" or (path / "MTD_MSIL1C.xml").exists() or (path / "MTD_MSIL2A.xml").exists()):
            return True
        if path.is_file() and path.suffix.lower() == ".zip":
            # Check zip contents without full extraction
            try:
                with zipfile.ZipFile(path, "r") as zf:
                    names = zf.namelist()
                    has_safe = any(".SAFE/" in n or "MTD_MSI" in n for n in names)
                    # or contains individual band files
                    has_bands = sum(1 for band, pat in BAND_FILE_PATTERNS.items() if any(pat.search(n) for n in names)) >= 8
                    return has_safe or has_bands
            except Exception:
                return False
        return False

    def inspect(self, path: Path) -> ValidationResult:
        errors: List[Diagnostic] = []
        warnings: List[Diagnostic] = []

        if path.is_file() and path.suffix.lower() == ".zip":
            # Security checks on zip archive
            size = path.stat().st_size
            if size > MAX_ZIP_BYTES:
                errors.append(Diagnostic("ZIP_TOO_LARGE", f"ZIP archive size ({size/(1024*1024):.1f} MB) exceeds maximum allowed limit ({MAX_ZIP_BYTES/(1024*1024)} MB).", "ERROR"))

            try:
                with zipfile.ZipFile(path, "r") as zf:
                    infolist = zf.infolist()
                    if len(infolist) > MAX_ZIP_FILES:
                        errors.append(Diagnostic("ZIP_TOO_MANY_FILES", f"ZIP contains {len(infolist)} files; maximum allowed is {MAX_ZIP_FILES}.", "ERROR"))
                    
                    total_uncompressed = sum(f.file_size for f in infolist)
                    if total_uncompressed > MAX_UNCOMPRESSED_BYTES:
                        errors.append(Diagnostic("ZIP_BOMB_PREVENTION", f"Total uncompressed zip size ({total_uncompressed/(1024*1024):.1f} MB) exceeds maximum safe extraction threshold ({MAX_UNCOMPRESSED_BYTES/(1024*1024)} MB).", "ERROR"))

                    # Path traversal check
                    for info in infolist:
                        normalized = os.path.normpath(info.filename)
                        if normalized.startswith("..") or os.path.isabs(normalized) or "../" in info.filename or "..\\" in info.filename:
                            errors.append(Diagnostic("PATH_TRAVERSAL_DETECTED", f"Malicious path traversal detected in archive entry: {info.filename}", "ERROR"))
                            break
            except Exception as exc:
                errors.append(Diagnostic("CORRUPT_ZIP", f"Failed to open zip archive: {exc}", "ERROR"))

            if errors:
                return ValidationResult(
                    is_valid=False,
                    source_type="sentinel2_safe",
                    detected_format="ZIP Archive",
                    detected_bands=[],
                    band_mapping={},
                    width=0,
                    height=0,
                    crs_epsg=None,
                    crs_wkt=None,
                    pixel_size_m=(0.0, 0.0),
                    radiometric_scale=10000.0,
                    processing_level="UNKNOWN",
                    errors=errors,
                )

        # Locate band files (directory or temp extract)
        temp_dir: Optional[str] = None
        target_dir = path
        if path.is_file() and path.suffix.lower() == ".zip":
            temp_dir = tempfile.mkdtemp(prefix="aware_s2_safe_")
            try:
                with zipfile.ZipFile(path, "r") as zf:
                    # Safely extract band files and metadata XML
                    for member in zf.infolist():
                        if not any(pat.search(member.filename) for pat in BAND_FILE_PATTERNS.values()) and not member.filename.endswith(".xml"):
                            continue
                        zf.extract(member, temp_dir)
                target_dir = Path(temp_dir)
            except Exception as exc:
                if temp_dir:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                return ValidationResult(
                    is_valid=False,
                    source_type="sentinel2_safe",
                    detected_format="ZIP Archive",
                    detected_bands=[],
                    band_mapping={},
                    width=0,
                    height=0,
                    crs_epsg=None,
                    crs_wkt=None,
                    pixel_size_m=(0.0, 0.0),
                    radiometric_scale=10000.0,
                    processing_level="UNKNOWN",
                    errors=[Diagnostic("EXTRACTION_FAILED", f"Failed to extract zip bands: {exc}", "ERROR")],
                )

        found_bands: Dict[str, Path] = {}
        try:
            for root, _, files in os.walk(target_dir):
                for f in files:
                    fpath = Path(root) / f
                    for band_name, pattern in BAND_FILE_PATTERNS.items():
                        if band_name not in found_bands and pattern.search(f):
                            found_bands[band_name] = fpath

            missing_bands = [b for b in CANONICAL_BANDS if b not in found_bands]
            if missing_bands:
                errors.append(
                    Diagnostic(
                        "MISSING_SPECTRAL_BANDS",
                        f"SAFE product is missing required Sentinel-2 bands: {', '.join(missing_bands)}.",
                        "ERROR",
                    )
                )

            width, height = 0, 0
            crs_epsg, crs_wkt = None, None
            pixel_size = (10.0, 10.0)
            proc_level = "L1C" if "L1C" in str(path) else ("L2A" if "L2A" in str(path) else "UNKNOWN")

            if "B2" in found_bands:
                try:
                    with rasterio.open(found_bands["B2"]) as ds:
                        width, height = ds.width, ds.height
                        if ds.crs:
                            crs_epsg = ds.crs.to_epsg()
                            crs_wkt = ds.crs.to_wkt()
                        pixel_size = (abs(ds.transform.a), abs(ds.transform.e))
                except Exception as exc:
                    errors.append(Diagnostic("BAND_READ_ERROR", f"Failed to open 10m anchor band B2: {exc}", "ERROR"))

            is_valid = len(errors) == 0
            return ValidationResult(
                is_valid=is_valid,
                source_type="sentinel2_safe",
                detected_format="Sentinel-2 SAFE Product",
                detected_bands=list(found_bands.keys()),
                band_mapping={b: 0 for b in found_bands},
                width=width,
                height=height,
                crs_epsg=crs_epsg,
                crs_wkt=crs_wkt,
                pixel_size_m=pixel_size,
                radiometric_scale=10000.0,
                processing_level=proc_level,
                warnings=warnings,
                errors=errors,
                recommended_action="Product valid." if is_valid else "Provide complete Sentinel-2 SAFE package.",
            )
        finally:
            if temp_dir:
                shutil.rmtree(temp_dir, ignore_errors=True)

    def read(self, path: Path) -> CanonicalScene:
        # Create staging folder if ZIP file
        temp_dir: Optional[str] = None
        target_dir = path
        if path.is_file() and path.suffix.lower() == ".zip":
            temp_dir = tempfile.mkdtemp(prefix="aware_s2_read_")
            with zipfile.ZipFile(path, "r") as zf:
                for member in zf.infolist():
                    normalized = os.path.normpath(member.filename)
                    if normalized.startswith("..") or os.path.isabs(normalized) or "../" in member.filename or "..\\" in member.filename:
                        raise ValueError(f"Path traversal detected in archive: {member.filename}")
                    zf.extract(member, temp_dir)
            target_dir = Path(temp_dir)

        try:
            found_bands: Dict[str, Path] = {}
            for root, _, files in os.walk(target_dir):
                for f in files:
                    fpath = Path(root) / f
                    for band_name, pattern in BAND_FILE_PATTERNS.items():
                        if band_name not in found_bands and pattern.search(f):
                            found_bands[band_name] = fpath

            missing = [b for b in CANONICAL_BANDS if b not in found_bands]
            if missing:
                raise ValueError(f"Sentinel-2 product missing required bands: {missing}")

            # Use 10m band B2 as master reference grid
            ref_path = found_bands["B2"]
            with rasterio.open(ref_path) as master_ds:
                target_width = master_ds.width
                target_height = master_ds.height
                target_transform = master_ds.transform
                target_crs = master_ds.crs

            stacked_image = np.zeros((11, target_height, target_width), dtype=np.float32)

            for idx, band_name in enumerate(CANONICAL_BANDS):
                bpath = found_bands[band_name]
                with rasterio.open(bpath) as ds:
                    if ds.width == target_width and ds.height == target_height:
                        data = ds.read(1, out_dtype="float32")
                    else:
                        # Resample 20m/60m band to 10m master grid using bilinear interpolation
                        data = ds.read(
                            1,
                            out_shape=(target_height, target_width),
                            resampling=Resampling.bilinear,
                            out_dtype="float32",
                        )

                    nodata_val = ds.nodata
                    if nodata_val is not None and not np.isnan(nodata_val):
                        data[data == np.float32(nodata_val)] = np.nan

                    stacked_image[idx] = data

            # Scaling integer reflectance values to [0.0, 1.0] if range > 1.5
            max_val = np.nanmax(stacked_image)
            scaling = 1.0
            if max_val > 1.5:
                scaling = 10000.0
                stacked_image = stacked_image / scaling

            valid_mask = ~np.isnan(stacked_image[0])
            for c in range(1, 11):
                valid_mask &= ~np.isnan(stacked_image[c])

            proc_level = "L1C" if "L1C" in str(path) else ("L2A" if "L2A" in str(path) else "SAFE")

            val_res = ValidationResult(
                is_valid=True,
                source_type="sentinel2_safe",
                detected_format="Sentinel-2 SAFE Product",
                detected_bands=list(found_bands.keys()),
                band_mapping={b: i for i, b in enumerate(CANONICAL_BANDS)},
                width=target_width,
                height=target_height,
                crs_epsg=target_crs.to_epsg() if target_crs else None,
                crs_wkt=target_crs.to_wkt() if target_crs else None,
                pixel_size_m=(abs(target_transform.a), abs(target_transform.e)),
                radiometric_scale=scaling,
                processing_level=proc_level,
            )

            return CanonicalScene(
                path=path,
                image=stacked_image,
                crs=target_crs,
                transform=target_transform,
                width=target_width,
                height=target_height,
                bands=list(CANONICAL_BANDS),
                dtype="float32",
                source_format="sentinel2_safe",
                processing_level=proc_level,
                scaling_factor=scaling,
                valid_mask=valid_mask,
                diagnostics=val_res,
                metadata={"found_bands": {k: str(v) for k, v in found_bands.items()}},
            )
        finally:
            if temp_dir:
                shutil.rmtree(temp_dir, ignore_errors=True)
