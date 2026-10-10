"""
Adapter Registry for input format detection, selection, and instantiation.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional

from backend.adapters.base import BaseInputAdapter, CanonicalScene, ValidationResult
from backend.adapters.geotiff import GeoTIFFAdapter
from backend.adapters.multiband_raster import MultiBandRasterAdapter
from backend.adapters.sentinel2_safe import Sentinel2SafeAdapter

logger = logging.getLogger(__name__)


class AdapterRegistry:
    """Registry managing input format detection and selection."""

    def __init__(self):
        self._adapters: List[BaseInputAdapter] = [
            GeoTIFFAdapter(),
            Sentinel2SafeAdapter(),
            MultiBandRasterAdapter(),
        ]

    def register_adapter(self, adapter: BaseInputAdapter) -> None:
        """Register a new adapter instance."""
        self._adapters.insert(0, adapter)

    def find_adapter(self, path: Path) -> Optional[BaseInputAdapter]:
        """Find the first adapter capable of reading the given file or folder."""
        for adapter in self._adapters:
            try:
                if adapter.can_read(path):
                    return adapter
            except Exception as exc:
                logger.debug(f"Adapter {adapter.adapter_name} can_read check failed for {path}: {exc}")
        return None

    def inspect(self, path: Path) -> ValidationResult:
        """Find adapter and run metadata inspection."""
        adapter = self.find_adapter(path)
        if not adapter:
            suffix = path.suffix.lower() if path.is_file() else "directory"
            is_unsupported_type = suffix in (".png", ".jpg", ".jpeg", ".bmp", ".gif")
            
            error_code = "UNSUPPORTED_FORMAT" if not is_unsupported_type else "NON_SPECTRAL_IMAGE"
            message = (
                f"File format '{suffix}' is not a valid Sentinel-2 multispectral raster. "
                f"Ordinary RGB photographs, PNGs, and JPEGs do not contain the 11 spectral bands required for marine debris detection."
                if is_unsupported_type
                else f"No compatible adapter found for file {path.name}. Supported formats: 11-band GeoTIFF, Sentinel-2 SAFE archives (.zip, .SAFE directory)."
            )

            from backend.adapters.base import Diagnostic
            return ValidationResult(
                is_valid=False,
                source_type="unsupported",
                detected_format=suffix,
                detected_bands=[],
                band_mapping={},
                width=0,
                height=0,
                crs_epsg=None,
                crs_wkt=None,
                pixel_size_m=(0.0, 0.0),
                radiometric_scale=1.0,
                processing_level="UNKNOWN",
                errors=[Diagnostic(error_code, message, "ERROR")],
                recommended_action="Upload a valid 11-band GeoTIFF or Sentinel-2 SAFE archive.",
            )
        return adapter.inspect(path)

    def read(self, path: Path) -> CanonicalScene:
        """Find suitable adapter and convert input into CanonicalScene."""
        adapter = self.find_adapter(path)
        if not adapter:
            val = self.inspect(path)
            error_msg = "; ".join([e.message for e in val.errors])
            raise ValueError(f"Unsupported file format for {path.name}: {error_msg}")
        return adapter.read(path)


# Global default registry instance
registry = AdapterRegistry()
