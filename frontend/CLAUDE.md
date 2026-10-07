# Marine Waste Intelligence: frontend

Hackathon project for Clean & Green Technology, problem statement TH2-PS-CG-014 (AI-Powered Marine Waste Identification and Geospatial Monitoring). The AI layer is UNet++ semantic segmentation (MARIDA / Sentinel-2 oriented). This frontend turns model output into a geographic, measurable, actionable cleanup product. It must look like a credible environmental monitoring instrument, not a student ML demo.

## Hard rules
1. GIT: never run git add, commit, push, stash, reset, checkout, rebase or merge. The owner handles all git. Read-only commands (git status, git diff, git log) are fine.
2. LIGHT MODE ONLY. No dark theme, no dark panels, no dark map tiles, no dark tooltips or toasts. No neon, no gradients as decoration, no glow, no glassmorphism, no 3D oceans, no particles, no sci-fi HUD.
3. The map is the hero. Do not build a generic analytics dashboard. Charts only where they add decision value.
4. Every number on screen comes from the Observation/Detection data contract or from a pure function in src/lib. Never hardcode figures inside components.
5. Mock data must be visibly labelled "Sample data" in the UI. Placeholder model metrics must be visibly labelled "Sample values". Never present synthetic output as a real result.
6. A "No debris detected" result is a valid result with its own designed state, not an empty map.
7. Quality gates before finishing any task: npm run typecheck, npm run lint, npm test, npm run build must all pass.
8. No `any`. Small typed components. Pure logic lives in src/lib with unit tests.
9. UI copy: sentence case, plain words, no emoji, no exclamation marks. Errors say what went wrong and what to do next.
10. Terminology is fixed: observation (one processed image), detection (one debris region), hotspot (cluster worth inspecting), density level (Low, Moderate, High, Critical).

## Design tokens (single source: src/styles/tokens in Tailwind @theme)
Background #F7F8F7. Surface #FFFFFF. Border #E3E7E5 (strong #CDD4D1). Ink #18212B. Ink muted #66717D. Accent teal #2F6F6D (hover #265957, soft #E6F0EF).
Severity scale (sequential, non-neon, readable by lightness and always paired with a text label):
Low #E8CF7A (stroke #B8993A, soft #FAF3D9); Moderate #E0954F (stroke #B86D2C, soft #FAE9D6); High #C4503A (stroke #983728, soft #F7DDD7); Critical #7F2432 (stroke #5C1824, soft #EBD3D7).
Status: success #3F7D58, warning #A66A12 (soft #FBF3E3), danger #A8402F (soft #FBEAE6), info = accent.
Type: Inter variable. Large type only for product title and KPI numbers. Tabular numerals for all figures. Monospace system stack only for coordinates and IDs.
Layout: 8px spacing grid, 12px card radius, 8px control radius, 6px badge radius, no pill-shaped buttons. 1px borders. Shadows only subtle: 0 1px 2px rgba(24,33,43,.04), popovers 0 8px 24px rgba(24,33,43,.08). Not everything goes in a card.
Motion: 120-200ms, ease-out, opacity/translate only, respect prefers-reduced-motion, nothing decorative.

## Architecture
React + Vite + TypeScript, Tailwind, React Router, TanStack Query, Leaflet (react-leaflet), GeoJSON everywhere, zod for runtime validation of API data. All server access goes through the ObservationsApi interface in src/features/observations/api, with a mock implementation and a real HTTP implementation selected by VITE_USE_MOCK.
GeoJSON is [lng, lat]. Leaflet is [lat, lng]. Convert in exactly one place (src/lib/geo.ts) and test it.

## Data contract
Observation { id, source: 'satellite'|'drone', capturedAt, region, imageUrl, previewUrl, bounds, crs, status, debrisAreaM2, waterAreaM2, coveragePercent, averageConfidence, densityLevel, detections[], modelMetrics }
Detection { id, geometry (GeoJSON Polygon/MultiPolygon), areaM2, confidence, densityLevel, centroid {lat,lng}, sourcePixelCount }

## Routes
/ (Overview), /analyze, /map/:observationId?, /observations, /observations/:id, /observations/:id/report, /settings, optional /compare, plus dev-only /design routes.

## Demo story the UI must make obvious
raw image -> AI detection -> geographic hotspot -> measurable severity -> actionable cleanup information. A full live demo must fit in under four minutes without explaining navigation.
