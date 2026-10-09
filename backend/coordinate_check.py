"""
Independent checks of where the pipeline puts things on the Earth.

The pipeline converts coordinates with GDAL/PROJ (rasterio). This module does not: it carries its
own UTM <-> WGS84 conversion (Karney's 6th-order Krueger series, "Transverse Mercator with an
accuracy of a few nanometers", J. Geodesy 2011) and its own MGRS lettering, so a mistake in how the
pipeline calls PROJ, or in axis order, rounding or pixel offsets, cannot hide behind the same code.
It also reads the MARIDA annotation shapefiles (no shapefile library needed), which human
annotators drew in UTM independently of the raster patches.

    from backend.coordinate_check import check_image
    report = check_image("semantic_segmentation/unet/sample_data/S2_9-10-17_16PEC_0.tif")

check_image returns plain numbers (errors in metres, agreement shares); backend/tests/
test_coordinates.py holds the thresholds and backend/scripts/check_coordinates.py prints a table.
"""
from __future__ import annotations

import json
import math
import re
import struct
import warnings
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, Union

import numpy as np
import rasterio
from rasterio import features, warp
from rasterio.transform import Affine
from shapely.geometry import Polygon, mapping

from backend import pipeline

REPO_ROOT = Path(__file__).resolve().parents[1]
SHAPEFILES = REPO_ROOT / "data" / "shapefiles"
PATCHES = REPO_ROOT / "data" / "patches"
PathLike = Union[str, Path]

# --------------------------------------------------------------------------------------------
# WGS84 transverse Mercator (UTM), Karney 2011, series to n^6
# --------------------------------------------------------------------------------------------

A_AXIS = 6378137.0
FLATTENING = 1 / 298.257223563
K0 = 0.9996
FALSE_EASTING = 500000.0

_n = FLATTENING / (2 - FLATTENING)
_E = math.sqrt(FLATTENING * (2 - FLATTENING))
_A = A_AXIS / (1 + _n) * (1 + _n**2 / 4 + _n**4 / 64 + _n**6 / 256)
_ALPHA = (
    _n / 2 - 2 * _n**2 / 3 + 5 * _n**3 / 16 + 41 * _n**4 / 180 - 127 * _n**5 / 288 + 7891 * _n**6 / 37800,
    13 * _n**2 / 48 - 3 * _n**3 / 5 + 557 * _n**4 / 1440 + 281 * _n**5 / 630 - 1983433 * _n**6 / 1935360,
    61 * _n**3 / 240 - 103 * _n**4 / 140 + 15061 * _n**5 / 26880 + 167603 * _n**6 / 181440,
    49561 * _n**4 / 161280 - 179 * _n**5 / 168 + 6601661 * _n**6 / 7257600,
    34729 * _n**5 / 80640 - 3418889 * _n**6 / 1995840,
    212378941 * _n**6 / 319334400,
)
_BETA = (
    _n / 2 - 2 * _n**2 / 3 + 37 * _n**3 / 96 - _n**4 / 360 - 81 * _n**5 / 512 + 96199 * _n**6 / 604800,
    _n**2 / 48 + _n**3 / 15 - 437 * _n**4 / 1440 + 46 * _n**5 / 105 - 1118711 * _n**6 / 3870720,
    17 * _n**3 / 480 - 37 * _n**4 / 840 - 209 * _n**5 / 4480 + 5569 * _n**6 / 90720,
    4397 * _n**4 / 161280 - 11 * _n**5 / 504 - 830251 * _n**6 / 7257600,
    4583 * _n**5 / 161280 - 108847 * _n**6 / 3991680,
    20648693 * _n**6 / 638668800,
)


def _central_meridian(zone: int) -> float:
    return math.radians(zone * 6 - 183)


def _false_northing(north: bool) -> float:
    return 0.0 if north else 10_000_000.0


def utm_forward(lng, lat, zone: int, north: bool = True):
    """(easting, northing, point scale factor) for degrees; arrays welcome."""
    lam = np.radians(np.asarray(lng, dtype=np.float64)) - _central_meridian(zone)
    phi = np.radians(np.asarray(lat, dtype=np.float64))
    tau = np.tan(phi)
    sigma = np.sinh(_E * np.arctanh(_E * tau / np.sqrt(1 + tau**2)))
    tau_c = tau * np.sqrt(1 + sigma**2) - sigma * np.sqrt(1 + tau**2)  # conformal latitude, tan
    xi_c = np.arctan2(tau_c, np.cos(lam))
    eta_c = np.arcsinh(np.sin(lam) / np.sqrt(tau_c**2 + np.cos(lam) ** 2))
    xi, eta = xi_c.copy(), eta_c.copy()
    p, q = np.ones_like(xi), np.zeros_like(xi)
    for j, alpha in enumerate(_ALPHA, start=1):
        xi = xi + alpha * np.sin(2 * j * xi_c) * np.cosh(2 * j * eta_c)
        eta = eta + alpha * np.cos(2 * j * xi_c) * np.sinh(2 * j * eta_c)
        p = p + 2 * j * alpha * np.cos(2 * j * xi_c) * np.cosh(2 * j * eta_c)
        q = q + 2 * j * alpha * np.sin(2 * j * xi_c) * np.sinh(2 * j * eta_c)
    easting = K0 * _A * eta + FALSE_EASTING
    northing = K0 * _A * xi + _false_northing(north)
    k = (
        K0
        * np.sqrt(1 - _E**2 * np.sin(phi) ** 2)
        * np.sqrt(1 + tau**2)
        / np.sqrt(tau_c**2 + np.cos(lam) ** 2)
        * (_A / A_AXIS)
        * np.sqrt(p**2 + q**2)
    )
    return easting, northing, k


def utm_inverse(easting, northing, zone: int, north: bool = True):
    """(lng, lat) in degrees for UTM metres; arrays welcome."""
    eta = (np.asarray(easting, dtype=np.float64) - FALSE_EASTING) / (K0 * _A)
    xi = (np.asarray(northing, dtype=np.float64) - _false_northing(north)) / (K0 * _A)
    xi_c, eta_c = xi.copy(), eta.copy()
    for j, beta in enumerate(_BETA, start=1):
        xi_c = xi_c - beta * np.sin(2 * j * xi) * np.cosh(2 * j * eta)
        eta_c = eta_c - beta * np.cos(2 * j * xi) * np.sinh(2 * j * eta)
    tau_c = np.sin(xi_c) / np.sqrt(np.sinh(eta_c) ** 2 + np.cos(xi_c) ** 2)
    tau = tau_c.copy()
    for _ in range(10):  # Newton on tau; converges to machine precision in 2 or 3 steps
        sigma = np.sinh(_E * np.arctanh(_E * tau / np.sqrt(1 + tau**2)))
        tau_i = tau * np.sqrt(1 + sigma**2) - sigma * np.sqrt(1 + tau**2)
        step = (
            (tau_c - tau_i)
            / np.sqrt(1 + tau_i**2)
            * (1 + (1 - _E**2) * tau**2)
            / ((1 - _E**2) * np.sqrt(1 + tau**2))
        )
        tau = tau + step
        if np.all(np.abs(step) < 1e-14):
            break
    lam = np.arctan2(np.sinh(eta_c), np.cos(xi_c))
    return np.degrees(lam + _central_meridian(zone)), np.degrees(np.arctan(tau))


def metres_between(lng1, lat1, lng2, lat2) -> np.ndarray:
    """Ground distance for points a few km apart or less (local tangent plane on the ellipsoid)."""
    lat = np.radians((np.asarray(lat1) + np.asarray(lat2)) / 2)
    w = np.sqrt(1 - _E**2 * np.sin(lat) ** 2)
    m_lat = A_AXIS * (1 - _E**2) / w**3 * math.pi / 180  # metres per degree of latitude
    m_lng = A_AXIS / w * np.cos(lat) * math.pi / 180
    return np.hypot((np.asarray(lng1) - np.asarray(lng2)) * m_lng, (np.asarray(lat1) - np.asarray(lat2)) * m_lat)


def utm_zone_of(crs: Any) -> Tuple[int, bool]:
    epsg = crs.to_epsg()
    if epsg and 32601 <= epsg <= 32660:
        return epsg - 32600, True
    if epsg and 32701 <= epsg <= 32760:
        return epsg - 32700, False
    raise ValueError(f"{crs} is not a WGS84 UTM zone")


# --------------------------------------------------------------------------------------------
# MGRS tile (the Sentinel-2 tile name in every MARIDA file name)
# --------------------------------------------------------------------------------------------

_BANDS = "CDEFGHJKLMNPQRSTUVWX"
_ROW_LETTERS = "ABCDEFGHJKLMNPQRSTUV"
_COLUMN_SETS = ("STUVWXYZ", "ABCDEFGH", "JKLMNPQR")  # by zone % 3


def mgrs_tile(easting: float, northing: float, zone: int, lat: float) -> str:
    """Zone, latitude band and 100 km square of a point, for example "16PEC"."""
    band = _BANDS[min(int((lat + 80) // 8), len(_BANDS) - 1)]
    column = _COLUMN_SETS[zone % 3][int(easting // 100_000) - 1]
    row_offset = 5 if zone % 2 == 0 else 0
    row = _ROW_LETTERS[(int(northing // 100_000) + row_offset) % 20]
    return f"{zone}{band}{column}{row}"


# A Sentinel-2 tile is its MGRS 100 km square extended to 109.8 km east and south of the square's
# north-west corner, so a tile overlaps its neighbours and can reach into the next latitude band:
# tile 16PEC runs past 16 deg N, where points are lettered 16Q.
SENTINEL2_TILE_M = 109_800
# Real tile origins sit a little off the square's corner (for example 499980 or 399960 instead of
# 500000 or 400000), so 10, 20 and 60 m pixels share one grid; four MARIDA 16PEC patches start at
# 499980. Containment is checked with this margin.
TILE_ORIGIN_MARGIN_M = 60.0


def sentinel2_tile_extent(tile: str) -> Tuple[int, float, float, float, float]:
    """(zone, west, east, south, north) in UTM metres for a tile name such as "16PEC"."""
    match = re.fullmatch(r"(\d{1,2})([C-X])([A-Z])([A-V])", tile)
    if not match:
        raise ValueError(f"{tile} is not an MGRS tile name")
    zone, band, column, row = int(match[1]), match[2], match[3], match[4]
    west = (_COLUMN_SETS[zone % 3].index(column) + 1) * 100_000.0
    # Row letters repeat every 2,000 km; the band picks the cycle.
    band_south = -80 + 8 * _BANDS.index(band)
    band_north = band_south + (12 if band == "X" else 8)
    north_hemisphere = band >= "N"
    _, n_south, _ = utm_forward(zone * 6 - 183, band_south, zone, north_hemisphere)
    _, n_north, _ = utm_forward(zone * 6 - 183, band_north, zone, north_hemisphere)
    row_offset = 5 if zone % 2 == 0 else 0
    base = (_ROW_LETTERS.index(row) - row_offset) % 20
    squares = [100_000.0 * (base + 20 * cycle) for cycle in range(5)]
    square = next(s for s in squares if s + 100_000 > n_south and s < n_north)
    north = square + 100_000
    return zone, west, west + SENTINEL2_TILE_M, north - SENTINEL2_TILE_M, north


def inside_named_tile(tile: str, crs: Any, bounds: Sequence[float]) -> bool:
    """True when a raster's (west, south, east, north) UTM bounds lie in Sentinel-2 tile `tile`."""
    zone, _ = utm_zone_of(crs)
    t_zone, west, east, south, north = sentinel2_tile_extent(tile)
    m = TILE_ORIGIN_MARGIN_M
    left, bottom, right, top = bounds
    return t_zone == zone and west - m <= left and right <= east + m and south - m <= bottom and top <= north + m


# --------------------------------------------------------------------------------------------
# MARIDA annotation shapefiles (polygons, class id in the dbf)
# --------------------------------------------------------------------------------------------


def _signed_area(ring: Sequence[Tuple[float, float]]) -> float:
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:])) / 2


def read_annotations(scene: str) -> List[Tuple[int, Polygon]]:
    """(class id, polygon in the shapefile's UTM CRS) for every annotation of a MARIDA scene."""
    shp = (SHAPEFILES / f"{scene}.shp").read_bytes()
    dbf = (SHAPEFILES / f"{scene}.dbf").read_bytes()
    count, header_len, record_len = struct.unpack("<IHH", dbf[4:12])
    fields, offset = [], 32
    while dbf[offset] != 0x0D:
        fields.append((dbf[offset : offset + 11].split(b"\0")[0].decode(), dbf[offset + 16]))
        offset += 32
    classes = []
    for r in range(count):
        record, position = dbf[header_len + r * record_len : header_len + (r + 1) * record_len], 1
        values = {}
        for name, length in fields:
            values[name] = record[position : position + length].decode().strip()
            position += length
        classes.append(int(float(values["id"])))

    shapes, offset = [], 100
    while offset < len(shp):
        _, length = struct.unpack(">ii", shp[offset : offset + 8])
        content = shp[offset + 8 : offset + 8 + 2 * length]
        offset += 8 + 2 * length
        if struct.unpack("<i", content[:4])[0] != 5:  # polygon
            shapes.append(None)
            continue
        parts, points = struct.unpack("<ii", content[36:44])
        starts = list(struct.unpack(f"<{parts}i", content[44 : 44 + 4 * parts])) + [points]
        xy = struct.unpack(f"<{2 * points}d", content[44 + 4 * parts : 44 + 4 * parts + 16 * points])
        rings = [[(xy[2 * i], xy[2 * i + 1]) for i in range(a, b)] for a, b in zip(starts, starts[1:])]
        # Shapefile outer rings run clockwise, holes counter-clockwise.
        polygons: List[Polygon] = []
        for ring in rings:
            if _signed_area(ring) <= 0 or not polygons:
                polygons.append(Polygon(ring))
            else:
                last = polygons.pop()
                polygons.append(Polygon(last.exterior.coords, [*map(lambda h: h.coords, last.interiors), ring]))
        shapes.append(polygons)
    return [(cid, polygon) for cid, parts in zip(classes, shapes) if parts for polygon in parts]


def annotation_registration(tif: PathLike, max_shift: int = 2) -> Dict[str, Any]:
    """
    Rasterises the annotators' polygons on the patch's own pixel grid and compares them with the
    MARIDA label raster (*_cl.tif). MARIDA labelled every pixel a polygon touches (`all_touched`;
    the pixel-centre rule misses 2 to 43% of the labels). Agreement is the share of pixels, over
    the union of labelled and burnt pixels, whose class matches; it is measured for every
    whole-pixel shift up to `max_shift`, and a correctly georeferenced patch peaks at (0, 0).
    """
    tif = Path(tif)
    stem = tif.stem
    scene = "_".join(stem.split("_")[:-1])
    label_path = PATCHES / scene / f"{stem}_cl.tif"
    with rasterio.open(label_path) as ds:
        labels = ds.read(1)
        transform, shape = ds.transform, (ds.height, ds.width)
    annotations = read_annotations(scene)
    labelled = labels > 0
    if not labelled.any():
        return {"labelledPixels": 0}
    pad = max_shift
    big = Affine(
        transform.a, transform.b, transform.c - pad * transform.a, transform.d, transform.e, transform.f - pad * transform.e
    )
    burnt = features.rasterize(
        ((mapping(polygon), cid) for cid, polygon in annotations),
        out_shape=(shape[0] + 2 * pad, shape[1] + 2 * pad),
        transform=big,
        fill=0,
        dtype="uint8",
        all_touched=True,
    )
    agreement = {}
    for dy in range(-max_shift, max_shift + 1):
        for dx in range(-max_shift, max_shift + 1):
            window = burnt[pad + dy : pad + dy + shape[0], pad + dx : pad + dx + shape[1]]
            union = labelled | (window > 0)
            agreement[(dy, dx)] = float((window[union] == labels[union]).mean())
    best = max(agreement, key=agreement.get)
    return {
        "labelledPixels": int(labelled.sum()),
        "polygons": len(annotations),
        "agreement": agreement[(0, 0)],
        "bestShift": best,
        "nextBest": max(v for k, v in agreement.items() if k != (0, 0)),
    }


# --------------------------------------------------------------------------------------------
# A larger image, like a real upload, from patches of one MARIDA scene
# --------------------------------------------------------------------------------------------

MOSAIC_PX = 1400  # over one 1024 px prediction window; 86 MB of float32, under the upload limit


def build_mosaic(scene: str, west: float, north: float, out_path: PathLike, size: int = MOSAIC_PX) -> Dict[str, Tuple[int, int]]:
    """
    Writes the patches of `scene` that fit in a `size` x `size` grid at (west, north), no data
    (NaN) elsewhere, as one GeoTIFF; returns {patch id: (row, col)} of each placed patch.
    """
    placed: Dict[str, Tuple[int, int]] = {}
    image = np.full((pipeline.INPUT_BANDS, size, size), np.nan, dtype=np.float32)
    profile = None
    for tif in sorted((PATCHES / scene).glob("*.tif")):
        if re.search(r"_(cl|conf)$", tif.stem):
            continue
        with rasterio.open(tif) as ds:
            t = ds.transform
            col, row = (t.c - west) / t.a, (north - t.f) / -t.e
            if col != int(col) or row != int(row):
                raise ValueError(f"{tif.name} is not on the pixel grid of the mosaic")
            col, row = int(col), int(row)
            if 0 <= col and col + ds.width <= size and 0 <= row and row + ds.height <= size:
                image[:, row : row + ds.height, col : col + ds.width] = ds.read()
                placed[tif.stem] = (row, col)
                profile = profile or ds.profile.copy()
    if profile is None:
        raise ValueError(f"No patch of {scene} fits in the mosaic")
    profile.update(width=size, height=size, transform=Affine(t.a, 0, west, 0, t.e, north), nodata=None, compress="deflate")
    with rasterio.open(out_path, "w", **profile) as out:
        out.write(image)
    return placed


# --------------------------------------------------------------------------------------------
# Checks of one pipeline run
# --------------------------------------------------------------------------------------------


def _positions(geometry: Dict[str, Any]) -> Iterable[Tuple[float, float]]:
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    for polygon in polygons:
        for ring in polygon:
            for lng, lat in ring:
                yield lng, lat


def _to_pixels(scene, lng, lat, zone, north):
    """WGS84 -> fractional (col, row) on the source grid, through the independent UTM code."""
    x, y, _ = utm_forward(lng, lat, zone, north)
    inverse = ~scene.transform
    col = inverse.a * x + inverse.b * y + inverse.c
    row = inverse.d * x + inverse.e * y + inverse.f
    return np.asarray(col), np.asarray(row)


def _to_lnglat(scene, col, row, zone, north):
    t = scene.transform
    x = t.a * np.asarray(col) + t.b * np.asarray(row) + t.c
    y = t.d * np.asarray(col) + t.e * np.asarray(row) + t.f
    return utm_inverse(x, y, zone, north)


def _pixel_metres(scene) -> float:
    return float(math.sqrt(abs(scene.transform.a * scene.transform.e - scene.transform.b * scene.transform.d)))


def check_image(tif: PathLike, result: Optional[pipeline.PipelineResult] = None) -> Dict[str, Any]:
    """Runs the pipeline (unless a result is given) and measures every coordinate it produced."""
    if result is None:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            result = pipeline.run_pipeline(tif)
    scene, o = result.scene, result.observation
    zone, north = utm_zone_of(scene.crs)
    size = _pixel_metres(scene)
    report: Dict[str, Any] = {"id": o["id"], "detections": len(o["detections"]), "hotspots": len(o["hotspots"])}

    # 1. Where the image is: centre, its MGRS tile, and agreement of this code with PROJ.
    centre_lng, centre_lat = _to_lnglat(scene, scene.width / 2, scene.height / 2, zone, north)
    cx = scene.transform.c + scene.transform.a * scene.width / 2
    cy = scene.transform.f + scene.transform.e * scene.height / 2
    report["centre"] = (round(float(centre_lat), 6), round(float(centre_lng), 6))
    report["mgrsAtCentre"] = mgrs_tile(cx, cy, zone, float(centre_lat))
    proj_lng, proj_lat = warp.transform(scene.crs, "EPSG:4326", [cx], [cy])
    report["projAgreementM"] = float(metres_between(centre_lng, centre_lat, proj_lng[0], proj_lat[0]))
    # The Sentinel-2 tile in the file name must contain the whole image.
    patch = pipeline.parse_patch_name(o["id"]) if "maridaPatch" in o else None
    if patch:
        report["tile"] = patch["tile"]
        report["insideNamedTile"] = inside_named_tile(patch["tile"], scene.crs, rasterio.transform.array_bounds(
            scene.height, scene.width, scene.transform
        ))

    # 2. Bounds: hold the whole footprint, and no more than rounding beyond it.
    edge = np.linspace(0, 1, 257)
    cols = np.concatenate([edge * scene.width, np.full(257, scene.width), edge[::-1] * scene.width, np.zeros(257)])
    rows = np.concatenate([np.zeros(257), edge * scene.height, np.full(257, scene.height), edge[::-1] * scene.height])
    f_lng, f_lat = _to_lnglat(scene, cols, rows, zone, north)
    b = o["bounds"]
    mid_lng, mid_lat = f_lng.mean(), f_lat.mean()
    # Signed, in metres: negative would mean part of the image lies outside the bounds.
    slack = [
        np.sign(b["north"] - f_lat.max()) * metres_between(mid_lng, b["north"], mid_lng, f_lat.max()),
        np.sign(f_lat.min() - b["south"]) * metres_between(mid_lng, b["south"], mid_lng, f_lat.min()),
        np.sign(b["east"] - f_lng.max()) * metres_between(b["east"], mid_lat, f_lng.max(), mid_lat),
        np.sign(f_lng.min() - b["west"]) * metres_between(b["west"], mid_lat, f_lng.min(), mid_lat),
    ]
    report["boundsSlackM"] = (float(min(slack)), float(max(slack)))

    # 3. Detections: every vertex on a pixel corner, outlines covering exactly the debris pixels.
    vertex_errors, centroid_errors = [0.0], [0.0]
    area_errors = [0.0]
    kept = np.zeros((scene.height, scene.width), dtype=bool)
    for detection in o["detections"]:
        lng, lat = np.array(list(_positions(detection["geometry"]))).T
        col, row = _to_pixels(scene, lng, lat, zone, north)
        vertex_errors.append(float(np.max(np.hypot(col - np.round(col), row - np.round(row)))) * size)
        # Back on the pixel grid, the outline must cover exactly the pixels it came from.
        pixel_geometry = _geometry_on_grid(detection["geometry"], scene, zone, north)
        mask = features.rasterize([(pixel_geometry, 1)], out_shape=kept.shape, fill=0, dtype="uint8") > 0
        if (mask & kept).any() or int(mask.sum()) != detection["sourcePixelCount"]:
            report.setdefault("outlineMismatches", []).append(detection["id"])
        kept |= mask
        # Centroid: mean of the pixel centres, converted independently.
        rr, cc = np.nonzero(mask)
        c_lng, c_lat = _to_lnglat(scene, cc.mean() + 0.5, rr.mean() + 0.5, zone, north)
        centroid_errors.append(
            float(metres_between(detection["centroid"]["lng"], detection["centroid"]["lat"], c_lng, c_lat))
        )
        # Area: the pipeline reports grid area (pixels x 100 m2); the ground area differs by k^2.
        _, _, k = utm_forward(c_lng, c_lat, zone, north)
        ground = mask.sum() * size**2 / float(k) ** 2
        area_errors.append(abs(detection["areaM2"] - ground) / ground)
    debris = (result.class_map == pipeline.DEBRIS) & result.valid
    suppressed = sum(r["pixels"] for r in o["suppressedRegions"])
    report["outlinePixelsMatch"] = bool(
        not report.get("outlineMismatches")
        and not (kept & ~debris).any()
        and int(kept.sum()) + suppressed == int(debris.sum())
    )
    report["vertexErrorM"] = max(vertex_errors)
    report["centroidErrorM"] = max(centroid_errors)
    report["groundAreaErrorPct"] = 100 * max(area_errors)

    # 4. Density cells: bounds of their 25 x 25 pixel block; hotspots inside their cells.
    cell_errors = [0.0]
    for cell in o["densityGrid"]["cells"]:
        px = pipeline.GRID_CELL_PX
        raster_row = o["densityGrid"]["rows"] - 1 - cell["row"]
        x0, y0 = cell["col"] * px, raster_row * px
        x1, y1 = min(x0 + px, scene.width), min(y0 + px, scene.height)
        lngs, lats = _to_lnglat(scene, np.array([x0, x1, x1, x0]), np.array([y0, y0, y1, y1]), zone, north)
        got, mid_lng, mid_lat = cell["bounds"], lngs.mean(), lats.mean()
        cell_errors += [
            float(metres_between(mid_lng, got["north"], mid_lng, lats.max())),
            float(metres_between(mid_lng, got["south"], mid_lng, lats.min())),
            float(metres_between(got["east"], mid_lat, lngs.max(), mid_lat)),
            float(metres_between(got["west"], mid_lat, lngs.min(), mid_lat)),
        ]
        block = kept[y0:y1, x0:x1].sum() * size**2
        if abs(block - cell["debrisAreaM2"]) > 1e-6:
            report.setdefault("cellAreaMismatches", []).append(cell["id"])
    report["cellBoundsErrorM"] = max(cell_errors)
    cells = {c["id"]: c for c in o["densityGrid"]["cells"]}
    report["hotspotsInsideCells"] = all(
        all(i in cells for i in h["cellIds"])
        and h["bounds"]["south"] <= h["centroid"]["lat"] <= h["bounds"]["north"]
        and h["bounds"]["west"] <= h["centroid"]["lng"] <= h["bounds"]["east"]
        for h in o["hotspots"]
    )

    # 5. Overlay PNGs: each drawn debris pixel of classes.png lands on a debris pixel of the image.
    report.update(_overlay_registration(result, zone, north))

    # 6. Human annotations: the label raster lines up with the annotators' polygons.
    if (PATCHES / "_".join(o["id"].split("_")[:-1]) / f"{o['id']}_cl.tif").exists():
        report["annotations"] = annotation_registration(scene.path)

    # 7. The copy the frontend ships (public/samples) carries these same coordinates.
    shipped = REPO_ROOT / "frontend" / "public" / "samples" / o["id"] / "observation.json"
    if shipped.exists():
        sent = json.loads(shipped.read_text(encoding="utf-8"))
        report["shippedSampleMatches"] = bool(
            sent["bounds"] == o["bounds"]
            and [(d["id"], d["geometry"], d["centroid"]) for d in sent["detections"]]
            == [(d["id"], d["geometry"], d["centroid"]) for d in o["detections"]]
            and sent["densityGrid"]["cells"] == o["densityGrid"]["cells"]
            and sent["hotspots"] == o["hotspots"]
        )
    return report


def _geometry_on_grid(geometry: Dict[str, Any], scene, zone: int, north: bool) -> Dict[str, Any]:
    """A WGS84 GeoJSON geometry moved onto the source pixel grid (identity transform)."""

    def move(ring):
        lng, lat = np.array(ring).T
        col, row = _to_pixels(scene, lng, lat, zone, north)
        return list(zip(col.tolist(), row.tolist()))

    if geometry["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": [move(r) for r in geometry["coordinates"]]}
    return {"type": "MultiPolygon", "coordinates": [[move(r) for r in p] for p in geometry["coordinates"]]}


def _overlay_registration(result: pipeline.PipelineResult, zone: int, north: bool) -> Dict[str, Any]:
    scene, o = result.scene, result.observation
    classes = pipeline.classes_rgba(result)
    height, width = classes.shape[:2]
    b = o["bounds"]
    debris_rgb = np.array(pipeline._hex_rgb(pipeline.CLASS_COLORS[pipeline.DEBRIS]))
    drawn = (classes[..., 3] > 0) & np.all(classes[..., :3] == debris_rgb, axis=-1)
    if not drawn.any():
        return {"overlayDebrisPixels": 0}
    rr, cc = np.nonzero(drawn)
    # The PNG is stretched over the bounds, so its pixel centres are linear in lng and lat.
    lng = b["west"] + (cc + 0.5) * (b["east"] - b["west"]) / width
    lat = b["north"] - (rr + 0.5) * (b["north"] - b["south"]) / height
    col, row = _to_pixels(scene, lng, lat, zone, north)
    inside = (col >= 0) & (col < scene.width) & (row >= 0) & (row < scene.height)
    hit = np.zeros(lng.shape, dtype=bool)
    hit[inside] = result.class_map[row[inside].astype(int), col[inside].astype(int)] == pipeline.DEBRIS
    # The other way: the centre of each debris pixel of the image, found on the PNG.
    dr, dc = np.nonzero(result.class_map == pipeline.DEBRIS)
    d_lng, d_lat = _to_lnglat(scene, dc + 0.5, dr + 0.5, zone, north)
    png_col = np.floor((d_lng - b["west"]) / (b["east"] - b["west"]) * width).astype(int)
    png_row = np.floor((b["north"] - d_lat) / (b["north"] - b["south"]) * height).astype(int)
    covered = drawn[np.clip(png_row, 0, height - 1), np.clip(png_col, 0, width - 1)]
    return {
        "overlayDebrisPixels": int(drawn.sum()),
        # Share of red PNG pixels that sit on a debris pixel of the image.
        "overlayHitShare": float(hit.mean()),
        # Share of the image's debris pixels whose centre falls on a red PNG pixel.
        "overlayCoverShare": float(covered.mean()),
        "overlayPixelM": float(metres_between(b["west"], b["south"], b["east"], b["south"]) / width),
    }


__all__ = (
    "utm_forward",
    "utm_inverse",
    "mgrs_tile",
    "sentinel2_tile_extent",
    "inside_named_tile",
    "read_annotations",
    "annotation_registration",
    "check_image",
)
