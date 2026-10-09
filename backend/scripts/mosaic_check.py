"""
The pipeline on an image larger than one MARIDA patch, like a real upload: patches of one scene are
placed on a 1,400 x 1,400 pixel grid (no data between them), so prediction runs in overlapping
1024 px windows. Each patch is then compared with the same patch run on its own, and both with the
human labels; the coordinates of the large image are checked with backend/coordinate_check.py.

    python backend/scripts/mosaic_check.py
    python backend/scripts/mosaic_check.py --scene S2_3-11-16_16PDC --west 485260 --north 1758040

Defaults: the window of scene S2_14-9-18_16PCC with the most test patches holding labelled debris
(11 patches, 8 of them test patches with debris). Uncompressed the mosaic is 86 MB, under the
100 MB upload limit.
"""
import argparse
import sys
import tempfile
import warnings
from pathlib import Path

import numpy as np
import rasterio

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from backend import pipeline  # noqa: E402
from backend.coordinate_check import MOSAIC_PX, build_mosaic, check_image  # noqa: E402

PATCHES = REPO_ROOT / "data" / "patches"
SIZE = MOSAIC_PX


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--scene", default="S2_14-9-18_16PCC")
    parser.add_argument("--west", type=float, default=365680.0)
    parser.add_argument("--north", type=float, default=1759040.0)
    args = parser.parse_args()
    test = {f"S2_{line.strip()}" for line in (REPO_ROOT / "data" / "splits" / "test_X.txt").read_text().split()}

    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / f"mosaic_{args.scene}.tif"
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            placed = build_mosaic(args.scene, args.west, args.north, path)
            print(f"Mosaic {SIZE} x {SIZE} px of {len(placed)} patches, {path.stat().st_size / 1e6:.0f} MB on disk")
            big = pipeline.run_pipeline(path)
            report = check_image(path, big)
            singles = {pid: pipeline.run_pipeline(PATCHES / args.scene / f"{pid}.tif") for pid in placed}

    o = big.observation
    print(
        f"Large image: {len(o['detections'])} detections, {len(o['hotspots'])} hotspots, density {o['densityLevel']},"
        f" {len(o['suppressedRegions'])} stripe regions removed, {o['processing']['stagesMs']['detectMs'] / 1000:.1f} s prediction"
    )
    print(
        f"Coordinates: vertices {1000 * report['vertexErrorM']:.1f} mm, centroids {1000 * report['centroidErrorM']:.1f} mm,"
        f" cells {1000 * report['cellBoundsErrorM']:.1f} mm, outlines match pixels: {report['outlinePixelsMatch']},"
        f" overlay hit/cover {report['overlayHitShare']:.2f}/{report['overlayCoverShare']:.2f}"
    )
    print()
    print(f"{'patch':24} {'split':5} {'same class':>10} {'labelled':>8} | {'alone: P/R':>14} | {'in mosaic: P/R':>14} | stripes alone/mosaic")
    totals = {"alone": [0, 0, 0], "mosaic": [0, 0, 0]}
    for pid, (row, col) in sorted(placed.items()):
        with rasterio.open(PATCHES / args.scene / f"{pid}_cl.tif") as ds:
            labels = ds.read(1)
        labels = np.where(labels >= 12, 7, labels)
        labelled, truth = labels > 0, labels == 1
        alone = singles[pid].class_map
        inside = big.class_map[row : row + 256, col : col + 256]
        cells = []
        for name, cmap in (("alone", alone), ("mosaic", inside)):
            debris = cmap == 1
            tp, fp, fn = int((debris & truth).sum()), int((debris & labelled & ~truth).sum()), int((~debris & truth).sum())
            for i, v in enumerate((tp, fp, fn)):
                totals[name][i] += v
            p = f"{100 * tp / (tp + fp):.0f}%" if tp + fp else "-"
            r = f"{100 * tp / (tp + fn):.0f}%" if tp + fn else "-"
            cells.append(f"{p:>6}/{r:<6}")
        stripes_alone = len(singles[pid].observation["suppressedRegions"])
        stripes_big = _stripes_inside(big, row, col)
        split = "test" if pid in test else "other"
        print(
            f"{pid:24} {split:5} {100 * (alone == inside).mean():9.1f}% {int(labelled.sum()):>8} | {cells[0]:>14} | {cells[1]:>14} |"
            f" {stripes_alone}/{stripes_big}"
        )
    for name, (tp, fp, fn) in totals.items():
        print(f"All patches, {name:6}: debris precision {100 * tp / max(tp + fp, 1):.1f}%, recall {100 * tp / max(tp + fn, 1):.1f}% (labelled pixels)")


def _stripes_inside(result, row, col):
    return sum(
        1
        for r in result.observation["suppressedRegions"]
        if row <= r["firstRow"] < row + 256 and col <= r["firstCol"] < col + 256
    )


if __name__ == "__main__":
    main()
