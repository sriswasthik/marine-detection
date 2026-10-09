# Backend contract

The HTTP API served by `backend/app` (FastAPI) around `backend/pipeline.py`. The frontend's types
are in `frontend/src/features/observations/types.ts` and `.../api/types.ts`; its zod schemas in
`.../observations/schemas.ts` validate every response.

Base URL: `http://localhost:8000` by default (`VITE_API_BASE_URL` in the frontend).

## Endpoints

| Method and path | Success | Body |
|---|---|---|
| `GET /health` | 200 | `{ status: "ok", ok: true, modelName, modelVersion, device }` |
| `GET /api/observations` | 200 | `ObservationSummary[]`, newest capture first |
| `GET /api/observations/{id}` | 200 | `Observation` |
| `POST /api/observations` | 202 | `{ jobId }` |
| `GET /api/jobs/{jobId}` | 200 | `Job` |
| `GET /files/{observationId}/{preview.png\|classes.png\|reference.png}` | 200 | PNG |
| `GET /files/{observationId}/{segmentation.png\|scene.png}` | 200 | PNG on the source pixel grid |
| `GET /files/{observationId}/segmentation.tif` | 200 | GeoTIFF class map, sent as an attachment named `{observationId}_segmentation.tif` |

### GET /health

```json
{ "status": "ok", "ok": true, "modelName": "U-Net marine debris segmentation", "modelVersion": "f19c947d5a0a", "device": "cpu" }
```

`modelVersion` is the first 12 hex digits of the checkpoint's SHA-256. `ok` is what the frontend's
health check reads; `status` is kept for other clients.

### Observation

Exactly what `backend/pipeline.py` produces (see `backend/README.md`, "What it computes"), with
file URLs made absolute when the response is built:

| Field | Value |
|---|---|
| `previewUrl`, `imageUrl` | `{base}/files/{id}/preview.png`: true colour, warped to EPSG:4326 over exactly `bounds` |
| `maskUrl`, `classMapUrl` | `{base}/files/{id}/classes.png`: context classes; the same file under both names (`maskUrl` is the frontend's field) |
| `referenceUrl` | `{base}/files/{id}/reference.png`, only when a MARIDA label exists |
| `segmentationUrl` | `{base}/files/{id}/segmentation.tif`: the class map as a GeoTIFF in the source CRS, for QGIS |
| `segmentationPreviewUrl`, `sceneImageUrl` | `{base}/files/{id}/segmentation.png` and `scene.png`: mask and true colour on the source pixel grid |

`{base}` is `PUBLIC_BASE_URL` when set, otherwise the address the request came in on.

- `detections[].geometry`: GeoJSON Polygon or MultiPolygon, WGS84, positions `[lng, lat]`, exterior
  rings counter-clockwise.
- `detections[].densityLevel` and `densityLevel` are graded by the pipeline (`densityLevel` is
  `null` only when there is no debris). `densityGrid` lists the 250 m cells (25 x 25 pixels)
  holding debris: `id` (`r{row}c{col}`, row 0 at the south), `bounds`, `areaM2`, `debrisAreaM2`,
  `coveragePercent`, `level` and `detectionAreasM2` (debris area per detection id), plus `rows`,
  `cols`, `cellSizeM`, `thresholds` and `method`. `hotspots` are ranked: `id`, `rank`, `level`,
  `bounds`, `centroid`, `cellIds`, `detectionIds`, `totalAreaM2`, `meanConfidence`,
  `priorityScore`. See `backend/README.md` for the rules. Observations stored before the
  pipeline graded density have neither field and `null` levels; the frontend grades those itself.
- Optional extras: `geospatial` (raster facts and debris figures, see `backend/README.md`), `maridaPatch`, `sceneContext`, `classPalette`, `suppressedRegions`,
  `referenceDebrisPixels`, `waterAreaDefinition`, `processing.stagesMs`, `processing.device`.
- Warnings: `LOW_CONFIDENCE`, `HIGH_CLOUD`, `STRIPE_ARTEFACT`.

### ObservationSummary

The Observation without `detections` and `densityGrid`, plus `detectionCount`. It keeps
`densityLevel` and `hotspots`.

### POST /api/observations

`multipart/form-data`:

| Field | Required | Notes |
|---|---|---|
| `file` | yes | An 11-band Sentinel-2 GeoTIFF, `.tif` or `.tiff`, at most `MAX_UPLOAD_MB` (default 100) |
| `source` | no | `satellite` (default). Anything else is refused: the model reads Sentinel-2 only |
| `region` | no | Shown name. Empty or missing: the MARIDA place for MARIDA patches (for example "Haiti (18QYF)"), otherwise the image centre ("Near 15.83° N 86.86° W") |
| `capturedAt` | no | ISO 8601 date and time; a time without offset is read as UTC |

The file is checked before the job is created (format, band count, georeferencing, size), so a bad
file fails with 422 on the form instead of halfway through a job. The frontend's optional `bounds`
field is ignored: files without georeferencing are refused with `NO_GEOREF`.

### Job

```json
{ "jobId": "job-…", "status": "running", "step": "detect", "progress": 40 }
{ "jobId": "job-…", "status": "completed", "step": "map", "progress": 100, "observationId": "obs-20261008061859-d953de" }
{ "jobId": "job-…", "status": "failed", "step": "detect", "progress": 40, "error": { "code": "MODEL_FAILURE", "message": "…", "recoverable": true } }
```

- `status`: `queued`, `running`, `completed`, `failed`.
- `step`: `upload`, `preprocess`, `detect`, `map`. A new job is `queued` at `upload`, 20%: the upload
  has finished when the job exists.
- `progress` comes from the pipeline's own stage callbacks: preprocess starts at 20, detect at 40,
  map at 75, writing the result at 90, done at 100.
- With `DEMO_MIN_STAGE_SECONDS` set, each stage stays visible at least that long. Off by default:
  a 256 x 256 patch takes about half a second on a CPU.
- Jobs run one at a time in a worker thread. Up to `MAX_QUEUED_JOBS` (default 8) wait; more get
  503 `QUEUE_FULL`.
- Jobs live in memory; finished observations are on disk.

## Errors

Every error body is:

```json
{ "error": { "code": "INVALID_BANDS", "message": "The image has 3 bands. …", "recoverable": true, "requestId": "d950e1ba5bc6" } }
```

| HTTP | `code` | `recoverable` | When |
|---|---|---|---|
| 422 | `INVALID_BANDS` | true | Not exactly 11 bands |
| 422 | `NO_GEOREF` | true | No CRS or geotransform |
| 422 | `UNREADABLE` | true | Not a readable GeoTIFF, or empty |
| 422 | `TOO_LARGE` | true | Over `MAX_UPLOAD_MB`, or more pixels than a Sentinel-2 tile |
| 422 | `UNSUPPORTED_FILE` | true | Not `.tif`/`.tiff`, or a non-TIFF content type |
| 422 | `UNSUPPORTED_SOURCE` | true | `source` other than `satellite` |
| 422 | `INVALID_REQUEST` | true | Missing or malformed form fields |
| 404 | `NOT_FOUND` | false | Unknown observation, job, file or route |
| 503 | `QUEUE_FULL` | true | Too many jobs waiting |
| 500 | `SERVER_ERROR` | true | Anything unexpected; the trace is logged, never returned |

A job that fails reports its error in the Job body instead: the same pipeline codes, or
`MODEL_FAILURE` (recoverable) for an unexpected failure during inference.

Every response carries `X-Request-ID` (the client's own, if it sends a valid one). Server log lines
carry the same id; the worker's lines for a job carry the id of the request that created it.

## Storage

- Finished uploads: `backend/store/<observationId>/` (`observation.json` and the PNGs). Each one
  is written to a hidden staging folder and renamed into place, so a crash never leaves a half
  observation. `backend/store/` is git-ignored.
- By default the list holds only those uploads: an observation exists once an image has been
  analysed. With `LOAD_SAMPLES=1` the service also loads the scenes exported by
  `backend/scripts/export_samples.py` from `frontend/public/samples/` (read only).

## Configuration (environment)

| Variable | Default | Meaning |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:5173,https://marine-waste-intelligence.vercel.app` | Comma-separated allowed origins. The Vercel address is a placeholder |
| `MAX_UPLOAD_MB` | `100` | Upload limit (matches the frontend) |
| `DEMO_MIN_STAGE_SECONDS` | unset | Minimum visible time per stage, for live demos |
| `MAX_QUEUED_JOBS` | `8` | Waiting jobs before `QUEUE_FULL` |
| `STORE_DIR` | `backend/store` | Where finished observations are written |
| `SAMPLES_DIR` | `frontend/public/samples` | Exported sample scenes to load at startup |
| `LOAD_SAMPLES` | `0` | `1` also lists the exported sample scenes; by default only analysed uploads are listed |
| `PUBLIC_BASE_URL` | unset | Absolute base for file URLs, for example behind a proxy |

## Frontend client

`frontend/src/features/observations/api/httpApi.ts` implements every call, validating responses
with the same zod schemas as the mock:

- Uploads use `XMLHttpRequest` for upload progress; `bounds` is not sent.
- Error bodies keep the service's code. `src/lib/errors/appError.ts` maps it to the app's copy:
  `INVALID_BANDS`, `NO_GEOREF` and `UNREADABLE` read as "This image can't be analysed",
  `TOO_LARGE` as "This file is too large", `QUEUE_FULL` as "service unavailable",
  `MODEL_FAILURE` as the model failure, with the service code kept as the reference.
- Summaries arrive with their `densityLevel`. For one stored before the pipeline graded density
  (`densityLevel: null` with detections), the client fills it from the observation's detail
  (fetched once, then cached). A detail that fails is reported as partial data, never shown as
  "No debris".
- The service's `densityGrid` and `hotspots` are shown as sent (`src/lib/analysis.ts`). With map
  filters on, `src/lib/serviceDensity.ts` regroups the shown detections' `detectionAreasM2` and
  ranks hotspots with the same rules.
