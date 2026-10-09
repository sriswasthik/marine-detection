import { Check, CircleCheck, PlugZap } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  Banner,
  Button,
  Checkbox,
  InfoTip,
  PageSkeleton,
  SegmentedControl,
  SeveritySwatch,
  Skeleton,
  Slider,
  Tag,
  TextInput,
  useToast,
} from '@/components/ui'
import {
  CONFIDENCE_THRESHOLDS,
  DENSITY_THRESHOLDS,
  GRID_CELL_SIZE_M,
  MODEL_CARD,
  PLACEHOLDER_MODEL_METRICS,
  REFERENCE_RESOLUTION_M,
} from '@/lib/config'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatConfidence, formatCoordinates, formatLength } from '@/lib/format'
import { GLOSSARY } from '@/lib/glossary'
import { BASEMAP_ORDER, BASEMAPS } from '@/lib/map/basemaps'
import { MAP_LAYER_IDS, MAP_LAYER_LABELS } from '@/lib/map/layers'
import {
  AREA_UNIT_LABELS,
  AREA_UNITS,
  COORDINATE_FORMAT_LABELS,
  COORDINATE_FORMATS,
  validateApiBaseUrl,
  type AppSettings,
} from '@/lib/settings'
import { useHealth } from '@/features/observations/hooks'
import { toAppError, type AppError } from '@/lib/errors/appError'
import { useSettings, useSettingsStore, useUpdateSettings } from './settingsContext'
import { testConnection, type ConnectionResult } from './testConnection'

/** "Saved" next to a section title for a moment after a change; a warning if storage refused it. */
function useSaved() {
  const [state, setState] = useState<'idle' | 'saved' | 'session'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = window.setTimeout(() => setState('idle'), state === 'saved' ? 2000 : 6000)
    return () => window.clearTimeout(timer)
  }, [state])
  const update = useUpdateSettings()
  const save = (patch: Partial<AppSettings>) => setState(update(patch) ? 'saved' : 'session')
  return { state, save }
}

function SavedNote({ state }: { state: 'idle' | 'saved' | 'session' }) {
  return (
    <span aria-live="polite" className="text-small">
      {state === 'saved' ? (
        <span className="inline-flex items-center gap-1 text-success">
          <Check aria-hidden className="size-4" />
          Saved
        </span>
      ) : state === 'session' ? (
        <span className="text-warning">
          Applied for this visit only: this browser does not allow saving settings.
        </span>
      ) : null}
    </span>
  )
}

function Section({
  id,
  title,
  description,
  saved,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  saved?: 'idle' | 'saved' | 'session'
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 border-t border-rule py-8 first:pt-0 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={id} className="label pt-1 text-ink-2">
            {title}
          </h2>
          {saved ? <SavedNote state={saved} /> : null}
        </div>
        {description ? <p className="text-small text-ink-2">{description}</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  )
}

function Setting({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-small font-medium text-ink">{label}</p>
      {children}
      {hint ? <p className="text-small text-ink-2">{hint}</p> : null}
    </div>
  )
}

const EXAMPLE_POINT = { lat: 13.2215, lng: 80.3621 }

export function UnitsSection() {
  const settings = useSettings()
  const { state, save } = useSaved()
  return (
    <Section
      id="units"
      title="Units"
      description="Applies everywhere at once: map, tables, report."
      saved={state}
    >
      <Setting label="Area unit" hint="Auto picks m², ha or km² to fit each figure.">
        <SegmentedControl
          label="Area unit"
          size="sm"
          options={AREA_UNITS.map((unit) => ({ value: unit, label: AREA_UNIT_LABELS[unit] }))}
          value={settings.areaUnit}
          onChange={(areaUnit) => save({ areaUnit })}
        />
      </Setting>
      <Setting
        label="Coordinate format"
        hint={
          <>
            Example:{' '}
            <span className="data">
              {formatCoordinates(EXAMPLE_POINT, { format: settings.coordinateFormat })}
            </span>
          </>
        }
      >
        <SegmentedControl
          label="Coordinate format"
          size="sm"
          options={COORDINATE_FORMATS.map((format) => ({
            value: format,
            label: COORDINATE_FORMAT_LABELS[format],
          }))}
          value={settings.coordinateFormat}
          onChange={(coordinateFormat) => save({ coordinateFormat })}
        />
      </Setting>
    </Section>
  )
}

export function MapSection() {
  const settings = useSettings()
  const { state, save } = useSaved()
  const cellPixels = GRID_CELL_SIZE_M / REFERENCE_RESOLUTION_M
  return (
    <Section
      id="map"
      title="Map"
      description="What the map shows when a link does not say otherwise. Shared links keep their own view."
      saved={state}
    >
      <Setting label="Default basemap">
        <SegmentedControl
          label="Default basemap"
          size="sm"
          options={BASEMAP_ORDER.map((id) => ({ value: id, label: BASEMAPS[id].label }))}
          value={settings.defaultBasemap}
          onChange={(defaultBasemap) => save({ defaultBasemap })}
        />
      </Setting>
      <Slider
        label="Default minimum confidence"
        hint="Detections below this are hidden until you lower the filter on the map."
        min={0}
        max={95}
        step={5}
        value={Math.round(settings.defaultMinConfidence * 100)}
        onChange={(value) => save({ defaultMinConfidence: value / 100 })}
        formatValue={(value) => (value === 0 ? 'Show all' : `${value}% or more`)}
        className="max-w-sm"
      />
      <Setting label="Default visible layers">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {MAP_LAYER_IDS.map((id) => (
            <Checkbox
              key={id}
              label={MAP_LAYER_LABELS[id]}
              checked={settings.defaultLayers[id]}
              onChange={(event) =>
                save({ defaultLayers: { ...settings.defaultLayers, [id]: event.target.checked } })
              }
            />
          ))}
        </div>
      </Setting>
      <Setting
        label="Density grid cell"
        hint={`Fixed: each cell spans ${cellPixels} × ${cellPixels} image pixels, so it is ${formatLength(GRID_CELL_SIZE_M)} on a ${REFERENCE_RESOLUTION_M} m Sentinel-2 image. Density is the share of each cell covered by debris.`}
      >
        <p className="num text-body text-ink">
          {formatLength(GRID_CELL_SIZE_M)} at {REFERENCE_RESOLUTION_M} m per pixel
        </p>
      </Setting>
    </Section>
  )
}

export function ThresholdsSection() {
  const t = DENSITY_THRESHOLDS
  const rows = [
    { level: 'low' as const, range: `below ${t.moderate}%` },
    { level: 'moderate' as const, range: `${t.moderate}% to ${t.high}%` },
    { level: 'high' as const, range: `${t.high}% to ${t.critical}%` },
    { level: 'critical' as const, range: `${t.critical}% or more` },
  ]
  return (
    <Section
      id="thresholds"
      title="Density thresholds"
      description="How each grid cell's debris coverage maps to a density level."
    >
      <Banner tone="warning" title="Placeholder values">
        These thresholds are starting values for the demo, not validated figures. Replace them with
        values calibrated on project data (DENSITY_THRESHOLDS in src/lib/config.ts).
      </Banner>
      <table className="w-full max-w-md text-small">
        <caption className="sr-only">Density thresholds by share of cell covered by debris</caption>
        <thead>
          <tr className="border-b border-hairline text-left text-small text-ink-2">
            <th scope="col" className="py-2 font-medium">
              Level
            </th>
            <th scope="col" className="py-2 font-medium">
              Cell covered by debris
            </th>
            <th scope="col" className="py-2 font-medium">
              Meaning
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ level, range }) => (
            <tr key={level} className="border-b border-hairline last:border-0">
              <td className="py-2">
                <span className="inline-flex items-center gap-2 font-medium text-ink">
                  <SeveritySwatch level={level} />
                  {DENSITY_LEVELS[level].label}
                </span>
              </td>
              <td className="data py-2 text-ink">{range}</td>
              <td className="py-2 text-ink-2">{DENSITY_LEVELS[level].meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

/** A failure inside a settings row: the shared error copy, left-aligned, with a retry if useful. */
function ErrorBanner({ error, onRetry }: { error: AppError; onRetry?: () => void }) {
  return (
    <Banner
      tone="danger"
      title={error.title}
      className="w-full max-w-xl"
      action={
        onRetry && error.recoverable ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null
      }
    >
      {error.message} <span className="data text-ink-2">{error.code}</span>
    </Banner>
  )
}

/** Whether the source in use answers right now, and which model it runs. */
function CurrentSourceStatus() {
  const health = useHealth()
  if (health.isPending) {
    return (
      <PageSkeleton label="Checking the service">
        <Skeleton className="h-5 w-64" />
      </PageSkeleton>
    )
  }
  if (health.isError) {
    return <ErrorBanner error={toAppError(health.error)} onRetry={() => void health.refetch()} />
  }
  return (
    <p className="flex items-center gap-2 text-small text-ink">
      <CircleCheck aria-hidden className="size-4 text-success" />
      Connected · {health.data.modelName} {health.data.modelVersion}
    </p>
  )
}

type TestState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | { phase: 'done'; result: ConnectionResult; url: string }

export function DataSourceSection() {
  const settings = useSettings()
  const store = useSettingsStore()
  const toast = useToast()
  const { state, save } = useSaved()
  // Live is chosen here first and only used once the connection test passes.
  const [choice, setChoice] = useState(settings.dataSource)
  const [url, setUrl] = useState(settings.apiBaseUrl)
  const [test, setTest] = useState<TestState>({ phase: 'idle' })
  const validation = validateApiBaseUrl(url)
  const passed =
    test.phase === 'done' && test.result.ok && validation.ok && test.url === validation.url

  const runTest = async () => {
    if (!validation.ok) return
    setTest({ phase: 'testing' })
    const result = await testConnection(validation.url)
    setTest({ phase: 'done', result, url: validation.url })
  }

  const useLive = () => {
    if (!passed || !validation.ok) return
    save({ dataSource: 'live', apiBaseUrl: validation.url })
    toast.show({ title: 'Using the live service', description: validation.url, tone: 'success' })
  }

  return (
    <Section
      id="data-source"
      title="Data source"
      description="Where observations come from. Switching starts the app afresh with the new source."
      saved={state}
    >
      <Setting label="In use now">
        <CurrentSourceStatus />
      </Setting>
      {/* Sample data is offered only where the environment turns the mock on (VITE_USE_MOCK). */}
      {store.sampleDataAllowed() ? (
        <SegmentedControl
          label="Data source"
          className="self-start"
          size="sm"
          options={[
            { value: 'mock' as const, label: 'Sample data' },
            { value: 'live' as const, label: 'Live API' },
          ]}
          value={choice}
          onChange={(next) => {
            setChoice(next)
            if (next === 'mock' && settings.dataSource !== 'mock') {
              save({ dataSource: 'mock' })
              toast.show({ title: 'Using sample data', tone: 'success' })
            }
          }}
        />
      ) : null}
      {choice === 'mock' ? (
        <p className="text-small text-ink-2">
          Synthetic scenes generated in the browser, labelled "Sample data", and real model output
          on MARIDA patches exported by the backend, labelled with their patch.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <TextInput
            label="API base URL"
            hint="The address of the processing service. The test calls GET /health on it."
            value={url}
            onChange={(event) => {
              setUrl(event.target.value)
              setTest({ phase: 'idle' })
            }}
            error={url.trim() !== '' && !validation.ok ? validation.message : undefined}
            spellCheck={false}
            autoComplete="url"
            className="max-w-md"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              iconStart={<PlugZap aria-hidden />}
              loading={test.phase === 'testing'}
              disabled={!validation.ok || test.phase === 'testing'}
              onClick={() => void runTest()}
            >
              Test connection
            </Button>
            {settings.dataSource === 'live' &&
            settings.apiBaseUrl === (validation.ok ? validation.url : '') ? (
              <Tag tone="success">In use</Tag>
            ) : (
              <Button variant="secondary" size="sm" disabled={!passed} onClick={useLive}>
                Use this service
              </Button>
            )}
          </div>
          {test.phase === 'done' ? (
            test.result.ok ? (
              <p role="status" className="flex items-center gap-2 text-small text-ink">
                <CircleCheck aria-hidden className="size-4 text-success" />
                Connected. The service runs {test.result.health.modelName}{' '}
                {test.result.health.modelVersion}.
              </p>
            ) : (
              <ErrorBanner error={test.result.error} />
            )
          ) : (
            <p className="text-small text-ink-2">
              Test the connection before switching. The live service lists, analyses and serves
              observations; start it with backend/run.sh.
            </p>
          )}
          {!store.persistent() ? (
            <p className="text-small text-warning">
              This browser does not allow saving settings, so the choice lasts for this visit only.
            </p>
          ) : null}
        </div>
      )}
    </Section>
  )
}

export function ModelCardSection() {
  const m = PLACEHOLDER_MODEL_METRICS
  const figures = [
    { label: 'Precision', value: m.precision, hint: GLOSSARY.precision },
    { label: 'Recall', value: m.recall, hint: GLOSSARY.recall },
    { label: 'F1 score', value: m.f1, hint: GLOSSARY.f1 },
    { label: 'Accuracy', value: m.accuracy, hint: GLOSSARY.accuracy },
  ]
  return (
    <Section id="model" title="Model card" description="The model behind every detection.">
      <dl className="grid max-w-lg grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-small">
        <dt className="text-ink-2">Model</dt>
        <dd className="text-ink">
          {MODEL_CARD.name} <span className="data">{MODEL_CARD.version}</span>
        </dd>
        <dt className="text-ink-2">Architecture</dt>
        <dd className="text-ink">{MODEL_CARD.architecture}</dd>
        <dt className="text-ink-2">Training data</dt>
        <dd className="text-ink">{MODEL_CARD.trainingData}</dd>
        <dt className="text-ink-2">Evaluation data</dt>
        <dd className="text-ink">{MODEL_CARD.evaluationData}</dd>
        <dt className="text-ink-2">Confidence</dt>
        <dd className="text-ink">
          High from {formatConfidence(CONFIDENCE_THRESHOLDS.high)}, low below{' '}
          {formatConfidence(CONFIDENCE_THRESHOLDS.low)}
        </dd>
      </dl>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-small font-medium text-ink">Evaluation</h3>
          {m.isPlaceholder ? <Tag tone="warning">Sample values</Tag> : null}
        </div>
        <dl className="grid max-w-lg grid-cols-4 gap-3">
          {figures.map((figure) => (
            <div key={figure.label} className="flex flex-col">
              <dt className="flex items-center gap-1 text-small text-ink-2">
                {figure.label}
                <InfoTip label={figure.label}>{figure.hint}</InfoTip>
              </dt>
              <dd className="num text-title text-ink">{formatConfidence(figure.value)}</dd>
            </div>
          ))}
        </dl>
        {m.isPlaceholder ? (
          <p className="text-small text-ink-2">
            Placeholder figures, not an evaluation of this model. {m.benchmark}.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-small font-medium text-ink">Known limitations</h3>
        <ul className="flex max-w-prose list-disc flex-col gap-1 pl-5 text-small text-ink">
          {MODEL_CARD.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

const ATTRIBUTIONS: readonly { name: string; detail: string }[] = [
  {
    name: 'Copernicus Sentinel-2',
    detail: 'Multispectral imagery from the European Union Copernicus programme (ESA).',
  },
  {
    name: 'MARIDA',
    detail: 'Marine Debris Archive, the labelled Sentinel-2 dataset the model is trained on.',
  },
  { name: 'OpenStreetMap', detail: '© OpenStreetMap contributors, in the light basemap.' },
  { name: 'Esri', detail: 'World Light Gray Canvas and World Imagery basemaps.' },
  {
    name: 'CARTO',
    detail: 'Positron basemap, supported when an API key is configured (not used by default).',
  },
  { name: 'Leaflet', detail: 'Open-source library that draws the maps.' },
]

export function AboutSection({ appName }: { appName: string }) {
  return (
    <Section
      id="about"
      title="About and attributions"
      description={`${appName} turns segmentation output into measurable, located cleanup information.`}
    >
      <dl className="flex max-w-prose flex-col gap-2 text-small">
        {ATTRIBUTIONS.map((item) => (
          <div key={item.name} className="grid grid-cols-[10rem_1fr] gap-3">
            <dt className="font-medium text-ink">{item.name}</dt>
            <dd className="text-ink-2">{item.detail}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
