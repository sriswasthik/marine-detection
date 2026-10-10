"""
Base abstractions and data structures for canonical scene representation and input adapters.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from rasterio.crs import CRS
from rasterio.transform import Affine

# Canonical Sentinel-2 11 spectral bands expected by MARIDA U-Net++ model
CANONICAL_BANDS = [
    "B1",   # Coastal aerosol (60m -> resampled 10m)
    "B2",   # Blue (10m)
    "B3",   # Green (10m)
    "B4",   # Red (10m)
    "B5",   # Vegetation Red Edge 1 (20m -> resampled 10m)
    "B6",   # Vegetation Red Edge 2 (20m -> resampled 10m)
    "B7",   # Vegetation Red Edge 3 (20m -> resampled 10m)
    "B8",   # NIR (10m)
    "B8A",  # Narrow NIR (20m -> resampled 10m)
    "B11",  # SWIR 1 (20m -> resampled 10m)
    "B12"   # SWIR 2 (20m -> resampled 10m)
]

# Wavelength & Native Resolution Specs (Sentinel-2 MSI)
BAND_METADATA = {
    "B1":  {"name": "Coastal aerosol", "native_res": 60, "wavelength_nm": 443},
    "B2":  {"name": "Blue",            "native_res": 10, "wavelength_nm": 490},
    "B3":  {"name": "Green",           "native_res": 10, "wavelength_nm": 560},
    "B4":  {"name": "Red",             "native_res": 10, "wavelength_nm": 665},
    "B5":  {"name": "Red Edge 1",      "native_res": 20, "wavelength_nm": 705},
    "B6":  {"name": "Red Edge 2",      "native_res": 20, "wavelength_nm": 740},
    "B7":  {"name": "Red Edge 3",      "native_res": 20, "wavelength_nm": 783},
    "B8":  {"name": "NIR",             "native_res": 10, "wavelength_nm": 842},
    "B8A": {"name": "Narrow NIR",      "native_res": 20, "wavelength_nm": 865},
    "B11": {"name": "SWIR 1",          "native_res": 20, "wavelength_nm": 1610},
    "B12": {"name": "SWIR 2",          "native_res": 20, "wavelength_nm": 2190},
}


@dataclass
class Diagnostic:
    code: str
    message: str
    severity: str  # "ERROR" or "WARNING"
    field: Optional[str] = None


@dataclass
class ValidationResult:
    is_valid: bool
    source_type: str
    detected_format: str
    detected_bands: List[str]
    band_mapping: Dict[str, int]
    width: int
    height: int
    crs_epsg: Optional[int]
    crs_wkt: Optional[str]
    pixel_size_m: Tuple[float, float]
    radiometric_scale: float
    processing_level: str
    warnings: List[Diagnostic] = field(default_factory=list)
    errors: List[Diagnostic] = field(default_factory=list)
    recommended_action: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "isValid": self.is_valid,
            "sourceType": self.source_type,
            "detectedFormat": self.detected_format,
            "detectedBands": self.detected_bands,
            "bandMapping": self.band_mapping,
            "dimensions": {"width": self.width, "height": self.height},
            "crs": {"epsg": self.crs_epsg, "wkt": self.crs_wkt},
            "pixelSizeM": self.pixel_size_m,
            "radiometricScale": self.radiometric_scale,
            "processingLevel": self.processing_level,
            "warnings": [{"code": d.code, "message": d.message, "field": d.field} for d in self.warnings],
            "errors": [{"code": d.code, "message": d.message, "field": d.field} for d in self.errors],
            "recommendedAction": self.recommended_action,
        }


@dataclass
class CanonicalScene:
    """
    Standardized in-memory scene representation passed into model inference and geospatial processing.
    
    Attributes:
        path: Original source file or archive path.
        image: Array of shape (11, H, W) containing float32 reflectance values [0.0, 1.0], NaN where invalid/NoData.
        crs: Coordinate Reference System (rasterio.crs.CRS).
        transform: Affine geotransform matrix (rasterio.transform.Affine).
        width: Grid width in pixels.
        height: Grid height in pixels.
        bands: List of band names matching CANONICAL_BANDS.
        dtype: Data type string of original source raster.
        source_format: High-level category ('geotiff', 'sentinel2_safe', 'multiband_raster').
        processing_level: 'L1C', 'L2A', 'MARIDA', or 'UNKNOWN'.
        scaling_factor: Scale factor used to convert raw stored integers/floats to reflectance (e.g. 10000.0 or 1.0).
        nodata: Original NoData sentinel value.
        valid_mask: Array of shape (H, W) boolean, True where pixels are valid reflectance.
        acquisition_date: Timestamp string (ISO 8601) if available in metadata.
        product_id: Scene/Product identifier string if available.
        diagnostics: ValidationResult diagnostic details.
        metadata: Extra key-value dictionary for provenance tracking.
    """
    path: Path
    image: np.ndarray
    crs: CRS
    transform: Affine
    width: int
    height: int
    bands: List[str] = field(default_factory=lambda: list(CANONICAL_BANDS))
    dtype: str = "float32"
    source_format: str = "geotiff"
    processing_level: str = "UNKNOWN"
    scaling_factor: float = 1.0
    nodata: Optional[float] = None
    valid_mask: Optional[np.ndarray] = None
    acquisition_date: Optional[str] = None
    product_id: Optional[str] = None
    diagnostics: Optional[ValidationResult] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.valid_mask is None:
            self.valid_mask = ~np.isnan(self.image[0]) if self.image.ndim == 3 else ~np.isnan(self.image)


class BaseInputAdapter(ABC):
    """Abstract Base Class for input file format adapters."""

    @property
    @abstractmethod
    def adapter_name(self) -> str:
        """Name identifier for adapter."""
        pass

    @abstractmethod
    def can_read(self, path: Path) -> bool:
        """Return True if this adapter can handle the given file or directory."""
        pass

    @abstractmethod
    def inspect(self, path: Path) -> ValidationResult:
        """Inspect and validate input metadata without loading full raster tensors."""
        pass

    @abstractmethod
    def read(self, path: Path) -> CanonicalScene:
        """Read raster and construct a CanonicalScene object with exact 11-band spectral alignment."""
        pass
