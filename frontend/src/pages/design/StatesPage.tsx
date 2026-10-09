import { useState, type ReactNode } from 'react'
import { OfflineBanner } from '@/app/shell/OfflineBanner'
import {
  Banner,
  Button,
  EmptyState,
  ErrorBoundary,
  ErrorState,
  PageSkeleton,
  SkeletonSection,
  SkeletonMap,
  SkeletonFigures,
  SkeletonPageHeader,
  SkeletonTable,
  useToast,
  type ToastTone,
} from '@/components/ui'
import { FailurePanel, SuccessPanel } from '@/features/analyze/RunOutcome'
import { ProcessingStepper } from '@/features/analyze/ProcessingStepper'
import { failureFromAppError } from '@/features/analyze/runReducer'
import { DetailSkeleton } from '@/features/evidence/DetailSkeleton'
import { MapPreview } from '@/features/map'
import { NoDebrisCard } from '@/features/map/monitoring/NoDebrisCard'
import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import { ObservationNotices } from '@/features/observations/components/ObservationNotices'
import {
  NoObservations,
  ObservationNotFound,
  ObservationStatusState,
} from '@/features/observations/components/ObservationStates'
import type { Observation } from '@/features/observations/types'
import {
  LatestObservationSkeleton,
  RecentObservationsSkeleton,
} from '@/features/overview/OverviewSkeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { createAppError } from '@/lib/errors/appError'
import { APP_ERROR_CODES } from '@/lib/errors/errorCopy'
import { observationNotices } from '@/lib/warnings'

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-hairline py-8">
      <h2 id={id} className="text-lead font-medium text-ink">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** One labelled specimen on a white panel. */
function Specimen({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <figure className={className}>
      <figcaption className="mb-2 text-small font-medium text-ink-2">{label}</figcaption>
      <div className="border-t border-rule pt-4">{children}</div>
    </figure>
  )
}

function sample(id: string): Observation {
  const observation = getSampleObservation(id)
  if (!observation) throw new Error(`Sample ${id} missing`)
  return observation
}

/** Throws while `broken` is true, to show the panel boundary. */
function Fragile({ broken }: { broken: boolean }) {
  if (broken) throw new Error('Deliberate render failure for the states page')
  return <p className="text-small text-ink">This panel renders normally.</p>
}

function BoundaryDemo() {
  const [broken, setBroken] = useState(true)
  return (
    <div className="flex flex-col gap-3">
      <ErrorBoundary label="The demo panel" resetKeys={[broken]}>
        <Fragile broken={broken} />
      </ErrorBoundary>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setBroken(!broken)}
      >
        {broken ? 'Fix the panel' : 'Break the panel'}
      </Button>
    </div>
  )
}

function ToastDemo() {
  const toast = useToast()
  const tones: ToastTone[] = ['info', 'success', 'warning', 'danger']
  return (
    <div className="flex flex-wrap gap-2">
      {tones.map((tone) => (
        <Button
          key={tone}
          variant="secondary"
          size="sm"
          onClick={() =>
            toast.show({
              tone,
              title: `${tone[0]?.toUpperCase()}${tone.slice(1)} toast`,
              description: 'Short supporting line.',
            })
          }
        >
          Show {tone}
        </Button>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.show({
            title: 'Analysis cancelled',
            description: 'Your file and details are kept.',
            action: { label: 'Undo', onClick: () => undefined },
          })
        }
      >
        Show with action
      </Button>
    </div>
  )
}

const ALL_PENDING = {
  upload: 'pending',
  preprocess: 'pending',
  detect: 'pending',
  map: 'pending',
} as const

/**
 * Dev-only review page: every state variant of every shared component, side by side.
 * Production builds leave this route out.
 */
export function StatesPage() {
  useDocumentTitle('States')
  const hero = sample(SAMPLE_IDS.ennore)
  const lowConfidence = sample(SAMPLE_IDS.visakhapatnam)
  const approximate = sample(SAMPLE_IDS.sundarbans)
  const clear = sample(SAMPLE_IDS.mannar)
  const coarse: Observation = { ...hero, warnings: ['LOW_RESOLUTION'] }
  const noop = () => undefined

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1 pb-6">
        <p className="data text-ink-2">/design/states · development only</p>
        <h1 className="text-title text-ink">UI states</h1>
        <p className="max-w-prose text-body text-ink-2">
          Every state of every shared component. The copy comes from the same files the app uses, so
          what you review here is what people see.
        </p>
      </header>

      <Section id="errors" title="ErrorState: every error code">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {APP_ERROR_CODES.map((code) => (
            <Specimen key={code} label={code}>
              <ErrorState
                size="sm"
                headingLevel={3}
                error={createAppError(code, { retry: noop })}
              />
            </Specimen>
          ))}
        </div>
      </Section>

      <Section id="empty" title="Empty and status states">
        <div className="grid gap-4 md:grid-cols-2">
          <Specimen label="EmptyState, md, with action">
            <EmptyState
              title="Nothing here yet"
              description="Explains why it is empty and what to do next."
              action={<Button variant="primary">Primary action</Button>}
            />
          </Specimen>
          <Specimen label="EmptyState, sm, no action">
            <EmptyState size="sm" title="No matches" description="Widen the filters to see more." />
          </Specimen>
          <Specimen label="No observations (Overview, list)">
            <NoObservations />
          </Specimen>
          <Specimen label="Observation not found">
            <ObservationNotFound id="obs-missing" headingLevel={3} />
          </Specimen>
          <Specimen label="Processing failed">
            <ObservationStatusState observation={{ status: 'failed' }} headingLevel={3} />
          </Specimen>
          <Specimen label="Still processing / queued">
            <div className="flex flex-col gap-3">
              <ObservationStatusState observation={{ status: 'processing' }} headingLevel={3} />
              <ObservationStatusState observation={{ status: 'queued' }} headingLevel={3} />
            </div>
          </Specimen>
          <Specimen label="No debris detected">
            <div className="flex justify-center bg-map-fallback p-4">
              <NoDebrisCard observation={clear} />
            </div>
          </Specimen>
        </div>
      </Section>

      <Section id="banners" title="Banner">
        <div className="flex flex-col gap-3">
          <Banner tone="info" title="Info">
            Neutral information about this page.
          </Banner>
          <Banner tone="warning" title="Warning">
            Something affects how to read the result.
          </Banner>
          <Banner tone="danger" title="Danger">
            Something failed and needs action.
          </Banner>
          <Banner
            tone="warning"
            title="With an action"
            action={
              <Button variant="secondary" size="sm">
                Fix it
              </Button>
            }
          >
            The action sits on the right.
          </Banner>
          <Banner tone="info" title="Dismissible" onDismiss={noop}>
            Can be closed.
          </Banner>
          <Specimen label="Offline bar (variant bar, under the top bar)">
            <div className="-m-4">
              <OfflineBanner preview />
            </div>
          </Specimen>
        </div>
      </Section>

      <Section id="notices" title="Observation notices (low confidence, partial, caveats)">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: 'Hero scene: no notices', observation: hero, partialData: false },
            { label: 'Low confidence and cloud', observation: lowConfidence, partialData: false },
            {
              label: 'Partial success: approximate positions',
              observation: approximate,
              partialData: false,
            },
            { label: 'Partial data (dropped detections)', observation: hero, partialData: true },
            { label: 'Coarse resolution', observation: coarse, partialData: false },
          ].map(({ label, observation, partialData }) => (
            <Specimen key={label} label={label}>
              {observationNotices(observation, { partialData }).length > 0 ? (
                <ObservationNotices observation={observation} partialData={partialData} />
              ) : (
                <p className="text-small text-ink-2">Nothing to show: no banner renders.</p>
              )}
            </Specimen>
          ))}
          <Specimen label="Low-confidence detections: dashed and lighter">
            <MapPreview observation={lowConfidence} className="h-56" />
          </Specimen>
        </div>
      </Section>

      <Section id="skeletons" title="Skeletons">
        <div className="grid gap-4 md:grid-cols-2">
          <Specimen label="Page header">
            <SkeletonPageHeader breadcrumb />
          </Specimen>
          <Specimen label="Card">
            <SkeletonSection lines={4} />
          </Specimen>
          <Specimen label="Metric cards">
            <SkeletonFigures count={3} className="grid grid-cols-3 gap-3" />
          </Specimen>
          <Specimen label="Table">
            <SkeletonTable rows={5} />
          </Specimen>
          <Specimen label="Map" className="md:col-span-2">
            <SkeletonMap className="h-64" />
          </Specimen>
          <Specimen label="Overview page" className="md:col-span-2">
            <PageSkeleton label="Loading overview" className="flex flex-col gap-10">
              <LatestObservationSkeleton />
              <RecentObservationsSkeleton />
            </PageSkeleton>
          </Specimen>
          <Specimen label="Observation detail page" className="md:col-span-2">
            <DetailSkeleton />
          </Specimen>
        </div>
      </Section>

      <Section id="analysis" title="Analysis run: uploading, processing, success, failures">
        <div className="grid gap-4 md:grid-cols-2">
          <Specimen label="Uploading">
            <ProcessingStepper
              statuses={{ ...ALL_PENDING, upload: 'active' }}
              uploadPercent={46}
              elapsedMs={800}
              onCancel={noop}
            />
          </Specimen>
          <Specimen label="Processing (detect)">
            <ProcessingStepper
              statuses={{ ...ALL_PENDING, upload: 'done', preprocess: 'done', detect: 'active' }}
              elapsedMs={3200}
              onCancel={noop}
            />
          </Specimen>
          <Specimen label="Success, with result caveats">
            <SuccessPanel
              summary={{
                detectionCount: lowConfidence.detections.length,
                hotspotCount: 2,
                notices: observationNotices(lowConfidence, { only: ['low-confidence'] }),
              }}
              onViewResults={noop}
              onAnalyzeAnother={noop}
            />
          </Specimen>
          <Specimen label="Success, no debris">
            <SuccessPanel
              summary={{ detectionCount: 0, hotspotCount: 0, notices: [] }}
              onViewResults={noop}
              onAnalyzeAnother={noop}
            />
          </Specimen>
          <Specimen label="Model failure: retry keeps the file and details">
            <FailurePanel
              failure={failureFromAppError(createAppError('MODEL_FAILED'))}
              onRetry={noop}
              onEdit={noop}
            />
          </Specimen>
          <Specimen label="Offline: retry blocked until reconnected">
            <FailurePanel
              failure={failureFromAppError(createAppError('OFFLINE'))}
              onRetry={noop}
              onEdit={noop}
              retryBlockedReason="You're offline. Reconnect to run detection."
            />
          </Specimen>
          <Specimen label="Invalid image" className="md:col-span-2">
            <Banner
              tone="danger"
              title={createAppError('INVALID_IMAGE').title}
              action={
                <Button variant="secondary" size="sm">
                  Choose another file
                </Button>
              }
            >
              {createAppError('INVALID_IMAGE').message}
            </Banner>
          </Specimen>
        </div>
      </Section>

      <Section id="boundaries" title="Error boundary and toasts">
        <div className="grid gap-4 md:grid-cols-2">
          <Specimen label="Panel boundary: one panel fails, the page keeps working">
            <BoundaryDemo />
          </Specimen>
          <Specimen label="Toasts">
            <ToastDemo />
          </Specimen>
        </div>
      </Section>
    </div>
  )
}
