import { ChevronDown, ChevronRight, Download, Map as MapIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, buttonStyles, DropdownMenu, useToast } from '@/components/ui'
import { isMockMode } from '@/features/observations/api'
import { SourceIcon } from '@/features/observations/components/SourceIcon'
import { SOURCE_LABELS, STATUS_LABELS, STATUS_TONES } from '@/features/observations/labels'
import type { Observation } from '@/features/observations/types'
import { downloadTextFile } from '@/lib/download'
import { formatDateTime } from '@/lib/format'
import { detectionsFileName, detectionsGeoJsonText } from '@/lib/geojson'

/** Downloads the detections as GeoJSON. The export module replaces this in a later task. */
function exportGeoJson(observation: Observation) {
  downloadTextFile(
    detectionsFileName(observation.id),
    detectionsGeoJsonText(observation),
    'application/geo+json',
  )
}

export function ObservationHeader({
  observation,
  actions = true,
}: {
  observation: Observation
  /** Off for failed and unfinished observations: there is nothing to open or export. */
  actions?: boolean
}) {
  const toast = useToast()
  const mapPath = `/map/${encodeURIComponent(observation.id)}`
  const count = observation.detections.length

  return (
    <header className="flex flex-col gap-3">
      <nav aria-label="Breadcrumb">
        <ol className="flex min-w-0 items-center gap-1 text-small text-ink-muted">
          <li>
            <Link to="/observations" className="rounded-[4px] hover:text-ink hover:underline">
              Observations
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5" />
          </li>
          <li className="min-w-0 truncate">
            <span aria-current="page" className="text-ink">
              {observation.region}
            </span>
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-title text-ink">{observation.region}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-small text-ink-muted">
            <span className="num">
              <span className="sr-only">Captured </span>
              {formatDateTime(observation.capturedAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <SourceIcon source={observation.source} className="size-4" />
              {SOURCE_LABELS[observation.source]}
            </span>
            <Badge tone={STATUS_TONES[observation.status]} dot>
              {STATUS_LABELS[observation.status]}
            </Badge>
            {isMockMode() ? <Badge tone="warning">Sample data</Badge> : null}
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center gap-2">
            <Link to={mapPath} className={buttonStyles({ variant: 'secondary' })}>
              <MapIcon aria-hidden />
              Open on map
            </Link>
            <DropdownMenu
              align="end"
              menuClassName="w-72"
              items={[
                {
                  id: 'geojson',
                  label: 'Detections as GeoJSON',
                  description:
                    count > 0
                      ? 'Outlines with area, confidence and density level, for GIS tools.'
                      : 'An empty collection: nothing was detected.',
                  icon: <Download aria-hidden />,
                  onSelect: () => {
                    exportGeoJson(observation)
                    toast.show({
                      title: 'GeoJSON downloaded',
                      description: detectionsFileName(observation.id),
                      tone: 'success',
                    })
                  },
                },
              ]}
              trigger={(props) => (
                <button type="button" {...props} className={buttonStyles({ variant: 'secondary' })}>
                  Export
                  <ChevronDown aria-hidden />
                </button>
              )}
            />
          </div>
        ) : null}
      </div>
    </header>
  )
}
