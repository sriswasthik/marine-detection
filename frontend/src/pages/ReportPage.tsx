import { CircleCheck, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Badge,
  Button,
  buttonStyles,
  Card,
  ErrorBoundary,
  MetricCard,
  PageSkeleton,
  SkeletonCard,
  SkeletonMetricCards,
  SkeletonPageHeader,
} from '@/components/ui'
import { DensitySummary } from '@/features/evidence/DensitySummary'
import { MapPreview } from '@/features/map'
import { isMockMode } from '@/features/observations/api'
import { ObservationNotices } from '@/features/observations/components/ObservationNotices'
import {
  LoadError,
  ObservationNotFound,
  ObservationStatusState,
} from '@/features/observations/components/ObservationStates'
import { useObservation } from '@/features/observations/hooks'
import { SOURCE_LABELS } from '@/features/observations/labels'
import { hasResult, isNotFound } from '@/features/observations/status'
import type { Observation } from '@/features/observations/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { analyzeObservation } from '@/lib/analysis'
import { formatArea, formatDateTime } from '@/lib/format'
import { observationKpis } from '@/lib/kpis'
import { PageContainer } from './PageHeader'

const REPORT_LAYERS = { detections: true, density: false, hotspots: true, footprint: true } as const

function ReportHeader({ observation }: { observation: Observation }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-caption font-medium tracking-wide text-ink-muted uppercase">
          Cleanup report
        </p>
        <h1 className="text-title text-ink">{observation.region}</h1>
        <p className="flex flex-wrap items-center gap-2 text-small text-ink-muted">
          <span className="num">{formatDateTime(observation.capturedAt)}</span>
          <span aria-hidden>·</span>
          <span>{SOURCE_LABELS[observation.source]}</span>
          {isMockMode() ? <Badge tone="warning">Sample data</Badge> : null}
        </p>
      </div>
      <div className="flex gap-2 print:hidden">
        <Link
          to={`/observations/${encodeURIComponent(observation.id)}`}
          className={buttonStyles({ variant: 'ghost' })}
        >
          Back to evidence
        </Link>
        <Button
          variant="secondary"
          iconStart={<Printer aria-hidden />}
          onClick={() => window.print()}
        >
          Print
        </Button>
      </div>
    </header>
  )
}

/** The report body: caveats, headline figures, the map and the ranked hotspots. */
function ReportBody({
  observation,
  partialData,
}: {
  observation: Observation
  partialData: boolean
}) {
  const analysis = useMemo(() => analyzeObservation(observation), [observation])
  const kpis = observationKpis(observation, analysis.hotspots)
  const noDebris = observation.detections.length === 0
  return (
    <>
      <ObservationNotices observation={observation} partialData={partialData} />
      {noDebris ? (
        // A clear result is a result: say so plainly, with what was checked.
        <Card>
          <p className="flex items-start gap-2 text-body text-ink">
            <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
            <span>
              <span className="font-medium">No debris detected.</span> The model checked{' '}
              {formatArea(observation.waterAreaM2)} of water in this image. No cleanup is needed for
              this area.
            </span>
          </p>
        </Card>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <MetricCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            footnote={kpi.footnote}
          />
        ))}
      </div>
      <ErrorBoundary label="The report map" className="h-80">
        <MapPreview
          observation={observation}
          analysis={analysis}
          visibleLayers={REPORT_LAYERS}
          className="h-80"
        />
      </ErrorBoundary>
      <ErrorBoundary label="The hotspot summary">
        <DensitySummary
          observation={observation}
          byLevel={analysis.stats.byLevel}
          hotspots={analysis.hotspots}
        />
      </ErrorBoundary>
    </>
  )
}

function ReportSkeleton() {
  return (
    <PageSkeleton label="Loading report" className="flex flex-col gap-6">
      <SkeletonPageHeader />
      <SkeletonMetricCards count={4} className="grid grid-cols-2 gap-3 lg:grid-cols-4" />
      <SkeletonCard title={false} lines={1} className="h-80" />
      <SkeletonCard lines={5} />
    </PageSkeleton>
  )
}

/** A printable summary of one observation for field teams. */
export function ReportPage() {
  const { id } = useParams()
  const query = useObservation(id)
  const observation = query.data?.data
  const notFound = query.isError && isNotFound(query.error)
  useDocumentTitle(
    observation
      ? `Cleanup report: ${observation.region}`
      : notFound
        ? 'Observation not found'
        : 'Cleanup report',
  )

  let body
  if (observation) {
    body = (
      <>
        <ReportHeader observation={observation} />
        {hasResult(observation) ? (
          <ReportBody
            observation={observation}
            partialData={(query.data?.issues.length ?? 0) > 0}
          />
        ) : (
          <ObservationStatusState observation={observation} />
        )}
      </>
    )
  } else if (notFound) {
    body = <ObservationNotFound id={id} />
  } else if (query.isError) {
    body = <LoadError error={query.error} onRetry={() => void query.refetch()} headingLevel={1} />
  } else {
    body = <ReportSkeleton />
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">{body}</div>
    </PageContainer>
  )
}
