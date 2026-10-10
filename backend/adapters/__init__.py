"""
Backend Input Adapters Package for A.W.A.R.E. Phase 2.
"""
from backend.adapters.base import (
    CANONICAL_BANDS,
    BaseInputAdapter,
    CanonicalScene,
    Diagnostic,
    ValidationResult,
)
from backend.adapters.geotiff import GeoTIFFAdapter
from backend.adapters.multiband_raster import MultiBandRasterAdapter
from backend.adapters.registry import AdapterRegistry, registry
from backend.adapters.sentinel2_safe import Sentinel2SafeAdapter

__all__ = [
    "CANONICAL_BANDS",
    "CanonicalScene",
    "ValidationResult",
    "Diagnostic",
    "BaseInputAdapter",
    "GeoTIFFAdapter",
    "Sentinel2SafeAdapter",
    "MultiBandRasterAdapter",
    "AdapterRegistry",
    "registry",
]
