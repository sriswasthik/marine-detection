# Design system: the survey chart

The visual language of A.W.A.R.E. (AI Waste Analysis & Reconnaissance Engine). It replaces the earlier tokens (Inter, rounded
cards, pill badges). `frontend/CLAUDE.md` carries the short form and the hard rules; this document
is the full specification. The baseline it improves on is in `DESIGN_AUDIT.md`.

**Status:** the visual foundation is in the code (D2): tokens, fonts, every primitive in
`src/components/ui`, the shell and navigation. Page layouts (first-glance order, the ChartFrame,
the docked map panel) follow in D3 and D4. The audit (`npm run design:audit` in `frontend/`)
measures each route; the latest numbers are in `DESIGN_AUDIT.md`. Where D2 settled a detail
differently from the first draft of this document (top bar primary, underlined inputs, square
switch, sheet tooltips, hairline drawer edge, 52px top bar), the text below says what is built.

## 1. Concept

A hydrographic survey chart. A calm, paper-like ground; hairline rules; coordinate ticks;
small-caps labels; tabular data set in ledgers; colour used only where it carries meaning. The
product should feel like an instrument made by people who survey coastlines, not like a dashboard
template.

Boldness lives in one place, the map chrome: the framed chart with its graticule, crop marks,
north indicator and scale bar. Everything else stays quiet and precise.

Principles:

1. **One first glance per screen.** Every page defines what the eye lands on first, second and
   third (section 11), and the layout serves that order.
2. **One primary action per view.** Everything else is an outline button, a text link or a menu
   item.
3. **Structure from rules and space, not boxes.** Content sits on the paper, separated by
   hairlines and whitespace. Boxes are for things that float: the drawer, dialogs, popovers.
4. **Colour means something.** Teal is the action colour; the severity ramp is the data colour.
   Nothing is coloured for decoration.
5. **Figures are set as figures.** Results are written as sentences with the numbers set large,
   tabular, with smaller units.

## 2. Colour

The A.W.A.R.E. palette, taken from the project deck: Concrete ground, Graphite and Slate text,
Tar Black for the mark and the one action, Signal Yellow kept for the logomark. The app is light mode only, so the
deck's dark-slide text colours (Stone `#C4C1B9`, Fog Grey `#9A9A92`) are not used.

### Surfaces and ink

| Token | Hex | Deck name | Use | On paper |
|---|---|---|---|---|
| `paper` | `#E7E4DC` | Concrete (primary light) | Page ground | |
| `sheet` | `#F1EFE9` | | Docked panels, map plates, tooltips, toasts | |
| `white` | `#FFFFFF` | | Inputs' surroundings, the drawer, dialogs, popovers | |
| `hairline` | `#D2CEC4` | | 1px structural rules, ledger rows, input underlines | 1.24:1 (non-text) |
| `rule` | `#ADA89C` | | Emphasis rules: section label rules, chart frame, ledger header rule | 1.87:1 (non-text) |
| `tar` | `#15171A` | Tar Black (primary dark) | The logomark, the wordmark, labels on yellow, focus rings, map marks | 14.13:1 |
| `ink` | `#3A3B3D` | Graphite (body text) | Body text, titles, figures, outline buttons | 8.83:1 |
| `ink-2` | `#5A5A55` | Slate Grey (muted text) | Secondary text. All small text (under 18px) is `ink-2` or darker | 5.46:1 |
| `ink-3` | `#78756C` | | Large or decorative only (ticks over 18px, placeholders never) | 3.62:1, fails small text |

### Accent (the one action)

The one primary action is **Tar Black with white text**. Signal Yellow, the brand colour, is kept
for the logomark only: as an action it sat next to the Low severity fill (#E8CF7A) and was 1.29:1
on Concrete, so it could never be text, a rule or a ring either. Accent text, links and active
states use Olive Ink; selections sit on a neutral wash; focus rings are Tar Black.

| Token | Hex | Deck name | Use | Contrast |
|---|---|---|---|---|
| `accent` | `#15171A` | Tar Black | The one primary button's fill | white on it 17.96:1 |
| `accent-hover` | `#3A3B3D` | Graphite | The primary button's hover and pressed fill | white on it 11.21:1 |
| `accent-ink` | `#3B3420` | Olive Ink | Tertiary links, active segment text, info icons and rules | 9.73:1 on paper |
| `accent-wash` | `#DCD8CD` | | Selected rows, the active segment, menu focus | `ink` on it about 7.5:1 |
| `signal` | `#F4C51D` | Signal Yellow | The logomark only | 1.29:1 on paper: never text, a line, a ring or an action |

### Severity ramp (data)

Sequential, readable by lightness, and **always paired with its text label**: the Low and
Moderate fills do not reach 3:1 against Concrete (1.21 and 1.93), so colour alone never carries
the level. Low sits close to Signal Yellow, which is one reason the yellow is kept out of the
interface and used only in the logomark.

| Level | Fill | Stroke | Soft tint | `ink` on tint |
|---|---|---|---|---|
| Low | `#E8CF7A` | `#B8993A` | `#FAF3D9` | 10.08:1 |
| Moderate | `#E0954F` | `#B86D2C` | `#FAE9D6` | 9.45:1 |
| High | `#C4503A` | `#983728` | `#F7DDD7` | 8.69:1 |
| Critical | `#7F2432` | `#5C1824` | `#EBD3D7` | 7.92:1 |

### Status

Darker than the first set, so status text keeps 4.5:1 on the darker Concrete ground.

| Token | Hex | Soft | On paper |
|---|---|---|---|
| `success` | `#2E6343` | `#EBF3EE` | 5.54:1 |
| `warning` | `#7F510C` | `#FBF3E3` | 5.36:1 |
| `danger` | `#963826` | `#FBEAE6` | 5.72:1 |
| `info` | = `accent-ink` | = `accent-wash` | |

### Map

The map's own colours mirror the tokens in `MAP_COLORS` (`src/lib/map/basemaps.ts`): selections
and hotspot selection rings are Tar Black over a white halo; the image footprint is a 1px dashed
Slate Grey line (white over imagery). Detections are their level's fill at 0.55 with a 1px stroke
in the level's darker colour; over satellite imagery, 0.8 with a 1.5px white casing.

### Never

No gradients, glow, glass or blur effects, no dark surfaces (panels, tooltips, toasts, map tiles),
no purple, blue or neon. The satellite basemap is imagery, not a theme.

## 3. Typography

**Faces** (self-hosted, no font CDN):

- UI: **Instrument Sans** (`@fontsource-variable/instrument-sans`, 5.3.0).
- Data: **Geist Mono** (`@fontsource-variable/geist-mono`, 5.3.0), for coordinates, IDs, ticks,
  ledger figures and scale labels.
- Fallbacks if a package disappears: Hanken Grotesk (`@fontsource-variable/hanken-grotesk`) and
  IBM Plex Mono (`@fontsource/ibm-plex-mono`); both exist at 5.3.0.

**Weights:** 400, 500, 600 only. No 700.

**Scale:** eight sizes, no others.

| Token | Size / line | Weight | Family | Treatment | Use |
|---|---|---|---|---|---|
| `label` | 11 / 16 | 500 | UI | Uppercase, small caps feel, tracking +0.06em, `ink-2` | Section labels, ledger headers, field labels on the map |
| `mono` | 12 / 16 | 400 | Mono | Tabular | Coordinates, IDs, graticule ticks, captions with figures |
| `small` | 13 / 20 | 400 | UI | | Secondary text, help text, table text |
| `body` | 14 / 20 | 400 | UI | Max 68 characters per line | Body copy, controls |
| `lead` | 16 / 24 | 400 or 500 | UI | Max 68 characters | Sentence summaries in running text, intro lines |
| `title` | 22 / 28 | 500 | UI | Tracking -0.01em | Section titles, the drawer title |
| `page` | 32 / 40 | 500 | UI | Tracking -0.015em | One page title per page |
| `figure` | 56 / 56 | 500 | UI | Tabular numerals, tracking -0.02em | Headline figures inside sentence summaries |

**Figures:**

- Headline figures use tabular numerals.
- Their unit is set at about 40% of the figure size (22px with a 56px figure, 13px with a 32px
  one), baseline-aligned, in `ink-2`, with a thin space before it.
- Ledger figures are mono, right-aligned and tabular, and their units sit in the column header,
  not in every cell.
- No size between the steps: anything that seems to need 15px or 20px is `body`/`lead` or `title`.

## 4. Space and grid

**Base 4px.** Steps (the only spacing values):

| Step | 4 | 8 | 12 | 16 | 24 | 32 | 48 | 64 | 96 |
|---|---|---|---|---|---|---|---|---|---|
| Token | `1` | `2` | `3` | `4` | `6` | `8` | `12` | `16` | `24` |

No 2, 6, 10 or 14px values. A 1px value exists only as a border.

**Grid:**

| Width | Columns | Gutter | Margin | Content max width |
|---|---|---|---|---|
| 1280 and up | 12 | 24px | 32px | 1280px (document pages) |
| 768 to 1279 | 8 | 24px | 24px | fluid |
| under 768 | 4 | 16px | 16px | fluid |

- The map is full-bleed under the top bar; its side panel docks to a column, it does not float.
- Everything aligns to the column edges, left-aligned. A page uses at most three left edges: the
  margin, the main column and the side column.

**Rhythm:**

- 48 to 64px between sections.
- 16 to 24px inside a section.
- 8 to 12px between a label and its content.

## 5. Shape and elevation

| Element | Radius |
|---|---|
| Panels (docked) | 2px |
| Controls (buttons, inputs, segments) | 4px |
| Tags | 2px |
| Drawer | 0 |
| Dialogs, popovers | 2px |
| Switch | 2px track, square thumb |

- **No pills, none at all.** Status dots become 6px squares; rank circles become target marks;
  rounded badges become tags; the spinner is a turning square. The rule covers UI elements: map symbols drawn on the chart (hotspot targets, the
  north indicator) are round by design, and the audit does not count Leaflet's layers.
- **Lines:** 1px `hairline` for structure (rows, panel edges, input borders); 1px `rule` for
  emphasis (section label rules, the chart frame, ledger header underline).
- **Elevation:** two levels only.
  - **None** is the default.
  - **Popover** is `0 6px 20px rgba(19,31,38,.10)`, for dialogs, popovers, menus, tooltips and the
    drawer.
  - Nothing else casts a shadow.
- **Cards** are allowed only for the drawer, dialogs and popovers. Everything else sits on the
  paper.

## 6. Signature elements

These make it look designed rather than generated; use them consistently.

1. **Section label.**
   - **Form:** an 11px `label` (uppercase, +0.06em, `ink-2`), a 12px gap, then a 1px `rule` line
     running to the right edge of its column.
   - **Use:** every section on document pages starts with one; it replaces boxed section titles.
     An optional count sits after the text in `mono` ("HOTSPOTS · 3").
2. **Ledger.**
   - **Rows:** data tables with 1px `hairline` rows, 40px tall (48px on touch), no zebra, no
     boxes and no row backgrounds except `accent-wash` for the selected row.
   - **Columns:** figures are mono, right-aligned and tabular. Headers are `label` style,
     sticky, with a `rule` underline. Units are in the header ("AREA, HA").
   - **Interaction:** hover nudges the row 2px right (section 12).
3. **ChartFrame.**
   - **Frame:** the map is framed with a 1px `rule` border and a 24px margin band on all four
     sides (16px on mobile).
   - **Graticule:** coordinate ticks every graticule step (chosen per zoom, for example 0.01°)
     with `mono` labels ("13.22° N", "80.36° E"); ticks 6px long, labels in `ink-2`.
   - **Corners:** crop marks, two 8px rules per corner, offset 4px outside the frame.
   - **North indicator:** a small arrow with an "N", top right inside the band.
   - **Scale bar:** an alternating black-and-white chart-style bar (four segments) with `mono`
     labels, bottom left.
   - **Scope:** this is the one bold element of the product.
4. **ObservationGlyph.**
   - **Form:** a square SVG thumbnail (16, 24 or 48px) drawing the observation's density grid:
     one cell per grid cell, filled with its level's colour, empty cells `paper`, a 1px
     `hairline` frame. A no-debris observation shows an empty grid with a single centred tick.
   - **Use:** in lists, the observation switcher, breadcrumbs, the drawer and report headers, as
     a recognisable thumbnail.
5. **Sentence summary.**
   - **Form:** a headline result written as a sentence, with the numbers set large inside it:
     "**42** possible debris regions covering **3.4** ha, in **3** hotspots." Numbers are `figure`
     (or `page` in tight spaces), words are `lead`, units at 40%.
   - **Replaces:** rows of metric cards. Supporting figures go in a ledger below it.
6. **Tags, not pills.**
   - **Form:** a squared label (2px radius, 20px tall, 6px horizontal padding) with an 8px square
     colour swatch and the text: Low, Moderate, High, Critical. The background is the level's
     soft tint and the text is `ink`.
   - **Rule:** never colour alone. Status tags use the same shape.
7. **Rings, not discs.**
   - **Form:** a hotspot marker is a 22px ring: a 1.5px stroke in the level's stroke colour over a
     thin white casing, with a transparent centre so the detections it marks stay visible. The rank
     sits in a small mono label at the top right; rank 1's label is inverted (Tar Black, white).
   - **Selected:** the ring turns Tar Black and thicker (3px), settling in 150ms.
   - **Small detections:** at low zoom, 6px squares in the level colour with a 1px white outline
     (dashed for low confidence). Above 40 in view, three or more in a 48px cell merge into a solid
     square of their most severe colour with the count on it, drawn under the rings.

## 7. Component vocabulary

| Component | Specification |
|---|---|
| Primary button | Tar Black fill, white text, 4px radius, 36px tall (40 on touch), `body` 500. **One per view.** |
| Secondary button | 1px `ink` outline, `ink` text, transparent fill; hover fills `paper` darker by `hairline`. |
| Tertiary action | Text link in Olive Ink (`accent-ink`) with a trailing arrow (→), no underline until hover. |
| Icon button | 32px (40 on touch), 1px `hairline` outline when standalone, none in a toolbar. Always labelled. |
| Toolbar | At most two visible buttons; everything else in a "More" menu. |
| Input, select | No box and no fill: a 1px `rule` underline that turns `ink` on hover and `danger` when invalid; 36px (40 on touch); label above in `small` 500; focus: 2px Tar Black outline, 2px offset. |
| Segmented control | Squared segments sharing 1px `hairline` dividers in a 1px frame, 4px outer radius; active segment `accent-wash` with `accent-ink` text. |
| Slider | A 1px `rule` track, the chosen part a 2px `ink` line, a square thumb; an optional histogram above the track. |
| Checkbox | 16px square, 2px radius, `ink` when checked. Label row is the 40px target. |
| Switch | Squared: a 2px-radius track with a square thumb, `ink` when on (the accent fill is kept for the one primary). |
| Tag | See signature element 6. |
| Section label | See signature element 1. |
| Ledger | See signature element 2. |
| Banner | No fill; a 2px left rule in the status colour, `body` text, an icon in the status colour. Full width of its column. |
| Drawer | `white`, 0 radius, 1px `hairline` left edge, popover shadow, 400px wide; a square bottom sheet on phones. |
| Dialog, popover, menu | `white`, 2px radius, 1px `hairline` border, popover shadow. |
| Tooltip | A label plate: `sheet`, 2px radius, 1px `hairline`, popover shadow, figures in mono. Never dark. |
| Toast | `sheet`, 1px `hairline`, a 2px left rule in the status colour, square corners, bottom right. |
| Empty and error states | Typographic: a title, a `lead` sentence and one action (an error may add one alternative link). Errors carry a 2px `danger` left rule. No illustrations. |
| Map plates | Until D3 docks them, controls floating on the map are square plates: `sheet`, 1px `rule`, no radius, no shadow. |
| Skeleton | `hairline`-coloured bars, no shimmer gradient; a slow opacity pulse that stops under reduced motion. |
| Top bar | 52px, Concrete, 1px `hairline` bottom. Left: the logomark (a Tar Black square with a Signal Yellow waterline and one square riding its crest: a detection on the sea surface) and the wordmark "A.W.A.R.E." in Tar Black, with "AI Waste Analysis & Reconnaissance Engine" in `ink-2` only on the Overview from 1440px (elsewhere the wordmark alone, so the navigation has room). Then the sections as plain text. Right: the primary "Analyze new imagery", unless the view shows a primary of its own (Run detection on Analyze, View evidence in the map drawer: `useClaimPrimaryAction`), and the Ctrl/Cmd+K hint. No data source tag and no observation switcher: provenance is labelled in each page's content, and observations are switched from the More sheet or the palette. |
| Context line | Under the top bar on deep pages: breadcrumbs left, the page's single secondary action right. |
| Tab bar | Under 900px: Overview, Analyze, Map, Observations and More (a sheet with Settings, the observation switcher, search and shortcuts). |
| Empty state | A sentence in `lead`, one tertiary or primary action, no illustration. |

## 8. CTA and hierarchy rules

- **Exactly one primary (filled accent) button per view.** The top bar carries it, "Analyze new
  imagery", on every page except Analyze, so no page shows another filled button while it is in
  view. On Analyze the page owns the primary: "Run detection", then "View results". The processing
  state has none on purpose: there is nothing to do but wait or cancel.
- **Secondary** is a 1px `ink` outline. **Tertiary** is a text link with an arrow.
- **A toolbar shows at most two buttons**; everything else goes in a menu.
- **The largest text on a page is its first-glance element** (section 11), never a label, a
  score or decoration.

## 9. Navigation rules

- **Where am I:** the top bar marks the current section (2px `ink` underline, `ink` text);
  deep pages (observation detail, report) show breadcrumbs ("Observations / Ennore coast / Report").
- **What am I looking at:** observation pages name the observation in their title and breadcrumbs,
  with its ObservationGlyph. The switcher lives in the phone's More sheet; the command palette
  reaches every observation on any screen.
- **What next:** every page ends with a "Next" tertiary link along the main path:
  Overview → Analyze → Map → Observation detail → Report.
- **Command palette:** Ctrl+K (Cmd+K on macOS) opens a palette.
  - **Reach:** every page, every observation (by region, date or id, with its glyph) and the main
    actions (Analyze new imagery, Fit to detections, Toggle density, Export GeoJSON, Open settings,
    Show shortcuts). Map actions open the map first when it is not in view.
  - **Behaviour:** fuzzy matching; recent picks first; arrow keys move, Enter opens, Esc closes;
    focus stays in the search field and returns when it closes. It is a dialog (white, popover
    shadow).

## 10. Accessibility

- **Contrast:** text contrast 4.5:1 or more for small text, 3:1 for large text; the token
  contrasts are in section 2. `ink-3` is never used for small text.
- **Targets:** 40px or more on touch screens. Ledger rows are 48px on touch.
- **Focus:** a 2px Tar Black (`tar`) outline with a 2px offset on everything focusable; Signal Yellow would not show on Concrete.
- **Colour:** never the only signal. Severity has a tag; low confidence has a dashed outline and
  a label.
- **Motion:** honours `prefers-reduced-motion` (section 12).

## 11. First-glance order per page

| Page | 1st | 2nd | 3rd | 4th |
|---|---|---|---|---|
| Overview | The map plate (ChartFrame) of the current observation and its sentence summary | The primary action "Analyze new imagery" | "Inspect next" (priority ledger) | Recent observations ledger |
| Analyze | The drop zone, then the image plate once a file is chosen | "Run detection" (the primary), directly under the plate | Details: region, time, quality checks |  |
| Map | The map (ChartFrame), hotspot 1 the strongest mark | Hotspot 1 and the priority ledger in the docked side panel | The toolbar (at most two buttons) |  |
| Observation detail | The evidence plate | The sentence summary and the ledger of figures | The detections ledger | Provenance, model quality |
| Observations | The ledger, newest first, with glyphs and tags | Search and filters (one row) | | |
| Report | The sheet: title, map plate, sentence summary | Hotspot ledger | Method and caveats | |
| Settings | Section labels down the left | The current data source | | |

Layout notes:

- **Overview:** the map plate takes eight columns and the sentence summary sits beside it in four,
  both above the fold at 1440 x 900; on phones the plate comes first, full width. No hero headline
  and no pipeline strip: the product statement becomes one `lead` line under the page title.
- **Analyze:** the processing state keeps the image plate in place and shows the stepper beside
  it; the result replaces the stepper with the sentence summary and the one primary "View on map".
- **Map:** a strict grid with no floating page-level panels (see `docs/MAP_CLEANUP.md`):
  - **Toolbar:** one 48px row docked above the map, every control 32px with the same frame:
    observation, minimum confidence, density (four swatch toggles, the only density filter), More
    filters (date, source, region, keyboard shortcuts), then the status text, the provenance tag
    and Export. At most two buttons.
  - **Side panel:** 288px on the left (a 40px rail when collapsed; a slide-over under 1100px) with
    two tabs: Inspect next (a 40px-row ledger) and Layers (toggles with counts, basemap, cell size),
    and "Next: view evidence" at the bottom.
  - **Caveats:** a docked row above the map whenever the result has any, at every size.
  - **Inside the map:** at most two overlays, inset 16px: the control group (zoom, fit, reset) at
    the top right and the legend line at the bottom left (details in a popover).
  - **Status strip:** 28px under the map: scale, coordinates, basemap, attribution in full.
  - **Drawer:** 360px on the right while something is selected (a sheet under 768px), with the one
    primary "View evidence".

## 12. Motion

One easing curve: `cubic-bezier(.2,.7,.2,1)`. Durations 120 to 400ms. Opacity and transform only.
Nothing loops. Under `prefers-reduced-motion: reduce`, everything below becomes instant except
opacity changes under 120ms.

| Moment | Motion | Duration |
|---|---|---|
| Result arrives on the map | Detections fade in, staggered by size (largest first) | 400ms total |
| Result arrives on the map | Each hotspot target draws one ring ripple (scale 1 to 1.6, opacity to 0), once | 400ms |
| Headline figures, first view | Count up from 0 to the value, once per observation per session | 400ms |
| Panels and the drawer | Slide 16px with opacity; content blocks follow with a 30ms stagger | 200ms |
| Ledger row hover | Nudge 2px right | 120ms |
| Processing | A 1px `tar` scan line sweeps the image plate top to bottom, then fades out at the end of the stage (one sweep per stage, no loop) | 400ms per sweep |
| Layer toggles | Crossfade the layer's opacity | 160ms |
| Route change | Fade the page in with a 4px rise | 160ms |

## 13. Audit thresholds (pass / fail)

Measured by `npm run design:audit` (in `frontend/`) on every route and state in
`scripts/design-audit.routes.json`, at 1440 x 900 and 390 x 844. A redesign task is done when
every route it touched passes. The same numbers are the `TARGETS` in
`frontend/scripts/design-audit.mjs`.

| Measure | Target | Baseline (`DESIGN_AUDIT.md`) |
|---|---|---|
| Distinct font sizes (app-wide) | at most 8 | 8 |
| Distinct font weights | at most 3 | 3 |
| Font families | at most 2 | 2 |
| Spacing values off the 4px grid (worst view) | 0 | 592 |
| Pills, outside switches (worst view) | 0 | 80 |
| Cards outside the drawer, dialogs, popovers (worst view) | 0 | 17 |
| Gradients | 0 | 0 |
| Elevation shadows (app-wide) | at most 2 | 2 |
| Filled accent buttons in the first viewport | exactly 1 per view | 10 of 20 views have 2 |
| Text contrast failures (worst view) | 0 | 3 |
| Interactive targets under 40px on mobile (worst view) | 0 | 23 |
| Distinct left edges of top-level blocks (worst view) | at most 3 | 6 |

## 14. Implementation notes

- Tokens live in `frontend/src/styles/tokens.css` (Tailwind `@theme`) as today; the redesign
  replaces their values and names with the ones above and keeps `src/lib/contrast.test.ts` in step
  with every new text pair.
- Tailwind half steps (`*-0.5`, `*-1.5`, `*-2.5`, `*-3.5`) are not allowed in new code; the audit
  reports them as off-grid spacing.
- The ObservationGlyph is computed from `computeDensityGrid` (`src/lib/density.ts`) so its cells
  match the map.
- The ChartFrame's graticule step comes from a pure function of the map bounds and zoom, with
  unit tests, like everything else in `src/lib`.
