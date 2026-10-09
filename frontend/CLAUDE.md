# A.W.A.R.E. (AI Waste Analysis & Reconnaissance Engine): frontend

Hackathon project for Clean & Green Technology, problem statement TH2-PS-CG-014 (AI-Powered Marine Waste Identification and Geospatial Monitoring). The AI layer is a PyTorch semantic segmentation model (class UNetPlusPlus in the repo) trained on MARIDA / Sentinel-2. This frontend turns model output into a geographic, measurable, actionable cleanup product. It must look like a credible environmental monitoring instrument, not a student ML demo.

## Hard rules
1. GIT: never run git add, commit, push, stash, reset, checkout, rebase or merge. The owner handles all git. Read-only commands (git status, git diff, git log) are fine.
2. LIGHT MODE ONLY. No dark theme, no dark panels, no dark map tiles, no dark tooltips or toasts. No neon, no gradients as decoration, no glow, no glassmorphism, no 3D oceans, no particles, no sci-fi HUD.
3. The map is the hero. Do not build a generic analytics dashboard. Charts only where they add decision value.
4. Every number on screen comes from the Observation/Detection data contract or from a pure function in src/lib. Never hardcode figures inside components.
5. Synthetic data must be visibly labelled "Sample data" in the UI. Real MARIDA scenes are labelled "Model output on MARIDA patch <id>". Placeholder model metrics must be labelled "Sample values". Never present synthetic output as a real result.
6. A "No debris detected" result is a valid result with its own designed state, not an empty map.
7. Quality gates before finishing any task: npm run typecheck, npm run lint, npm test, npm run build must all pass.
8. No `any`. Small typed components. Pure logic lives in src/lib with unit tests.
9. UI copy: sentence case, plain words, no emoji, no exclamation marks. Errors say what went wrong and what to do next.
10. Terminology is fixed: observation (one processed image), detection (one debris region), hotspot (cluster worth inspecting), density level (Low, Moderate, High, Critical).
11. ONE PRIMARY BUTTON PER VIEW. Exactly one filled Tar Black button (white label) is visible per view. The top bar carries it ("Analyze new imagery") unless the view shows its own primary, which it claims with useClaimPrimaryAction (Run detection on Analyze, View evidence in the map drawer). Secondary is a 1px ink outline, tertiary a text link with an arrow. A toolbar shows at most two buttons; everything else goes in a menu. Checked switches and boxes are ink, never accent.
12. CARDS ONLY FOR THINGS THAT FLOAT: the drawer, dialogs and popovers. Everything else sits directly on the paper, separated by hairlines and whitespace. No metric-card grids.
13. NO PILLS. No element with a radius of half its height or more, except map symbols drawn on the chart. Badges are squared tags (Tag, SeverityTag, ConfidenceTag) with a swatch and text; status dots are small squares; the switch is square.
14. Design audit: a task that changes UI runs `npm run design:audit` for the routes it touched and leaves them passing the thresholds in docs/DESIGN_SYSTEM.md section 13 (or says which ones still fail and why).

## Design system: the survey chart (full spec: docs/DESIGN_SYSTEM.md; baseline: docs/DESIGN_AUDIT.md)
Status: D2 is in the code: these tokens, Instrument Sans and Geist Mono, the primitives in src/components/ui (Button, ArrowLink, Tag, Field, Ledger, SectionLabel, Figure, Sentence, Measure, ObservationGlyph and the rest; Badge, Card and MetricCard are gone), the shell (52px top bar with the A.W.A.R.E. logomark and wordmark, no data source tag or observation switcher in it; command palette, phone tab bar with the switcher in its More sheet, breadcrumbs, NextStep). Sample data stays labelled in page content (ProvenanceTag), never only in the chrome. Page layouts follow in D3 and D4. Use the primitives; do not rebuild boxes, pills or metric cards. `npm run design:audit` measures each route against the thresholds in docs/DESIGN_SYSTEM.md section 13.
Concept: a hydrographic survey chart. Calm paper ground, hairline rules, coordinate ticks, small-caps labels, tabular data in ledgers, colour only where it carries meaning. Boldness lives in one place, the map chrome; everything else stays quiet and precise.

### Tokens (single source: src/styles/tokens.css in Tailwind @theme)
The A.W.A.R.E. deck palette. Paper #E7E4DC Concrete (page). Sheet #F1EFE9 (docked panels, plates, tooltips). White #FFFFFF (drawer, dialogs). Hairline #D2CEC4. Rule #ADA89C. Tar #15171A Tar Black (logomark, wordmark, focus rings, map marks). Ink #3A3B3D Graphite (body text, titles, figures). Ink-2 #5A5A55 Slate Grey (all small text is ink-2 or darker). Ink-3 #78756C (large or decorative only; fails 4.5:1). Accent #15171A Tar Black: the primary button, white text, hover #3A3B3D. Signal #F4C51D Signal Yellow is the LOGOMARK ONLY (it clashes with the Low severity fill and is 1.3:1 on Concrete). Accent-ink #3B3420 Olive Ink for links, tertiary actions and active states; accent-wash #DCD8CD (neutral) for selected rows and segments. Dark-slide colours (Stone, Fog Grey) are unused: light mode only.
Severity ramp (always with a text label; Low and Moderate fills are under 3:1 on paper): Low #E8CF7A (stroke #B8993A, soft #FAF3D9); Moderate #E0954F (stroke #B86D2C, soft #FAE9D6); High #C4503A (stroke #983728, soft #F7DDD7); Critical #7F2432 (stroke #5C1824, soft #EBD3D7).
Status: success #2E6343 (soft #EBF3EE), warning #7F510C (soft #FBF3E3), danger #963826 (soft #FBEAE6), info = accent-ink.

### Type
UI face Instrument Sans (@fontsource-variable/instrument-sans); data face Geist Mono (@fontsource-variable/geist-mono) for coordinates, IDs, ticks and ledger figures. Weights 400, 500, 600 only.
Eight sizes, no others: 11 label (uppercase, +0.06em, ink-2), 12 mono caption, 13 secondary, 14 body (20 line height), 16 lead, 22 section title, 32 page title, 56 headline figure. Headline figures are tabular with the unit at about 40% of the figure size, baseline-aligned. Body lines at most 68 characters.

### Space, grid, shape
4px base; steps 4, 8, 12, 16, 24, 32, 48, 64, 96 only (no 2, 6, 10 or 14px; no Tailwind half steps). 12-column grid, 24px gutters, content max width 1280px on document pages, the map full-bleed. Left-aligned to the grid, at most three left edges per page. 48 to 64px between sections, 16 to 24px inside.
Radii: panels 2px, controls 4px, tags 2px, drawer 0. 1px hairlines for structure, the rule colour for emphasis. Elevation: none, or the popover shadow 0 6px 20px rgba(19,31,38,.10). Nothing else casts a shadow.

### Signature elements (use them consistently)
1. Section labels: an 11px small-caps label followed by a rule running to the right edge.
2. Ledgers: tables with hairline rows, mono right-aligned tabular figures, units in the header, no zebra, no boxes, sticky headers.
3. ChartFrame: the map framed by a rule with graticule ticks and labels on all four edges, corner crop marks, a north indicator and a chart-style alternating scale bar.
4. ObservationGlyph: a small square SVG of the observation's density grid, coloured by level; used in lists, the observation switcher, breadcrumbs and report headers.
5. Sentence summaries: results written as a sentence with the numbers set large inside it ("42 possible debris regions covering 3.4 ha, in 3 hotspots."), not rows of metric cards.
6. Tags, not pills: a squared label with a colour swatch and text, never colour alone.
7. Rings, not discs: hotspot markers are a 22px ring in the level colour with a transparent centre and the rank in a small mono label at the top right (rank 1 inverted); selected, a thicker Tar Black ring. Small detections are 6px squares that cluster above 40 in view.
8. The Map page is a strict grid (toolbar, side panel, map, status strip, drawer; see docs/MAP_CLEANUP.md): no floating page-level panels, at most two overlays inside the map, and e2e/map-layout.spec.ts (npm run e2e) must pass for any change to it.

### First glance and navigation
Each page leads with one thing (full table in docs/DESIGN_SYSTEM.md section 11): Overview: the map plate and sentence summary, then "Analyze new imagery", then "Inspect next", then recent observations. Analyze: the drop zone or image plate, then "Run detection", then details. Map: the map, then hotspot 1 and the priority ledger, then the toolbar. Observation detail: the evidence plate, then the sentence summary and ledger, then the detections table.
Always show where I am (top bar, breadcrumbs on deep pages), what I am looking at (the current observation with its glyph) and what to do next (a "Next" link at the end of each page: Overview, Analyze, Map, Detail, Report). Ctrl or Cmd + K opens a command palette that reaches every page, every observation and the main actions.

### Motion
120 to 400ms, one easing curve cubic-bezier(.2,.7,.2,1), opacity and transform only, honours prefers-reduced-motion, nothing loops. Results: detections fade in staggered by size, hotspots settle with one ring ripple; headline figures count up once on first view; panels and the drawer slide with a short content stagger; ledger rows nudge 2px on hover; a thin Tar Black scan line sweeps the image while processing; layer toggles crossfade.

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
