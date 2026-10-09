# A.W.A.R.E.: frontend

AI Waste Analysis & Reconnaissance Engine.

Map-first interface for the marine debris pipeline: an 11-band Sentinel-2 image goes in; possible
debris regions come out on a map, with a density level per area and a ranked list of where to
inspect first. Project rules, design tokens and the data contract are in `CLAUDE.md`; the whole
repository is described in `../docs/PROJECT_MAP.md`.

React 19, Vite 8, TypeScript (strict), Tailwind CSS v4, React Router 7, TanStack Query 5, zod,
Leaflet with react-leaflet, framer-motion (sparingly), Vitest.

## Setup

```sh
npm install
cp .env.example .env
npm run dev        # http://localhost:5173
```

| Script               | What it does                            |
| -------------------- | --------------------------------------- |
| `npm run dev`        | Dev server with hot reload              |
| `npm run build`      | Type-checks, then builds to `dist/`     |
| `npm run preview`    | Serves the built `dist/`                |
| `npm run typecheck`  | `tsc -b` over the app, tests and config |
| `npm run lint`       | ESLint                                  |
| `npm test`           | Vitest, once                            |
| `npm run test:watch` | Vitest in watch mode                    |
| `npm run format`     | Prettier                                |

Every task finishes with `typecheck`, `lint`, `test` and `build` passing.

## Environment variables

| Variable            | Default                     | Meaning                                                       |
| ------------------- | --------------------------- | ------------------------------------------------------------- |
| `VITE_USE_MOCK`     | `false`                     | `false`: the live API, observations are the images analysed. `true`: in-browser mock with synthetic sample data (tests use it, see `.env.test`) |
| `VITE_API_BASE_URL` | `http://localhost:8000`     | The backend (`../backend`, see its README)                    |
| `VITE_APP_NAME`     | `A.W.A.R.E.`                | Product name in the top bar and reports                       |
| `VITE_DEMO_FAST`    | `false`                     | `true` shortens the mock pipeline from about 8 s to about 2 s |

The data source can also be switched at run time in Settings, with a connection test; the choice
is saved in the browser. When the live service cannot be reached, error screens offer "Switch to
sample data".

## Data and labels

- **Sample data (mock):** six synthetic scenes generated in the browser from fixed seeds. Every
  screen labels them "Sample data"; placeholder model metrics are labelled "Sample values".
- **Model output on MARIDA patches:** `public/samples/` holds real output of the model, exported
  by `../backend/scripts/export_samples.py`. The mock serves these too, labelled
  "Model output on MARIDA patch <id>" (training-split patches say so). Uploading one of those
  patch files on the Analyze page returns its real output.
- **Live:** the FastAPI service in `../backend/app`; contract in `../docs/BACKEND_CONTRACT.md`.

### Mock scenarios

Add `?mock=<scenario>` to any URL (or pick it under the Analyze form). A job keeps the scenario
that was active when it started.

| Scenario    | Result                                                                                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `success`   | Default. Upload, preprocess, detect, map, then a completed observation: the sample named in the file name (for example `mahim.tif`), an exported MARIDA patch of the same name, or the Ennore scene |
| `nodebris`  | The valid no-debris result (Gulf of Mannar)                                                                                                                                                         |
| `lowconf`   | Many low-confidence detections with a cloud warning (Visakhapatnam)                                                                                                                                 |
| `partial`   | Partial georeferencing: approximate positions (Sundarbans)                                                                                                                                          |
| `invalid`   | Fails at upload: the image cannot be analysed                                                                                                                                                       |
| `modelfail` | Fails during detection                                                                                                                                                                              |
| `network`   | Every request fails as if the service were unreachable                                                                                                                                              |
| `empty`     | No observations, as on a fresh install                                                                                                                                                              |

The synthetic scenes: Ennore coast (about 60 detections, 3 hotspots, the demo opener), Mahim Bay
(Moderate), Vembanad Lake (Low), Gulf of Mannar (no debris), Visakhapatnam coast (low confidence,
cloud) and Sundarbans delta (partial georeferencing).

## Architecture

```
src/
  app/          router (lazy page routes), providers, shell (top bar, shortcuts dialog)
  pages/        one file per route
  features/     observations (API, schemas, mock), map, analyze, evidence, export, settings, overview
  components/ui primitives: Button, Drawer, Dialog, Tooltip, SegmentedControl, ...
  lib/          pure logic with unit tests: geo, density, hotspots, filters, format, errors, ...
  styles/       tokens.css (Tailwind @theme, the single source of design tokens) and base styles
  test/         Vitest setup and helpers
```

- All server access goes through `ObservationsApi` (`src/features/observations/api`): the mock and
  the HTTP client implement it, and every response is validated with zod.
- GeoJSON is `[lng, lat]`, Leaflet `[lat, lng]`; the conversion happens only in `src/lib/geo.ts`.
- Density levels and hotspots of real model output come from the service (`densityGrid` and
  `hotspots`, graded by `backend/pipeline.py`) and are shown as sent; with map filters on, the
  hotspots are regrouped from the service's measured cells (`src/lib/serviceDensity.ts`). The
  synthetic sample scenes are graded in the browser (`src/lib/density.ts`, `hotspots.ts`), with
  the same rules. The observation detail page says which ("Density and hotspots").
- Each page is its own chunk; React, framer-motion and Leaflet are separate vendor chunks, and
  Leaflet loads only with pages that draw a map. The first load is about 230 KB gzipped.

### Routes

`/` Overview · `/analyze` · `/map/:observationId?` · `/observations` · `/observations/:id` ·
`/observations/:id/report` · `/settings` · `/compare` · `/design` and `/design/states` (development
only).

### Keyboard

`?` lists the shortcuts. On the map: `F` fits to the detections, `L` toggles the legend, `1` to
`4` toggle detections, density, hotspots and footprint; with the map focused, `+`/`-` zoom and the
arrow keys pan. `Esc` closes drawers, menus and dialogs. Shortcuts never fire while typing.

## Deploy

`vercel.json` builds with `npm run build`, serves `dist/`, rewrites every path to `index.html` (the
app routes in the browser) and caches hashed assets for a year. Set the environment variables in
the Vercel project; for live data the backend must allow the deployed origin (`CORS_ORIGINS`).

## Attributions

- Basemaps: Esri World Light Gray Canvas and Esri World Imagery ("Tiles © Esri"; sources Esri,
  HERE, Garmin, Maxar, Earthstar Geographics, © OpenStreetMap contributors and the GIS user
  community). CARTO Positron (© OpenStreetMap contributors, © CARTO) is configured but needs an
  API key.
- Imagery: contains modified Copernicus Sentinel-2 data.
- Training data and sample patches: MARIDA, a marine debris benchmark built on Sentinel-2
  (Kikaki et al., 2022; Zenodo record 5151941).
- Model code: github.com/karthikram-p/Marine-Debris-Detection.
- Leaflet (BSD-2-Clause), Lucide icons (ISC), Inter typeface (SIL Open Font License 1.1).
