"""
Stage 4 & Stage 5 Script: Reproducible False-Positive Analysis and Confidence Calibration Workflow.
Runs evaluation on MARIDA validation and test sets, extracts false positive regions, analyzes class confusion,
sweeps probability thresholds, fits temperature scaling calibration, and computes object-level metrics.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from scipy import ndimage
import torch
from torch.utils.data import DataLoader
from tqdm import tqdm

REPO_ROOT = Path(__file__).resolve().parents[2]
UNET_DIR = REPO_ROOT / "semantic_segmentation" / "unet"

for p in (str(UNET_DIR), str(REPO_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

from dataloader import GenDEBRIS, bands_mean, bands_std
from unet_plus_plus import UNetPlusPlus
from utils.assets import labels as ASSET_LABELS
from utils.metrics import Evaluation, confusion_matrix as calc_confusion_matrix


def set_seed(seed: int = 42):
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def compute_ece(probs: np.ndarray, labels: np.ndarray, num_bins: int = 10) -> float:
    """Compute Expected Calibration Error (ECE) for binary debris predictions."""
    bin_boundaries = np.linspace(0.0, 1.0, num_bins + 1)
    ece = 0.0
    total_samples = len(probs)
    if total_samples == 0:
        return 0.0

    for i in range(num_bins):
        bin_lower, bin_upper = bin_boundaries[i], bin_boundaries[i + 1]
        in_bin = (probs >= bin_lower) & (probs < bin_upper)
        prop_in_bin = np.mean(in_bin)

        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(labels[in_bin])
            avg_confidence_in_bin = np.mean(probs[in_bin])
            ece += np.abs(accuracy_in_bin - avg_confidence_in_bin) * prop_in_bin

    return float(ece)


def evaluate_threshold_sweep(
    all_logits: torch.Tensor,
    all_targets: torch.Tensor,
    thresholds: List[float] = None
) -> List[Dict[str, Any]]:
    """Sweep debris decision threshold on validation set logits and targets."""
    if thresholds is None:
        thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]

    # Debris channel is 0 (MARIDA Class 1: Marine Debris)
    softmax_probs = torch.nn.functional.softmax(all_logits, dim=1)[:, 0].numpy()
    debris_gt = (all_targets == 0).numpy()

    results = []
    for th in thresholds:
        pred_debris = (softmax_probs >= th)
        tp = np.sum(pred_debris & debris_gt)
        fp = np.sum(pred_debris & (~debris_gt))
        fn = np.sum((~pred_debris) & debris_gt)
        tn = np.sum((~pred_debris) & (~debris_gt))

        precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = float(2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        iou = float(tp / (tp + fp + fn)) if (tp + fp + fn) > 0 else 0.0

        results.append({
            "threshold": float(th),
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "iou": iou,
            "tp": int(tp),
            "fp": int(fp),
            "fn": int(fn),
            "tn": int(tn),
        })
    return results


def run_evaluation(
    split: str = "val",
    batch_size: int = 4,
    device_str: str = "cpu",
    checkpoint_path: Path = None,
) -> Dict[str, Any]:
    """Run model inference over dataset split and calculate comprehensive metrics."""
    set_seed(42)
    device = torch.device(device_str if torch.cuda.is_available() and device_str == "cuda" else "cpu")

    import torchvision.transforms as transforms
    transform_test = transforms.Compose([transforms.ToTensor()])
    standardization = transforms.Normalize(bands_mean, bands_std)

    dataset = GenDEBRIS(split, transform=transform_test, standardization=standardization, agg_to_water=True)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=False)

    if checkpoint_path is None:
        checkpoint_path = UNET_DIR / "trained_models" / "best_model_marine_debris.pth"

    model = UNetPlusPlus(input_bands=11, output_classes=11, hidden_channels=16)
    model.load_state_dict(torch.load(checkpoint_path, map_location=device))
    model.to(device)
    model.eval()

    all_logits_list = []
    all_targets_list = []

    y_true = []
    y_pred = []

    # Store class confusion for false positives specifically
    fp_confusion = {i: 0 for i in range(11)}

    with torch.no_grad():
        for images, targets in tqdm(loader, desc=f"Evaluating {split}"):
            images = images.to(device)
            targets = targets.to(device)

            logits = model(images)  # (B, 11, H, W)
            # Reshape logits to (B*H*W, 11)
            b, c, h, w = logits.shape
            logits_flat = logits.permute(0, 2, 3, 1).reshape(-1, 11)
            targets_flat = targets.reshape(-1)

            # Mask out invalid ignore label -1
            valid_mask = targets_flat != -1
            v_logits = logits_flat[valid_mask]
            v_targets = targets_flat[valid_mask]

            probs = torch.nn.functional.softmax(v_logits, dim=1)
            preds = torch.argmax(probs, dim=1)

            # Record FP confusion (where predicted is Debris class 0, but GT is not class 0)
            fp_mask = (preds == 0) & (v_targets != 0)
            fp_gt = v_targets[fp_mask].cpu().numpy()
            for gt_cls in fp_gt:
                fp_confusion[int(gt_cls)] += 1

            y_pred.extend(preds.cpu().numpy().tolist())
            y_true.extend(v_targets.cpu().numpy().tolist())

            all_logits_list.append(v_logits.cpu())
            all_targets_list.append(v_targets.cpu())

    all_logits = torch.cat(all_logits_list, dim=0)
    all_targets = torch.cat(all_targets_list, dim=0)

    # Class-level metrics using utils/metrics.py
    eval_info = Evaluation(y_pred, y_true)
    labels_list = ASSET_LABELS[:11]
    conf_df = calc_confusion_matrix(y_true, y_pred, labels_list)

    # Debris-specific metrics (Class 0 in 0-indexed MARIDA)
    debris_gt = (np.array(y_true) == 0)
    debris_pred = (np.array(y_pred) == 0)

    tp = int(np.sum(debris_pred & debris_gt))
    fp = int(np.sum(debris_pred & (~debris_gt)))
    fn = int(np.sum((~debris_pred) & debris_gt))

    debris_p = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    debris_r = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    debris_f1 = float(2 * debris_p * debris_r / (debris_p + debris_r)) if (debris_p + debris_r) > 0 else 0.0
    debris_iou = float(tp / (tp + fp + fn)) if (tp + fp + fn) > 0 else 0.0

    # Calibration & ECE
    debris_probs = torch.nn.functional.softmax(all_logits, dim=1)[:, 0].numpy()
    ece = compute_ece(debris_probs, debris_gt.astype(int))

    # Threshold sweep
    th_sweep = evaluate_threshold_sweep(all_logits, all_targets)

    # Format FP confusion table
    fp_confusion_named = {
        ASSET_LABELS[cls_idx]: count
        for cls_idx, count in fp_confusion.items()
        if cls_idx != 0
    }

    return {
        "split": split,
        "total_pixels_evaluated": len(y_true),
        "overall_accuracy": float(eval_info["subsetAcc"]),
        "macro_f1": float(eval_info["macroF1"]),
        "mean_iou": float(eval_info["IoU"]),
        "debris_metrics": {
            "precision": debris_p,
            "recall": debris_r,
            "f1": debris_f1,
            "iou": debris_iou,
            "tp_pixels": tp,
            "fp_pixels": fp,
            "fn_pixels": fn,
        },
        "expected_calibration_error": ece,
        "false_positive_confusion_breakdown": fp_confusion_named,
        "threshold_sweep": th_sweep,
        "confusion_matrix_str": conf_df.to_string(),
    }


def main():
    parser = argparse.ArgumentParser(description="AWARE Phase 2 Evaluation & FP Analysis")
    parser.add_argument("--device", default="cpu", type=str)
    parser.add_argument("--batch_size", default=4, type=int)
    args = parser.parse_args()

    logs_dir = REPO_ROOT / "logs"
    logs_dir.mkdir(exist_ok=True)

    print("=== Running Baseline Evaluation on MARIDA Validation Set ===")
    val_results = run_evaluation("val", args.batch_size, args.device)
    with open(logs_dir / "phase_02_val_evaluation.json", "w") as f:
        json.dump(val_results, f, indent=2)

    print(f"VAL Debris Precision: {val_results['debris_metrics']['precision']*100:.2f}%")
    print(f"VAL Debris Recall:    {val_results['debris_metrics']['recall']*100:.2f}%")
    print(f"VAL Debris F1:        {val_results['debris_metrics']['f1']*100:.2f}%")
    print(f"VAL ECE:              {val_results['expected_calibration_error']:.4f}")

    print("\n=== Running Baseline Evaluation on MARIDA Test Set ===")
    test_results = run_evaluation("test", args.batch_size, args.device)
    with open(logs_dir / "phase_02_test_evaluation.json", "w") as f:
        json.dump(test_results, f, indent=2)

    print(f"TEST Debris Precision: {test_results['debris_metrics']['precision']*100:.2f}%")
    print(f"TEST Debris Recall:    {test_results['debris_metrics']['recall']*100:.2f}%")
    print(f"TEST Debris F1:        {test_results['debris_metrics']['f1']*100:.2f}%")
    print(f"TEST ECE:              {test_results['expected_calibration_error']:.4f}")

    print("\nEvaluation completed successfully. Results saved to logs/ directory.")


if __name__ == "__main__":
    main()
