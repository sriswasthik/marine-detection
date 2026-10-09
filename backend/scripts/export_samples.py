"""
Exports real model output for the frontend: frontend/public/samples/<id>/{observation.json,
preview.png, classes.png, reference.png} and frontend/public/samples/index.json.

Scenes:
  - every file in semantic_segmentation/unet/sample_data/ (all from the training split), and
  - a curated set from the MARIDA test split, chosen automatically by running the model on every
    test patch: most predicted debris, a medium amount, a few pixels, no debris, Sargassum or
    foam present, and a high cloud share. Patches with reference debris labels are preferred.

It also checks the stored predictions in data/predicted_unet against a fresh run and against the
counts in logs/evaluating_unet.log, and prints what it finds.

Run from the repository root:
    python backend/scripts/export_samples.py [--out frontend/public/samples]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import numpy as np
import rasterio

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.pipeline import (  # noqa: E402
    CLOUDS,
    DEBRIS,
    FOAM,
    SARGASSUM,
    load_model,
    parse_patch_name,
    predict_probabilities,
    preprocess,
    read_scene,
    reference_label_path,
    run_pipeline,
    write_outputs,
)

SAMPLE_DATA = REPO_ROOT / "semantic_segmentation" / "unet" / "sample_data"
PATCHES = REPO_ROOT / "data" / "patches"
PREDICTED = REPO_ROOT / "data" / "predicted_unet"
TEST_SPLIT = REPO_ROOT / "data" / "splits" / "test_X.txt"
MODEL_CARD = REPO_ROOT / "backend" / "model_card.json"
DEFAULT_OUT = REPO_ROOT / "frontend" / "public" / "samples"


def patch_path(stem: str) -> Path:
    return PATCHES / "_".join(stem.split("_")[:-1]) / f"{stem}.tif"


def survey_test_split() -> List[Dict[str, Any]]:
    """Fresh class counts for every test patch, plus the reference labels and stored predictions."""
    model, device, _ = load_model()
    stems = [f"S2_{line.strip()}" for line in TEST_SPLIT.read_text().split()]
    rows = []
    for stem in stems:
        scene = read_scene(patch_path(stem))
        standardised, valid = preprocess(scene.image)
        class_map = np.argmax(predict_probabilities(standardised, model, device), axis=0) + 1
        with rasterio.open(reference_label_path(stem)) as ds:
            reference = ds.read(1).astype(np.int64)
        annotated = reference > 0
        stored_file = PREDICTED / f"{stem}_epoch_44.npy"
        stored = np.load(stored_file) if stored_file.exists() else None
        counts = np.bincount(class_map[valid].ravel(), minlength=12)
        rows.append(
            {
                "id": stem,
                "valid": int(valid.sum()),
                "debris": int(counts[DEBRIS]),
                "sargassumFoam": int(sum(counts[c] for c in SARGASSUM) + counts[FOAM]),
                "cloud": int(counts[CLOUDS]),
                "refDebris": int((reference == DEBRIS).sum()),
                "refContext": int(np.isin(reference, list(SARGASSUM) + [FOAM]).sum()),
                "refCloud": int((reference == CLOUDS).sum()),
                "annotated": int(annotated.sum()),
                "predOnAnnotated": int(((class_map == DEBRIS) & annotated).sum()),
                "truePositive": int(((class_map == DEBRIS) & (reference == DEBRIS)).sum()),
                "storedDebris": int((stored == DEBRIS).sum()) if stored is not None else None,
                "storedMatches": bool(np.array_equal(stored, class_map)) if stored is not None else None,
                "storedDiffPixels": int((stored != class_map).sum()) if stored is not None else None,
            }
        )
    return rows


def choose(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Up to six distinct test patches that span the cases the UI needs."""
    chosen: List[Dict[str, Any]] = []

    def pick(case: str, candidates: List[Dict[str, Any]], key: Callable[[Dict[str, Any]], Any]) -> None:
        pool = [r for r in candidates if r["id"] not in {c["id"] for c in chosen}]
        if pool:
            chosen.append({**max(pool, key=key), "case": case})

    labelled = [r for r in rows if r["refDebris"] > 0]
    with_debris = [r for r in rows if r["debris"] > 0]
    pick("Most predicted debris", labelled or with_debris, lambda r: r["debris"])
    medium_pool = [r for r in labelled if r["debris"] > 0] or with_debris
    if medium_pool:
        median = float(np.median([r["debris"] for r in medium_pool]))
        pick("Medium debris", medium_pool, lambda r: -abs(r["debris"] - median))
    few_pool = [r for r in labelled if 0 < r["debris"] <= 20] or [r for r in with_debris if r["debris"] <= 20]
    pick("Few debris pixels", few_pool, lambda r: (-r["debris"], r["refDebris"]))
    none_pool = [r for r in rows if r["debris"] == 0]
    # A clean "no debris" example: no reference debris, mostly clear sky, most annotated pixels.
    pick(
        "No debris predicted",
        none_pool,
        lambda r: (r["refDebris"] == 0, r["cloud"] / max(r["valid"], 1) < 0.1, r["annotated"]),
    )
    context_pool = [r for r in rows if r["refContext"] > 0] or rows
    pick("Sargassum or foam", context_pool, lambda r: r["sargassumFoam"])
    cloud_pool = [r for r in rows if r["refCloud"] > 0] or rows
    pick("High cloud share", cloud_pool, lambda r: r["cloud"] / max(r["valid"], 1))
    return chosen


def consistency_report(rows: List[Dict[str, Any]]) -> List[str]:
    card = json.loads(MODEL_CARD.read_text(encoding="utf-8"))
    logged = card["debrisCounts"]
    predicted = sum(r["predOnAnnotated"] for r in rows)
    reference = sum(r["refDebris"] for r in rows)
    true_positive = sum(r["truePositive"] for r in rows)
    fresh_total = sum(r["debris"] for r in rows)
    stored = [r for r in rows if r["storedDebris"] is not None]
    stored_total = sum(r["storedDebris"] for r in stored)
    mismatched = [r["id"] for r in stored if not r["storedMatches"]]
    precision = true_positive / predicted if predicted else 0.0
    recall = true_positive / reference if reference else 0.0
    lines = [
        "Consistency of stored predictions and logged test metrics (Marine Debris, class 1):",
        f"  log, annotated pixels:          predicted {logged['predictedPixels']}, reference {logged['referencePixels']}, "
        f"true positives {logged['truePositivePixels']}",
        f"  fresh run, annotated pixels:    predicted {predicted}, reference {reference}, true positives {true_positive} "
        f"(precision {precision:.3f}, recall {recall:.3f})",
        f"  fresh run, every pixel:         {fresh_total} debris pixels over {len(rows)} test patches",
        f"  data/predicted_unet:            {stored_total} debris pixels in {len(stored)} stored masks; "
        f"{len(stored) - len(mismatched)} identical to the fresh run, {len(mismatched)} differ",
        "  Reading: the log counts only annotated pixels (MARIDA labels a small share of each patch), so "
        "its 903 cannot be compared with the stored masks, which classify every pixel. The large "
        "whole-patch total is mostly pixels nobody labelled; their precision is unknown.",
    ]
    if mismatched:
        differing = sum(r["storedDiffPixels"] for r in stored)
        lines.append(
            f"  Stored masks that differ from the fresh run: {', '.join(mismatched[:10])} "
            f"({differing} pixels in total out of {len(stored) * 256 * 256})"
        )
    if abs(predicted - logged["predictedPixels"]) > 0.1 * logged["predictedPixels"]:
        lines.append(
            "  NOTE: the fresh annotated-pixel count is more than 10% away from the log. evaluation.py "
            "scores randomly flipped and rotated tiles, which explains small gaps but not large ones."
        )
    return lines


def export_scene(tif: Path, out_root: Path, case: str) -> Dict[str, Any]:
    result = run_pipeline(tif)
    observation = result.observation
    sample_id = observation["id"]
    write_outputs(result, out_root / sample_id, url_prefix=f"/samples/{sample_id}/")
    patch = parse_patch_name(sample_id) or {}
    detections = observation["detections"]
    return {
        "id": sample_id,
        "name": observation["name"],
        "region": observation["region"],
        "date": patch.get("date"),
        "capturedAt": observation["capturedAt"],
        "split": (observation.get("maridaPatch") or {}).get("split"),
        "case": case,
        "debrisPixels": sum(d["sourcePixelCount"] for d in detections),
        "detectionCount": len(detections),
        "debrisAreaM2": observation["debrisAreaM2"],
        "averageConfidence": observation["averageConfidence"],
        "cloudPercent": observation["sceneContext"]["cloudPercent"],
        "referenceDebrisPixels": observation.get("referenceDebrisPixels"),
        "warnings": observation["warnings"],
        "suppressedPixels": sum(r["pixels"] for r in observation["suppressedRegions"]),
    }


def print_table(entries: List[Dict[str, Any]]) -> None:
    header = f"{'id':26} {'split':5} {'case':22} {'debris px':>9} {'polygons':>8} {'mean conf':>9} {'cloud %':>7} {'ref px':>6} {'stripe px':>9}"
    print(header)
    print("-" * len(header))
    for e in entries:
        conf = f"{e['averageConfidence']:.3f}" if e["averageConfidence"] is not None else "-"
        ref = e["referenceDebrisPixels"] if e["referenceDebrisPixels"] is not None else "-"
        print(
            f"{e['id']:26} {e['split'] or '-':5} {e['case'][:22]:22} {e['debrisPixels']:>9} "
            f"{e['detectionCount']:>8} {conf:>9} {e['cloudPercent']:>7.2f} {ref:>6} {e['suppressedPixels']:>9}"
        )


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output folder")
    args = parser.parse_args(argv)
    out_root: Path = args.out.resolve()
    out_root.mkdir(parents=True, exist_ok=True)

    started = time.perf_counter()
    print(f"Surveying the test split ({TEST_SPLIT.relative_to(REPO_ROOT).as_posix()}) ...")
    rows = survey_test_split()
    curated = choose(rows)
    print(f"  {len(rows)} patches in {time.perf_counter() - started:.0f} s")
    print()

    entries = []
    for tif in sorted(SAMPLE_DATA.glob("*.tif")):
        entries.append(export_scene(tif, out_root, "Demo sample (sample_data)"))
    for row in curated:
        entries.append(export_scene(patch_path(row["id"]), out_root, row["case"]))

    index = {
        "generatedBy": "backend/scripts/export_samples.py",
        "note": "Model output on MARIDA patches, with density levels and hotspots graded by backend/pipeline.py.",
        "samples": entries,
    }
    (out_root / "index.json").write_text(json.dumps(index, indent=1) + "\n", encoding="utf-8")

    # Folders from an earlier export that are no longer selected (only folders this script writes).
    exported = {e["id"] for e in entries}
    for folder in sorted(p for p in out_root.iterdir() if p.is_dir()):
        if folder.name not in exported and (folder / "observation.json").exists():
            for name in ("observation.json", "preview.png", "classes.png", "reference.png"):
                if (folder / name).exists():
                    (folder / name).unlink()
            if not any(folder.iterdir()):
                folder.rmdir()
            print(f"Removed stale export {folder.name}")

    print_table(entries)
    print()
    for line in consistency_report(rows):
        print(line)
    print()
    print(f"Wrote {len(entries)} scenes to {out_root} in {time.perf_counter() - started:.0f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
