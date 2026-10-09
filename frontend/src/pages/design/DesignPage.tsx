/**
 * Dev-only visual QA page: every primitive of the survey-chart system in its states, the type
 * specimen and the spacing scale. Not in production builds or nav. Figures come from the hero
 * sample observation and src/lib, never typed in by hand.
 */
import { Download, FileText, Layers, Map as MapIcon, Plus, Settings, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Logomark } from '@/components/brand/Logomark'
import {
  ArrowLink,
  Banner,
  Button,
  Checkbox,
  ConfidenceTag,
  Dialog,
  Drawer,
  DropdownMenu,
  EmptyState,
  ErrorState,
  Figure,
  IconButton,
  Kbd,
  Ledger,
  Measure,
  ObservationGlyph,
  RangeSlider,
  SectionLabel,
  SegmentedControl,
  Select,
  Sentence,
  SentenceFigure,
  SeverityTag,
  Skeleton,
  SkeletonTable,
  SkeletonText,
  Slider,
  SliderHistogram,
  Spinner,
  Switch,
  Tabs,
  Tag,
  TextInput,
  Tooltip,
  useToast,
  type ButtonVariant,
  type LedgerColumn,
  type TagTone,
} from '@/components/ui'
import { getSampleObservations, HERO_SAMPLE_ID } from '@/features/observations/mock/samples'
import { DENSITY_LEVEL_IDS, type Detection } from '@/features/observations/types'
import { analyzeObservation } from '@/lib/analysis'
import { CONFIDENCE_THRESHOLDS } from '@/lib/config'
import {
  formatArea,
  formatConfidence,
  formatCoordinates,
  formatInteger,
  shortId,
} from '@/lib/format'
import { PageHeader } from '../PageHeader'

const samples = getSampleObservations()
const hero = samples.find((o) => o.id === HERO_SAMPLE_ID) ?? samples[0]
const heroAnalysis = hero ? analyzeObservation(hero) : null

const COLOR_TOKENS = [
  ['Surfaces and ink', ['paper', 'sheet', 'white', 'hairline', 'rule', 'ink', 'ink-2', 'ink-3']],
  ['Accent', ['accent', 'accent-ink', 'accent-wash']],
  ['Severity', DENSITY_LEVEL_IDS.flatMap((level) => [level, `${level}-stroke`, `${level}-soft`])],
  ['Status', ['success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft']],
] as const

/** The eight sizes, largest first: token, size and line, use. */
const TYPE_SCALE = [
  ['text-figure', 'figure', '56 / 56', 'Headline figures inside sentence summaries'],
  ['text-page', 'page', '32 / 40', 'One page title per page'],
  ['text-title', 'title', '22 / 28', 'Section titles, the drawer title'],
  ['text-lead', 'lead', '16 / 24', 'Sentence summaries in running text, intro lines'],
  ['text-body', 'body', '14 / 20', 'Body copy and controls'],
  ['text-small', 'small', '13 / 20', 'Secondary text, help text, table text'],
  ['data', 'mono', '12 / 16', 'Coordinates, IDs, ticks, ledger figures'],
  ['label text-ink-2', 'label', '11 / 16', 'Section labels, ledger headers'],
] as const

/** The only spacing steps, in px, with their Tailwind number. */
const SPACING = [
  [4, '1'],
  [8, '2'],
  [12, '3'],
  [16, '4'],
  [24, '6'],
  [32, '8'],
  [48, '12'],
  [64, '16'],
  [96, '24'],
] as const

const BUTTON_VARIANTS: readonly ButtonVariant[] = [
  'primary',
  'secondary',
  'tertiary',
  'ghost',
  'danger-quiet',
]
const TAG_TONES: readonly TagTone[] = ['neutral', 'accent', 'success', 'warning', 'danger']

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const id = `design-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 py-12">
      <SectionLabel id={id}>{title}</SectionLabel>
      {description ? (
        <p className="-mt-2 max-w-[68ch] text-body text-ink-2">{description}</p>
      ) : null}
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-small font-medium text-ink-2">{label}</p>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  )
}

function Swatch({ name }: { name: string }) {
  return (
    <div className="flex w-44 items-center gap-3">
      <span
        className="size-8 shrink-0 border border-hairline"
        style={{ backgroundColor: `var(--color-${name})` }}
      />
      <span className="min-w-0">
        <span className="block truncate text-small text-ink">{name}</span>
        <span
          className="data block text-ink-2"
          ref={(el) => {
            if (el) {
              el.textContent = getComputedStyle(document.documentElement)
                .getPropertyValue(`--color-${name}`)
                .trim()
                .toUpperCase()
            }
          }}
        />
      </span>
    </div>
  )
}

export function DesignPage() {
  const toast = useToast()
  const [segment, setSegment] = useState<'map' | 'split' | 'image'>('map')
  const [region, setRegion] = useState('bay-of-bengal')
  const [layers, setLayers] = useState({ detections: true, grid: false })
  const [labels, setLabels] = useState(true)
  const [opacity, setOpacity] = useState(70)
  const [confidenceRange, setConfidenceRange] = useState<[number, number]>([60, 100])
  const [tab, setTab] = useState<'detections' | 'hotspots' | 'evidence'>('detections')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const drawerButton = useRef<HTMLButtonElement | null>(null)

  const detections = useMemo(() => hero?.detections.slice(0, 6) ?? [], [])
  // Confidence distribution of the hero scene, in ten bins, for the slider histogram.
  const confidenceBins = useMemo(() => {
    const bins = Array.from({ length: 10 }, () => 0)
    for (const d of hero?.detections ?? []) bins[Math.min(9, Math.floor(d.confidence * 10))]! += 1
    return bins
  }, [])
  const confidenceSamples = [
    CONFIDENCE_THRESHOLDS.high + 0.07,
    CONFIDENCE_THRESHOLDS.high - 0.01,
    CONFIDENCE_THRESHOLDS.low - 0.18,
  ]

  const ledgerColumns: LedgerColumn<Detection>[] = [
    {
      id: 'id',
      header: 'ID',
      render: (d) => <span className="data">{shortId(d.id)}</span>,
      sortValue: (d) => d.id,
    },
    {
      id: 'density',
      header: 'Density',
      render: (d) => <SeverityTag level={d.densityLevel} variant="plain" />,
    },
    {
      id: 'area',
      header: 'Area',
      unit: 'm²',
      numeric: true,
      render: (d) => formatInteger(d.areaM2),
      sortValue: (d) => d.areaM2,
    },
    {
      id: 'confidence',
      header: 'Confidence',
      numeric: true,
      render: (d) => formatConfidence(d.confidence),
      sortValue: (d) => d.confidence,
    },
    {
      id: 'centroid',
      header: 'Centroid',
      numeric: true,
      render: (d) => formatCoordinates(d.centroid),
      className: 'max-md:hidden',
    },
  ]

  return (
    <div className="mx-auto w-full max-w-page px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <PageHeader
        title="Design system"
        meta="Development only"
        description="The survey chart: every primitive in its states, the type specimen and the spacing scale. Figures come from the Ennore sample observation."
      />

      <Section title="Brand" description="A chart sheet with graticule ticks and one contour.">
        <div className="flex flex-wrap items-center gap-8">
          <span className="flex items-center gap-3">
            <Logomark />
            <span className="text-small font-semibold tracking-[0.08em] text-ink uppercase">
              A.W.A.R.E.
            </span>
          </span>
          <Logomark size={48} />
          <Logomark size={16} />
        </div>
      </Section>

      <Section title="Colour" description="Tokens from src/styles/tokens.css, values read live.">
        {COLOR_TOKENS.map(([group, names]) => (
          <Row key={group} label={group}>
            {names.map((name) => (
              <Swatch key={name} name={name} />
            ))}
          </Row>
        ))}
      </Section>

      <Section
        title="Type specimen"
        description="Instrument Sans for the interface, Geist Mono for data. Eight sizes and three weights, no others."
      >
        <div className="flex flex-col border-t border-hairline">
          {TYPE_SCALE.map(([className, token, size, use]) => (
            <div
              key={token}
              className="grid gap-2 border-b border-hairline py-4 md:grid-cols-[8rem_6rem_minmax(0,1fr)] md:items-baseline md:gap-6"
            >
              <span className="data text-ink-2">{token}</span>
              <span className="data text-ink-2">{size}</span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className={`${className} truncate text-ink`}>
                  {token === 'figure'
                    ? '3.4'
                    : token === 'mono'
                      ? '13.2204° N 80.3612° E'
                      : 'Possible debris near Ennore'}
                </span>
                <span className="text-small text-ink-2">{use}</span>
              </span>
            </div>
          ))}
        </div>
        <Row label="Weights">
          <span className="text-lead font-normal">Regular 400</span>
          <span className="text-lead font-medium">Medium 500</span>
          <span className="text-lead font-semibold">Semibold 600</span>
        </Row>
      </Section>

      <Section
        title="Spacing scale"
        description="A 4px base; these steps are the only spacing values. 12 columns, 24px gutters, 1280px content."
      >
        <div className="flex flex-col gap-2">
          {SPACING.map(([px, step]) => (
            <div key={px} className="flex items-center gap-4">
              <span className="data w-16 shrink-0 text-ink-2">{px} px</span>
              <span className="data w-10 shrink-0 text-ink-2">{step}</span>
              <span className="h-3 bg-accent" style={{ width: px }} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Signature elements"
        description="Section labels, sentence summaries with figures, observation glyphs, tags and ledgers."
      >
        <Row label="Section label">
          <div className="w-full">
            <SectionLabel as="p" count={heroAnalysis?.hotspots.length ?? 0}>
              Hotspots
            </SectionLabel>
          </div>
        </Row>
        {hero && heroAnalysis ? (
          <Row label="Sentence summary">
            <Sentence>
              <SentenceFigure value={hero.detections.length} countUpKey="design-count" /> possible
              debris regions covering{' '}
              <SentenceFigure
                value={hero.debrisAreaM2 / 10_000}
                format={(v) => v.toFixed(1)}
                unit="ha"
              />
              , in <SentenceFigure value={heroAnalysis.hotspots.length} /> hotspots.
            </Sentence>
          </Row>
        ) : null}
        <Row label="Figure, page and title sizes">
          <Figure
            value={hero?.coveragePercent ?? null}
            format={(v) => v.toFixed(2)}
            unit="%"
            size="page"
          />
          <Figure value={hero?.detections.length ?? null} size="title" />
          <Figure value={null} size="title" />
        </Row>
        <Row label="Measure">
          <Measure
            label="Detected area"
            value={formatArea(hero?.debrisAreaM2 ?? 0)}
            hint="Sum of the areas of every detected region."
            footnote="From the outlines on the map"
          />
          <Measure label="Coverage" value="…" loading />
        </Row>
        <Row label="Observation glyph: 16, 24 and 48 px, one per sample scene">
          {samples.map((o) => (
            <span key={o.id} className="flex items-center gap-2">
              <ObservationGlyph observation={o} size={48} />
              <ObservationGlyph observation={o} size={24} />
              <ObservationGlyph observation={o} size={16} />
            </span>
          ))}
          <ObservationGlyph observation={null} size={24} />
        </Row>
      </Section>

      <Section
        title="Buttons"
        description="One primary per view. Secondary is an ink outline, tertiary a text link."
      >
        <Row label="Variants">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant === 'danger-quiet' ? 'Delete' : variant[0]!.toUpperCase() + variant.slice(1)}
            </Button>
          ))}
        </Row>
        <Row label="Small, with icons, loading, disabled">
          <Button variant="primary" size="sm" iconStart={<Download aria-hidden />}>
            Export
          </Button>
          <Button variant="secondary" size="sm" loading>
            Testing
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <ArrowLink to="/map">Next: open the map</ArrowLink>
        </Row>
        <Row label="Icon buttons: in a toolbar, standalone">
          <IconButton label="Layers" icon={<Layers aria-hidden />} />
          <IconButton label="Settings" icon={<Settings aria-hidden />} />
          <IconButton label="Add" icon={<Plus aria-hidden />} variant="outline" />
          <IconButton label="Delete" icon={<Trash2 aria-hidden />} variant="outline" disabled />
          <span className="flex gap-1">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
          <Spinner />
        </Row>
      </Section>

      <Section
        title="Tags"
        description="Squared, with a swatch and text. Never colour alone, never a pill."
      >
        <Row label="Tones">
          {TAG_TONES.map((tone) => (
            <Tag key={tone} tone={tone}>
              {tone === 'warning' ? 'Sample data' : tone[0]!.toUpperCase() + tone.slice(1)}
            </Tag>
          ))}
        </Row>
        <Row label="Severity">
          {DENSITY_LEVEL_IDS.map((level) => (
            <SeverityTag key={level} level={level} />
          ))}
          {DENSITY_LEVEL_IDS.map((level) => (
            <SeverityTag key={`${level}-plain`} level={level} variant="plain" />
          ))}
        </Row>
        <Row label="Confidence">
          {confidenceSamples.map((value) => (
            <ConfidenceTag key={value} value={value} />
          ))}
        </Row>
      </Section>

      <Section title="Fields" description="Labels above, hairline underlines, no boxed fills.">
        <div className="grid max-w-2xl gap-6 sm:grid-cols-2">
          <TextInput label="Region" placeholder="For example, Ennore coast" />
          <TextInput label="Latitude" numeric defaultValue="13.2204" hint="Decimal degrees" />
          <TextInput label="Captured" error="Enter a date in the past." defaultValue="2031-01-01" />
          <Select
            label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            options={[
              { value: 'bay-of-bengal', label: 'Bay of Bengal' },
              { value: 'arabian-sea', label: 'Arabian Sea' },
            ]}
          />
        </div>
        <div className="grid max-w-2xl gap-6 sm:grid-cols-2">
          <Slider
            label="Overlay opacity"
            min={0}
            max={100}
            value={opacity}
            onChange={setOpacity}
            formatValue={(v) => `${v}%`}
          />
          <RangeSlider
            label="Confidence"
            min={0}
            max={100}
            value={confidenceRange}
            onChange={setConfidenceRange}
            formatValue={(v) => `${v}%`}
            histogram={
              <SliderHistogram
                bins={confidenceBins}
                range={[confidenceRange[0] / 100, confidenceRange[1] / 100]}
              />
            }
          />
        </div>
        <Row label="Choices">
          <Checkbox
            label="Detections"
            checked={layers.detections}
            onChange={(e) => setLayers({ ...layers, detections: e.target.checked })}
          />
          <Checkbox
            label="Density grid"
            checked={layers.grid}
            onChange={(e) => setLayers({ ...layers, grid: e.target.checked })}
          />
          <Switch label="Show labels" checked={labels} onCheckedChange={setLabels} />
          <SegmentedControl
            label="View"
            value={segment}
            onChange={setSegment}
            options={[
              { value: 'map', label: 'Map', icon: <MapIcon aria-hidden /> },
              { value: 'split', label: 'Split' },
              { value: 'image', label: 'Image' },
            ]}
          />
        </Row>
      </Section>

      <Section
        title="Ledger"
        description="Hairline rows, mono right-aligned figures, sticky header, sortable."
      >
        <Ledger
          caption="Sample detections"
          columns={ledgerColumns}
          rows={detections}
          rowKey={(d) => d.id}
          defaultSort={{ column: 'area', direction: 'desc' }}
          selectedKey={detections[1]?.id ?? null}
          onRowActivate={(d) => toast.show({ title: `Selected ${shortId(d.id)}` })}
          rowLabel={(d) => `Detection ${shortId(d.id)}`}
        />
        <SkeletonTable rows={3} columns={5} />
      </Section>

      <Section title="Tabs, banners and states">
        <Tabs
          label="Evidence"
          value={tab}
          onValueChange={setTab}
          items={[
            {
              value: 'detections',
              label: 'Detections',
              count: detections.length,
              content: <SkeletonText lines={2} />,
            },
            {
              value: 'hotspots',
              label: 'Hotspots',
              content: <p className="text-body">Ranked by priority.</p>,
            },
            { value: 'evidence', label: 'Evidence', disabled: true, content: null },
          ]}
        />
        <Banner tone="info" title="Positions are approximate">
          The image has no coordinate system, so outlines are placed from the bounds you gave.
        </Banner>
        <Banner tone="warning" title="Low confidence">
          Most detections are under {formatConfidence(CONFIDENCE_THRESHOLDS.low)}.
        </Banner>
        <Banner tone="danger" title="The file could not be read" onDismiss={() => undefined}>
          Choose an 11-band GeoTIFF.
        </Banner>
        <div className="grid gap-8 md:grid-cols-2">
          <EmptyState
            size="sm"
            title="No observations match these filters"
            description="Widen the search or turn off some filters to see more."
            action={<Button variant="secondary">Reset filters</Button>}
          />
          <ErrorState
            size="sm"
            title="The map could not load"
            description="Check your connection, then try again."
            onRetry={() => undefined}
            details="NETWORK"
          />
        </div>
        <Row label="Skeleton">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-24" />
        </Row>
      </Section>

      <Section
        title="Overlays"
        description="The only boxes: drawer, dialog, menu, tooltip and toast."
      >
        <Row label="Open one">
          <Button ref={drawerButton} variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open drawer
          </Button>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <DropdownMenu
            items={[
              { type: 'label', id: 'label', label: 'Export' },
              {
                id: 'geojson',
                label: 'Detections',
                aside: 'GeoJSON',
                icon: <Download />,
                onSelect: () => undefined,
              },
              {
                id: 'report',
                label: 'Summary report',
                aside: 'PDF',
                icon: <FileText />,
                onSelect: () => undefined,
              },
              { type: 'separator', id: 'sep' },
              {
                id: 'delete',
                label: 'Remove',
                tone: 'danger',
                icon: <Trash2 />,
                onSelect: () => undefined,
              },
            ]}
            trigger={(props) => (
              <Button {...props} variant="secondary">
                Menu
              </Button>
            )}
          />
          <Tooltip
            content={
              <span>
                Centroid <span className="data">13.2204° N</span>
              </span>
            }
          >
            <Button variant="secondary">Tooltip</Button>
          </Tooltip>
          <Button
            variant="secondary"
            onClick={() =>
              toast.show({
                title: 'Export downloaded',
                description: 'ennore-detections.geojson',
                tone: 'success',
              })
            }
          >
            Toast
          </Button>
        </Row>
      </Section>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Hotspot 1"
        description="Critical density, 3 regions"
        footer={<Button variant="secondary">View evidence</Button>}
      >
        <SkeletonText lines={4} />
      </Drawer>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Keyboard shortcuts"
        description="Shortcuts work when no text field has focus."
      >
        <p className="text-body text-ink-2">A dialog: white, hairline frame, the popover shadow.</p>
      </Dialog>
    </div>
  )
}
