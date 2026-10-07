import { useCallback, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Card, ErrorBoundary } from '@/components/ui'
import { DensitySummary } from '@/features/evidence/DensitySummary'
import { DetailSkeleton } from '@/features/evidence/DetailSkeleton'
import { DetectionsTable } from '@/features/evidence/DetectionsTable'
import { EvidenceMetrics } from '@/features/evidence/EvidenceMetrics'
import { EvidenceViewer } from '@/features/evidence/EvidenceViewer'
import { DEFAULT_EVIDENCE_MODE, type EvidenceMode } from '@/features/evidence/modes'
import { ExtentCard, ModelQualityCard, ProvenanceCard } from '@/features/evidence/ObservationFacts'
import { ObservationHeader } from '@/features/evidence/ObservationHeader'
import { TraceabilityStrip } from '@/features/evidence/TraceabilityStrip'
import { isMockMode } from '@/features/observations/api'
import { ObservationNotices } from '@/features/observations/components/ObservationNotices'
import {
  LoadError,
  ObservationNotFound,
  ObservationStatusState,
} from '@/features/observations/components/ObservationStates'
import { useObservation } from '@/features/observations/hooks'
import { hasResult, isNotFound } from '@/features/observations/status'
import type { Observation } from '@/features/observations/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { analyzeObservation } from '@/lib/analysis'
import { detectionFromParam, evidenceSource } from '@/lib/evidence'

export const DETECTION_PARAM = 'detection'

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** The full evidence page for one completed (or partial) observation. */
function ObservationDetail({
  observation,
  partialData,
}: {
  observation: Observation
  partialData: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  // ?detection=<id> (from "View evidence" on the map) opens focused on that detection.
  const selectedId = detectionFromParam(observation.detections, searchParams.get(DETECTION_PARAM))
  const [mode, setMode] = useState<EvidenceMode>(() =>
    selectedId ? 'geographic' : DEFAULT_EVIDENCE_MODE,
  )
  const [focusRequest, setFocusRequest] = useState(() =>
    selectedId ? { detectionId: selectedId, key: 1 } : null,
  )
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const viewerRef = useRef<HTMLDivElement | null>(null)

  const analysis = useMemo(() => analyzeObservation(observation), [observation])
  const source = useMemo(
    () => evidenceSource(observation, { sampleData: isMockMode() }),
    [observation],
  )
  const hasDebris = observation.detections.length > 0

  const select = useCallback(
    (id: string | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (id) next.set(DETECTION_PARAM, id)
          else next.delete(DETECTION_PARAM)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  /** From the table: select, switch to the geographic view and zoom to the detection. */
  const focus = (id: string) => {
    select(id)
    setMode('geographic')
    setFocusRequest((current) => ({ detectionId: id, key: (current?.key ?? 0) + 1 }))
    viewerRef.current?.scrollIntoView?.({
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <ObservationHeader
        observation={observation}
        exportSource={{
          observation,
          detections: observation.detections,
          analysis,
          filters: null,
        }}
      />
      <ObservationNotices observation={observation} partialData={partialData} />

      <div ref={viewerRef} className="scroll-mt-20">
        <ErrorBoundary label="The evidence viewer" className="h-[380px] md:h-[520px]">
          <EvidenceViewer
            observation={observation}
            analysis={analysis}
            source={source}
            mode={mode}
            onModeChange={setMode}
            selectedId={selectedId}
            onSelect={select}
            highlightedId={highlightedId}
            focusRequest={focusRequest}
          />
        </ErrorBoundary>
      </div>
      <ErrorBoundary label="The traceability strip" className="h-28">
        <TraceabilityStrip
          source={source}
          detections={observation.detections}
          mode={mode}
          onModeChange={setMode}
        />
      </ErrorBoundary>

      <ErrorBoundary label="The measurements">
        <EvidenceMetrics observation={observation} hotspotCount={analysis.hotspots.length} />
      </ErrorBoundary>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <ErrorBoundary label="The density summary">
            <DensitySummary
              observation={observation}
              byLevel={analysis.stats.byLevel}
              hotspots={analysis.hotspots}
            />
          </ErrorBoundary>
          {hasDebris ? (
            <ErrorBoundary label="The detections table">
              <DetectionsTable
                detections={observation.detections}
                selectedId={selectedId}
                onHighlight={setHighlightedId}
                onFocus={focus}
              />
            </ErrorBoundary>
          ) : (
            <Card title="Detections" headingLevel={2}>
              <p className="text-small text-ink-muted">
                The model checked the whole image and outlined no debris, so there is nothing to
                list.
              </p>
            </Card>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <ErrorBoundary label="The geographic extent">
            <ExtentCard observation={observation} analysis={analysis} />
          </ErrorBoundary>
          <ErrorBoundary label="Provenance">
            <ProvenanceCard observation={observation} />
          </ErrorBoundary>
          <ErrorBoundary label="Model quality">
            <ModelQualityCard observation={observation} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

/** Failed, queued or still processing: the header, what is going on, and provenance if any. */
function ObservationWithoutResult({ observation }: { observation: Observation }) {
  return (
    <div className="flex flex-col gap-6">
      <ObservationHeader observation={observation} actions={false} />
      <ObservationStatusState observation={observation} />
      {observation.status === 'failed' ? <ProvenanceCard observation={observation} /> : null}
    </div>
  )
}

/** Observation detail: evidence first, then measurements, density, detections and provenance. */
export function ObservationDetailPage() {
  const { id } = useParams()
  const query = useObservation(id)
  const observation = query.data?.data
  const notFound = query.isError && isNotFound(query.error)
  useDocumentTitle(
    observation ? observation.region : notFound ? 'Observation not found' : 'Observation',
  )

  let body
  if (observation) {
    if (!hasResult(observation)) {
      body = <ObservationWithoutResult observation={observation} />
    } else {
      body = (
        <ObservationDetail
          key={observation.id}
          observation={observation}
          partialData={(query.data?.issues.length ?? 0) > 0}
        />
      )
    }
  } else if (notFound) {
    body = <ObservationNotFound id={id} />
  } else if (query.isError) {
    body = <LoadError error={query.error} onRetry={() => void query.refetch()} headingLevel={1} />
  } else {
    body = <DetailSkeleton />
  }

  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{body}</div>
}
