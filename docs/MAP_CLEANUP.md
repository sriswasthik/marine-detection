# Map page cleanup

Goal: a minimal, uncluttered map screen where nothing overlaps and the eye lands on the map and
hotspot 1. Scope: `src/pages/MapPage.tsx`, `src/features/map` and the map helpers in
`src/lib/map`, plus the top bar's primary button and tagline.

## 1. Diagnosis (before)

Measured with `node scripts/map-shots.mjs --out ../docs/design/map-before` on
`/map/obs-ennore-20261003` in sample-data mode, the Light basemap, at 1440x900, 1280x720, 1024x768
and 390x844. Each size was captured with hotspot 1 selected (`<size>.png`) and with nothing selected
(`<size>-idle.png`); `satellite-1440.png` shows the Satellite basemap. `boxes.json` holds every box
drawn over or around the map, its bounding box and every pair that intersects. A "box" is the
outermost framed element (a border or a fill) in the map region, plus Leaflet's attribution and the
drawer.

### Summary

| Size | Boxes (hotspot selected) | Boxes (idle) | Overlapping pairs (selected / idle) | Attribution clipped | Text sizes in the map region |
|---|---|---|---|---|---|
| 1440x900 | 14 | 13 | 2 / 0 | yes | 11, 12, 13, 14 px |
| 1280x720 | 14 | 13 | 3 / 1 | yes | 11, 12, 13, 14 px |
| 1024x768 | 14 | 13 | 2 / 0 | yes | 11, 12, 13, 14 px |
| 390x844 | 13 | 12 | 5 / 1 | no | 11, 12, 13 px |

### The problems, with evidence

1. **About ten independent floating boxes. Confirmed: 12 to 13 on the map, 14 with the drawer.**
   At 1440x900 (idle), each at its own offset:
   - toolbar at (12, 65), 1101x50;
   - count strip "61 detections · 3 hotspots" at (12, 165), 183x30;
   - Export at (203, 164);
   - "Sample data" tag at (326, 170);
   - "Next step" plate at (444, 163);
   - "Where to inspect next" at (12, 205), 320x239;
   - Basemap switch at (1297, 65);
   - Layers panel at (1252, 105), 176x163;
   - zoom/fit/reset column at (1394, 276);
   - keyboard button at (1394, 417);
   - legend at (12, 594), 288x283;
   - scale and coordinates box at (1154, 849);
   - the attribution.

   They start at six different left edges and five different top edges.
2. **Overlaps and collisions. Partly confirmed.**
   - **Priority panel and legend: confirmed.** At 1280x720 they overlap by 288x30 px: the legend
     starts at y = 414 and the panel ends at y = 444, so the last priority row is hidden under the
     legend title.
   - **Attribution: confirmed.** It is clipped: at every desktop size its box ends 1 px below the
     viewport. With a selection, the drawer covers it entirely (64x15 px), and the scale and
     coordinates box as well (278x28 px).
   - **On phones: confirmed, and worse.** The scale box overlaps the legend (25x28 px), and the
     bottom sheet covers the priority panel (320x42 px), the legend (288x42 px), the scale box and
     the attribution.
   - **Toolbar over the count strip: not reproduced** at these sizes. The toolbar wraps to two
     rows (90 px tall at 1280x720) and the strip starts 10 px below it. The row wrapping is real,
     though: the second row of chips sits under the first row's slider.
   - **"Sample data" and "Next: view evidence": not reproduced as an overlap.** They sit 9 px
     apart, with Export on the same line, which reads as one crowded row of mismatched boxes (20,
     30, 32 and 34 px tall).
3. **Duplicated controls. Confirmed.**
   - Low, Moderate, High and Critical appear as toolbar chips and again as legend rows.
   - The Basemap switch (131x32) and the Layers panel (176x163) are separate boxes stacked at the
     top right.
   - "All regions" and the "Any date" button sit in the main toolbar row beside the already chosen
     observation, where they filter the observation list, not the map.
4. **Inconsistent toolbar controls. Confirmed.**
   - **Heights:** the observation select is 32 px tall with an underline, the date button 32 px with
     an ink outline, the density chips 28 px with dashed or solid borders, the region select 32 px
     with an underline, and the slider is a borderless 20 px track.
   - **Slider thumb:** a 12 px hollow square that reads as an unticked checkbox (see `1280x720.png`).
5. **Symbology hides the data. Confirmed.**
   - **Hotspot markers:** a 24 to 32 px white-filled disc at 92% opacity, sitting exactly on the
     densest detections it marks (the cluster at hotspot 1 is mostly hidden).
   - **Low-zoom centroid markers:** all 8 px round dots, indistinguishable by level at a glance.
   - **Satellite:** the open sea is near-black navy, and severity fills under white outlines lose
     their hue (`satellite-1440.png`).
   - **Default basemap:** Light is the code default (`DEFAULT_BASEMAP = 'light'`). The Satellite view
     in the reported screenshot comes from a saved Settings default or a `?bm=satellite` link. The
     Map page now makes Light the visible default again and keeps Satellite as an option.
6. **Legend and priority list. Confirmed.**
   - **Legend:** 288x283 px and open by default from 640 px wide.
   - **Priority rows:** coordinates are truncated with an ellipsis ("80.3525°…") at every desktop
     size.
   - **Text sizes:** four in the map region (11, 12, 13, 14 px).
7. **CTA colour and top bar. Confirmed.**
   - **CTA:** "Analyze new imagery" is Signal Yellow, which is next to the Low severity fill (#E8CF7A).
     The design docs listed it as the accent, but the colour clashes with the data ramp.
   - **Tagline:** "AI Waste Analysis & Reconnaissance Engine" (263 px at 1440x900) sits between the
     wordmark and the navigation on every page.

## 2. The new structure

The Map page is a CSS grid with named areas (`.mwi-map-page` in `src/features/map/map.css`). There
are no absolutely positioned page-level panels.

| Area | Size | Holds |
|---|---|---|
| `toolbar` | 48px row, full width | Observation, Min confidence, Density, More filters, status, provenance, Export |
| `notices` | only when the result has caveats | Low confidence, approximate positions, partial data, stripe artefacts |
| `side` | 288px, a 40px rail when collapsed; from 1100px | Inspect next and Layers tabs, "Next: view evidence" |
| `map` | the rest | The canvas, with at most two overlays inset 16px |
| `status` | 28px under the map only | Scale bar, coordinates, basemap name, attribution |
| `drawer` | 360px while something is selected, else nothing | The selected hotspot or detection, with the one primary "View evidence" |

Responsive behaviour:

- **1100 to 1279px:** the side panel is docked; confidence and density move into the Filters menu.
- **768 to 1099px:** the side panel becomes a slide-over, opened from a button at the start of the
  toolbar.
- **Under 768px:**
  - **Drawer:** a sheet docked under the status strip (it takes its own rows, so it never covers
    the map).
  - **Toolbar:** collapses to the panel button, the observation, the provenance tag and one Filters
    button, with Export inside it.
  - **Status:** the status text moves to the status strip.
  - **Legend:** hidden while the drawer is open.

## 3. What changed

1. **Toolbar.**
   - **Controls:** one row, every control 32px with the same rule border, radius and 13px type
     (`toolbarStyles.ts`): Observation (glyph, region, date); Min confidence (a 120px hairline slider,
     a solid 10px square thumb, the value in mono); Density (four swatch toggles with tooltips, the
     only density filter); More filters (capture date, source, region, Reset, Keyboard shortcuts).
     Then the status "61 detections · 3 hotspots" in 12px mono, a quiet "Sample data" tag, and
     Export.
   - **Moved:** "Any date" and "All regions" are in More filters. Two buttons are visible: More
     filters and Export.
2. **Next step.** "Next: view evidence" is a text link at the bottom of the side panel. "View
   evidence" is the drawer's primary.
   - **One primary:** while the drawer is open it claims the view's primary, so the top bar's
     "Analyze new imagery" steps back (`app/shell/primaryAction.ts`) and exactly one primary
     remains.
   - **Removed duplicate:** the "View evidence" button inside the drawer's trace section.
3. **Side panel.**
   - **Inspect next:** a ledger with 40px rows (rank in mono, swatch and level, area, confidence),
     each column with a minimum width. Coordinates are in each row's tooltip and in the drawer.
     Row 1 has a tinted background and an inverted rank.
   - **Layers:** the four toggles with counts, the Light and Satellite control, and the grid cell
     size. The separate Layers and Basemap boxes are gone.
4. **Legend.** One line at the bottom left: four swatches with their names and an info button. Its
   popover (closed by default, and opened by "l") holds the meanings, the low-confidence outline,
   the footprint line, the hotspot ring and the grid cell size.
5. **Status strip.**
   - **Contents:** Leaflet's scale control is moved into the strip, beside the coordinates, the
     basemap name and the attribution, all in one line.
   - **Clipping:** the page height accounts for the top bar's 1px hairline, so nothing falls 1px
     below the viewport (the cause of the clipped attribution before).
6. **Map controls.** One group at the top right: zoom in, zoom out, fit to detections, reset. The
   keyboard shortcuts are in More filters.
7. **Symbology.**
   - **Basemap:** Light is the default.
   - **Hotspots:** a 22px ring with a 1.5px level-colour stroke over a white casing, a transparent
     centre and the rank in a small mono label at the top right (rank 1 inverted). Selected, the
     ring turns Tar Black and 3px wide, over 150ms.
   - **Detections:** fill 0.55 with a 1px darker stroke. On Satellite: 0.8 with a 1.5px white
     casing.
   - **Low-zoom markers:** 6px squares with a 1px white outline (dashed for low confidence). Above
     40 in view, three or more in a 48px cell merge into a solid counted square of their most
     severe colour, under the rings.
   - **Footprint:** a 1px dashed Slate Grey line.
   - **Fitting:** zoom snaps in quarter steps, so a fit fills the frame. A map that mounted before
     its cell reached full size is refitted until the person moves it.
8. **Type.** The toolbar and side panel use the 11px label, 13px text and 12px mono styles only.
9. **Top bar.**
   - **Wordmark:** "A.W.A.R.E." alone; the full name only on the Overview from 1440px.
   - **Primary colour:** the primary button is the documented accent, now Tar Black with white text.
     Signal Yellow stays in the logomark only (its own `signal` token), because it clashed with the
     Low severity fill.
10. **Responsive.** See section 2.
11. **Motion.** The drawer slides in over 200ms, the panel collapses over 160ms and the selected ring
    settles over 150ms. Nothing loops, and reduced motion is honoured.

Removed: `FilterBar`, `ResultStrip`, `InspectionPriority` (its `RankDot` moved to
`InspectNextLedger`), `MapControls`, `MapLegend`, and the confidence slider and density chips in
`FilterControls`.

## 4. Proof

### Layout test

`e2e/map-layout.spec.ts`, run with `npm run e2e`, covers 1440x900, 1280x720, 1024x768 and 390x844,
each with hotspot 1 selected and with nothing selected. It checks:

- no two `[data-chrome]` elements intersect;
- every one of them is inside the viewport;
- the attribution is fully visible and inside its strip;
- there are at most two overlays, both inside the map frame;
- every toolbar control is the same height;
- exactly one primary button is in view.

All 8 pass.

### Measurements

Before and after, from `node scripts/map-shots.mjs`:

| Size | Boxes (selected), before → after | Overlapping pairs (selected), before → after | Attribution |
|---|---|---|---|
| 1440x900 | 14 → 6 | 2 → 0 | clipped → full |
| 1280x720 | 14 → 6 | 3 → 0 | clipped → full |
| 1024x768 | 14 → 5 | 2 → 0 | clipped → full |
| 390x844 | 13 → 4 | 5 → 0 | under the sheet → full |

After, the boxes are the toolbar, the side panel, the control group, the legend line, the status
strip and the drawer.

### Design audit

The Map page row (`map-hotspot`, hotspot 1 selected), before (`docs/design/audit-aware.json`) and
after (`docs/design/audit-map-after.json`):

| Measure | 1440 before | 1440 after | 390 before | 390 after |
|---|---|---|---|---|
| Cards | 0 | 0 | 0 | 0 |
| Pills | 0 | 0 | 0 | 0 |
| Text sizes on the page | 6 | 6 | 5 | 5 |
| Left edges of top-level blocks | 5 | 3 | 6 | 1 |
| Off-grid spacing, contrast failures, small targets | 0 | 0 | 0 | 0 |
| Primary buttons in view | 1 | 1 | 1 | 1 |

- **Text sizes:** the page count includes the top bar's 14px navigation and the drawer's 22px title
  and 32px priority score. The toolbar and side panel themselves use 11, 12 and 13px only.
- **Cards and pills:** both were already 0 before; D2 had squared the floating plates.

Screenshots: `docs/design/map-before/` and `docs/design/map-after/`, with `<size>.png` selected,
`<size>-idle.png` idle and `satellite-1440.png`.

## 5. Art direction review

Looked at as a strict art director, after the first pass.

### Fixed

- **Clusters looked like rank labels.** Counted squares on a sheet plate read like the hotspot
  ranks, so two number systems competed. Clusters are now solid squares in their level colour, sit
  under the rings, and need three members ("2" badges were noise).
- **The scene was half the frame on phones.** Integer zoom and an early mount made the scene a
  third of the map at 390px. Fixed with quarter-step zoom and refitting on resize.
- **Caveats disappeared under 1100px.** They lived in the side panel, which is closed there. They
  are now a docked row above the map at every size.
- **Ledger overflow.** The confidence column ran 8px past the panel edge. The gaps were tightened,
  and every column has a minimum width.
- **Low-confidence points.** They faded to a muddy grey-green on satellite water; they now use a
  dashed outline, the same signal as the polygons.
- **Boxed callouts in the drawer.** The pink "Priority for inspection" box and the grey formula box
  were filled boxes; they are now left rules.
- **Phone map with the drawer open.** The legend line covered the bottom of a short map; it is
  hidden in that state.

### Still imperfect

- **Empty panel.** At 1440 and 1280 the side panel has about 450px of empty sheet below the
  three-row ledger. That is honest for three hotspots, but the panel could hold a Layers summary
  instead of nothing.
- **Weak hotspot 1 at low zoom.** Its ring is 22px like the others; only the inverted rank label
  and, when selected, the black ring single it out. A slightly heavier rank-1 ring would help the
  first glance.
- **Overlap inside the canvas at low zoom.** Clusters and small squares can still sit under a ring
  or touch the footprint label. Their markers do not avoid each other.
- **Drawer type.** The drawer still uses the 22px title and the 32px priority score for hierarchy,
  outside the 11/12/13px set the toolbar and side panel follow.
- **Short map on phones.** With the drawer open the map is about 280px tall: usable, but tight.
- **Density toggles.** They carry no visible text; the legend line beside the map and the tooltips
  name them.
