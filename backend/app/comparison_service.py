"""
Temporal Comparison Engine for comparing two Sentinel-2 marine debris observations.
Calculates area change metrics, assesses comparability, matches detection polygons,
and generates GeoJSON change layers.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union

logger = logging.getLogger("backend.comparison")


def bounds_to_polygon(bounds: Dict[str, float]) -> Polygon:
    return Polygon([
        [bounds["west"], bounds["south"]],
        [bounds["east"], bounds["south"]],
        [bounds["east"], bounds["north"]],
        [bounds["west"], bounds["north"]],
        [bounds["west"], bounds["south"]],
    ])


def evaluate_comparability(obs_a: Dict[str, Any], obs_b: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Assess whether two observations are geographically and scientifically comparable."""
    warnings: List[str] = []

    bounds_a = obs_a.get("bounds")
    bounds_b = obs_b.get("bounds")

    if not bounds_a or not bounds_b:
        warnings.append("NO_GEOREF: One or both observations lack geographic bounds.")
        return False, warnings

    poly_a = bounds_to_polygon(bounds_a)
    poly_b = bounds_to_polygon(bounds_b)

    if not poly_a.intersects(poly_b):
        warnings.append("NON_OVERLAPPING: Observations have no spatial intersection.")
        return False, warnings

    intersection_area = poly_a.intersection(poly_b).area
    min_area = min(poly_a.area, poly_b.area)
    overlap_ratio = intersection_area / max(1e-9, min_area)

    if overlap_ratio < 0.20:
        warnings.append(f"LOW_SPATIAL_OVERLAP: Observations share only {overlap_ratio*100:.1f}% spatial overlap.")

    res_a = obs_a.get("resolutionM", 10.0)
    res_b = obs_b.get("resolutionM", 10.0)
    if abs(res_a - res_b) > 5.0:
        warnings.append(f"RESOLUTION_MISMATCH: Baseline resolution is {res_a}m, comparison is {res_b}m.")

    cloud_a = obs_a.get("cloudCoveragePercent", 0.0)
    cloud_b = obs_b.get("cloudCoveragePercent", 0.0)
    if cloud_a > 30.0 or cloud_b > 30.0:
        warnings.append(f"HIGH_CLOUD_COVERAGE: Cloud contamination present (Baseline: {cloud_a:.1f}%, Comparison: {cloud_b:.1f}%).")

    is_comparable = overlap_ratio >= 0.10
    return is_comparable, warnings


def match_detections(
    detections_a: List[Dict[str, Any]],
    detections_b: List[Dict[str, Any]],
    iou_threshold: float = 0.1,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Match detection polygons between observation A (baseline) and B (comparison).
    
    Returns:
        (matched_pairs, baseline_only, comparison_only, change_features)
    """
    shapes_a = []
    for d in detections_a:
        try:
            s = shape(d["geometry"])
            if not s.is_valid:
                s = s.buffer(0)
            shapes_a.append((d, s))
        except Exception:
            continue

    shapes_b = []
    for d in detections_b:
        try:
            s = shape(d["geometry"])
            if not s.is_valid:
                s = s.buffer(0)
            shapes_b.append((d, s))
        except Exception:
            continue

    matched_a = set()
    matched_b = set()
    matched_pairs = []
    change_features = []

    for idx_a, (det_a, s_a) in enumerate(shapes_a):
        best_iou = 0.0
        best_idx_b = -1

        for idx_b, (det_b, s_b) in enumerate(shapes_b):
            if idx_b in matched_b:
                continue
            if s_a.intersects(s_b):
                inter = s_a.intersection(s_b).area
                union = s_a.union(s_b).area
                iou = inter / max(1e-9, union)
                if iou > best_iou:
                    best_iou = iou
                    best_idx_b = idx_b

        if best_iou >= iou_threshold and best_idx_b != -1:
            matched_a.add(idx_a)
            matched_b.add(best_idx_b)
            det_b, s_b = shapes_b[best_idx_b]
            matched_pairs.append({"baseline": det_a, "comparison": det_b, "iou": round(best_iou, 4)})

            # Feature for overlapping detection
            inter_poly = s_a.intersection(s_b)
            change_features.append({
                "type": "Feature",
                "geometry": mapping(inter_poly),
                "properties": {
                    "changeType": "overlapping",
                    "baselineId": det_a["id"],
                    "comparisonId": det_b["id"],
                    "areaM2": det_a["areaM2"],
                    "baselineConfidence": det_a["confidence"],
                    "comparisonConfidence": det_b["confidence"],
                    "matchIoU": round(best_iou, 4),
                },
            })

    baseline_only = []
    for idx_a, (det_a, s_a) in enumerate(shapes_a):
        if idx_a not in matched_a:
            baseline_only.append(det_a)
            change_features.append({
                "type": "Feature",
                "geometry": mapping(s_a),
                "properties": {
                    "changeType": "baseline_only",
                    "detectionId": det_a["id"],
                    "areaM2": det_a["areaM2"],
                    "confidence": det_a["confidence"],
                },
            })

    comparison_only = []
    for idx_b, (det_b, s_b) in enumerate(shapes_b):
        if idx_b not in matched_b:
            comparison_only.append(det_b)
            change_features.append({
                "type": "Feature",
                "geometry": mapping(s_b),
                "properties": {
                    "changeType": "comparison_only",
                    "detectionId": det_b["id"],
                    "areaM2": det_b["areaM2"],
                    "confidence": det_b["confidence"],
                },
            })

    return matched_pairs, baseline_only, comparison_only, change_features


def compare_observations(
    obs_a: Dict[str, Any],
    obs_b: Dict[str, Any],
    iou_threshold: float = 0.1,
) -> Dict[str, Any]:
    """
    Perform complete temporal comparison between two observations.
    
    Args:
        obs_a: Baseline observation dictionary
        obs_b: Comparison observation dictionary
    """
    is_comparable, warnings = evaluate_comparability(obs_a, obs_b)

    area_a = float(obs_a.get("debrisAreaM2", 0.0))
    area_b = float(obs_b.get("debrisAreaM2", 0.0))

    abs_change = area_b - area_a
    pct_change = float((abs_change / area_a) * 100.0) if area_a > 0.0 else None

    dets_a = obs_a.get("detections", [])
    dets_b = obs_b.get("detections", [])

    det_delta = len(dets_b) - len(dets_a)

    matched, base_only, comp_only, change_feats = match_detections(dets_a, dets_b, iou_threshold)

    change_geojson = {
        "type": "FeatureCollection",
        "features": change_feats,
    }

    return {
        "baselineId": obs_a["id"],
        "comparisonId": obs_b["id"],
        "baselineName": obs_a.get("name", obs_a["id"]),
        "comparisonName": obs_b.get("name", obs_b["id"]),
        "baselineCapturedAt": obs_a.get("capturedAt", ""),
        "comparisonCapturedAt": obs_b.get("capturedAt", ""),
        "baselineAreaM2": round(area_a, 2),
        "comparisonAreaM2": round(area_b, 2),
        "absoluteChangeM2": round(abs_change, 2),
        "percentChange": round(pct_change, 2) if pct_change is not None else None,
        "baselineDetectionCount": len(dets_a),
        "comparisonDetectionCount": len(dets_b),
        "detectionCountDelta": det_delta,
        "isComparable": is_comparable,
        "comparabilityWarnings": warnings,
        "matchedDetectionsCount": len(matched),
        "baselineOnlyCount": len(base_only),
        "comparisonOnlyCount": len(comp_only),
        "changeGeoJson": change_geojson,
    }
