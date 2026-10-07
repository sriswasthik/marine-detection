/**
 * Dev-only visual QA page: every primitive in every state. Not in production builds or nav.
 * Figures come from the hero sample observation and src/lib, never typed in by hand.
 */
import {
  Download,
  FileText,
  Inbox,
  Layers,
  Map as MapIcon,
  Plus,
  ScanSearch,
  Settings,
  Trash2,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Logomark } from '@/components/brand/Logomark'
import {
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  ConfidenceBadge,
  Divider,
  Drawer,
  DropdownMenu,
  EmptyState,
  ErrorState,
  IconButton,
  Kbd,
  MetricCard,
  RangeSlider,
  SegmentedControl,
  Select,
  SeverityBadge,
  Skeleton,
  SkeletonText,
  Slider,
  Spinner,
  Switch,
  Tabs,
  Tooltip,
  useToast,
  type ButtonVariant,
} from '@/components/ui'
import { getSampleObservation, HERO_SAMPLE_ID } from '@/features/observations/mock/samples'
import { DENSITY_LEVEL_IDS } from '@/features/observations/types'
import { analyzeObservation } from '@/lib/analysis'
import { CONFIDENCE_THRESHOLDS } from '@/lib/config'
import {
  formatArea,
  formatConfidence,
  formatCoordinates,
  formatCoveragePercent,
  formatInteger,
} from '@/lib/format'
import { PageHeader } from '../PageHeader'

const hero = getSampleObservation(HERO_SAMPLE_ID)
const heroAnalysis = hero ? analyzeObservation(hero) : null

const COLOR_TOKENS = [
  ['Base', ['bg', 'surface', 'border', 'border-strong', 'ink', 'ink-muted']],
  ['Accent', ['accent', 'accent-hover', 'accent-soft']],
  ['Severity', DENSITY_LEVEL_IDS.flatMap((level) => [level, `${level}-stroke`, `${level}-soft`])],
  [
    'Status',
    ['success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft', 'info-soft'],
  ],
] as const

const TYPE_SCALE = [
  ['text-display', 'Display', 'Product title and KPI figures'],
  ['text-title', 'Title', 'Page titles'],
  ['text-heading', 'Heading', 'Section and card headings'],
  ['text-body', 'Body', 'Default text, 14px'],
  ['text-small', 'Small', 'Labels and secondary text'],
  ['text-caption', 'Caption', 'Badges, hints, footnotes'],
] as const

const BUTTON_VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger-quiet']

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-4 border-t border-border py-8 lg:grid-cols-[200px_1fr] lg:gap-8">
      <div>
        <h2 className="text-heading text-ink">{title}</h2>
        {description ? <p className="mt-1 text-small text-ink-muted">{description}</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption font-medium text-ink-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

function Swatch({ name }: { name: string }) {
  return (
    <div className="flex w-40 items-center gap-2.5">
      <span
        className="size-8 shrink-0 rounded-control border border-border"
        style={{ backgroundColor: `var(--color-${name})` }}
      />
      <span className="min-w-0">
        <span className="block truncate text-small text-ink">{name}</span>
        <span
          className="mono-label block text-ink-muted"
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

function Thrower({ armed }: { armed: boolean }) {
  if (armed) throw new Error('Deliberate render error from the design page.')
  return null
}

export function DesignPage() {
  const toast = useToast()
  const [segment, setSegment] = useState<'map' | 'split' | 'image'>('map')
  const [unit, setUnit] = useState<'auto' | 'm2' | 'ha'>('auto')
  const [region, setRegion] = useState('bay-of-bengal')
  const [layers, setLayers] = useState({ detections: true, grid: false })
  const [labels, setLabels] = useState(true)
  const [opacity, setOpacity] = useState(70)
  const [confidenceRange, setConfidenceRange] = useState<[number, number]>([60, 100])
  const [tab, setTab] = useState<'detections' | 'hotspots' | 'evidence'>('detections')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [throwError, setThrowError] = useState(false)
  const drawerButton = useRef<HTMLButtonElement | null>(null)

  const metrics = hero && heroAnalysis
  const confidenceSamples = [
    CONFIDENCE_THRESHOLDS.high + 0.07,
    CONFIDENCE_THRESHOLDS.high,
    CONFIDENCE_THRESHOLDS.high - 0.01,
    CONFIDENCE_THRESHOLDS.low,
    CONFIDENCE_THRESHOLDS.low - 0.01,
    CONFIDENCE_THRESHOLDS.low - 0.18,
  ]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <Thrower armed={throwError} />
      <PageHeader
        title="Design system"
        meta="Development only"
        description="Every primitive in every state, for visual QA. Figures come from the Ennore sample observation."
      />

      <Section title="Brand" description="Logomark and product name.">
        <div className="flex flex-wrap items-center gap-6">
          <span className="flex items-center gap-2.5">
            <Logomark />
            <span className="text-heading tracking-tight">Marine Waste Intelligence</span>
          </span>
          <Logomark className="size-10" />
          <Logomark className="size-5" />
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

      <Section title="Type" description="Hierarchy from weight and spacing before colour.">
        {TYPE_SCALE.map(([className, name, use]) => (
          <div key={name} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-6">
            <span className="w-20 shrink-0 text-caption text-ink-muted">{name}</span>
            <span className={className}>
              {className === 'text-display' && metrics ? (
                <span className="num">{formatArea(hero.debrisAreaM2)}</span>
              ) : (
                use
              )}
            </span>
          </div>
        ))}
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-6">
          <span className="w-20 shrink-0 text-caption text-ink-muted">Mono label</span>
          <span className="mono-label text-ink">
            {hero?.detections[0]
              ? `${hero.detections[0].id} · ${formatCoordinates(hero.detections[0].centroid)}`
              : 'obs-id'}
          </span>
        </div>
      </Section>

      <Section title="Button" description="Primary for the one main action per view.">
        {(['md', 'sm'] as const).map((size) => (
          <Row key={size} label={size === 'md' ? 'Medium' : 'Small'}>
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} size={size}>
                {variant === 'danger-quiet' ? 'Remove' : 'Analyze imagery'}
              </Button>
            ))}
          </Row>
        ))}
        <Row label="With icon, loading, disabled">
          <Button variant="primary" iconStart={<ScanSearch aria-hidden />}>
            Analyze new imagery
          </Button>
          <Button variant="secondary" iconStart={<Download aria-hidden />}>
            Export
          </Button>
          <Button variant="primary" loading>
            Uploading
          </Button>
          <Button variant="secondary" loading>
            Saving
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </Row>
        <Row label="Icon button">
          <IconButton label="Layers" icon={<Layers aria-hidden />} />
          <IconButton label="Layers" icon={<Layers aria-hidden />} variant="secondary" />
          <IconButton label="Add" icon={<Plus aria-hidden />} size="sm" variant="secondary" />
          <IconButton label="Settings" icon={<Settings aria-hidden />} size="sm" />
          <IconButton label="Disabled" icon={<Trash2 aria-hidden />} disabled variant="secondary" />
        </Row>
      </Section>

      <Section title="Badge" description="Severity and confidence are never shown by colour alone.">
        <Row label="Tones">
          <Badge>Neutral</Badge>
          <Badge tone="accent">Accent</Badge>
          <Badge tone="success" dot>
            Completed
          </Badge>
          <Badge tone="warning" dot>
            Sample data
          </Badge>
          <Badge tone="danger">Failed</Badge>
        </Row>
        <Row label="Severity, soft">
          {DENSITY_LEVEL_IDS.map((level) => (
            <SeverityBadge key={level} level={level} />
          ))}
        </Row>
        <Row label="Severity, plain and with meaning">
          {DENSITY_LEVEL_IDS.map((level) => (
            <SeverityBadge key={level} level={level} variant="plain" />
          ))}
          <SeverityBadge level="critical" showMeaning />
        </Row>
        <Row label="Confidence at the band thresholds">
          {confidenceSamples.map((value) => (
            <ConfidenceBadge key={value} value={value} />
          ))}
          <ConfidenceBadge value={CONFIDENCE_THRESHOLDS.high} showValue={false} />
        </Row>
      </Section>

      <Section title="Metric card" description="Values come from the data contract and src/lib.">
        <div className="grid gap-3 sm:grid-cols-2">
          {metrics ? (
            <>
              <MetricCard
                label="Debris area"
                value={formatArea(hero.debrisAreaM2)}
                hint="Sum of the area of every detection, measured on the map."
              />
              <MetricCard
                label="Water coverage"
                value={formatCoveragePercent(hero.coveragePercent)}
                hint="Debris area as a share of the water area in the image."
                footnote={`of ${formatArea(hero.waterAreaM2)} water`}
              />
              <MetricCard
                label="Hotspots"
                value={formatInteger(heroAnalysis.hotspots.length)}
                unit={heroAnalysis.hotspots.length === 1 ? 'hotspot' : 'hotspots'}
                status={{ tone: 'danger', label: 'Action needed' }}
              />
              {hero.modelMetrics ? (
                <MetricCard
                  label="Model precision"
                  value={formatConfidence(hero.modelMetrics.precision)}
                  status={
                    hero.modelMetrics.isPlaceholder
                      ? { tone: 'warning', label: 'Sample values' }
                      : undefined
                  }
                  footnote={hero.modelMetrics.benchmark}
                />
              ) : null}
            </>
          ) : null}
          <MetricCard label="Loading" value="" loading />
        </div>
      </Section>

      <Section title="Controls">
        <Row label="Segmented control">
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
          <SegmentedControl
            label="Area unit"
            size="sm"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'm2', label: 'm²' },
              { value: 'ha', label: 'ha', disabled: true },
            ]}
          />
        </Row>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            options={[
              { value: 'bay-of-bengal', label: 'Bay of Bengal' },
              { value: 'arabian-sea', label: 'Arabian Sea' },
              { value: 'gulf-of-mannar', label: 'Gulf of Mannar' },
            ]}
            hint="Used to label the observation."
          />
          <Select
            label="Source"
            defaultValue=""
            placeholder="Choose a source"
            options={[
              { value: 'satellite', label: 'Satellite' },
              { value: 'drone', label: 'Drone' },
            ]}
            error="Choose where the image came from."
          />
          <Select
            label="Model"
            disabled
            defaultValue="unet"
            options={[{ value: 'unet', label: 'UNet++' }]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-3">
            <Checkbox
              label="Detections"
              description="Debris polygons from the model."
              checked={layers.detections}
              onChange={(e) => setLayers((l) => ({ ...l, detections: e.target.checked }))}
            />
            <Checkbox
              label="Density grid"
              checked={layers.grid}
              onChange={(e) => setLayers((l) => ({ ...l, grid: e.target.checked }))}
            />
            <Checkbox label="All layers" checked={false} indeterminate onChange={() => {}} />
            <Checkbox label="Disabled" disabled />
          </div>
          <div className="flex flex-col gap-3">
            <Switch label="Show labels" checked={labels} onCheckedChange={setLabels} />
            <Switch
              label="Fast demo mode"
              description="Shortens the simulated pipeline."
              checked={false}
              onCheckedChange={() => {}}
            />
            <Switch label="Disabled" checked disabled onCheckedChange={() => {}} />
          </div>
          <div className="flex flex-col gap-5">
            <Slider
              label="Layer opacity"
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
              step={5}
              value={confidenceRange}
              onChange={setConfidenceRange}
              formatValue={(v) => `${v}%`}
              hint="Only show detections in this range."
            />
            <Slider label="Disabled" min={0} max={100} value={40} onChange={() => {}} disabled />
          </div>
        </div>
      </Section>

      <Section title="Overlays" description="Tooltip, menu, drawer and toast.">
        <Row label="Tooltip">
          <Tooltip content="Debris area as a share of the water area.">
            <Button variant="secondary">Hover or focus</Button>
          </Tooltip>
          <Tooltip content="Opens below the trigger." side="bottom">
            <Button variant="ghost">Bottom</Button>
          </Tooltip>
        </Row>
        <Row label="Dropdown menu">
          <DropdownMenu
            items={[
              {
                id: 'geojson',
                label: 'GeoJSON',
                description: 'Detections as polygons',
                icon: <MapIcon />,
                onSelect: () => toast.show({ title: 'GeoJSON exported', tone: 'success' }),
              },
              {
                id: 'csv',
                label: 'CSV',
                description: 'One row per detection',
                icon: <FileText />,
                onSelect: () => toast.show({ title: 'CSV exported', tone: 'success' }),
              },
              {
                id: 'pdf',
                label: 'PDF report',
                icon: <FileText />,
                disabled: true,
                onSelect: () => {},
              },
              { type: 'separator', id: 'sep' },
              {
                id: 'remove',
                label: 'Remove observation',
                tone: 'danger',
                icon: <Trash2 />,
                onSelect: () => {},
              },
            ]}
            trigger={(props) => (
              <Button {...props} variant="secondary" iconStart={<Download aria-hidden />}>
                Export
              </Button>
            )}
          />
        </Row>
        <Row label="Drawer">
          <Button ref={drawerButton} variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open drawer
          </Button>
          <span className="text-small text-ink-muted">
            Right panel from 768px, bottom sheet below. <Kbd>Esc</Kbd> closes.
          </span>
        </Row>
        <Row label="Toast">
          <Button
            variant="secondary"
            onClick={() =>
              toast.show({
                title: 'Analysis started',
                description: 'Results usually take under a minute.',
              })
            }
          >
            Info
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.show({ title: 'Report saved', tone: 'success' })}
          >
            Success
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.show({
                title: 'Partial georeferencing',
                description: 'Positions may be off by up to a few hundred meters.',
                tone: 'warning',
              })
            }
          >
            Warning
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.show({
                title: 'Upload failed',
                description: 'Check your connection and try again.',
                tone: 'danger',
                action: { label: 'Retry', onClick: () => {} },
                duration: 0,
              })
            }
          >
            Danger, persistent
          </Button>
        </Row>
      </Section>

      <Section title="Feedback">
        <Row label="Spinner">
          <Spinner size="sm" className="text-accent" />
          <Spinner className="text-accent" />
          <Spinner size="lg" className="text-ink-muted" />
        </Row>
        <Row label="Skeleton">
          <div className="flex w-full max-w-md flex-col gap-3">
            <Skeleton className="h-8 w-40" />
            <SkeletonText lines={3} />
          </div>
        </Row>
        <div className="flex flex-col gap-3">
          <Banner tone="info" title="Sample data">
            These observations are synthetic and exist to demonstrate the product.
          </Banner>
          <Banner
            tone="warning"
            title="Low confidence"
            action={
              <Button size="sm" variant="secondary">
                Review detections
              </Button>
            }
            onDismiss={() => {}}
          >
            Many detections are below {formatConfidence(CONFIDENCE_THRESHOLDS.low)} confidence.
            Check them against the image before planning a cleanup.
          </Banner>
          <Banner tone="danger" title="Analysis failed">
            The detection model stopped before finishing. Try again with a smaller image.
          </Banner>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Card padding="none">
            <EmptyState
              icon={<Inbox />}
              title="No observations yet"
              description="Analyze an image to see detections, density and hotspots here."
              action={
                <Button variant="primary" iconStart={<ScanSearch aria-hidden />}>
                  Analyze new imagery
                </Button>
              }
            />
          </Card>
          <Card padding="none">
            <ErrorState
              headingLevel={3}
              description="The observation list could not load. Check your connection and try again."
              onRetry={() => {}}
              details="NETWORK_ERROR"
            />
          </Card>
        </div>
        <Row label="Route error boundary">
          <Button variant="danger-quiet" onClick={() => setThrowError(true)}>
            Throw a render error
          </Button>
        </Row>
      </Section>

      <Section title="Structure">
        <div className="grid gap-3 md:grid-cols-2">
          <Card
            title="Card with header"
            description="Optional description line."
            actions={<IconButton label="Settings" icon={<Settings aria-hidden />} size="sm" />}
          >
            <p className="text-body text-ink-muted">Plain surface, 1px border, 12px radius.</p>
          </Card>
          <Card>
            <p className="text-body text-ink-muted">Card without a header.</p>
          </Card>
        </div>
        <Tabs
          label="Observation details"
          value={tab}
          onValueChange={setTab}
          items={[
            {
              value: 'detections',
              label: 'Detections',
              count: hero?.detections.length,
              content: <p className="text-body text-ink-muted">Detection table goes here.</p>,
            },
            {
              value: 'hotspots',
              label: 'Hotspots',
              count: heroAnalysis?.hotspots.length,
              content: <p className="text-body text-ink-muted">Hotspot ranking goes here.</p>,
            },
            {
              value: 'evidence',
              label: 'Evidence',
              content: <p className="text-body text-ink-muted">Image evidence goes here.</p>,
            },
          ]}
        />
        <Row label="Divider">
          <div className="flex w-full flex-col gap-4">
            <Divider />
            <Divider label="or" />
            <div className="flex h-6 items-center gap-3 text-small text-ink-muted">
              <span>Left</span>
              <Divider orientation="vertical" />
              <span>Right</span>
            </div>
          </div>
        </Row>
        <Row label="Kbd">
          <span className="flex items-center gap-1 text-small text-ink-muted">
            <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> to search
          </span>
        </Row>
      </Section>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Detection d001"
        description="Largest detection in the hero scene."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
              Close
            </Button>
            <Button variant="primary">Add to report</Button>
          </>
        }
      >
        {hero?.detections[0] ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-body">
            <dt className="text-ink-muted">Area</dt>
            <dd className="num">{formatArea(hero.detections[0].areaM2)}</dd>
            <dt className="text-ink-muted">Confidence</dt>
            <dd>
              <ConfidenceBadge value={hero.detections[0].confidence} />
            </dd>
            <dt className="text-ink-muted">Density</dt>
            <dd>
              <SeverityBadge level={hero.detections[0].densityLevel} />
            </dd>
            <dt className="text-ink-muted">Pixels</dt>
            <dd className="num">{formatInteger(hero.detections[0].sourcePixelCount)}</dd>
          </dl>
        ) : null}
      </Drawer>
    </div>
  )
}
