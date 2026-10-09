# backend

Python side of A.W.A.R.E. (AI Waste Analysis & Reconnaissance Engine). It wraps the original segmentation model
(`semantic_segmentation/unet/`, unchanged) and turns its output into the frontend's data contract
(`frontend/src/features/observations/types.ts`), served over HTTP by a FastAPI service.

| File | What it does |
|---|---|
| `pipeline.py` | `run_pipeline(tif)`: one 11-band Sentinel-2 GeoTIFF in, one Observation out; `write_outputs()` writes the JSON and PNG overlays |
| `model_card.py`, `model_card.json` | Evaluation figures parsed from `logs/evaluating_unet.log`; the pipeline copies them into `modelMetrics` |
| `scripts/export_samples.py` | Runs the pipeline on the demo and curated MARIDA patches and writes `frontend/public/samples/` |
| `app/` | FastAPI service: `main.py` (routes), `jobs.py` (worker), `store.py` (disk), `config.py` (environment) |
| `run.sh` | Starts the service from the repository root |
| `coordinate_check.py`, `scripts/check_coordinates.py` | Independent coordinate checks (own UTM maths, Sentinel-2 tile, MARIDA annotation polygons) and a per-image accuracy table |
| `tests/` | pytest suite, about 75 s on CPU (`test_density.py`: grid and hotspots; `test_coordinates.py`: coordinates of every sample image) |

## Setup

Python 3.8 to 3.10 with the original pins:

```bash
pip install -r requirements.txt            # the repository's pins (torch 1.13.1, numpy 1.23.5, ...)
pip install -r backend/requirements.txt    # what the backend adds (scipy, shapely, FastAPI, pytest)
```

Python 3.11 or newer (verified on 3.13, CPU):

```bash
python -m venv .venv
.venv/Scripts/activate                     # Windows; on macOS or Linux: source .venv/bin/activate
pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu
pip install -r backend/requirements-relaxed.txt
```

Run every command below from the repository root. The pipeline adds `semantic_segmentation/unet`
and the root to `sys.path` itself, so no `PYTHONPATH` is needed.

## Run the API

The contract (endpoints, bodies, error codes, environment variables) is in
`docs/BACKEND_CONTRACT.md`.

```bash
./backend/run.sh                                   # bash; http://127.0.0.1:8000
python -m uvicorn backend.app.main:app --port 8000 # any shell, from the repository root
```

PowerShell, with a demo stepper and a second allowed origin:

```powershell
$env:DEMO_MIN_STAGE_SECONDS = "1.5"
$env:CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
python -m uvicorn backend.app.main:app --port 8000
```

The model loads once at startup (on CUDA when available). The list holds only images analysed
through the service: finished uploads are written to `backend/store/` and listed after a restart
too. `LOAD_SAMPLES=1` also lists the 17 scenes exported to `frontend/public/samples/`.

Point the frontend at it in `frontend/.env`:

```bash
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000
```

Or switch at run time in the app's Settings ("Live service", with a connection test). The top bar
then shows "Live data" instead of "Sample data".

Try every endpoint with curl:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/observations
curl http://localhost:8000/api/observations/S2_22-12-20_18QYF_0
curl -X POST http://localhost:8000/api/observations   -F "file=@semantic_segmentation/unet/sample_data/S2_9-10-17_16PEC_0.tif;type=image/tiff"   -F source=satellite -F "region=La Ceiba coast" -F capturedAt=2017-10-09T16:20:00Z
curl http://localhost:8000/api/jobs/<jobId from the previous answer>
curl -o preview.png http://localhost:8000/files/S2_22-12-20_18QYF_0/preview.png
curl -i http://localhost:8000/api/observations/nope
curl -i -H "Origin: http://localhost:5173" http://localhost:8000/health
```

## Run the pipeline

```python
from backend.pipeline import run_pipeline, write_outputs, PipelineError

result = run_pipeline("semantic_segmentation/unet/sample_data/S2_9-10-17_16PEC_0.tif")
result.observation          # dict in the frontend's Observation shape
result.probabilities        # (11, H, W) softmax, kept (app.py discards it)
write_outputs(result, "out/S2_9-10-17_16PEC_0", url_prefix="/samples/S2_9-10-17_16PEC_0/")
```

Options: `source`, `region`, `captured_at`, `min_pixels` (smallest detection kept), `device`,
`tile_size` and `tile_overlap` (images over 1024 px run in overlapping, blended windows),
`reference_path` (a MARIDA `*_cl.tif`; found automatically under `data/patches` by patch name).

Refused files raise `PipelineError` with `code` and `message`:

| Code | When |
|---|---|
| `INVALID_BANDS` | not exactly 11 bands |
| `NO_GEOREF` | no CRS or an identity geotransform |
| `UNREADABLE` | missing, or not a raster rasterio can open |
| `TOO_LARGE` | over 100 MB, or more pixels than one Sentinel-2 tile |

### What it computes

- **Preprocessing** is app.py's: missing values become `bands_mean`, then `(x - bands_mean) /
  bands_std`, both imported from `dataloader.py`. Sizes that do not divide by 16 are reflection
  padded and cropped back.
- **Detections** are 8-connected regions of class 1 (Marine Debris), polygonised in the source CRS
  and reprojected to EPSG:4326, `[lng, lat]`, exterior rings counter-clockwise. `areaM2` is
  `pixels x pixel area`; `confidence` is the mean class-1 softmax probability over the region.
- **Stripe artefacts** are left out: a debris region at most 8 px thick that runs along the
  image rows or columns for at least half the image. The model draws such bands near patch edges
  (45 of the 359 stored test predictions have one, at rows 3 to 5 or columns 1 to 2). They are
  listed in `suppressedRegions` with the `STRIPE_ARTEFACT` warning, which the UI shows.
- **Water area** is every valid pixel not classed as Clouds (class 6); MARIDA has no land class.
  `coveragePercent` is debris area over water area. `averageConfidence` is area-weighted.
- **Density levels and hotspots** (`compute_density`, `find_hotspots`) are graded on the model's
  own pixels: the image is cut into blocks of 25 x 25 pixels (250 m at 10 m). A block's coverage
  is the debris pixels of the kept detections over its imaged pixels, graded Low, Moderate (from
  2%), High (from 8%) or Critical (from 20%); these are the frontend's placeholder thresholds, not
  calibrated values. A detection takes the level of the block holding most of its pixels; the
  observation takes the highest block level. Hotspots join 8-adjacent High and Critical blocks
  (Moderate ones when there are none) and are ranked by debris area x mean detection confidence x
  level weight (1 to 4). The output has `densityGrid` (only blocks with debris, each with
  `detectionAreasM2` per detection, so the frontend can regroup a filtered subset) and `hotspots`.
  The rules mirror `frontend/src/lib/density.ts` and `hotspots.ts`;
  `frontend/src/features/observations/realSamples.test.ts` checks that every export agrees.
- **Warnings:** `LOW_CONFIDENCE` below 0.6 average confidence (the frontend's threshold),
  `HIGH_CLOUD` above 30% cloud, `STRIPE_ARTEFACT` when a band was left out.
- **Names:** MARIDA patches are named "<place> patch <n>" (for example "Haiti patch 0"); the
  full id stays in `maridaPatch.id`.
- **Images** (`preview.png` true colour from bands 3, 2, 1 with a 2 to 98 percentile stretch;
  `classes.png` with the context classes and water left transparent; `reference.png`, the
  ground-truth debris pixels) are warped to EPSG:4326 over exactly `observation.bounds`, so a map
  can stretch them over the bounds. The class colours are in `observation.classPalette`.
- **Segmentation for QGIS:** `segmentation.tif` is the class map (uint8, 1 to 11, 0 = no data) in
  the source CRS and geotransform, as `app.py` writes it, with a colour table and class names.
  `segmentation.png` (the mask) and `scene.png` (true colour) are on the source pixel grid, not
  warped, so they line up pixel for pixel; the mask uses the colours of
  `utils/qgis_color_mask_mapping.qml`, so it looks as it does in QGIS once that style is applied.
- **Geospatial summary** (`observation.geospatial`): width, height, band count, data type, CRS
  code and name, pixel size and area, total and valid pixels, scene area, debris pixels and area
  (the kept detections), debris coverage of the whole scene (`coveragePercent` is over the water
  area), the debris centroid (mean of the debris pixel centres; null without debris) and the
  image centre.

## Model card

```bash
python backend/model_card.py
```

Rebuilds `model_card.json` from the log and prints the figures. Marine Debris on the MARIDA test
split, annotated pixels: precision 0.371, recall 0.879, F1 0.522, IoU 0.353; all classes: overall
accuracy 0.882, mIoU 0.553, macro F1 0.680. **Confirm that the log was produced by the checkpoint
the backend loads**: the log names the same path on another machine but records no hash.

## Export the frontend samples

```bash
python backend/scripts/export_samples.py
```

About 90 s on CPU. Runs the model on all 359 test patches to pick a curated set (most debris,
medium, few pixels, none, Sargassum or foam, high cloud), exports those plus the 11 files in
`sample_data/` (all training patches) to `frontend/public/samples/`, prints a table per scene,
and reports how the stored predictions in `data/predicted_unet` compare with a fresh run and with
the log. Folders from an earlier export that are no longer selected are removed.

## Detection quality

```bash
python backend/scripts/evaluate_pipeline.py --splits test   # held-out split, about 3 min on CPU
python backend/scripts/evaluate_pipeline.py                 # train, val and test, about 10 min
python backend/scripts/mosaic_check.py                      # a 1,400 px image of 11 patches
```

These scripts score the pipeline's output against MARIDA's labelled pixels. Measured 2026-10-09,
Marine Debris:

| Split | Patches | Pixel precision | Pixel recall | Debris objects found | Judged detections that are debris |
|---|---|---|---|---|---|
| train (seen in training; includes `sample_data`) | 694 | 63.8% | 94.2% | 94.2% | 69.3% |
| val (used to pick the checkpoint) | 328 | 67.0% | 87.9% | 93.8% | 72.2% |
| test (unseen) | 359 | 38.1% | 86.1% | 86.1% | 57.2% |

- **Test matches the log:** the test figures reproduce `logs/evaluating_unet.log` (precision
  0.37, recall 0.88), so the backend runs the model as it was evaluated.
- **Most detections can't be scored:** MARIDA labels only part of each patch, so about 98% of
  detections touch no labelled pixel. "Judged" counts only those that touch labels.
- **Confidence barely means anything on unseen data:** almost no detection reaches 80%. On test,
  Medium (60–80%) detections are right 60% of the time and Low ones 57%.
- **False alarms:** on test, wrong debris pixels are mostly labelled Marine Water (66%), Ship (11%)
  and Clouds (10%).
- **Stripe filter:** it removed 0 labelled debris pixels on test and 3 on train.
- **Large images:** on the 1,400 px mosaic, 95–99.9% of each patch's pixels get the same class as
  when the patch runs alone. Debris precision on its labelled pixels is 67.9% vs 70.4% alone, and
  recall is 100% both ways.

## Coordinate accuracy

```bash
python backend/scripts/check_coordinates.py            # every image in sample_data
python backend/scripts/check_coordinates.py <file.tif> # any MARIDA patch
```

`coordinate_check.py` converts with its own UTM code (Karney's series; it matches PROJ to about
6 nm) rather than the pipeline's PROJ calls, and checks each image three ways:

- **Pipeline output:** detection vertices fall on pixel corners, and centroids, density cells and
  bounds sit where the pixels are, all within 7.7 mm (the 7-decimal rounding of the JSON).
  Outlines cover exactly the model's debris pixels. The red pixels of `classes.png` lie on debris,
  and the shipped `frontend/public/samples` copy has the same coordinates.
- **Location:** the image lies inside the Sentinel-2 tile in its file name (all 1,381 MARIDA
  patches do). Sample patches 1 and 8 to 10 are north of 16° N, so their MGRS letter is Q
  (16QEC), still inside tile 16PEC.
- **Ground truth:** the annotators' polygons (`data/shapefiles`, drawn in UTM), rasterised on the
  patch grid with MARIDA's touched-pixel rule, reproduce every labelled pixel of the `_cl.tif`.
  Every whole-pixel shift does worse.

`areaM2` is UTM grid area (pixels x 100 m²). Ground area is about 0.08% larger here, because the
UTM scale factor is 0.9996 near the central meridian.

## Tests

```bash
python -m pytest backend
```

The schema test runs `npx vitest` in `frontend/` to check the exported JSON with the app's zod
schema; it is skipped when Node or `frontend/node_modules` is missing.
