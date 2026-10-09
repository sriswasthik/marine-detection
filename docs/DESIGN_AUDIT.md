# Design audit: baseline

The frontend as it stands, measured and critiqued before the redesign described in
`DESIGN_SYSTEM.md`. Screenshots are in `design/before/` (1440 x 900 and 390 x 844, sample-data
mode); the raw measurements are in `design/audit.json`.

Reproduce from `frontend/`:

```bash
npm run design:audit -- --shots ../docs/design/before
```

The script (`frontend/scripts/design-audit.mjs`) starts its own Vite server in sample-data mode,
walks the routes and states in `frontend/scripts/design-audit.routes.json`, and measures computed
styles in the browser. Definitions are in the script's comments; the main ones:

- **Type:** every visible text node, its computed size, weight and first font family.
- **Off-grid spacing:** padding, margin and gap values that are not multiples of 4 px. Margins
  produced by `auto` and Leaflet's own markup are excluded.
- **Pills:** a radius of 999 px or at least half the shorter side (status dots and swatches
  count; switches and Leaflet's markup do not).
- **Cards:** a box with a border or shadow, a radius above 0 and a background that differs from
  its parent. Form fields and controls under 48 px tall do not count.
- **Shadows:** distinct elevation shadows (blur above 0). Rings (outlines drawn with box-shadow) are
  listed separately in the JSON.
- **Primary buttons:** filled accent buttons and links inside the first viewport.
- **Left edges:** distinct left x of the page's top-level blocks (the first container in `<main>`
  with several children, its children and their children).

## Baseline numbers

App-wide verdicts (worst view, or distinct values across all views for type and shadows):

| Measure | Baseline | Target | Pass |
|---|---|---|---|
| Font sizes | 8 (10, 11, 12, 13, 14, 15, 20, 28 px) | at most 8 | yes |
| Font weights | 3 (400, 500, 600) | at most 3 | yes |
| Font families | 2 (Inter Variable, system mono) | at most 2 | yes |
| Off-grid spacing values | 592 (Observation detail) | 0 | no |
| Pills | 80 (Observation detail) | 0 | no |
| Cards | 17 (Observation detail) | 0 outside drawer, dialogs, popovers | no |
| Gradients | 0 | 0 | yes |
| Elevation shadows | 2 | at most 2 | yes |
| Primary buttons per view | 10 of 20 views have 2 | exactly 1 per view | no |
| Contrast failures | 3 (Map) | 0 | no |
| Targets under 40 px (mobile) | 23 (Observations) | 0 | no |
| Left edges | 6 (Map) | at most 3 | no |

Per view:

| Route | Width | Sizes | Off-grid | Pills | Cards | Primary | Contrast | Small | Edges |
|---|---|---|---|---|---|---|---|---|---|
| Overview | 1440 | 8 | 87 | 17 | 1 | 2 | 0 | 0 | 1 |
| Overview | 390 | 8 | 68 | 12 | 1 | 2 | 0 | 0 | 1 |
| Analyze, empty | 1440 | 5 | 17 | 2 | 4 | 2 | 0 | 0 | 2 |
| Analyze, file chosen | 1440 | 5 | 49 | 1 | 4 | 2 | 0 | 0 | 2 |
| Analyze, processing | 1440 | 5 | 12 | 7 | 1 | 1 | 0 | 0 | 2 |
| Analyze, result | 1440 | 5 | 17 | 5 | 2 | 2 | 0 | 0 | 2 |
| Map, hotspot open | 1440 | 7 | 198 | 47 | 5 | 1 | 3 | 0 | 5 |
| Map, hotspot open | 390 | 6 | 152 | 44 | 5 | 1 | 0 | 0 | 6 |
| Observation detail | 1440 | 8 | 592 | 80 | 17 | 2 | 0 | 0 | 2 |
| Observation detail | 390 | 8 | 530 | 80 | 17 | 2 | 0 | 2 | 1 |
| Observations | 1440 | 5 | 358 | 23 | 0 | 1 | 0 | 0 | 1 |
| Observations | 390 | 4 | 308 | 23 | 0 | 1 | 0 | 23 | 1 |
| Settings | 1440 | 5 | 138 | 2 | 1 | 1 | 0 | 0 | 1 |
| Settings | 390 | 5 | 138 | 2 | 1 | 1 | 0 | 1 | 1 |
| Report | 1440 | 7 | 69 | 2 | 2 | 2 | 0 | 0 | 3 |
| Report | 390 | 6 | 67 | 2 | 2 | 2 | 0 | 0 | 1 |

What the numbers say:

- **Type passes on count but not on intent.** Eight sizes is the limit, but they are the wrong
  eight: three of them (13, 14, 15 px) sit 1 px apart and do the same job, and nothing is larger
  than 28 px, so no figure or title can lead.
- **Spacing is mostly 6, 2, 10 and 14 px:** Tailwind's half steps (`gap-1.5`, `py-0.5`,
  `px-2.5`, `py-3.5`). On Observation detail, 480 of 592 off-grid values are 6 px.
- **Pills are status dots, swatches, rank circles and rounded bars**, repeated per table row.
- **The second primary button on 10 of 20 views is the same one:** "Analyze new imagery" in the
  top bar, competing with the page's own action.
- **Contrast:** the three failures are muted text (4.28:1) on the translucent "Where to inspect
  next" panel over the map.
- **Small targets:** the Observations table's region links (20 px tall; the row is the real
  target) and range sliders.

## After D2: the visual foundation

New tokens, fonts and primitives, and the new shell, with no layout redesign yet. Measured with
the same script and routes: `docs/design/audit-after-d2.json`, screenshots in `docs/design/after/`.
The baseline stays in `docs/design/audit.json` and `docs/design/before/`.

| Measure | Target | Before | After D2 | Pass |
|---|---|---|---|---|
| Font sizes (app-wide) | at most 8 | 8 | 7 | yes |
| Font weights | at most 3 | 3 | 3 | yes |
| Font families | at most 2 | 2 (Inter, ui-monospace) | 2 (Instrument Sans, Geist Mono) | yes |
| Off-grid spacing (worst view) | 0 | 592 | 0 | yes |
| Pills (worst view) | 0 | 80 | 0 | yes |
| Cards (worst view) | 0 | 17 | 0 | yes |
| Gradients | 0 | 0 | 0 | yes |
| Elevation shadows (app-wide) | at most 2 | 2 | 1 | yes |
| Primary buttons | exactly 1 per view | 10 of 20 views off | 3 of 20 views off | no |
| Contrast failures (worst view) | 0 | 3 | 0 | yes |
| Small targets on mobile (worst view) | 0 | 23 | 0 | yes |
| Left edges (worst view) | at most 3 | 6 | 6 | no |

What still fails, and where it gets fixed:

- **Primary buttons (3 views):**
  - **Analyze processing (both widths):** no primary, on purpose; there is nothing to do but wait
    or cancel.
  - **Analyze with a file chosen, 390px:** "Run detection" sits below the first screen, after the
    details form. D3 moves it directly under the image plate.
- **Left edges:**
  - **Map (5 at 1440px, 6 at 390px):** the floating plates (filters, priority list, legend,
    controls) each start at their own x. D3 docks them in a side panel and the chart's margin band.
  - **Report (4 at 1440px):** the centred A4 sheet and its toolbar.
- **Not yet in the layout:** the map plates are square sheets for now (no radius, so not cards),
  and the Overview still has its hero and pipeline strip. D3 and D4 rebuild the page layouts in
  the first-glance order of `DESIGN_SYSTEM.md` section 11.

## Per route

### Overview (`overview-1440.png`, `overview-390.png`)

- **First glance today:** the 28 px headline "Detect marine debris and understand exactly where it
  is." and two teal buttons (top bar and hero) that compete. At 1440 x 900 the map preview starts
  at y = 857, so the one thing that shows a result is below the fold. On mobile the map appears
  after 1.1 screens of marketing copy, pipeline icons and four figures.
- **Should land on:** the map plate of the current observation and one sentence that says what was
  found, then "Analyze new imagery", then "Inspect next".
- **Typography:** the headline (28 px) and the figures (28 px) share a size, so nothing leads. The
  eyebrow (12 px uppercase), section titles (15 to 20 px) and table text (13 to 14 px) are too close
  to separate levels. Figures use tabular numerals, but units ("ha", "%") are set at the figure
  size, which reads as noise ("11.3 ha" weighs the same as "70%").
- **Spacing and rhythm:** 87 off-grid values; the gaps between intro, pipeline, figures and map
  vary (48, 64, 40 px) without a pattern.
- **Alignment:** a single left edge at 144 px, but the right column ("Inspect next") ends about
  100 px above the map it sits beside, leaving a hole.
- **CTA:** two filled "Analyze new imagery" buttons in the first viewport.
- **Template-like:**
  - **The whole page:** the hero, a seven-step pipeline of circled line icons, four metric
    figures, a two-column map and list, and a table: the generated-dashboard sequence.
  - **Generic icons:** the pipeline icons are stock and say nothing a label does not.
  - **Repetition:** "Completed" is repeated on every row of "Recent observations".

### Analyze (`analyze-*.png`)

- **First glance today:**
  - **Empty:** the dashed drop zone and the disabled teal "Run detection".
  - **File chosen:** the true-colour preview, which is right; but "Run detection" sits halfway
    down the right column, far from the image it acts on.
  - **Processing and result:** the preview disappears and a centred card takes over.
- **Should land on:** the image plate first, then "Run detection" directly beside or under it, then
  the details (region, time, quality checks).
- **Typography:** the page title is 20 px, the same as the result headline "59 regions detected,
  1 hotspot", which is the most important sentence of the flow and should be the largest text on
  the page. The quality checks use 14 px titles with 14 px descriptions, a flat list.
- **Spacing:** the processing and result card is centred while the title is left-aligned, which
  creates a second axis (left edges 168 and 432 px). Below it, 300 px of empty paper.
- **CTA:** "Run detection" and the top bar button are both filled; on the result, "View results"
  and the top bar button.
- **Template-like:**
  - three boxed "sample scene" cards with an icon, a name and a repeated sublabel ("Satellite")
  - a vertical stepper of numbered circles inside a white card
  - a development-only scenario select at the foot of the page, styled like a product control

### Map (`map-hotspot-1440.png`, `map-hotspot-390.png`)

- **First glance today:** the drawer's "79,011" priority score (the largest figure on screen, but
  an abstract index) and the pink banner above it. The map itself is crowded by six floating white
  boxes: filters, result count, "Where to inspect next", legend, layers and zoom.
- **Should land on:** the map, with hotspot 1 the strongest mark on it, then the priority ledger,
  then the toolbar.
- **Typography:** 7 sizes on one screen; the drawer mixes 11 px uppercase labels, 13 px facts,
  28 px score and 12 px mono with no shared baseline grid.
- **Spacing:** 198 off-grid values; panels have different inner paddings (12, 14, 16 px).
- **Alignment:** 5 left edges (0, 12, 872, 920, 1173 px): floating panels align to nothing but
  the viewport corners.
- **Template-like:**
  - **Floating cards:** a card on every side of the map, with shadows.
  - **Rounded badges:** a rounded badge per hotspot.
  - **Markers:** circled numerals for hotspots, the same as generic map pins.
  - **Duplication:** the hotspot list duplicates the drawer when a hotspot is open.
- **Contrast:** muted text on the translucent priority panel fails (4.28:1).

### Observation detail (`observation-detail-1440.png`)

- **First glance today:** the evidence viewer, which is right, but it is a flat mid-grey rectangle
  (the synthetic scene has no source preview), so the eye moves straight to the six boxed figures
  below it.
- **Should land on:** the evidence plate, then a sentence summary with the key figures set large
  inside it, then the ledger of detections.
- **Typography:**
  - **Figures:** six figures at the same 20 px weight; nothing says which matters.
  - **Tables:** the "Detections" table repeats a confidence glyph and badge on every row.
- **Spacing:** the worst in the app (592 off-grid values, 480 of them 6 px).
- **Cards:** 17 (figures, "Density and hotspots", "Detections", "Geographic extent", "Provenance",
  "Model quality", the three trace steps): everything is boxed, so nothing is grouped.
- **Pills:** 80 (status dots, swatches, confidence glyph capsules, the density share bar).
- **CTA:** the top bar's filled button competes with "Open on map" and "Export", which are both
  outline buttons of equal weight.
- **Template-like:**
  - **Figures:** a two-by-three grid of metric cards.
  - **Layout:** a two-column card layout.
  - **Header:** a tab strip above the image.

### Observations (`observations-1440.png`, `observations-390.png`)

- **First glance today:** nothing in particular; the most saturated thing is the amber "Low
  confidence" badge, repeated on 18 of 23 rows.
- **Should land on:** the ledger itself, newest first, with each row's glyph and density tag
  readable at a glance.
- **Typography:** region names (14 px) and the patch line ("Model output on MARIDA patch ...",
  13 px mono mix) make two-line rows of uneven height.
- **Spacing:** 358 off-grid values; row heights vary from 40 to 78 px with badges.
- **Template-like:**
  - three generic icon buttons per row (report, map, download)
  - filter chips with rounded corners
  - "Completed" with a green dot on every row
- **Mobile:** 23 region links are 20 px tall. The row is the real target, but the links still
  register as targets.

### Settings (`settings-1440.png`)

- **First glance today:** the amber "Placeholder values" banner in the middle of the page.
- **Should land on:** the section labels down the left, then the current data source.
- **Typography:** section titles 15 px, descriptions 13 px, values 14 px; segmented controls at 13
  px.
- **Template-like:** segmented controls with rounded containers, a bulleted list of limitations.
  This page is the closest to the new direction already: a label column and a value column with
  hairlines between sections.

### Report (`report-1440.png`)

- **First glance today:** the teal "Print or save as PDF" button and the top bar button (two
  primaries), then the white sheet floating on grey with a shadow.
- **Should land on:** the sheet: title, map plate, the sentence summary.
- **Typography:** section labels are already small caps and uppercase ("MEASUREMENTS", "TOP 5
  HOTSPOTS"), which is the right idea, but the figures under them are 15 px, the same as body
  text.
- **Alignment:** 3 edges; the figure blocks use left borders that do not line up with the
  section labels.

## Top 15 problems, ranked by impact

1. **No single focal point per screen.** Headline, figures and section titles share 20 to 28 px,
   and two filled buttons compete in 10 of 20 views. The eye has nowhere to land first.
2. **The map, the product's hero, is below the fold on the Overview** (starts at y = 857 at
   1440 x 900; after 1.1 screens on mobile).
3. **Everything is a card.** 17 boxed blocks on Observation detail and 5 floating boxes on the
   map; boxes stop meaning "this is a group".
4. **The generated-dashboard sequence** on Overview and detail: hero, pipeline of icon circles,
   row of metric figures, two columns, table.
5. **Pills everywhere**: status dots, swatches, rank circles, rounded badges, confidence capsules
   (up to 80 per screen). They make data look like decoration.
6. **The map chrome is generic**: floating white panels with shadows on all sides, circled-numeral
   markers, a dashed footprint. Nothing marks it as a survey instrument.
7. **The top bar's filled "Analyze new imagery" doubles every page's own primary action.**
8. **Spacing has no grid**: 6, 10, 14 and 2 px steps dominate (up to 592 off-grid values per
   screen), so rhythm is uneven between sections and inside rows.
9. **Figures are not set as figures.** Units are as large as numbers, numbers are 20 to 28 px, and
   the result of an analysis ("59 regions detected") is set at heading size.
10. **Repetition as noise**: "Completed" and "Low confidence" repeated per row, the confidence glyph
    repeated per detection; the exceptions are what should stand out.
11. **The Analyze flow loses its subject**: the image disappears while processing and the result
    appears in a centred card on a second axis.
12. **Abstract numbers lead**: the drawer's largest figure is the priority score (79,011), not the
    area or the level that a person acts on.
13. **Type has no character**: Inter at 13 to 15 px for nearly everything, a system monospace for
    coordinates, no small caps, no tabular ledger style.
14. **Floating panels on the map align to nothing**: 5 to 6 left edges and mixed inner paddings.
15. **Mobile targets and contrast details**: 20 px region links in the Observations ledger, muted
    text at 4.28:1 on the translucent priority panel.
