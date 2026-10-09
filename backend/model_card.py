"""
Builds backend/model_card.json from logs/evaluating_unet.log.

The log is the only evaluation record in the repository. It holds the evaluation dict written by
semantic_segmentation/unet/evaluation.py, including the full 11-class confusion matrix (rows are
the reference class, columns the predicted class, both in the order of utils/assets.py `labels`).
Marine Debris figures are computed from the raw counts rather than copied from the rounded table.

Run from the repository root:
    python backend/model_card.py
"""
from __future__ import annotations

import ast
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[1]
LOG_PATH = REPO_ROOT / "logs" / "evaluating_unet.log"
CHECKPOINT_PATH = (
    REPO_ROOT / "semantic_segmentation" / "unet" / "trained_models" / "best_model_marine_debris.pth"
)
MODEL_CARD_PATH = Path(__file__).resolve().parent / "model_card.json"

BENCHMARK = "MARIDA test split (from logs/evaluating_unet.log)"
DEBRIS_INDEX = 0  # class id 1, Marine Debris, is row and column 0


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _evaluation_dict(text: str) -> Dict[str, Any]:
    match = re.search(r"Evaluation: (\{.*?\})\n", text, re.S)
    if not match:
        raise ValueError("No 'Evaluation: {...}' entry found in the evaluation log.")
    return ast.literal_eval(match.group(1))


def _checkpoint_in_log(text: str) -> str | None:
    match = re.search(r"Loading model from: (.+)", text)
    if not match:
        return None
    # Keep the repository-relative part; the prefix is a home folder on the author's machine.
    path = match.group(1).strip().replace("\\", "/")
    start = path.find("semantic_segmentation/")
    return path[start:] if start >= 0 else path.rsplit("/", 1)[-1]


def parse_log(text: str) -> Dict[str, Any]:
    evaluation = _evaluation_dict(text)
    matrix: List[List[float]] = evaluation["confusionMatrix"]
    true_positive = float(matrix[DEBRIS_INDEX][DEBRIS_INDEX])
    reference = float(sum(matrix[DEBRIS_INDEX]))
    predicted = float(sum(row[DEBRIS_INDEX] for row in matrix))
    precision = true_positive / predicted if predicted else 0.0
    recall = true_positive / reference if reference else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    union = predicted + reference - true_positive
    iou = true_positive / union if union else 0.0
    return {
        "debrisCounts": {
            "truePositivePixels": int(true_positive),
            "predictedPixels": int(predicted),
            "referencePixels": int(reference),
        },
        "metrics": {
            # Marine Debris (class id 1). Recall is the class pixel accuracy.
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "iou": round(iou, 4),
            # Scene-wide figures over all 11 classes.
            "accuracy": round(float(evaluation["subsetAcc"]), 4),
            "meanIoU": round(float(evaluation["IoU"]), 4),
            "macroF1": round(float(evaluation["macroF1"]), 4),
        },
        "logCheckpoint": _checkpoint_in_log(text),
    }


def build_model_card() -> Dict[str, Any]:
    text = LOG_PATH.read_text(encoding="utf-8")
    parsed = parse_log(text)
    return {
        "modelName": "U-Net marine debris segmentation",
        "modelClass": "UNetPlusPlus (semantic_segmentation/unet/unet_plus_plus.py)",
        "checkpoint": CHECKPOINT_PATH.relative_to(REPO_ROOT).as_posix(),
        "checkpointSha256": file_sha256(CHECKPOINT_PATH),
        "benchmark": BENCHMARK,
        "isPlaceholder": False,
        **parsed,
        "caveats": [
            "The log loaded logCheckpoint on another machine. Its path matches the shipped "
            "checkpoint, but the log carries no hash, so the match is not proven.",
            "Pixel counts cover annotated pixels only; MARIDA leaves most pixels unlabelled.",
            "evaluation.py applies seeded random flips and rotations to the test tiles.",
        ],
    }


def main() -> int:
    card = build_model_card()
    MODEL_CARD_PATH.write_text(json.dumps(card, indent=2) + "\n", encoding="utf-8")
    metrics = card["metrics"]
    counts = card["debrisCounts"]
    print(f"Wrote {MODEL_CARD_PATH.relative_to(REPO_ROOT).as_posix()}")
    print("Marine Debris (class 1), MARIDA test split, annotated pixels:")
    print(f"  precision {metrics['precision']:.4f}  ({counts['truePositivePixels']} / {counts['predictedPixels']})")
    print(f"  recall    {metrics['recall']:.4f}  ({counts['truePositivePixels']} / {counts['referencePixels']})")
    print(f"  F1        {metrics['f1']:.4f}")
    print(f"  IoU       {metrics['iou']:.4f}")
    print("All classes:")
    print(f"  overall accuracy {metrics['accuracy']:.4f}  mIoU {metrics['meanIoU']:.4f}  macro F1 {metrics['macroF1']:.4f}")
    print()
    print("WARNING: confirm that logs/evaluating_unet.log was produced by the checkpoint this backend")
    print(f"loads ({card['checkpoint']}, sha256 {card['checkpointSha256'][:12]}...).")
    print(f"The log loaded: {card['logCheckpoint']} (on another machine)")
    print("The path matches, but the log records no hash, so the match is not proven.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
