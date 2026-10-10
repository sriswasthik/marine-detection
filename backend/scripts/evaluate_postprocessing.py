"""
Stage 6 Script: Post-Processing Improvements Evaluation.
Evaluates combinations of minimum connected component area, average region confidence, and stripe artifact filters
on the MARIDA validation set predictions.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from scipy import ndimage
import torch
from torch.utils.data import DataLoader

REPO_ROOT = Path(__file__).resolve().parents[2]
UNET_DIR = REPO_ROOT / "semantic_segmentation" / "unet"

for p in (str(UNET_DIR), str(REPO_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

from dataloader import GenDEBRIS, bands_mean, bands_std
from unet_plus_plus import UNetPlusPlus
import torchvision.transforms as transforms


def apply_postprocessing(
    debris_mask: np.ndarray,
    debris_probs: np.ndarray,
    min_area_px: int = 0,
    min_avg_conf: float = 0.0,
    stripe_max_thickness: int = 8,
    stripe_min_span_frac: float = 0.5,
) -> np.ndarray:
    """
    Apply post-processing rules to raw binary debris predictions.
    
    Rules:
    1. Filter out connected components smaller than min_area_px.
    2. Filter out connected components with mean confidence below min_avg_conf.
    3. Filter out stripe artifacts along grid borders.
    """
    if not np.any(debris_mask):
        return debris_mask

    cleaned_mask = debris_mask.copy()
    labeled, num_features = ndimage.label(cleaned_mask, structure=np.ones((3, 3), dtype=bool))

    height, width = cleaned_mask.shape

    for comp_idx in range(1, num_features + 1):
        comp_pixels = (labeled == comp_idx)
        area_px = np.sum(comp_pixels)

        # 1. Minimum area filter
        if min_area_px > 0 and area_px < min_area_px:
            cleaned_mask[comp_pixels] = False
            continue

        # 2. Average confidence filter
        if min_avg_conf > 0.0:
            avg_conf = np.mean(debris_probs[comp_pixels])
            if avg_conf < min_avg_conf:
                cleaned_mask[comp_pixels] = False
                continue

        # 3. Stripe artifact detection
        if stripe_max_thickness > 0:
            ys, xs = np.where(comp_pixels)
            span_y = ys.max() - ys.min() + 1
            span_x = xs.max() - xs.min() + 1

            is_vert_stripe = (span_y >= height * stripe_min_span_frac) and (span_x <= stripe_max_thickness)
            is_horiz_stripe = (span_x >= width * stripe_min_span_frac) and (span_y <= stripe_max_thickness)

            if is_vert_stripe or is_horiz_stripe:
                cleaned_mask[comp_pixels] = False

    return cleaned_mask


def evaluate_postprocessing_grid(
    device_str: str = "cpu",
    checkpoint_path: Path = None,
) -> List[Dict[str, Any]]:
    """Grid search over post-processing parameters on validation set."""
    if checkpoint_path is None:
        checkpoint_path = UNET_DIR / "trained_models" / "best_model_marine_debris.pth"

    device = torch.device(device_str if torch.cuda.is_available() and device_str == "cuda" else "cpu")
    transform_test = transforms.Compose([transforms.ToTensor()])
    standardization = transforms.Normalize(bands_mean, bands_std)

    dataset = GenDEBRIS("val", transform=transform_test, standardization=standardization, agg_to_water=True)
    loader = DataLoader(dataset, batch_size=4, shuffle=False)

    model = UNetPlusPlus(input_bands=11, output_classes=11, hidden_channels=16)
    model.load_state_dict(torch.load(checkpoint_path, map_location=device))
    model.to(device)
    model.eval()

    all_probs = []
    all_gts = []

    with torch.no_grad():
        for images, targets in loader:
            images = images.to(device)
            logits = model(images)
            probs = torch.nn.functional.softmax(logits, dim=1)[:, 0].cpu().numpy() # Debris prob
            gts = targets.numpy()

            for b in range(len(images)):
                valid = (gts[b] != -1)
                all_probs.append((probs[b], valid, gts[b] == 0))

    # Grid search candidate configurations
    area_options = [0, 2, 4, 8]
    conf_options = [0.0, 0.40, 0.50, 0.60]
    th_options = [0.5, 0.6]

    results = []

    for base_th in th_options:
        for min_area in area_options:
            for min_conf in conf_options:
                total_tp, total_fp, total_fn = 0, 0, 0

                for prob_map, valid_map, gt_debris in all_probs:
                    raw_mask = (prob_map >= base_th) & valid_map
                    post_mask = apply_postprocessing(
                        raw_mask, prob_map, min_area_px=min_area, min_avg_conf=min_conf
                    )

                    tp = np.sum(post_mask & gt_debris & valid_map)
                    fp = np.sum(post_mask & (~gt_debris) & valid_map)
                    fn = np.sum((~post_mask) & gt_debris & valid_map)

                    total_tp += tp
                    total_fp += fp
                    total_fn += fn

                prec = float(total_tp / (total_tp + total_fp)) if (total_tp + total_fp) > 0 else 0.0
                rec = float(total_tp / (total_tp + total_fn)) if (total_tp + total_fn) > 0 else 0.0
                f1 = float(2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
                iou = float(total_tp / (total_tp + total_fp + total_fn)) if (total_tp + total_fp + total_fn) > 0 else 0.0

                results.append({
                    "decision_threshold": base_th,
                    "min_area_pixels": min_area,
                    "min_avg_confidence": min_conf,
                    "precision": prec,
                    "recall": rec,
                    "f1": f1,
                    "iou": iou,
                    "tp": int(total_tp),
                    "fp": int(total_fp),
                    "fn": int(total_fn),
                })

    return results


def main():
    print("=== Evaluating Post-Processing Improvements on Validation Set ===")
    results = evaluate_postprocessing_grid()
    
    logs_dir = REPO_ROOT / "logs"
    logs_dir.mkdir(exist_ok=True)
    with open(logs_dir / "phase_02_postprocessing_experiments.json", "w") as f:
        json.dump(results, f, indent=2)

    # Sort by F1 descending
    results.sort(key=lambda x: x["f1"], reverse=True)
    best = results[0]
    print(f"\nBest Post-Processing Config:")
    print(f"Decision Threshold: {best['decision_threshold']}")
    print(f"Min Area Pixels:    {best['min_area_pixels']}")
    print(f"Min Avg Confidence: {best['min_avg_confidence']}")
    print(f"Precision:          {best['precision']*100:.2f}%")
    print(f"Recall:             {best['recall']*100:.2f}%")
    print(f"F1 Score:           {best['f1']*100:.2f}%")
    print(f"IoU:                {best['iou']*100:.2f}%")


if __name__ == "__main__":
    main()
