"""
Prints the coordinate accuracy of the pipeline on every image in sample_data (or the files given),
measured by backend/coordinate_check.py. Run from the repository root:

    python backend/scripts/check_coordinates.py
    python backend/scripts/check_coordinates.py data/patches/S2_22-12-20_18QYF/S2_22-12-20_18QYF_0.tif
"""
import sys
import warnings
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from backend.coordinate_check import check_image  # noqa: E402

SAMPLE_DATA = REPO_ROOT / "semantic_segmentation" / "unet" / "sample_data"


def main(paths):
    files = [Path(p) for p in paths] or sorted(SAMPLE_DATA.glob("*.tif"), key=lambda p: int(p.stem.rsplit("_", 1)[1]))
    header = (
        f"{'image':22} {'centre (lat, lng)':22} {'tile':12} {'det':>4} {'hot':>4} {'vertex':>7} {'centroid':>8}"
        f" {'cell':>6} {'bounds':>13} {'area':>6} {'overlay':>11} {'annotations':>17}"
    )
    print(header)
    print(f"{'':22} {'':22} {'':12} {'':>4} {'':>4} {'mm':>7} {'mm':>8} {'mm':>6} {'slack mm':>13} {'%':>6} {'hit/cover':>11} {'px, match, shift':>17}")
    print("-" * len(header))
    for tif in files:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            r = check_image(tif)
        a = r.get("annotations", {})
        tile = f"{r.get('tile', '-')}{' ok' if r.get('insideNamedTile') else ' OUT' if 'tile' in r else ''}"
        overlay = f"{r['overlayHitShare']:.2f}/{r['overlayCoverShare']:.2f}" if r["overlayDebrisPixels"] else "no debris"
        ann = f"{a['labelledPixels']}, {a['agreement']:.3f}, {a['bestShift']}" if a.get("labelledPixels") else "-"
        print(
            f"{r['id']:22} {r['centre'][0]:9.5f}, {r['centre'][1]:10.5f} {tile:12} {r['detections']:>4} {r['hotspots']:>4}"
            f" {1000 * r['vertexErrorM']:7.2f} {1000 * r['centroidErrorM']:8.2f} {1000 * r['cellBoundsErrorM']:6.2f}"
            f" {1000 * r['boundsSlackM'][0]:5.1f} to {1000 * r['boundsSlackM'][1]:4.1f} {r['groundAreaErrorPct']:6.3f}"
            f" {overlay:>11} {ann:>17}"
            + ("" if r.get("outlinePixelsMatch") else "  OUTLINES DIFFER")
            + ("" if r.get("shippedSampleMatches", True) else "  SHIPPED SAMPLE DIFFERS")
        )
    print()
    print("vertex, centroid, cell: largest distance from the independent position (7-decimal output is at most 7.7 mm).")
    print("bounds slack: how far the bounds reach beyond the image footprint (never negative).")
    print("area: reported area (pixels x 100 m2, UTM grid) against ground area (divided by the scale factor squared).")
    print("overlay: red classes.png pixels on image debris / image debris pixels under red PNG pixels.")
    print("annotations: labelled pixels, share matching the annotators' polygons, best whole-pixel shift.")


if __name__ == "__main__":
    main(sys.argv[1:])
