"""
How well the whole pipeline finds marine debris on MARIDA patches with human labels, per split.

    python backend/scripts/evaluate_pipeline.py                 # train, val and test (about 10 min on CPU)
    python backend/scripts/evaluate_pipeline.py --splits test   # the held-out test split only
    python backend/scripts/evaluate_pipeline.py --json out.json # also save the figures

The model trained on `train` and chose its checkpoint on `val`; only `test` is unseen. The demo
images in sample_data are train patches.

MARIDA labels part of each patch (the *_cl.tif; 0 = not labelled), so every figure below is
measured on labelled pixels only, as in evaluation.py. Labels 12 to 15 count as Marine Water (7),
as in training. Three levels:

- pixels: the raw class map (what logs/evaluating_unet.log measured) and the pipeline's detections
  (stripe artefacts removed);
- objects: a labelled debris object (8-connected region of label 1) is found when a detection
  touches it; a detection is right when it touches labelled debris, wrong when it touches only
  pixels labelled as something else, and cannot be judged when it touches no labelled pixel;
- hotspots and confidence bands, judged the same way.
"""
import argparse
import json
import sys
import time
import warnings
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import rasterio
from scipy import ndimage

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from backend import pipeline  # noqa: E402

SPLITS = REPO_ROOT / "data" / "splits"
PATCHES = REPO_ROOT / "data" / "patches"
EIGHT = np.ones((3, 3), dtype=bool)
BANDS = (("low", 0.0, 0.6), ("medium", 0.6, 0.8), ("high", 0.8, 1.01))  # src/lib/config.ts


def patch_ids(split):
    return [f"S2_{line.strip()}" for line in (SPLITS / f"{split}_X.txt").read_text().split()]


def paths(patch_id):
    folder = PATCHES / "_".join(patch_id.split("_")[:-1])
    return folder / f"{patch_id}.tif", folder / f"{patch_id}_cl.tif"


def scores(tp, fp, fn):
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    f1 = 2 * precision * recall / (precision + recall) if precision and recall else None
    iou = tp / (tp + fp + fn) if tp + fp + fn else None
    return {"precision": precision, "recall": recall, "f1": f1, "iou": iou, "tp": tp, "fp": fp, "fn": fn}


def evaluate(split, limit=None):
    ids = patch_ids(split)[:limit]
    confusion = np.zeros((12, 12), dtype=np.int64)  # [label, predicted], 0 unused
    pipe = Counter()
    objects = Counter()
    detections = Counter()
    bands = defaultdict(Counter)
    hotspots = Counter()
    hotspot_rank1 = Counter()
    false_alarm_classes = Counter()
    stripes = Counter()
    started = time.perf_counter()
    for patch_id in ids:
        tif, cl = paths(patch_id)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            result = pipeline.run_pipeline(tif)
        with rasterio.open(cl) as ds:
            labels = ds.read(1).astype(np.int64)
        labels = np.where(labels >= 12, 7, labels)
        labelled = labels > 0
        truth = labels == pipeline.DEBRIS
        predicted = result.class_map.astype(np.int64)

        # Pixels, raw class map.
        np.add.at(confusion, (labels[labelled], predicted[labelled]), 1)

        # Pixels, pipeline detections (stripes removed).
        o = result.observation
        kept = np.zeros(labels.shape, dtype=bool)
        detection_masks = []
        for d in o["detections"]:
            mask = _detection_mask(d, result)
            detection_masks.append((d, mask))
            kept |= mask
        pipe["tp"] += int((kept & truth).sum())
        pipe["fp"] += int((kept & labelled & ~truth).sum())
        pipe["fn"] += int((~kept & truth).sum())
        for cid, n in Counter(labels[kept & labelled & ~truth].tolist()).items():
            false_alarm_classes[pipeline.CLASS_NAMES[cid]] += n

        # Stripes: did the filter remove labelled debris?
        stripe_pixels = (predicted == pipeline.DEBRIS) & result.valid & ~kept
        if o["suppressedRegions"]:
            stripes["patches"] += 1
            stripes["pixels"] += int(stripe_pixels.sum())
            stripes["labelledDebrisRemoved"] += int((stripe_pixels & truth).sum())
            stripes["labelledOtherRemoved"] += int((stripe_pixels & labelled & ~truth).sum())

        # Objects.
        objs, count = ndimage.label(truth, structure=EIGHT)
        objects["labelled"] += count
        objects["found"] += len(set(np.unique(objs[kept & truth]).tolist()) - {0})
        for d, mask in detection_masks:
            verdict = _verdict(mask, truth, labelled)
            detections[verdict] += 1
            band = next(name for name, low, high in BANDS if low <= d["confidence"] < high)
            bands[band][verdict] += 1

        # Hotspots: judged by the detections inside them.
        by_id = {d["id"]: mask for d, mask in detection_masks}
        for h in o["hotspots"]:
            mask = np.zeros(labels.shape, dtype=bool)
            for i in h["detectionIds"]:
                mask |= by_id[i]
            verdict = _verdict(mask, truth, labelled)
            hotspots[verdict] += 1
            if h["rank"] == 1:
                hotspot_rank1[verdict] += 1

    seconds = time.perf_counter() - started
    debris_row, debris_col = confusion[1, 1:].sum(), confusion[1:, 1].sum()
    tp = int(confusion[1, 1])
    diagonal = np.diag(confusion)[1:]
    union = confusion[1:, 1:].sum(axis=0) + confusion[1:, 1:].sum(axis=1) - diagonal
    judged = detections["right"] + detections["wrong"]
    return {
        "split": split,
        "patches": len(ids),
        "seconds": round(seconds, 1),
        "labelledPixels": int(confusion.sum()),
        "rawPixels": {
            **scores(tp, int(debris_col - tp), int(debris_row - tp)),
            "overallAccuracy": float(diagonal.sum() / confusion.sum()),
            "meanIoU": float(np.mean(diagonal[union > 0] / union[union > 0])),
        },
        "pipelinePixels": scores(pipe["tp"], pipe["fp"], pipe["fn"]),
        "objects": {
            "labelledDebrisObjects": objects["labelled"],
            "found": objects["found"],
            "objectRecall": objects["found"] / objects["labelled"] if objects["labelled"] else None,
            "detections": sum(detections.values()),
            "right": detections["right"],
            "wrong": detections["wrong"],
            "notJudgeable": detections["unlabelled"],
            "precisionOfJudged": detections["right"] / judged if judged else None,
        },
        "confidenceBands": {
            name: {
                "right": bands[name]["right"],
                "wrong": bands[name]["wrong"],
                "notJudgeable": bands[name]["unlabelled"],
                "precisionOfJudged": (
                    bands[name]["right"] / (bands[name]["right"] + bands[name]["wrong"])
                    if bands[name]["right"] + bands[name]["wrong"]
                    else None
                ),
            }
            for name, _, _ in BANDS
        },
        "hotspots": {
            "total": sum(hotspots.values()),
            "right": hotspots["right"],
            "wrong": hotspots["wrong"],
            "notJudgeable": hotspots["unlabelled"],
            "rank1": dict(hotspot_rank1),
        },
        "falseAlarmLabels": dict(false_alarm_classes.most_common()),
        "stripeFilter": dict(stripes),
    }


def _verdict(mask, truth, labelled):
    if (mask & truth).any():
        return "right"
    if (mask & labelled).any():
        return "wrong"
    return "unlabelled"


def _detection_mask(detection, result):
    """The detection's pixels, rasterised from its own WGS84 outline back on the image grid."""
    from rasterio import features, warp

    geometry = warp.transform_geom("EPSG:4326", result.scene.crs, detection["geometry"])
    return (
        features.rasterize(
            [(geometry, 1)], out_shape=result.class_map.shape, transform=result.scene.transform, fill=0, dtype="uint8"
        )
        > 0
    )


def _pct(value):
    return "   -  " if value is None else f"{100 * value:5.1f}%"


def print_report(results):
    print()
    print("Marine Debris, labelled pixels only")
    print(f"{'split':6} {'patches':>7} | {'raw model: precision recall F1 IoU':>36} | {'pipeline detections: precision recall F1':>42}")
    for r in results:
        a, b = r["rawPixels"], r["pipelinePixels"]
        print(
            f"{r['split']:6} {r['patches']:>7} | {_pct(a['precision']):>10} {_pct(a['recall'])} {_pct(a['f1'])} {_pct(a['iou'])}"
            f" | {_pct(b['precision']):>17} {_pct(b['recall'])} {_pct(b['f1'])}"
            f"   (all classes: accuracy {_pct(a['overallAccuracy'])}, mIoU {_pct(a['meanIoU'])})"
        )
    print()
    print("Debris objects and detections")
    for r in results:
        o = r["objects"]
        print(
            f"{r['split']:6} labelled objects found {o['found']}/{o['labelledDebrisObjects']} ({_pct(o['objectRecall'])})"
            f" | detections {o['detections']}: right {o['right']}, wrong {o['wrong']}, cannot judge {o['notJudgeable']}"
            f" -> precision of judged {_pct(o['precisionOfJudged'])}"
        )
    print()
    print("Precision of judged detections by confidence band (Low < 60%, Medium 60-80%, High >= 80%)")
    for r in results:
        cells = [
            f"{name} {_pct(b['precisionOfJudged'])} ({b['right']}/{b['right'] + b['wrong']}, +{b['notJudgeable']} unjudged)"
            for name, b in r["confidenceBands"].items()
        ]
        print(f"{r['split']:6} " + " | ".join(cells))
    print()
    print("Hotspots (judged by the detections inside them)")
    for r in results:
        h = r["hotspots"]
        print(f"{r['split']:6} {h['total']} hotspots: right {h['right']}, wrong {h['wrong']}, cannot judge {h['notJudgeable']}; rank 1: {h['rank1']}")
    print()
    print("What wrong debris pixels were labelled as")
    for r in results:
        total = sum(r["falseAlarmLabels"].values()) or 1
        top = ", ".join(f"{k} {100 * v / total:.0f}%" for k, v in list(r["falseAlarmLabels"].items())[:5])
        print(f"{r['split']:6} {top}")
    print()
    print("Stripe filter")
    for r in results:
        s = r["stripeFilter"]
        print(
            f"{r['split']:6} {s.get('patches', 0)} patches, {s.get('pixels', 0)} pixels removed; of those labelled"
            f" debris {s.get('labelledDebrisRemoved', 0)}, labelled other {s.get('labelledOtherRemoved', 0)}"
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--splits", nargs="+", default=["train", "val", "test"])
    parser.add_argument("--limit", type=int, help="first N patches per split")
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    results = []
    for split in args.splits:
        print(f"Evaluating {split} ...", flush=True)
        results.append(evaluate(split, args.limit))
        print(f"  {results[-1]['patches']} patches in {results[-1]['seconds']:.0f} s", flush=True)
    print_report(results)
    if args.json:
        args.json.write_text(json.dumps(results, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
