# marine-detection

## Project layout

- `frontend/`: React app (Vite, TypeScript). See `frontend/README.md`.
- `backend/`: Python API that wraps the model (in progress).
- `semantic_segmentation/unet/`, `utils/`, `data/`, `logs/`: the original Marine Debris Detection
  model code, data and training logs, left unchanged.
- `docs/`: project documentation.

Folder purposes, the data flow, the paths the backend depends on and the run commands are in
[docs/PROJECT_MAP.md](docs/PROJECT_MAP.md).
