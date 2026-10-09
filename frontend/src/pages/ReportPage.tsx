import { Printer } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ContextLine } from '@/app/shell/ContextLine'
import { NextStep } from '@/app/shell/NextStep'
import {
  Button,
  ObservationGlyph,
  PageSkeleton,
  SegmentedControl,
  Skeleton,
  SkeletonFigures,
  SkeletonMap,
  SkeletonPageHeader,
  SkeletonText,
} from '@/components/ui'
import { ReportSheet } from '@/features/export/ReportSheet'
import { isMockMode } from '@/features/observations/api'
import {
  LoadError,
  ObservationNotFound,
  ObservationStatusState,
} from '@/features/observations/components/ObservationStates'
import { useObservation } from '@/features/observations/hooks'
import { hasResult, isNotFound } from '@/features/observations/status'
import type { Observation } from '@/features/observations/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ENV } from '@/lib/env'
import { exportBaseName } from '@/lib/export/filename'
import { BASEMAP_ORDER, BASEMAPS, type BasemapId } from '@/lib/map/basemaps'

/** Enable printing anyway if some tiles never answer (offline, slow tile server). */
const TILE_WAIT_LIMIT_MS = 10_000

const BASEMAP_OPTIONS = BASEMAP_ORDER.map((id) => ({ value: id, label: BASEMAPS[id].label }))

function ReportSkeleton() {
  return (
    <PageSkeleton label="Loading report" className="mx-auto flex flex-col gap-4">
      <Skeleton className="h-8 w-80" />
      <div className="mwi-report-sheet theme-paper flex flex-col gap-4 border border-hairline">
        <SkeletonPageHeader />
        <SkeletonMap controls={false} className="h-[74mm]" />
        <SkeletonFigures count={6} className="grid grid-cols-3 gap-3" />
        <SkeletonText lines={6} />
      </div>
    </PageSkeleton>
  )
}

/** Toolbar, sheet and printing for an observation with results. */
function PrintableReport({
  observation,
  partialData,
}: {
  observation: Observation
  partialData: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [basemap, setBasemap] = useState<BasemapId>('light')
  const [loadedFor, setLoadedFor] = useState<BasemapId | null>(null)
  const [timedOutFor, setTimedOutFor] = useState<BasemapId | null>(null)
  const [generatedAt] = useState(() => new Date())
  const tilesLoaded = loadedFor === basemap
  const ready = tilesLoaded || timedOutFor === basemap

  const onMapReady = useCallback(() => setLoadedFor(basemap), [basemap])

  // Do not wait for ever: after the limit, allow printing and say the map may be incomplete.
  useEffect(() => {
    if (tilesLoaded) return
    const timer = window.setTimeout(() => setTimedOutFor(basemap), TILE_WAIT_LIMIT_MS)
    return () => window.clearTimeout(timer)
  }, [basemap, tilesLoaded])

  // The browser names a saved PDF after the document title.
  useEffect(() => {
    let previous = document.title
    const before = () => {
      previous = document.title
      document.title = exportBaseName(observation, 'report')
    }
    const after = () => {
      document.title = previous
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [observation])

  // Arriving from "Summary report (PDF)": open the print dialog once the map is ready.
  const wantsPrint = searchParams.get('print') === '1'
  const printed = useRef(false)
  useEffect(() => {
    if (!wantsPrint || !ready || printed.current) return
    printed.current = true
    setSearchParams({}, { replace: true })
    const timer = window.setTimeout(() => window.print(), 300)
    return () => window.clearTimeout(timer)
  }, [wantsPrint, ready, setSearchParams])

  return (
    <div className="flex flex-col items-center gap-6">
      <ContextLine
        region={observation.region}
        glyph={<ObservationGlyph observation={observation} size={16} />}
        className="mwi-report-screen-only w-full"
        action={
          <Button
            variant="secondary"
            size="sm"
            iconStart={<Printer aria-hidden />}
            loading={!ready}
            disabled={!ready}
            onClick={() => window.print()}
          >
            Print or save as PDF
          </Button>
        }
      />
      <div className="mwi-report-screen-only flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Report basemap"
          size="sm"
          options={BASEMAP_OPTIONS}
          value={basemap}
          onChange={setBasemap}
        />
        <p className="text-small text-ink-2" aria-live="polite">
          {!ready
            ? 'Waiting for the map tiles to finish loading.'
            : tilesLoaded
              ? 'Ready. Choose "Save as PDF" in the print dialog for a PDF file.'
              : 'Some map tiles did not load, so the map may be incomplete. You can still print.'}
        </p>
      </div>
      <div
        // Scrolls sideways on narrow screens; focusable so the keyboard can scroll it too.
        tabIndex={0}
        role="region"
        aria-label="Report sheet"
        className="w-full overflow-x-auto pb-2 print:overflow-visible print:pb-0"
      >
        <div className="mx-auto w-fit">
          <ReportSheet
            observation={observation}
            partialData={partialData}
            basemap={basemap}
            sampleData={isMockMode()}
            generatedAt={generatedAt}
            appName={ENV.appName}
            onMapReady={onMapReady}
          />
        </div>
      </div>
      <NextStep
        page="report"
        observationId={observation.id}
        className="mwi-report-screen-only w-full max-w-[210mm]"
      />
    </div>
  )
}

/** A printable one-page A4 summary of one observation for field teams. */
export function ReportPage() {
  const { id } = useParams()
  const query = useObservation(id)
  const observation = query.data?.data
  const notFound = query.isError && isNotFound(query.error)
  useDocumentTitle(
    observation ? `Report: ${observation.region}` : notFound ? 'Observation not found' : 'Report',
  )

  let body
  if (observation) {
    body = hasResult(observation) ? (
      <PrintableReport
        key={observation.id}
        observation={observation}
        partialData={(query.data?.issues.length ?? 0) > 0}
      />
    ) : (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="text-page text-ink">Report: {observation.region}</h1>
        <ObservationStatusState observation={observation} />
      </div>
    )
  } else if (notFound) {
    body = <ObservationNotFound id={id} />
  } else if (query.isError) {
    body = <LoadError error={query.error} onRetry={() => void query.refetch()} headingLevel={1} />
  } else {
    body = <ReportSkeleton />
  }

  return (
    <div className="mwi-report-page mx-auto w-full max-w-page px-4 pt-2 pb-12 sm:px-6 lg:px-8">
      {body}
    </div>
  )
}
