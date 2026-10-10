"""
Monitoring Area Persistence Store & Spatial Intersector.
Manages analyst-defined Geographic Areas of Interest (AOI) in data/monitoring_areas.json.
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union

logger = logging.getLogger("backend.monitoring")


@dataclass
class MonitoringAreaRecord:
    id: str
    name: str
    description: str
    geometry: Dict[str, Any]  # GeoJSON Polygon / MultiPolygon
    crs: str = "EPSG:4326"
    area_m2: float = 0.0
    status: str = "active"  # active, archived
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "geometry": self.geometry,
            "crs": self.crs,
            "areaM2": self.area_m2,
            "status": self.status,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


class MonitoringStore:
    """Persistent store for monitoring areas of interest."""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self._areas: Dict[str, MonitoringAreaRecord] = {}
        self._load()

    def _load(self) -> None:
        if not self.file_path.exists():
            self._areas = {}
            return

        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    area = MonitoringAreaRecord(
                        id=item["id"],
                        name=item["name"],
                        description=item.get("description", ""),
                        geometry=item["geometry"],
                        crs=item.get("crs", "EPSG:4326"),
                        area_m2=float(item.get("areaM2", 0.0)),
                        status=item.get("status", "active"),
                        created_at=item.get("createdAt", datetime.now(timezone.utc).isoformat()),
                        updated_at=item.get("updatedAt", datetime.now(timezone.utc).isoformat()),
                    )
                    self._areas[area.id] = area
        except Exception as exc:
            logger.error(f"Failed to load monitoring areas from {self.file_path}: {exc}")
            self._areas = {}

    def _save(self) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        data = [area.to_dict() for area in self._areas.values()]

        temp_fd, temp_path = tempfile.mkstemp(dir=self.file_path.parent, prefix="areas_stage_")
        try:
            with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.replace(temp_path, self.file_path)
        except Exception as exc:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            logger.error(f"Failed to save monitoring areas to {self.file_path}: {exc}")

    def list_areas(self, include_archived: bool = False) -> List[MonitoringAreaRecord]:
        if include_archived:
            return list(self._areas.values())
        return [a for a in self._areas.values() if a.status == "active"]

    def get_area(self, area_id: str) -> Optional[MonitoringAreaRecord]:
        return self._areas.get(area_id)

    def create_area(
        self,
        name: str,
        geometry: Dict[str, Any],
        description: str = "",
        crs: str = "EPSG:4326",
    ) -> MonitoringAreaRecord:
        # Validate geometry with Shapely
        shp = shape(geometry)
        if not shp.is_valid:
            shp = shp.buffer(0)
        if shp.is_empty:
            raise ValueError("Geometry is empty or invalid.")

        # Approximate metric area calculation using simple geodesic/UTM projection
        area_m2 = float(shp.area)
        # If coordinates are in degrees (EPSG:4326), convert approx deg^2 to m^2 (1 deg approx 111,320m at equator)
        if "4326" in crs or abs(shp.bounds[0]) <= 180.0:
            lat_center = (shp.bounds[1] + shp.bounds[3]) / 2.0
            meters_per_deg_lat = 111132.0
            meters_per_deg_lng = 111320.0 * np.cos(np.radians(lat_center))
            area_m2 = float(shp.area * meters_per_deg_lat * meters_per_deg_lng)

        area_id = f"area-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        rec = MonitoringAreaRecord(
            id=area_id,
            name=name,
            description=description,
            geometry=mapping(shp),
            crs=crs,
            area_m2=round(area_m2, 2),
            status="active",
            created_at=now,
            updated_at=now,
        )
        self._areas[area_id] = rec
        self._save()
        return rec

    def update_area(
        self,
        area_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        geometry: Optional[Dict[str, Any]] = None,
        status: Optional[str] = None,
    ) -> MonitoringAreaRecord:
        rec = self._areas.get(area_id)
        if not rec:
            raise ValueError(f"Monitoring area {area_id} not found.")

        if name is not None:
            rec.name = name
        if description is not None:
            rec.description = description
        if status is not None:
            rec.status = status
        if geometry is not None:
            shp = shape(geometry)
            if not shp.is_valid:
                shp = shp.buffer(0)
            rec.geometry = mapping(shp)

        rec.updated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        self._save()
        return rec

    def delete_area(self, area_id: str) -> bool:
        if area_id in self._areas:
            self._areas[area_id].status = "archived"
            self._save()
            return True
        return False
