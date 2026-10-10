"""
Marine debris pipeline: one Sentinel-2 GeoTIFF in, one Observation (the frontend data contract,
frontend/src/features/observations/types.ts) out, plus PNG overlays for the map.

Pure and importable: no Streamlit, no global state apart from a cached model. The model code in
semantic_segmentation/unet is imported unchanged; preprocessing reproduces app.py exactly, but the
softmax probabilities are kept (app.py discards them) because detection confidence comes from them.

    from backend.pipeline import run_pipeline, write_outputs
    result = run_pipeline("semantic_segmentation/unet/sample_data/S2_9-10-17_16PEC_0.tif")
    write_outputs(result, "out/S2_9-10-17_16PEC_0")

Density levels and hotspots are computed here, on the model's own pixel grid (compute_density):
every detection's densityLevel, the observation's densityLevel, `densityGrid` (the cells holding
debris, with each detection's share) and the ranked `hotspots`. The rules and placeholder
thresholds are those of frontend/src/lib/density.ts and hotspots.ts, which the frontend still uses
for its synthetic sample scenes and to regroup these cells when the map is filtered.

Written for the repository's pinned stack (Python 3.8+, numpy 1.23, rasterio 1.3, torch 1.13) and
verified on newer versions (see backend/requirements-relaxed.txt).
"""
from __future__ import annotations

import hashlib
import inspect
import json
import re
import sys
import time
import xml.etree.ElementTree as ElementTree
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple, Union

import numpy as np
import rasterio
from rasterio import features, warp
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.errors import RasterioError
from rasterio.transform import Affine
from scipy import ndimage
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

REPO_ROOT = Path(__file__).resolve().parents[1]
UNET_DIR = REPO_ROOT / "semantic_segmentation" / "unet"

# The model modules import each other as top-level modules (`from dataloader import ...`), and
# utils/ is imported from the repository root, so both directories go on the import path.
for _path in (str(UNET_DIR), str(REPO_ROOT)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

import torch  # noqa: E402

# Band statistics come from the training code itself; they are never copied here.
# Importing dataloader also seeds Python, numpy and torch RNGs (dataloader.py lines 14 to 16).
from dataloader import bands_mean, bands_std  # noqa: E402
from unet_plus_plus import UNetPlusPlus  # noqa: E402
from utils.assets import labels as ASSET_LABELS, roi_mapping  # noqa: E402

PathLike = Union[str, Path]

# ---------------------------------------------------------------------------------------------
# Model and input
# ---------------------------------------------------------------------------------------------

CHECKPOINT_PATH = UNET_DIR / "trained_models" / "best_model_marine_debris.pth"
MODEL_CARD_PATH = Path(__file__).resolve().parent / "model_card.json"
MODEL_NAME = "U-Net marine debris segmentation"
INPUT_BANDS = 11
OUTPUT_CLASSES = 11
HIDDEN_CHANNELS = 16
# Four 2x poolings, and Up concatenates without padding: height and width must divide by 16.
SIZE_MULTIPLE = 16

# Larger images run in overlapping windows whose softmax outputs are blended.
TILE_SIZE = 1024
TILE_OVERLAP = 128

MAX_FILE_BYTES = 100 * 1024 * 1024  # matches MAX_UPLOAD_MB in frontend/src/lib/config.ts
MAX_PIXELS = 10980 * 10980  # one full Sentinel-2 tile at 10 m

# ---------------------------------------------------------------------------------------------
# Classes (ids 1 to 11, the order of utils/assets.py `labels`; 12 to 15 were merged into 7)
# ---------------------------------------------------------------------------------------------

CLASS_NAMES: Dict[int, str] = {i + 1: name for i, name in enumerate(ASSET_LABELS[:OUTPUT_CLASSES])}
DEBRIS = 1
SARGASSUM = (2, 3)
NATURAL_ORGANIC = 4
SHIP = 5
CLOUDS = 6
FOAM = 9
WATER_CLASSES = (7, 8, 10, 11)

# Context overlay colours: clear mid-tones on a light map, no navy or black. Marine Debris uses
# the High severity red from frontend/CLAUDE.md; water classes are not drawn.
OVERLAY_ALPHA = 0.85
CLASS_COLORS: Dict[int, Optional[str]] = {
    1: "#C4503A",
    2: "#6FA35A",
    3: "#B3CF7B",
    4: "#B39B78",
    5: "#9384C6",
    6: "#BAC4CD",
    7: None,
    8: None,
    9: "#72C2C8",
    10: None,
    11: None,
}
REFERENCE_COLOR = "#2F6F6D"  # accent teal: ground-truth debris, distinct from predicted red

# The QGIS style shipped with the model (paletted renderer, one entry per class id). The
# segmentation GeoTIFF's colour table and segmentation.png use its colours, so the mask looks the
# same in the app and in QGIS once the style is applied.
QGIS_STYLE_PATH = REPO_ROOT / "utils" / "qgis_color_mask_mapping.qml"

# ---------------------------------------------------------------------------------------------
# Warnings (thresholds match the frontend: CONFIDENCE_THRESHOLDS.low in src/lib/config.ts)
# ---------------------------------------------------------------------------------------------

LOW_CONFIDENCE_THRESHOLD = 0.6
HIGH_CLOUD_PERCENT = 30.0

# Stripe artefacts: a debris region at most this many pixels thick that runs along the image rows
# or columns for at least this share of the image. Floating debris almost never lines up with the
# pixel grid, but this model draws such bands near patch edges: 45 of the 359 stored test
# predictions in data/predicted_unet have one, always at rows 3 to 5 or columns 1 to 2. Such
# regions are left out of the detections, listed in `suppressedRegions` and flagged with the
# STRIPE_ARTEFACT warning.
STRIPE_MAX_THICKNESS_PX = 8
STRIPE_MIN_SPAN_FRACTION = 0.5

WATER_DEFINITION = (
    "Water surface = every valid pixel the model did not classify as Clouds (class 6). "
    "MARIDA has no land class, so any land in the scene is counted as water."
)

PATCH_NAME = re.compile(r"^S2_(\d{1,2})-(\d{1,2})-(\d{2})_([0-9]{2}[A-Z]{3})(?:_(\d+))?$")

ERROR_CODES = ("INVALID_BANDS", "NO_GEOREF", "UNREADABLE", "TOO_LARGE")


class PipelineError(Exception):
    """A file the pipeline refuses, with a stable code and a message a person can act on."""

    def __init__(self, code: str, message: str):
        if code not in ERROR_CODES:
            raise ValueError(f"Unknown pipeline error code {code}")
        super().__init__(message)
        self.code = code
        self.message = message

    def to_dict(self) -> Dict[str, str]:
        return {"code": self.code, "message": self.message}


@dataclass
class Scene:
    """What was read from the GeoTIFF."""

    path: Path
    image: np.ndarray  # (11, H, W) float32 reflectance, NaN where missing
    crs: CRS
    transform: Affine
    width: int
    height: int
    dtype: str = "float32"  # data type of the bands as stored in the file


@dataclass
class PipelineResult:
    observation: Dict[str, Any]
    class_map: np.ndarray  # (H, W) uint8, class ids 1 to 11, 0 where the input had no data
    probabilities: np.ndarray  # (11, H, W) float32 softmax
    valid: np.ndarray  # (H, W) bool
    scene: Scene
    timings_ms: Dict[str, float] = field(default_factory=dict)
    reference_debris: Optional[np.ndarray] = None  # (H, W) bool from a MARIDA *_cl.tif


# ---------------------------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------------------------

_MODEL_CACHE: Dict[str, Tuple[torch.nn.Module, str]] = {}


def default_device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def file_sha256(path: PathLike) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_model(device: Optional[torch.device] = None) -> Tuple[torch.nn.Module, torch.device, str]:
    """The checkpoint in UNetPlusPlus(11, 11, 16), in eval mode. Cached per device."""
    device = device or default_device()
    key = str(device)
    if key not in _MODEL_CACHE:
        model = UNetPlusPlus(
            input_bands=INPUT_BANDS, output_classes=OUTPUT_CLASSES, hidden_channels=HIDDEN_CHANNELS
        )
        state = torch.load(str(CHECKPOINT_PATH), map_location=device)
        model.load_state_dict(state)
        model.to(device)
        model.eval()
        _MODEL_CACHE[key] = (model, file_sha256(CHECKPOINT_PATH)[:12])
    model, version = _MODEL_CACHE[key]
    return model, device, version


def load_model_metrics() -> Optional[Dict[str, Any]]:
    """modelMetrics for the Observation, from backend/model_card.json (see model_card.py)."""
    if not MODEL_CARD_PATH.exists():
        return None
    card = json.loads(MODEL_CARD_PATH.read_text(encoding="utf-8"))
    metrics = card["metrics"]
    return {
        "precision": metrics["precision"],
        "recall": metrics["recall"],
        "f1": metrics["f1"],
        "accuracy": metrics["accuracy"],
        "iou": metrics["iou"],
        "meanIoU": metrics["meanIoU"],
        "macroF1": metrics["macroF1"],
        "benchmark": card["benchmark"],
        "isPlaceholder": bool(card["isPlaceholder"]),
    }


# ---------------------------------------------------------------------------------------------
# 1. Read and validate
# ---------------------------------------------------------------------------------------------


def read_scene(tif_path: PathLike) -> Scene:
    path = Path(tif_path)
    if not path.is_file() and not path.is_dir():
        raise PipelineError("UNREADABLE", f"The file {path.name} was not found. Choose the image again.")

    from backend.adapters.registry import registry as adapter_registry
    from backend.validation import DataValidator

    # Run adapter inspection
    val_meta = adapter_registry.inspect(path)
    if not val_meta.is_valid:
        primary_err = val_meta.errors[0] if val_meta.errors else None
        err_code = primary_err.code if primary_err and primary_err.code in ERROR_CODES else "UNREADABLE"
        err_msg = primary_err.message if primary_err else "Failed input format validation."
        raise PipelineError(err_code, err_msg)

    try:
        canonical_scene = adapter_registry.read(path)
        scene_val = DataValidator.validate_scene(canonical_scene)
        if not scene_val.is_valid:
            primary_err = scene_val.errors[0]
            err_code = primary_err.code if primary_err.code in ERROR_CODES else "UNREADABLE"
            raise PipelineError(err_code, primary_err.message)

        return Scene(
            path=canonical_scene.path,
            image=canonical_scene.image,
            crs=canonical_scene.crs,
            transform=canonical_scene.transform,
            width=canonical_scene.width,
            height=canonical_scene.height,
            dtype=canonical_scene.dtype,
        )
    except PipelineError:
        raise
    except (RasterioError, OSError, ValueError) as error:
        raise PipelineError(
            "UNREADABLE", f"The file could not be processed ({error}). Export it again and retry."
        ) from error


# ---------------------------------------------------------------------------------------------
# 2. Preprocess (exactly app.py preprocess_image) and 3. predict
# ---------------------------------------------------------------------------------------------


def preprocess(image: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """app.py preprocess_image without the tensor step. Returns (standardised, valid mask)."""
    img = np.array(image).astype(np.float32)
    nan_mask = np.isnan(img)
    mean_values = np.tile(bands_mean[:, None, None], (1, img.shape[1], img.shape[2]))
    img = np.where(nan_mask, mean_values, img)
    img = (img - bands_mean[:, None, None]) / bands_std[:, None, None]
    valid = ~np.all(nan_mask, axis=0)
    return img.astype(np.float32), valid


def _predict_window(model: torch.nn.Module, device: torch.device, window: np.ndarray) -> np.ndarray:
    """Softmax for one window. Pads bottom and right by reflection to a multiple of 16."""
    _, height, width = window.shape
    pad_h = (-height) % SIZE_MULTIPLE
    pad_w = (-width) % SIZE_MULTIPLE
    if pad_h or pad_w:
        window = np.pad(window, ((0, 0), (0, pad_h), (0, pad_w)), mode="reflect")
    tensor = torch.from_numpy(np.ascontiguousarray(window)).unsqueeze(0).to(device)
    with torch.no_grad():
        logits = model(tensor)
        probabilities = torch.softmax(logits, dim=1)
    return probabilities[0, :, :height, :width].cpu().numpy().astype(np.float32)


def _window_starts(length: int, tile: int, overlap: int) -> List[int]:
    if length <= tile:
        return [0]
    step = tile - overlap
    starts = list(range(0, length - tile + 1, step))
    if starts[-1] != length - tile:
        starts.append(length - tile)
    return starts


def _blend_weights(height: int, width: int, overlap: int) -> np.ndarray:
    """Linear ramps over the overlap so window seams blend; never zero."""
    def ramp(n: int) -> np.ndarray:
        index = np.arange(n, dtype=np.float32)
        edge = np.minimum(index + 1, n - index)
        return np.clip(edge / max(overlap / 2.0, 1.0), 1e-3, 1.0)

    return np.outer(ramp(height), ramp(width)).astype(np.float32)


def predict_probabilities(
    standardised: np.ndarray,
    model: torch.nn.Module,
    device: torch.device,
    tile_size: int = TILE_SIZE,
    overlap: int = TILE_OVERLAP,
) -> np.ndarray:
    """(11, H, W) softmax. Images up to tile_size on both sides run in one pass."""
    _, height, width = standardised.shape
    if height <= tile_size and width <= tile_size:
        return _predict_window(model, device, standardised)
    total = np.zeros((OUTPUT_CLASSES, height, width), dtype=np.float32)
    weight_sum = np.zeros((height, width), dtype=np.float32)
    for top in _window_starts(height, tile_size, overlap):
        for left in _window_starts(width, tile_size, overlap):
            window = standardised[:, top : top + tile_size, left : left + tile_size]
            probabilities = _predict_window(model, device, window)
            weights = _blend_weights(window.shape[1], window.shape[2], overlap)
            total[:, top : top + window.shape[1], left : left + window.shape[2]] += probabilities * weights
            weight_sum[top : top + window.shape[1], left : left + window.shape[2]] += weights
    return total / weight_sum[None]


# ---------------------------------------------------------------------------------------------
# 4. Detections
# ---------------------------------------------------------------------------------------------


def _is_metric_projected(crs: CRS) -> bool:
    if not crs.is_projected:
        return False
    units = (crs.linear_units or "").lower()
    return units in ("metre", "meter", "m", "metres", "meters")


def _utm_crs_for(lng: float, lat: float) -> CRS:
    zone = int(min(max((lng + 180) // 6 + 1, 1), 60))
    return CRS.from_epsg((32600 if lat >= 0 else 32700) + zone)


def _to_wgs84_point(crs: CRS, x: float, y: float) -> Tuple[float, float]:
    xs, ys = warp.transform(crs, "EPSG:4326", [x], [y])
    return float(xs[0]), float(ys[0])


def _area_m2(geometry: Any, crs: CRS) -> float:
    """Area in m2. A non-projected (or non-metre) CRS is first reprojected to the local UTM zone."""
    if _is_metric_projected(crs):
        return float(geometry.area)
    centre = geometry.centroid
    lng, lat = _to_wgs84_point(crs, centre.x, centre.y)
    utm = _utm_crs_for(lng, lat)
    return float(shape(warp.transform_geom(crs, utm, mapping(geometry))).area)


def _polygons_only(geometry: Any) -> Any:
    if isinstance(geometry, (Polygon, MultiPolygon)):
        return geometry
    if isinstance(geometry, GeometryCollection):
        parts = [g for g in geometry.geoms if isinstance(g, (Polygon, MultiPolygon))]
        return unary_union(parts)
    return Polygon()


def _make_valid(geometry: Any) -> Any:
    if geometry.is_valid:
        return geometry
    try:
        from shapely.validation import make_valid

        return _polygons_only(make_valid(geometry))
    except ImportError:  # shapely < 1.8
        return geometry.buffer(0)


def _oriented(geometry: Any) -> Any:
    """RFC 7946 winding: exterior rings counter-clockwise."""
    if isinstance(geometry, Polygon):
        return orient(geometry, sign=1.0)
    return MultiPolygon([orient(p, sign=1.0) for p in geometry.geoms])


def _round_coordinates(value: Any, digits: int = 7) -> Any:
    if isinstance(value, (list, tuple)):
        if value and isinstance(value[0], (int, float)):
            return [round(float(v), digits) for v in value]
        return [_round_coordinates(v, digits) for v in value]
    return value


def _geojson_wgs84(geometry: Any, crs: CRS) -> Dict[str, Any]:
    """Source-CRS geometry to GeoJSON in EPSG:4326, positions [lng, lat] (rasterio uses GIS order)."""
    projected = warp.transform_geom(crs, "EPSG:4326", mapping(geometry))
    return {"type": projected["type"], "coordinates": _round_coordinates(projected["coordinates"])}


def is_stripe(rows: int, cols: int, height: int, width: int) -> bool:
    """A thin region running along the pixel grid across much of the image (see STRIPE_*)."""
    thin_horizontal = rows <= STRIPE_MAX_THICKNESS_PX and cols >= STRIPE_MIN_SPAN_FRACTION * width
    thin_vertical = cols <= STRIPE_MAX_THICKNESS_PX and rows >= STRIPE_MIN_SPAN_FRACTION * height
    return thin_horizontal or thin_vertical


def find_detections(
    class_map: np.ndarray,
    probabilities: np.ndarray,
    valid: np.ndarray,
    scene: Scene,
    observation_id: str,
    pixel_area_m2: float,
    min_pixels: int = 1,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], np.ndarray]:
    """
    Connected (8-neighbour) regions of class 1, as Detection dicts sorted by size, the regions set
    aside as stripe artefacts, and an (H, W) raster numbering each pixel's detection (see below).
    """
    debris = (class_map == DEBRIS) & valid
    labels, count = ndimage.label(debris, structure=np.ones((3, 3), dtype=bool))
    if count == 0:
        return [], [], np.zeros(class_map.shape, dtype=np.int32)
    flat = labels.ravel()
    pixel_counts = np.bincount(flat, minlength=count + 1)
    probability_sums = np.bincount(flat, weights=probabilities[DEBRIS - 1].ravel().astype(np.float64), minlength=count + 1)
    slices = ndimage.find_objects(labels)
    keep = np.zeros(count + 1, dtype=bool)
    keep[1:] = pixel_counts[1:] >= max(min_pixels, 1)
    suppressed = []
    for label in range(1, count + 1):
        rows = slices[label - 1][0].stop - slices[label - 1][0].start
        cols = slices[label - 1][1].stop - slices[label - 1][1].start
        if keep[label] and is_stripe(rows, cols, scene.height, scene.width):
            keep[label] = False
            pixels = int(pixel_counts[label])
            suppressed.append(
                {
                    "reason": "stripe",
                    "pixels": pixels,
                    "areaM2": round(pixels * pixel_area_m2, 2),
                    "confidence": round(float(probability_sums[label] / pixels), 4),
                    "rowSpan": int(rows),
                    "colSpan": int(cols),
                    "firstRow": int(slices[label - 1][0].start),
                    "firstCol": int(slices[label - 1][1].start),
                }
            )
    kept_labels = np.where(keep, np.arange(count + 1), 0)[labels].astype(np.int32)

    parts: Dict[int, List[Any]] = {}
    for geometry, value in features.shapes(
        kept_labels, mask=kept_labels > 0, transform=scene.transform, connectivity=8
    ):
        parts.setdefault(int(value), []).append(shape(geometry))

    order = sorted(
        (label for label in parts),
        key=lambda label: (-int(pixel_counts[label]), slices[label - 1][0].start, slices[label - 1][1].start),
    )
    detections = []
    for index, label in enumerate(order, start=1):
        geometry = _oriented(_make_valid(unary_union(parts[label])))
        pixels = int(pixel_counts[label])
        area = pixels * pixel_area_m2 if _is_metric_projected(scene.crs) else _area_m2(geometry, scene.crs)
        centre = geometry.centroid
        lng, lat = _to_wgs84_point(scene.crs, centre.x, centre.y)
        detections.append(
            {
                "id": f"{observation_id}-d{index:03d}",
                "geometry": _geojson_wgs84(geometry, scene.crs),
                "areaM2": round(float(area), 2),
                "confidence": round(float(probability_sums[label] / pixels), 4),
                "densityLevel": None,  # set by compute_density
                "centroid": {"lat": round(lat, 7), "lng": round(lng, 7)},
                "sourcePixelCount": pixels,
            }
        )
    suppressed.sort(key=lambda region: -region["pixels"])
    # Each pixel's detection number (1 = detections[0]), 0 where there is no kept detection.
    numbering = np.zeros(count + 1, dtype=np.int32)
    for index, label in enumerate(order, start=1):
        numbering[label] = index
    return detections, suppressed, numbering[kept_labels]


# ---------------------------------------------------------------------------------------------
# 5. Density grid and hotspots
# ---------------------------------------------------------------------------------------------

# Percent of a grid cell's imaged area covered by debris. The same placeholder values as
# DENSITY_THRESHOLDS in frontend/src/lib/config.ts (frontend/src/features/observations/
# realSamples.test.ts keeps them equal); they are not calibrated.
DENSITY_THRESHOLDS: Dict[str, float] = {"moderate": 2.0, "high": 8.0, "critical": 20.0}
DENSITY_LEVELS = ("low", "moderate", "high", "critical")
# Cells span 25 x 25 source pixels, so 250 m at Sentinel-2's 10 m (GRID_CELL_SIZE_M in the frontend).
GRID_CELL_PX = 25
# Weight of each level in the hotspot priority score (HOTSPOT_LEVEL_WEIGHTS in src/lib/hotspots.ts).
HOTSPOT_LEVEL_WEIGHTS = {"low": 1, "moderate": 2, "high": 3, "critical": 4}
DENSITY_METHOD = (
    f"Blocks of {GRID_CELL_PX} x {GRID_CELL_PX} source pixels. Coverage = debris pixels of the kept "
    "detections / imaged pixels in the block. A detection takes the level of the block holding most "
    "of its pixels. Hotspots join 8-adjacent High and Critical blocks (Moderate when there are none)."
)


def level_for_coverage(coverage_percent: float) -> str:
    if coverage_percent >= DENSITY_THRESHOLDS["critical"]:
        return "critical"
    if coverage_percent >= DENSITY_THRESHOLDS["high"]:
        return "high"
    if coverage_percent >= DENSITY_THRESHOLDS["moderate"]:
        return "moderate"
    return "low"


def _max_level(levels: Sequence[Optional[str]]) -> Optional[str]:
    present = [DENSITY_LEVELS.index(level) for level in levels if level]
    return DENSITY_LEVELS[max(present)] if present else None


def _block_bounds(scene: Scene, x0: int, y0: int, x1: int, y1: int) -> Dict[str, float]:
    """WGS84 bounds of a pixel block: the box around its four corners, reprojected."""
    t = scene.transform  # written out: affine 3 deprecates `*` and older versions lack `@`
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    xs = [t.a * x + t.b * y + t.c for x, y in corners]
    ys = [t.d * x + t.e * y + t.f for x, y in corners]
    lngs, lats = warp.transform(scene.crs, "EPSG:4326", xs, ys)
    return {
        "north": round(max(lats), 7),
        "south": round(min(lats), 7),
        "east": round(max(lngs), 7),
        "west": round(min(lngs), 7),
    }


def _bounds_center(bounds: Dict[str, float]) -> Tuple[float, float]:
    return (bounds["north"] + bounds["south"]) / 2, (bounds["east"] + bounds["west"]) / 2


def compute_density(
    detection_raster: np.ndarray,
    valid: np.ndarray,
    detections: List[Dict[str, Any]],
    scene: Scene,
    pixel_area_m2: float,
    resolution_m: float,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], Optional[str]]:
    """
    Density grid, hotspots and the observation's level, from the model's pixels.

    `detection_raster` numbers each pixel's detection (1 = detections[0], 0 = none), as returned by
    find_detections, so cells count the debris that is actually in them; suppressed stripes are not
    counted. Sets every detection's densityLevel in place. Rows count from the south edge and
    columns from the west, like the frontend's grid (cell ids r{row}c{col}); only cells holding
    debris are listed.
    """
    height, width = detection_raster.shape
    rows = -(-height // GRID_CELL_PX)
    cols = -(-width // GRID_CELL_PX)
    # Raster rows run from the north; grid rows from the south.
    grid_row = rows - 1 - np.arange(height) // GRID_CELL_PX
    grid_col = np.arange(width) // GRID_CELL_PX
    cell_of_pixel = grid_row[:, None] * cols + grid_col[None, :]

    imaged = np.bincount(cell_of_pixel[valid], minlength=rows * cols)
    count = len(detections)
    debris = detection_raster > 0
    # Pixels per (cell, detection) pair, in one pass.
    pairs = np.bincount(
        cell_of_pixel[debris].astype(np.int64) * (count + 1) + detection_raster[debris],
        minlength=rows * cols * (count + 1),
    ).reshape(rows * cols, count + 1)

    cells: Dict[int, Dict[str, Any]] = {}
    for index in np.flatnonzero(pairs.sum(axis=1)):
        row, col = divmod(int(index), cols)
        raster_row = rows - 1 - row
        x0, y0 = col * GRID_CELL_PX, raster_row * GRID_CELL_PX
        x1, y1 = min(x0 + GRID_CELL_PX, width), min(y0 + GRID_CELL_PX, height)
        area = float(imaged[index]) * pixel_area_m2
        debris_area = float(pairs[index].sum()) * pixel_area_m2
        coverage = 100.0 * debris_area / area if area else 0.0
        cells[int(index)] = {
            "id": f"r{row}c{col}",
            "row": row,
            "col": col,
            "bounds": _block_bounds(scene, x0, y0, x1, y1),
            "areaM2": round(area, 2),
            "debrisAreaM2": round(debris_area, 2),
            "coveragePercent": round(coverage, 4),
            "level": level_for_coverage(coverage),
            "detectionAreasM2": {
                detections[n - 1]["id"]: round(float(pairs[index, n]) * pixel_area_m2, 2)
                for n in np.flatnonzero(pairs[index, 1:]) + 1
            },
        }

    # A detection's level: the cell with most of its pixels (the first such cell, south to north).
    for n, detection in enumerate(detections, start=1):
        detection["densityLevel"] = cells[int(np.argmax(pairs[:, n]))]["level"]

    ordered = [cells[index] for index in sorted(cells)]
    grid = {
        "method": DENSITY_METHOD,
        "cellSizeM": round(GRID_CELL_PX * resolution_m, 4),
        "cellSizePx": GRID_CELL_PX,
        "rows": rows,
        "cols": cols,
        "thresholds": dict(DENSITY_THRESHOLDS),
        "cells": ordered,
    }
    hotspots = find_hotspots(cells, rows, cols, {d["id"]: d["confidence"] for d in detections})
    return grid, hotspots, _max_level([cell["level"] for cell in ordered])


def find_hotspots(
    cells: Dict[int, Dict[str, Any]], rows: int, cols: int, confidences: Dict[str, float]
) -> List[Dict[str, Any]]:
    """
    findHotspots in frontend/src/lib/hotspots.ts: 8-adjacent cells at High or Critical form a
    hotspot; with none, Moderate cells do; Low-only scenes have none. Ranked by priority score =
    debris area x mean detection confidence x level weight.
    """
    levels = {cell["level"] for cell in cells.values()}
    if levels & {"high", "critical"}:
        eligible = {"high", "critical"}
    elif "moderate" in levels:
        eligible = {"moderate"}
    else:
        return []

    def at(row: int, col: int) -> Optional[Dict[str, Any]]:
        if 0 <= row < rows and 0 <= col < cols:
            cell = cells.get(row * cols + col)
            if cell and cell["level"] in eligible:
                return cell
        return None

    visited = set()
    groups: List[List[Dict[str, Any]]] = []
    for index in sorted(cells):  # row-major from the south-west, as the frontend walks its grid
        start = cells[index]
        if start["level"] not in eligible or start["id"] in visited:
            continue
        visited.add(start["id"])
        group, stack = [], [start]
        while stack:
            cell = stack.pop()
            group.append(cell)
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    neighbour = at(cell["row"] + dr, cell["col"] + dc) if (dr or dc) else None
                    if neighbour and neighbour["id"] not in visited:
                        visited.add(neighbour["id"])
                        stack.append(neighbour)
        groups.append(group)

    unranked = []
    for group in groups:
        level = _max_level([cell["level"] for cell in group]) or "low"
        total = sum(cell["debrisAreaM2"] for cell in group)
        ids = sorted({i for cell in group for i in cell["detectionAreasM2"]})
        mean_confidence = sum(confidences[i] for i in ids) / len(ids) if ids else 0.0
        bounds = {
            "north": max(c["bounds"]["north"] for c in group),
            "south": min(c["bounds"]["south"] for c in group),
            "east": max(c["bounds"]["east"] for c in group),
            "west": min(c["bounds"]["west"] for c in group),
        }
        if total > 0:
            lat = sum(_bounds_center(c["bounds"])[0] * c["debrisAreaM2"] for c in group) / total
            lng = sum(_bounds_center(c["bounds"])[1] * c["debrisAreaM2"] for c in group) / total
        else:
            lat, lng = _bounds_center(bounds)
        unranked.append(
            {
                "level": level,
                "bounds": bounds,
                "centroid": {"lat": round(lat, 7), "lng": round(lng, 7)},
                "cellIds": sorted(cell["id"] for cell in group),
                "detectionIds": ids,
                "totalAreaM2": round(total, 2),
                "meanConfidence": round(mean_confidence, 4),
                "priorityScore": round(total * mean_confidence * HOTSPOT_LEVEL_WEIGHTS[level], 4),
            }
        )
    unranked.sort(key=lambda hotspot: -hotspot["priorityScore"])
    return [{"id": f"hotspot-{rank}", "rank": rank, **h} for rank, h in enumerate(unranked, start=1)]


# ---------------------------------------------------------------------------------------------
# 6. Observation
# ---------------------------------------------------------------------------------------------


def _iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_patch_name(stem: str) -> Optional[Dict[str, Any]]:
    """MARIDA names are S2_<day>-<month>-<yy>_<tile>_<n>; day values reach 30, months only 12."""
    match = PATCH_NAME.match(stem)
    if not match:
        return None
    day, month, year, tile, index = match.groups()
    try:
        date = datetime(2000 + int(year), int(month), int(day), tzinfo=timezone.utc)
    except ValueError:
        return None
    region = roi_mapping.get(tile)  # for example "Haiti (18QYF)"
    place = region.split(" (")[0] if region else None
    return {
        "date": date.date().isoformat(),
        "tile": tile,
        "region": region,
        "index": int(index) if index is not None else None,
        # Short display name; the full patch id stays in maridaPatch.id.
        "name": f"{place} patch {index}" if place and index is not None else stem,
    }


def _pixel_area_m2(scene: Scene) -> float:
    if _is_metric_projected(scene.crs):
        return abs(scene.transform.a * scene.transform.e - scene.transform.b * scene.transform.d)
    # Geographic CRS: footprint area in the local UTM zone, shared out over the pixels.
    left, bottom, right, top = rasterio.transform.array_bounds(scene.height, scene.width, scene.transform)
    footprint = Polygon([(left, bottom), (right, bottom), (right, top), (left, top)])
    return _area_m2(footprint, scene.crs) / (scene.width * scene.height)


def overlay_grid(scene: Scene) -> Tuple[Affine, int, int, Dict[str, float]]:
    """EPSG:4326 grid the PNG overlays are warped to; its bounds are the observation bounds."""
    left, bottom, right, top = rasterio.transform.array_bounds(scene.height, scene.width, scene.transform)
    # Pixel count from GDAL's suggestion; extent from the densified footprint (rounded outwards),
    # so every detection vertex lies inside the bounds.
    _, width, height = warp.calculate_default_transform(
        scene.crs, "EPSG:4326", scene.width, scene.height, left=left, bottom=bottom, right=right, top=top
    )
    west, south, east, north = warp.transform_bounds(
        scene.crs, "EPSG:4326", left, bottom, right, top, densify_pts=21
    )
    step = 1e-7
    west, south = np.floor(west / step) * step, np.floor(south / step) * step
    east, north = np.ceil(east / step) * step, np.ceil(north / step) * step
    transform = rasterio.transform.from_bounds(west, south, east, north, width, height)
    bounds = {"north": round(north, 7), "south": round(south, 7), "east": round(east, 7), "west": round(west, 7)}
    return transform, width, height, bounds


def _percent(part: int, whole: int) -> float:
    return round(100.0 * part / whole, 4) if whole else 0.0


def location_label(bounds: Dict[str, float]) -> str:
    """A region name from the image centre, for images that are not named MARIDA patches."""
    lat = (bounds["north"] + bounds["south"]) / 2
    lng = (bounds["east"] + bounds["west"]) / 2
    # No comma: the frontend groups regions by the text after the last comma.
    return f"Near {abs(lat):.2f}° {'N' if lat >= 0 else 'S'} {abs(lng):.2f}° {'E' if lng >= 0 else 'W'}"


def _crs_string(crs: CRS) -> str:
    epsg = crs.to_epsg()
    return f"EPSG:{epsg}" if epsg else crs.to_string()


def _crs_name(crs: CRS) -> str:
    """The CRS's own name from its WKT, for example "WGS 84 / UTM zone 16N"."""
    match = re.match(r'\s*[A-Z_]+\["([^"]+)"', crs.to_wkt())
    return match.group(1) if match else _crs_string(crs)


def _pixel_size_unit(crs: CRS) -> str:
    if _is_metric_projected(crs):
        return "m"
    return "degree" if crs.is_geographic else (crs.linear_units or "unit")


def geospatial_summary(
    scene: Scene, valid: np.ndarray, detection_raster: np.ndarray, pixel_area: float, debris_area: float
) -> Dict[str, Any]:
    """
    Raster facts and debris figures for the analysis report: size, bands, CRS, pixel size and area,
    scene area, debris pixels (the kept detections, so stripe artefacts are not counted), debris
    coverage of the whole scene, and the debris centroid (mean of the debris pixel centres).
    """
    total_pixels = scene.width * scene.height
    scene_area = total_pixels * pixel_area
    rows, cols = np.nonzero(detection_raster > 0)
    debris_centroid = None
    if rows.size:
        # The transform is affine, so the mean of the pixel centres maps to the mean of their
        # coordinates.
        x, y = rasterio.transform.xy(scene.transform, float(rows.mean()), float(cols.mean()), offset="center")
        lng, lat = _to_wgs84_point(scene.crs, x, y)
        debris_centroid = {"lat": round(lat, 7), "lng": round(lng, 7)}
    x, y = rasterio.transform.xy(scene.transform, scene.height / 2, scene.width / 2, offset="ul")
    centre_lng, centre_lat = _to_wgs84_point(scene.crs, x, y)
    return {
        "width": scene.width,
        "height": scene.height,
        "bandCount": int(scene.image.shape[0]),
        "dataType": scene.dtype,
        "crs": _crs_string(scene.crs),
        "crsName": _crs_name(scene.crs),
        "pixelSizeX": round(abs(float(scene.transform.a)), 9),
        "pixelSizeY": round(abs(float(scene.transform.e)), 9),
        "pixelSizeUnit": _pixel_size_unit(scene.crs),
        "pixelAreaM2": round(pixel_area, 4),
        "totalPixels": total_pixels,
        "validPixels": int(valid.sum()),
        "sceneAreaM2": round(scene_area, 2),
        "debrisPixels": int(rows.size),
        "debrisAreaM2": round(debris_area, 2),
        "debrisCoveragePercent": round(100.0 * debris_area / scene_area, 6) if scene_area else 0.0,
        "debrisCentroid": debris_centroid,
        "sceneCentre": {"lat": round(centre_lat, 7), "lng": round(centre_lng, 7)},
    }


def run_pipeline(
    tif_path: PathLike,
    *,
    source: str = "satellite",
    region: Optional[str] = None,
    captured_at: Optional[str] = None,
    min_pixels: int = 1,
    observation_id: Optional[str] = None,
    device: Optional[torch.device] = None,
    tile_size: int = TILE_SIZE,
    tile_overlap: int = TILE_OVERLAP,
    reference_path: Optional[PathLike] = None,
    on_stage: Optional[Callable[[str], None]] = None,
) -> PipelineResult:
    """
    Runs the model on one 11-band Sentinel-2 GeoTIFF.

    Raises PipelineError (INVALID_BANDS, NO_GEOREF, UNREADABLE, TOO_LARGE) for files it refuses.
    `reference_path` is a MARIDA *_cl.tif label; when omitted, a matching one under data/patches
    is used if it exists. `on_stage` is called with "preprocess", "detect" and "map" as each
    stage starts, so a caller can report real progress.
    """
    notify = on_stage or (lambda stage: None)
    started = datetime.now(timezone.utc)
    t0 = time.perf_counter()
    notify("preprocess")
    scene = read_scene(tif_path)
    stem = scene.path.stem
    patch = parse_patch_name(stem)
    observation_id = observation_id or stem

    standardised, valid = preprocess(scene.image)
    t1 = time.perf_counter()
    notify("detect")

    model, device, model_version = load_model(device)
    probabilities = predict_probabilities(standardised, model, device, tile_size, tile_overlap)
    class_map = (np.argmax(probabilities, axis=0) + 1).astype(np.uint8)
    class_map[~valid] = 0
    t2 = time.perf_counter()
    notify("map")

    pixel_area = _pixel_area_m2(scene)
    detections, suppressed, detection_raster = find_detections(
        class_map, probabilities, valid, scene, observation_id, pixel_area, min_pixels
    )
    _, _, _, bounds = overlay_grid(scene)
    resolution = (
        round(float((abs(scene.transform.a) + abs(scene.transform.e)) / 2), 4)
        if _is_metric_projected(scene.crs)
        else round(float(np.sqrt(pixel_area)), 4)
    )
    density_grid, hotspots, density_level = compute_density(
        detection_raster, valid, detections, scene, pixel_area, resolution
    )
    t3 = time.perf_counter()

    valid_pixels = int(valid.sum())
    class_counts = {cid: int(((class_map == cid) & valid).sum()) for cid in CLASS_NAMES}
    cloud_percent = _percent(class_counts[CLOUDS], valid_pixels)
    water_pixels = valid_pixels - class_counts[CLOUDS]
    water_area = water_pixels * pixel_area
    debris_area = float(sum(d["areaM2"] for d in detections))
    detected_pixels = sum(d["sourcePixelCount"] for d in detections)
    average_confidence = (
        round(sum(d["confidence"] * d["sourcePixelCount"] for d in detections) / detected_pixels, 4)
        if detected_pixels
        else None
    )

    warnings: List[str] = []
    if average_confidence is not None and average_confidence < LOW_CONFIDENCE_THRESHOLD:
        warnings.append("LOW_CONFIDENCE")
    if cloud_percent > HIGH_CLOUD_PERCENT:
        warnings.append("HIGH_CLOUD")
    if suppressed:
        warnings.append("STRIPE_ARTEFACT")

    reference = _find_reference(scene, reference_path)
    timings = {
        "preprocessMs": round((t1 - t0) * 1000, 1),
        "detectMs": round((t2 - t1) * 1000, 1),
        "mapMs": round((t3 - t2) * 1000, 1),
    }
    observation: Dict[str, Any] = {
        "id": observation_id,
        "name": patch["name"] if patch else stem,
        "source": source,
        # MARIDA names carry the day only; noon UTC keeps that day in every time zone from -11 to +11.
        "capturedAt": captured_at
        or (f"{patch['date']}T12:00:00.000Z" if patch else _iso(started)),
        "region": region or (patch["region"] if patch and patch["region"] else location_label(bounds)),
        "imageUrl": "",
        "previewUrl": "",
        "maskUrl": "",
        "bounds": bounds,
        "crs": _crs_string(scene.crs),
        "status": "completed",
        "debrisAreaM2": round(debris_area, 2),
        "waterAreaM2": round(water_area, 2),
        "waterAreaDefinition": WATER_DEFINITION,
        "coveragePercent": min(round(100.0 * debris_area / water_area, 6), 100.0) if water_area else 0.0,
        "averageConfidence": average_confidence,
        "densityLevel": density_level,
        "detections": detections,
        "densityGrid": density_grid,
        "hotspots": hotspots,
        # Class-1 regions left out as stripe artefacts (STRIPE_*); still drawn in classes.png and
        # counted in sceneContext, which describe the raw class map.
        "suppressedRegions": suppressed,
        "warnings": warnings,
        "cloudCoveragePercent": cloud_percent,
        "resolutionM": resolution,
        "sceneContext": {
            "validPixels": valid_pixels,
            "debrisPercent": _percent(class_counts[DEBRIS], valid_pixels),
            "cloudPercent": cloud_percent,
            "shipPercent": _percent(class_counts[SHIP], valid_pixels),
            "foamPercent": _percent(class_counts[FOAM], valid_pixels),
            "sargassumPercent": _percent(sum(class_counts[c] for c in SARGASSUM), valid_pixels),
            "naturalOrganicPercent": _percent(class_counts[NATURAL_ORGANIC], valid_pixels),
            "classPixelCounts": {str(cid): n for cid, n in class_counts.items()},
        },
        "classPalette": [
            {
                "id": cid,
                "name": CLASS_NAMES[cid],
                "color": CLASS_COLORS[cid],
                "opacity": OVERLAY_ALPHA if CLASS_COLORS[cid] else 0.0,
                "drawn": CLASS_COLORS[cid] is not None,
            }
            for cid in CLASS_NAMES
        ],
        "overlay": {"crs": "EPSG:4326", "bounds": bounds},
        "geospatial": geospatial_summary(scene, valid, detection_raster, pixel_area, debris_area),
        "processing": {
            "startedAt": _iso(started),
            "finishedAt": _iso(datetime.now(timezone.utc)),
            "modelName": MODEL_NAME,
            "modelVersion": model_version,
            "device": str(device),
            "stagesMs": timings,
        },
    }
    metrics = load_model_metrics()
    if metrics:
        observation["modelMetrics"] = metrics
    if patch:
        observation["maridaPatch"] = {"id": stem, "tile": patch["tile"], "date": patch["date"], "split": _split_of(stem)}
    if reference is not None:
        observation["referenceDebrisPixels"] = int(reference.sum())

    return PipelineResult(
        observation=observation,
        class_map=class_map,
        probabilities=probabilities,
        valid=valid,
        scene=scene,
        timings_ms=timings,
        reference_debris=reference,
    )


_SPLITS: Optional[Dict[str, str]] = None


def _split_of(stem: str) -> Optional[str]:
    """train, val or test for a MARIDA patch, from data/splits (ids there drop the S2_ prefix)."""
    global _SPLITS
    if _SPLITS is None:
        _SPLITS = {}
        for split in ("train", "val", "test"):
            path = REPO_ROOT / "data" / "splits" / f"{split}_X.txt"
            if path.exists():
                for line in path.read_text().split():
                    _SPLITS[f"S2_{line.strip()}"] = split
    return _SPLITS.get(stem)


def reference_label_path(stem: str) -> Optional[Path]:
    """data/patches/<scene>/<patch>_cl.tif for a MARIDA patch name, when it exists."""
    if not PATCH_NAME.match(stem):
        return None
    folder = "_".join(stem.split("_")[:-1])
    path = REPO_ROOT / "data" / "patches" / folder / f"{stem}_cl.tif"
    return path if path.exists() else None


def _find_reference(scene: Scene, reference_path: Optional[PathLike]) -> Optional[np.ndarray]:
    path = Path(reference_path) if reference_path else reference_label_path(scene.path.stem)
    if path is None or not path.exists():
        return None
    with rasterio.open(path) as ds:
        if (ds.width, ds.height) != (scene.width, scene.height):
            return None
        return ds.read(1) == DEBRIS


# ---------------------------------------------------------------------------------------------
# 7. Image outputs
# ---------------------------------------------------------------------------------------------


def _hex_rgb(color: str) -> Tuple[int, int, int]:
    color = color.lstrip("#")
    return int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)


# GDAL interpolates the reprojection with an error of up to 0.125 px unless told otherwise. On a
# 1,400 px mosaic that put 8% of the overlay's debris pixels one pixel off (about 1 m past a pixel
# edge); tolerance 0 transforms every pixel exactly. Older rasterio has no such argument.
_EXACT_WARP = {"tolerance": 0} if "tolerance" in inspect.signature(warp.reproject).parameters else {}


def _warp(array: np.ndarray, scene: Scene, resampling: Resampling) -> np.ndarray:
    """One uint8 band from the scene grid to the EPSG:4326 overlay grid; 0 outside the footprint."""
    transform, width, height, _ = overlay_grid(scene)
    # GDAL bumps valid pixels that equal the destination nodata, so values are shifted up by one
    # (in uint16, so 255 still fits) and 0 is left to mean "outside the footprint".
    out = np.zeros((height, width), dtype=np.uint16)
    warp.reproject(
        source=array.astype(np.uint16) + 1,
        destination=out,
        src_transform=scene.transform,
        src_crs=scene.crs,
        dst_transform=transform,
        dst_crs="EPSG:4326",
        resampling=resampling,
        src_nodata=None,
        dst_nodata=0,
        **_EXACT_WARP,
    )
    return np.where(out > 0, out - 1, 0).astype(np.uint8)


def _stretch(band: np.ndarray, mask: np.ndarray) -> np.ndarray:
    values = band[mask & np.isfinite(band)]
    if values.size == 0:
        return np.zeros(band.shape, dtype=np.uint8)
    low, high = np.percentile(values, [2, 98])
    scaled = (band - low) / (high - low if high > low else 1.0)
    return (np.clip(np.nan_to_num(scaled), 0, 1) * 255).astype(np.uint8)


def preview_rgba(result: PipelineResult) -> np.ndarray:
    """True colour (band indexes 3, 2, 1: 665, 560, 490 nm), 2-98 percentile stretch."""
    scene = result.scene
    rgb = [_warp(_stretch(scene.image[i], result.valid), scene, Resampling.bilinear) for i in (3, 2, 1)]
    alpha = _warp(result.valid.astype(np.uint8) * 255, scene, Resampling.nearest)
    return np.dstack(rgb + [alpha])


def classes_rgba(result: PipelineResult) -> np.ndarray:
    warped = _warp(result.class_map, result.scene, Resampling.nearest)
    rgba = np.zeros(warped.shape + (4,), dtype=np.uint8)
    for cid, color in CLASS_COLORS.items():
        if color is None:
            continue
        r, g, b = _hex_rgb(color)
        rgba[warped == cid] = (r, g, b, round(255 * OVERLAY_ALPHA))
    return rgba


def reference_rgba(result: PipelineResult) -> Optional[np.ndarray]:
    if result.reference_debris is None:
        return None
    warped = _warp(result.reference_debris.astype(np.uint8), result.scene, Resampling.nearest)
    rgba = np.zeros(warped.shape + (4,), dtype=np.uint8)
    r, g, b = _hex_rgb(REFERENCE_COLOR)
    rgba[warped == 1] = (r, g, b, round(255 * OVERLAY_ALPHA))
    return rgba


_QGIS_PALETTE: Optional[Dict[int, Tuple[str, str]]] = None


def qgis_palette() -> Dict[int, Tuple[str, str]]:
    """Class id to (label, hex colour) for classes 1 to 11, read from the shipped QGIS style."""
    global _QGIS_PALETTE
    if _QGIS_PALETTE is None:
        root = ElementTree.parse(QGIS_STYLE_PATH).getroot()
        entries = {
            int(entry.get("value", "0")): (entry.get("label", ""), entry.get("color", "#000000"))
            for entry in root.iter("paletteEntry")
        }
        _QGIS_PALETTE = {cid: entries[cid] for cid in CLASS_NAMES if cid in entries}
    return _QGIS_PALETTE


def segmentation_rgba(result: PipelineResult) -> np.ndarray:
    """The class map on the source pixel grid (not warped), in the QGIS style's colours."""
    rgba = np.zeros(result.class_map.shape + (4,), dtype=np.uint8)
    for cid, (_, color) in qgis_palette().items():
        r, g, b = _hex_rgb(color)
        rgba[result.class_map == cid] = (r, g, b, 255)
    return rgba


def scene_rgba(result: PipelineResult) -> np.ndarray:
    """True colour on the source pixel grid (preview.png's stretch), pixel for pixel with the mask."""
    image, valid = result.scene.image, result.valid
    rgb = [_stretch(image[i], valid) for i in (3, 2, 1)]
    return np.dstack(rgb + [valid.astype(np.uint8) * 255])


def write_segmentation_tif(result: PipelineResult, path: PathLike) -> None:
    """
    The predicted class map as a single-band uint8 GeoTIFF in the source CRS and geotransform, as
    app.py's save_prediction_as_tiff writes it, plus 0 as nodata (pixels with no input data), a
    colour table from the QGIS style and the class names as band metadata.
    """
    scene = result.scene
    profile = {
        "driver": "GTiff",
        "height": scene.height,
        "width": scene.width,
        "count": 1,
        "dtype": "uint8",
        "crs": scene.crs,
        "transform": scene.transform,
        "nodata": 0,
        "compress": "deflate",
    }
    palette = qgis_palette()
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(result.class_map.astype(np.uint8), 1)
        dst.write_colormap(1, {cid: _hex_rgb(color) + (255,) for cid, (_, color) in palette.items()})
        dst.set_band_description(1, "Predicted class (1 to 11, 0 = no data)")
        dst.update_tags(1, **{f"CLASS_{cid}": name for cid, name in CLASS_NAMES.items()})
        dst.update_tags(MODEL=MODEL_NAME, SOURCE=scene.path.name)


def write_outputs(result: PipelineResult, out_dir: PathLike, url_prefix: str = "") -> Dict[str, Any]:
    """
    Writes observation.json, preview.png, classes.png and, with a reference label, reference.png.
    PNGs are warped to EPSG:4326 over observation.bounds so a map can stretch them over the bounds.
    Also writes segmentation.tif (the class map as a GeoTIFF, for QGIS) and, on the source pixel
    grid, segmentation.png (the mask in the QGIS style's colours) and scene.png (true colour).
    `url_prefix` is prepended to the file names in the JSON (for example "/samples/<id>/").
    """
    from PIL import Image

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    observation = dict(result.observation)
    Image.fromarray(preview_rgba(result), "RGBA").save(out / "preview.png", optimize=True)
    Image.fromarray(classes_rgba(result), "RGBA").save(out / "classes.png", optimize=True)
    observation["previewUrl"] = f"{url_prefix}preview.png"
    observation["imageUrl"] = f"{url_prefix}preview.png"
    observation["maskUrl"] = f"{url_prefix}classes.png"
    write_segmentation_tif(result, out / "segmentation.tif")
    Image.fromarray(segmentation_rgba(result), "RGBA").save(out / "segmentation.png", optimize=True)
    Image.fromarray(scene_rgba(result), "RGBA").save(out / "scene.png", optimize=True)
    observation["segmentationUrl"] = f"{url_prefix}segmentation.tif"
    observation["segmentationPreviewUrl"] = f"{url_prefix}segmentation.png"
    observation["sceneImageUrl"] = f"{url_prefix}scene.png"
    reference = reference_rgba(result)
    if reference is not None:
        Image.fromarray(reference, "RGBA").save(out / "reference.png", optimize=True)
        observation["referenceUrl"] = f"{url_prefix}reference.png"
    (out / "observation.json").write_text(json.dumps(observation, indent=1) + "\n", encoding="utf-8")
    return observation


def run_and_write(tif_path: PathLike, out_dir: PathLike, url_prefix: str = "", **kwargs: Any) -> Dict[str, Any]:
    return write_outputs(run_pipeline(tif_path, **kwargs), out_dir, url_prefix)


__all__: Sequence[str] = (
    "PipelineError",
    "PipelineResult",
    "run_pipeline",
    "write_outputs",
    "run_and_write",
    "load_model",
    "preprocess",
    "predict_probabilities",
)
