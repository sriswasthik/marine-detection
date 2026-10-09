import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui'
import { JOB_STEPS, type JobStep } from '@/features/observations/api/types'
import { cn } from '@/lib/cn'
import { PIPELINE_STEP_COPY } from '@/lib/config'
import { formatDuration, formatElapsed } from '@/lib/format'
import type { StepStatus } from './runReducer'

const STATUS_WORD: Record<StepStatus, string> = {
  pending: 'Waiting',
  active: 'In progress',
  done: 'Done',
  failed: 'Failed',
}

function Marker({ status, index }: { status: StepStatus; index: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        'data relative z-10 flex size-7 shrink-0 items-center justify-center border font-medium',
        'transition-colors duration-[120ms] ease-out',
        status === 'done' && 'border-ink bg-ink text-white',
        status === 'active' && 'border-accent-ink bg-accent-wash text-accent-ink',
        status === 'failed' && 'border-danger bg-danger-soft text-danger',
        status === 'pending' && 'border-rule bg-paper text-ink-2',
      )}
    >
      {status === 'done' ? (
        <Check className="size-4" strokeWidth={2.5} />
      ) : status === 'failed' ? (
        <X className="size-4" strokeWidth={2.5} />
      ) : (
        index + 1
      )}
    </span>
  )
}

function Bar({ percent }: { percent: number | null }) {
  return (
    <span aria-hidden className="mt-2 block h-px w-full max-w-xs overflow-hidden bg-rule">
      {percent === null ? (
        <span className="block h-full w-2/5 bg-tar animate-[indeterminate_1.4s_ease-in-out_infinite]" />
      ) : (
        // Full-width bar slid in from the left: a translate, not a width change.
        <span
          className="block h-full w-full bg-tar transition-transform duration-150 ease-out"
          style={{ transform: `translateX(${percent - 100}%)` }}
        />
      )}
    </span>
  )
}

export interface ProcessingStepperProps {
  statuses: Readonly<Record<JobStep, StepStatus>>
  /** Upload percentage while step 1 is active. */
  uploadPercent?: number | null
  elapsedMs?: number | null
  onCancel?: () => void
  /** Line under the failed step, for example the failure title. */
  failureNote?: ReactNode
  title?: string
  className?: string
}

/**
 * Upload, Preprocess, Detect, Map: each with its state, a one-line description from config, a
 * thin progress bar while active, elapsed time and Cancel. Step changes are announced politely.
 */
export function ProcessingStepper({
  statuses,
  uploadPercent = null,
  elapsedMs = null,
  onCancel,
  failureNote,
  title = 'Running detection',
  className,
}: ProcessingStepperProps) {
  const activeIndex = JOB_STEPS.findIndex((s) => statuses[s] === 'active')
  const failedIndex = JOB_STEPS.findIndex((s) => statuses[s] === 'failed')
  const allDone = JOB_STEPS.every((s) => statuses[s] === 'done')
  const active = JOB_STEPS[activeIndex]
  const failed = JOB_STEPS[failedIndex]

  const announcement = allDone
    ? 'All four steps are done.'
    : failed
      ? `${PIPELINE_STEP_COPY[failed].label} failed.`
      : active
        ? `Step ${activeIndex + 1} of 4: ${PIPELINE_STEP_COPY[active].label}. ${PIPELINE_STEP_COPY[active].description}.`
        : ''

  return (
    <section aria-labelledby="stepper-title" className={cn('flex flex-col gap-5', className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="stepper-title" className="text-lead font-medium text-ink">
            {allDone ? 'Detection complete' : failed ? 'Detection stopped' : title}
          </h2>
          {elapsedMs !== null ? (
            <p className="num text-small text-ink-2">
              <span className="sr-only">Elapsed time: </span>
              {allDone || failed ? formatDuration(elapsedMs) : formatElapsed(elapsedMs)}
            </p>
          ) : null}
        </div>
        {onCancel && !allDone && !failed ? (
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite" role="status">
        {announcement}
      </p>

      <ol className="flex flex-col">
        {JOB_STEPS.map((step, index) => {
          const status = statuses[step]
          const copy = PIPELINE_STEP_COPY[step]
          const last = index === JOB_STEPS.length - 1
          return (
            <li
              key={step}
              aria-current={status === 'active' ? 'step' : undefined}
              className="relative flex gap-4 pb-6 last:pb-0"
            >
              {last ? null : (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-7 bottom-0 left-[13.5px] w-px transition-colors duration-150 ease-out',
                    status === 'done' ? 'bg-ink' : 'bg-hairline',
                  )}
                />
              )}
              <Marker status={status} index={index} />
              <div className="min-w-0 flex-1 pt-1">
                <p className="flex flex-wrap items-baseline gap-x-3 text-small">
                  <span
                    className={cn('font-medium', status === 'pending' ? 'text-ink-2' : 'text-ink')}
                  >
                    {copy.label}
                  </span>
                  <span
                    className={cn('text-small', status === 'failed' ? 'text-danger' : 'text-ink-2')}
                  >
                    {step === 'upload' && status === 'active' && uploadPercent !== null
                      ? `${uploadPercent}%`
                      : STATUS_WORD[status]}
                  </span>
                </p>
                <p className="text-small text-ink-2">{copy.description}</p>
                {status === 'active' ? (
                  <Bar percent={step === 'upload' ? uploadPercent : null} />
                ) : null}
                {status === 'failed' && failureNote ? (
                  <p className="mt-1 text-small text-danger">{failureNote}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
