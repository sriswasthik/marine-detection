# A.W.A.R.E. (AI Waste Analysis & Reconnaissance Engine): frontend

Hackathon project for Clean & Green Technology, problem statement TH2-PS-CG-014 (AI-Powered Marine Waste Identification and Geospatial Monitoring). The AI layer is a PyTorch semantic segmentation model (class UNetPlusPlus in the repo) trained on MARIDA / Sentinel-2. This frontend turns model output into a geographic, measurable, actionable cleanup product. It must look like a credible environmental monitoring instrument, not a student ML demo.

## Hard rules
1. GIT: never run git add, commit, push, stash, reset, checkout, rebase or merge. The owner handles all git. Read-only commands (git status, git diff, git log) are fine.
2. LIGHT AND MINIMAL ONLY. No dark theme, no gradients, no glows, no glass, no decorative particles. Colour appears only where it carries meaning (severity, status, links). 3D is allowed only as data-driven or pipeline-explaining scenes in src/features/scene3d, drawn as ink on paper (see "3D scenes" below).
3. The map is the hero. Do not build a generic analytics dashboard. Charts only where they add decision value.
4. Every number on screen comes from the Observation/Detection data contract or from a pure function in src/lib. Never hardcode figures inside components.
5. Synthetic data must be visibly labelled "Sample data" in the UI. Real MARIDA scenes are labelled "Model output on MARIDA patch <id>". Placeholder model metrics must be labelled "Sample values". Never present synthetic output as a real result.
6. A "No debris detected" result is a valid result with its own designed state, not an empty map.
7. Quality gates before finishing any task: npm run typecheck, npm run lint, npm test, npm run build must all pass.
8. No `any`. Small typed components. Pure logic lives in src/lib with unit tests.
9. UI copy: sentence case, plain words, no emoji, no exclamation marks. Errors say what went wrong and what to do next.
10. Terminology is fixed: observation (one processed image), detection (one debris region), hotspot (cluster worth inspecting), density level (Low, Moderate, High, Critical).
11. ONE PRIMARY BUTTON PER VIEW. Exactly one solid ink button (white label) is visible per view, and it is the only solid ink block on the page. The top bar carries it ("Analyze new imagery") unless the view shows its own primary, which it claims with useClaimPrimaryAction (the Overview hero, Run detection on Analyze, View evidence in the map drawer). Secondary is a 1px ink outline whose ink fill wipes in from the left on hover; tertiary an Ultramarine text link with an arrow. Links, focus and active states are Ultramarine, never ink-filled, so the call to action never shares its look. A toolbar shows at most two buttons; everything else goes in a menu. Checked switches and boxes are ink.
12. NO CARDS. Only things that float (the drawer, dialogs, popovers, menus) get a surface and a shadow. Everything else sits on the paper, separated by hairlines, rules and whitespace. No metric-card grids, no boxed lists: lists are ruled rows.
13. NO PILLS. Square corners everywhere (2px on controls only); no tinted chips. A tag is an 8px square swatch and a word, with a hairline frame only for warnings (sample data, low confidence). Filters are text toggles with an ink underline. Colour never carries meaning alone.
14. Design audit: a task that changes UI runs `npm run design:audit` for the routes it touched and leaves them passing the thresholds in scripts/design-audit.mjs TARGETS (or says which ones still fail and why; the report route has 4 left edges and the running Analyze states have no primary, both from before the redesign).

## Design system: Survey sheet (tokens in src/styles/tokens.css; docs/DESIGN_SYSTEM.md describes the earlier "survey chart" and is out of date on type and accent)
Concept: a printed survey sheet. Warm paper, ink type, hairline rules, an editorial serif for titles, mono for data, and colour only in the data. Minimal but not generic: the serif display, the numbered brief (01, 02, 03), ruled lists and the one solid ink call to action are the signature. `npm run design:audit` enforces it (targets in scripts/design-audit.mjs: 0 pills, 0 cards, 0 gradients, the popover shadow only, 3 families, 8 sizes, the 4px grid, AA contrast, one primary per view).

### Tokens (single source: src/styles/tokens.css in Tailwind @theme)
Surfaces: paper #F7F6F2 (page), sheet #EFEDE7 (docked panels, quiet fills, selected rows), raised #FFFFFF (drawer, dialogs, popovers, inputs), hairline #E2DFD7, rule #C2BEB3. Ink: tar #0B1520 (headlines, wordmark, map selection), ink #1C2530 (body), ink-2 #565E68 (all small text is ink-2 or darker), ink-3 #868B91 (large or decorative only). Accent #0B1520 is the primary button fill (on-accent white, hover #26313D); accent-ink Ultramarine #2235C9 for links, focus and active states; accent-wash #E7E9F6 for text selection.
Severity ramp (always with a text label; Low and Moderate fills are under 3:1 on paper): Low #E8CF7A (stroke #B8993A); Moderate #E0954F (stroke #B86D2C); High #C4503A (stroke #983728); Critical #7F2432 (stroke #5C1824). src/lib/density.ts and MAP_COLORS in src/lib/map/basemaps.ts mirror the tokens (tests keep them equal); tokens.test.ts checks every text pair for AA. Cluster counts: ink on Low and Moderate, white on High and Critical (--cluster-ink-* in index.css).
Status: success #2E6343, warning #7F510C, danger #963826, info = accent-ink. Map: default basemap "light" (Esri World Light Gray), satellite optional. The printed report adds `.theme-paper` (a white page).

### Type
Instrument Serif (@fontsource/instrument-serif, the `display` utility) for page titles and the hero only; Geist (@fontsource-variable/geist) for the interface; Geist Mono (@fontsource-variable/geist-mono) for coordinates, IDs, ticks and ledger figures. Weights 400, 500, 600 only.
Eight sizes, no others: 11 label (uppercase, +0.08em), 12 mono, 13 secondary, 14 body, 16 lead, 22 section title, 40 page title (serif), 56 headline (the Overview h1 in serif; headline figures in Geist).

### Space, grid, shape
4px base; padding, margin and gap on the 4px grid only. 12-column grid, 24px gutters, content max width 1280px on document pages, the map full-bleed. Radii 0, 2px on controls. Elevation: the popover shadow on floating things only.

### First screen (Overview)
Above the fold, in this order: what kind of product (eyebrow), the promise (serif h1), a three-part brief (01 What it is, 02 Who it is for, 03 Why it matters), then the next step: the primary "Analyze new imagery" (with a muted "─ 11-band GeoTIFF" qualifier), the secondary "Try a sample scene" on sample data, and "Open latest map". The globe and the totals sit beside it on desktop and below it on phones.

### Motion
120 to 400ms, one easing curve cubic-bezier(.2,.7,.2,1), honours prefers-reduced-motion. The primary button lifts 2px on hover; the secondary's fill wipes in; headline figures count up once; the processing scan line sweeps once per pass. Nothing decorative loops.

### uiverse.io elements (MIT, github.com/uiverse-io/galaxy)
Adapted to the tokens, not copied, and credited in the component comments: the primary button (McHaXYT, two-tone dark), the secondary button (Cornerstone-04, outline with a wipe fill), the switch (anonithrax, square track and thumb). Pick further elements only if they are flat, square and monochrome.

### 3D scenes (src/features/scene3d; three.js + @react-three/fiber, lazy-loaded)
Pure geometry lives in src/lib/scene3d.ts with tests. Every scene runs inside SceneHost: WebGL only where available (jsdom and no-WebGL browsers get a still fallback), paused off-screen, decorative (aria-hidden) with the same information in text beside it. Normal blending only (additive glow vanishes on paper); ink, Ultramarine and the severity ramp only.
- OrbitalGlobe (Overview): observations as beams at their image centres (colour = density level, height = log of detections), Natural Earth land as ink dots on a white sphere, Sentinel-2 in Ultramarine on its real orbit (786 km, 98.62 degrees, 290 km swath). Clicking a beam opens the map.
- SpectralStack (Analyze, while running): the 11 model bands driven by the real job step statuses; captioned as an illustration, not the user's pixels.
- DensityRelief (Observation detail): the density grid as bars (height = square root of coverage, colour = level) on a ruled plate, with beacons over the top hotspots; hovering a bar reads out that cell.
Do not add 3D that is decoration only, and never show figures in 3D that are not in the data.

### Signature elements (use them consistently)
1. Section labels: an 11px small-caps label followed by a rule running to the right edge.
2. Ledgers: tables with hairline rows, mono right-aligned tabular figures, units in the header, no zebra, no boxes, sticky headers.
3. ChartFrame: the map framed by a rule with graticule ticks and labels on all four edges, corner crop marks, a north indicator and a chart-style alternating scale bar.
4. ObservationGlyph: a small square SVG of the observation's density grid, coloured by level; used in lists, the observation switcher, breadcrumbs and report headers.
5. Sentence summaries: results written as a sentence with the numbers set large inside it ("42 possible debris regions covering 3.4 ha, in 3 hotspots."), not rows of metric cards.
6. Tags, not pills: a square swatch and text, never colour alone.
7. Rings, not discs: hotspot markers are a 22px ring in the level colour with a transparent centre and the rank in a small mono label at the top right (rank 1 inverted, ink); selected, a thicker ink ring over a white casing. Small detections are 6px squares that cluster above 40 in view.
8. The Map page is a strict grid (toolbar, side panel, map, status strip, drawer; see docs/MAP_CLEANUP.md): no floating page-level panels, at most two overlays inside the map, and e2e/map-layout.spec.ts (npm run e2e) must pass for any change to it.

### First glance and navigation
Each page leads with one thing (full table in docs/DESIGN_SYSTEM.md section 11): Overview: the map plate and sentence summary, then "Analyze new imagery", then "Inspect next", then recent observations. Analyze: the drop zone or image plate, then "Run detection", then details. Map: the map, then hotspot 1 and the priority ledger, then the toolbar. Observation detail: the evidence plate, then the sentence summary and ledger, then the detections table.
Always show where I am (top bar, breadcrumbs on deep pages), what I am looking at (the current observation with its glyph) and what to do next (a "Next" link at the end of each page: Overview, Analyze, Map, Detail, Report). Ctrl or Cmd + K opens a command palette that reaches every page, every observation and the main actions.

## Architecture
React + Vite + TypeScript, Tailwind, React Router, TanStack Query, Leaflet (react-leaflet), GeoJSON everywhere, zod for runtime validation of API data. All server access goes through the ObservationsApi interface in src/features/observations/api, with a mock implementation and a real HTTP implementation selected by VITE_USE_MOCK.
GeoJSON is [lng, lat]. Leaflet is [lat, lng]. Convert in exactly one place (src/lib/geo.ts) and test it.

## Data contract
Observation { id, source: 'satellite'|'drone', capturedAt, region, imageUrl, previewUrl, bounds, crs, status, debrisAreaM2, waterAreaM2, coveragePercent, averageConfidence, densityLevel, detections[], modelMetrics }
Detection { id, geometry (GeoJSON Polygon/MultiPolygon), areaM2, confidence, densityLevel, centroid {lat,lng}, sourcePixelCount }

## Model and data reality (verified from the repo, keep the UI honest about it)
- Input: one 11-band Sentinel-2 GeoTIFF patch, float32 reflectance, 256x256 px at 10 m (about 2.56 km square), projected UTM CRS (for example EPSG:32616). Band order: 440, 490, 560, 665, 705, 740, 783, 842, 865, 1600, 2200 nm. A true-colour preview uses band indexes 3, 2, 1 (665/560/490 nm) with a percentile stretch.
- The model does not accept PNG/JPG, drone imagery, or any band count other than 11. The UI says so up front instead of failing late.
- Output: per-pixel class ids 1 to 11: 1 Marine Debris, 2 Dense Sargassum, 3 Sparse Sargassum, 4 Natural Organic Material, 5 Ship, 6 Clouds, 7 Marine Water, 8 Sediment-Laden Water, 9 Foam, 10 Turbid Water, 11 Shallow Water. A detection is a connected region of class 1. One pixel is 100 m2.
- The other classes are useful context. Sargassum, foam, ships and clouds are the usual false-positive sources, so the UI offers a "context classes" view and uses the cloud share as cloud coverage.
- Debris-class quality is modest (precision about 0.37, recall about 0.88, F1 about 0.52 in logs/evaluating_unet.log; confirm these belong to the shipped checkpoint). Copy treats detections as possible debris with a confidence, never as certain.
- There is no REST API in the repo, only a Streamlit app. A FastAPI service is built around backend/pipeline.py in prompts 02B and 11A.

## Routes
/ (Overview), /analyze, /map/:observationId?, /observations, /observations/:id, /observations/:id/report, /settings, optional /compare, plus dev-only /design routes.

## Demo story the UI must make obvious
raw image -> AI detection -> geographic hotspot -> measurable severity -> actionable cleanup information. A full live demo must fit in under four minutes without explaining navigation.

## Repository layout
This frontend is one part of a larger project: the original PyTorch model (semantic_segmentation/, utils/, data/, logs/ at the repo root) and a Python backend (backend/) that wraps it. Folder purposes, the data flow, the paths the backend depends on and the run commands are in docs/PROJECT_MAP.md at the repo root.
