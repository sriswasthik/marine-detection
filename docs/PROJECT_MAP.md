# Project map

One repository, three parts: the original Marine Debris Detection model code (copied in from
github.com/karthikram-p/Marine-Debris-Detection, kept unchanged), a React frontend, and a Python
backend that will wrap the model. Facts below were checked on 2026-10-08; numbers come from running
the code, not from the upstream description.

## Layout

| Path | Purpose | Produced by |
|---|---|---|
| `semantic_segmentation/unet/` | Model code: `unet_plus_plus.py`, `unet.py`, `dataloader.py`, `train.py`, `evaluation.py`, `loss_functions.py`, the Streamlit app `app.py`, `sample_data/` (11 GeoTIFFs), `trained_models/` (best checkpoints plus one per epoch, 1 to 45) | Original ML code |
| `utils/` | `assets.py` (class names, colours, ROI names), `metrics.py`, QGIS styles | Original ML code |
| `data/patches/` | MARIDA patches: 63 scenes, 1,381 patches, each `<id>.tif` (11 bands), `<id>_cl.tif` (class mask), `<id>_conf.tif` (annotation confidence), plus one GDAL `.aux.xml` sidecar; 4,144 files, 4.5 GB | Original data |
| `data/predicted_unet/` | Saved predictions for the 359 test patches, one `.npy` and one `.tif` each, plus one GDAL `.aux.xml` sidecar (719 files); 273 MB | Original `evaluation.py` |
| `data/shapefiles/` | Annotation polygons, one shapefile set per scene (63); 2.2 MB | Original data |
| `data/splits/` | `train_X.txt` (694), `val_X.txt` (328), `test_X.txt` (359) patch ids | Original data |
| `data/labels_mapping.txt` | JSON: patch file name to a 15-element multi-label vector (1,381 entries) | Original data |
| `logs/` | `log_unet.log` (training), `evaluating_unet.log` (test metrics), `tsboard_segm/` (TensorBoard, 612 KB) | Original training runs |
| `frontend/` | React, Vite and TypeScript app; its own rules in `frontend/CLAUDE.md` | Frontend work |
| `backend/` | Pipeline around the model (`pipeline.py`), FastAPI service (`app/`, contract in `docs/BACKEND_CONTRACT.md`), model card, sample export, tests (see `backend/README.md`) | New backend |
| `docs/` | This map; `frontend/docs/STATE_MATRIX.md` covers UI states | Documentation |
| `.devcontainer/` | Codespaces config that installs `requirements.txt` and starts Streamlit | Original |
| `requirements.txt` | Original pinned dependencies (torch 1.13.1, numpy 1.23.5, rasterio 1.3.6, ...) | Original |

## Data flow

1. Input: a Sentinel-2 GeoTIFF with 11 bands (440, 490, 560, 665, 705, 740, 783, 842, 865, 1600,
   2200 nm, per `utils/assets.py` `s2_mapping`), 256 x 256 pixels, float32 reflectance, projected
   in UTM (the samples are EPSG:32616, 10 m pixels).
2. Preprocessing (`app.py` `preprocess_image`): NaN pixels replaced with `bands_mean`, then
   `(x - bands_mean) / bands_std` per band, both from `dataloader.py`.
3. Model: `UNetPlusPlus(input_bands=11, output_classes=11, hidden_channels=16)` loaded from
   `best_model_marine_debris.pth`; output logits `(1, 11, 256, 256)`.
4. Class map: `softmax`, `argmax`, then `+ 1`, giving class ids 1 to 11 in the order of
   `utils/assets.py` `labels`: 1 Marine Debris, 2 Dense Sargassum, 3 Sparse Sargassum, 4 Natural
   Organic Material, 5 Ship, 6 Clouds, 7 Marine Water, 8 Sediment-Laden Water, 9 Foam, 10 Turbid
   Water, 11 Shallow Water. Labels 12 to 15 (Waves, Cloud Shadows, Wakes, Mixed Water) were merged
   into 7 during training (`agg_to_water=True` in `dataloader.py`).
5. Polygons (`backend/pipeline.py`): 8-connected class 1 regions vectorised with the GeoTIFF
   transform, then reprojected to WGS84. Density and hotspots (`compute_density`): debris
   coverage per 25 x 25 pixel block graded Low to Critical, each detection's level, and ranked
   hotspots of adjacent dense blocks.
6. Observation JSON (`backend/pipeline.py`): the frontend data contract in `frontend/CLAUDE.md`
   (Observation, Detection), written to `frontend/public/samples/` by
   `backend/scripts/export_samples.py`, and served over HTTP by `backend/app` (`docs/BACKEND_CONTRACT.md`).
7. Frontend: renders observations on the map, detail page and report.

## Paths later tasks depend on

| What | Path |
|---|---|
| Checkpoint | `semantic_segmentation/unet/trained_models/best_model_marine_debris.pth` (3.4 MB, PyTorch zip, a plain state_dict of 128 tensors; identical to `trained_models/39/model.pth`) |
| Other checkpoint | `semantic_segmentation/unet/trained_models/best_model_overall.pth` (identical to `trained_models/34/model.pth`) |
| Sample inputs | `semantic_segmentation/unet/sample_data/S2_9-10-17_16PEC_{0..10}.tif` (11 files, 11 bands, 256 x 256, EPSG:32616, float32, no nodata value) |
| Training patches | `data/patches/S2_<date>_<tile>/S2_<date>_<tile>_<n>{,_cl,_conf}.tif` |
| Saved predictions | `data/predicted_unet/<patch>_epoch_44.npy` and `<patch>_unet_epoch_44.tif` |
| Splits | `data/splits/{train,val,test}_X.txt` (ids without the `S2_` prefix) |
| Test metrics | `logs/evaluating_unet.log` |
| Class names and colours | `utils/assets.py` (`labels`, `cat_mapping`, `color_mapping`, `roi_mapping`) |
| Band statistics | `semantic_segmentation/unet/dataloader.py` (`bands_mean`, `bands_std`, `class_distr`) |

## Running from the project root

The model modules import each other as top-level modules (`from dataloader import ...`), so they
need `semantic_segmentation/unet` on the import path. No file needs editing.

```bash
# Streamlit app. Streamlit adds the script's folder to sys.path, and app.py's paths
# (checkpoint, sample_data, favicon) are relative to the project root, so run it from there.
streamlit run semantic_segmentation/unet/app.py

# Using the model from your own script or the backend (bash; PowerShell: $env:PYTHONPATH = "semantic_segmentation/unet")
PYTHONPATH=semantic_segmentation/unet python your_script.py

# Evaluation (writes to logs/evaluating_unet.log and data/predicted_unet/ by default)
python semantic_segmentation/unet/evaluation.py

# Backend API (http://127.0.0.1:8000) and tests
python -m uvicorn backend.app.main:app --port 8000
python -m pytest backend

# Frontend dev server
npm --prefix frontend install
npm --prefix frontend run dev
```

Python: `requirements.txt` needs Python 3.8 to 3.10 (torch 1.13.1). On Python 3.13 use
`backend/requirements-relaxed.txt`, which was verified to load the checkpoint and reproduce a saved
prediction exactly. Note that `evaluation.py` writes to `logs/evaluating_unet.log` as soon as it is
imported, not only when run.

## Known issues (observations, with evidence)

- **The class named UNetPlusPlus has no nested skip connections.** `unet_plus_plus.py` builds one
  encoder (`down1` to `down4`) and one decoder (`up1` to `up4`), each `Up` joining one encoder
  level; U-Net++'s nested dense skip nodes are absent. `unet.py`'s `UNet` declares the same layers:
  the checkpoint loads into both and they give identical masks. Training used `UNetPlusPlus`
  (`train.py` line 199); evaluation uses `UNet` (`evaluation.py` line 73).
- **`app.py` discards the probabilities.** `predict` computes `softmax` but returns only
  `argmax + 1`. On `S2_9-10-17_16PEC_0.tif`, 183 pixels are classed Marine Debris, yet the highest
  debris probability is 0.536 and only 3 pixels reach 0.5: debris wins the argmax over 11 classes
  with low probability.
- **The demo samples come from the training set.** All 11 files in `sample_data/` are patches
  `9-10-17_16PEC_0` to `_10`, listed in `data/splits/train_X.txt` (46 patches of that scene, none
  in val or test).
- **Saved predictions and the log count different pixels.** The log's confusion matrix counts only
  annotated pixels (`target != -1`): 381 true debris pixels in the test split (confirmed from the
  `_cl.tif` masks) and 903 predicted as debris. The saved masks in `data/predicted_unet` cover every
  pixel of the 359 test patches and contain 69,828 class-1 pixels.
- **Epoch labels.** Saved predictions are named `epoch_44` (the `--epoch` default in
  `evaluation.py`), but they come from `best_model_marine_debris.pth`, which is byte-identical to the
  epoch-39 checkpoint (`log_unet.log` line 1237: "New best marine debris model saved with IoU:
  0.637"). A fresh run of that checkpoint reproduces `S2_12-12-20_16PCC_0_epoch_44.npy` exactly.
- **Test metrics were computed on augmented tiles.** `GenDEBRIS` applies random flips and 90-degree
  rotations (seeded) when no `albumentations_transform` is passed, and `evaluation.py` passes none
  for the test set. Image and mask are transformed together, so pixel metrics stay meaningful; the
  saved masks are computed separately from unaugmented files.
- **Debris bands along patch edges.** 45 of the 359 stored test predictions in
  `data/predicted_unet` have a row or column that is more than half Marine Debris, always at rows
  3 to 5 (top edge) or columns 1 to 2 (left edge), across many scenes; for example
  `S2_22-12-20_18QYF_0` (698 pixels) and `S2_27-1-19_16PCC_24` (598 pixels). Floating debris does
  not follow the pixel grid, so `backend/pipeline.py` leaves such bands out of the detections and
  flags them (`STRIPE_ARTEFACT`). Smaller fragments along the same edges are not caught.
- **Python version.** `.devcontainer` uses Python 3.7.10, but `numpy==1.23.5`, `pandas==1.5.3`
  and `pip==25.0.1` require Python 3.8 or later, so `requirements.txt` cannot install there as
  written. The `__pycache__` files are `cpython-37`.
- **Machine-specific paths in logs.** Both logs record `C:\Users\karth\...` paths; the code itself
  builds paths relative to its own location or the working directory.
- **No upstream README.** The copy has no upstream README or `.gitignore`, so the upstream file
  list could not be compared with the folders.

## Decisions that are yours

- Whether to push `data/patches` (4.5 GB, 4,144 files): GitHub accepts the files (largest 3.4 MB)
  but recommends repositories under 1 GB and limits a single push to 2 GB. Options: push in
  several commits, use Git LFS, or keep it out and document the MARIDA download (Zenodo 5151941).
- Whether to keep the 45 per-epoch checkpoints (154 MB) or only the two best ones.
- Which Python the backend targets: 3.10 with the original pins, or 3.13 with
  `backend/requirements-relaxed.txt`.
- Whether the backend reports debris by argmax (as `app.py` does) or by a probability threshold
  (see the observation above).
- Whether `data/predicted_unet` (273 MB, reproducible by `evaluation.py`) belongs in the repository.
