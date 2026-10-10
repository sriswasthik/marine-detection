"""
Stage 7 Script: Controlled Model-Training Experiments.
Evaluates Class-Weighted Cross Entropy, Focal Loss, and Combined Dice+CE Loss functions.
Saves candidate checkpoints separately without overwriting the baseline model checkpoint.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from tqdm import tqdm

REPO_ROOT = Path(__file__).resolve().parents[2]
UNET_DIR = REPO_ROOT / "semantic_segmentation" / "unet"

for p in (str(UNET_DIR), str(REPO_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

from dataloader import GenDEBRIS, bands_mean, bands_std, class_distr, gen_weights
from loss_functions import DiceLoss
from unet_plus_plus import UNetPlusPlus
import torchvision.transforms as transforms


class FocalLoss(nn.Module):
    """Multi-class Focal Loss ignoring index -1."""

    def __init__(self, alpha: float = 1.0, gamma: float = 2.0, ignore_index: int = -1):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.ignore_index = ignore_index

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        mask = targets != self.ignore_index
        if not torch.any(mask):
            return torch.tensor(0.0, device=logits.device, requires_grad=True)

        logits = logits.permute(0, 2, 3, 1).reshape(-1, logits.shape[1])[mask.reshape(-1)]
        targets = targets.reshape(-1)[mask.reshape(-1)]

        log_pt = F.log_softmax(logits, dim=1)
        log_pt = log_pt.gather(1, targets.unsqueeze(1)).squeeze(1)
        pt = log_pt.exp()

        loss = -1.0 * self.alpha * ((1.0 - pt) ** self.gamma) * log_pt
        return loss.mean()


class CombinedDiceCELoss(nn.Module):
    """Combined CrossEntropy and Dice Loss."""

    def __init__(self, weight_ce: float = 1.0, weight_dice: float = 1.0, class_weights: torch.Tensor = None):
        super().__init__()
        self.weight_ce = weight_ce
        self.weight_dice = weight_dice
        self.ce_loss = nn.CrossEntropyLoss(weight=class_weights, ignore_index=-1)
        self.dice_loss = DiceLoss()

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        ce = self.ce_loss(logits, targets)
        dice = self.dice_loss(logits, targets)
        return self.weight_ce * ce + self.weight_dice * dice


def train_epoch(
    model: nn.Module,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
    device: torch.device,
) -> float:
    model.train()
    total_loss = 0.0

    for images, targets in loader:
        images = images.to(device)
        targets = targets.long().to(device)

        optimizer.zero_grad()
        logits = model(images)
        loss = criterion(logits, targets)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    return total_loss / max(1, len(loader))


def evaluate_candidate(
    model: nn.Module,
    val_loader: DataLoader,
    device: torch.device,
    decision_th: float = 0.5,
) -> Dict[str, float]:
    model.eval()
    total_tp, total_fp, total_fn = 0, 0, 0

    with torch.no_grad():
        for images, targets in val_loader:
            images = images.to(device)
            targets = targets.long().to(device)

            logits = model(images)
            probs = F.softmax(logits, dim=1)[:, 0]  # Debris prob
            debris_gt = (targets == 0)
            valid_mask = (targets != -1)

            pred_debris = (probs >= decision_th) & valid_mask

            tp = np.sum((pred_debris & debris_gt).cpu().numpy())
            fp = np.sum((pred_debris & (~debris_gt) & valid_mask).cpu().numpy())
            fn = np.sum(((~pred_debris) & debris_gt & valid_mask).cpu().numpy())

            total_tp += tp
            total_fp += fp
            total_fn += fn

    prec = float(total_tp / (total_tp + total_fp)) if (total_tp + total_fp) > 0 else 0.0
    rec = float(total_tp / (total_tp + total_fn)) if (total_tp + total_fn) > 0 else 0.0
    f1 = float(2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
    iou = float(total_tp / (total_tp + total_fp + total_fn)) if (total_tp + total_fp + total_fn) > 0 else 0.0

    return {"precision": prec, "recall": rec, "f1": f1, "iou": iou, "tp": int(total_tp), "fp": int(total_fp), "fn": int(total_fn)}


def run_experiment(
    exp_name: str,
    criterion: nn.Module,
    epochs: int = 3,
    lr: float = 1e-4,
    batch_size: int = 4,
    device_str: str = "cpu",
) -> Dict[str, Any]:
    print(f"\n--- Running Experiment: {exp_name} ({epochs} epochs) ---")
    device = torch.device(device_str if torch.cuda.is_available() and device_str == "cuda" else "cpu")

    transform_train = transforms.Compose([
        transforms.ToTensor(),
        transforms.RandomHorizontalFlip(),
    ])
    transform_test = transforms.Compose([transforms.ToTensor()])
    standardization = transforms.Normalize(bands_mean, bands_std)

    dataset_train = GenDEBRIS("train", transform=transform_train, standardization=standardization, agg_to_water=True)
    dataset_val = GenDEBRIS("val", transform=transform_test, standardization=standardization, agg_to_water=True)

    train_loader = DataLoader(dataset_train, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(dataset_val, batch_size=batch_size, shuffle=False)

    # Initialize from Phase 1 baseline weights for fast convergence
    baseline_path = UNET_DIR / "trained_models" / "best_model_marine_debris.pth"
    model = UNetPlusPlus(input_bands=11, output_classes=11, hidden_channels=16)
    model.load_state_dict(torch.load(baseline_path, map_location=device))
    model.to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    best_f1 = 0.0
    best_metrics = {}
    checkpoint_out = UNET_DIR / "trained_models" / f"candidate_{exp_name}.pth"

    for ep in range(1, epochs + 1):
        loss_val = train_epoch(model, train_loader, optimizer, criterion, device)
        val_metrics = evaluate_candidate(model, val_loader, device)

        print(f"Epoch {ep}/{epochs} - Loss: {loss_val:.4f} | Val P: {val_metrics['precision']*100:.2f}%, R: {val_metrics['recall']*100:.2f}%, F1: {val_metrics['f1']*100:.2f}%")

        if val_metrics["f1"] > best_f1:
            best_f1 = val_metrics["f1"]
            best_metrics = val_metrics
            torch.save(model.state_dict(), str(checkpoint_out))

    return {
        "experiment_name": exp_name,
        "epochs": epochs,
        "learning_rate": lr,
        "checkpoint": str(checkpoint_out.name),
        "val_metrics": best_metrics,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", default=2, type=int)
    parser.add_argument("--batch_size", default=4, type=int)
    parser.add_argument("--device", default="cpu", type=str)
    args = parser.parse_args()

    # 1. Baseline inverse class weights
    cw = gen_weights(class_distr[:11]).to(args.device)

    exp_a = run_experiment("class_weighted_ce", nn.CrossEntropyLoss(weight=cw, ignore_index=-1), epochs=args.epochs, batch_size=args.batch_size, device_str=args.device)
    exp_b = run_experiment("focal_loss", FocalLoss(gamma=2.0), epochs=args.epochs, batch_size=args.batch_size, device_str=args.device)
    exp_c = run_experiment("combined_dice_ce", CombinedDiceCELoss(class_weights=cw), epochs=args.epochs, batch_size=args.batch_size, device_str=args.device)

    summary = [exp_a, exp_b, exp_c]

    logs_dir = REPO_ROOT / "logs"
    logs_dir.mkdir(exist_ok=True)
    with open(logs_dir / "phase_02_training_experiments.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("\nTraining experiments completed. Candidate checkpoints saved separately in trained_models/.")


if __name__ == "__main__":
    main()
