import { CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { SectionLabel } from '@/components/ui'
import type { ProcessingInfo } from '@/features/observations/types'
import { modelRunFacts, stageTimesText } from '@/lib/analysisReport'
import { formatDuration } from '@/lib/format'

function StatusLine({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <CircleCheck aria-hidden className="mt-1 size-4 shrink-0 text-success" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-small font-medium text-ink">{title}</p>
        <p className="text-small text-ink-2">{children}</p>
      </div>
    </li>
  )
}

/** The model run as the service recorded it: which model loaded, and how long prediction took. */
export function ModelRunSection({ processing }: { processing: ProcessingInfo }) {
  const facts = modelRunFacts(processing)
  return (
    <section aria-labelledby="model-run-title" className="flex flex-col gap-3">
      <SectionLabel id="model-run-title">Model run</SectionLabel>
      <ul className="flex flex-col divide-y divide-hairline border-y border-hairline">
        <StatusLine title="Model loaded successfully">{facts.model}</StatusLine>
        <StatusLine title="Prediction complete">
          {facts.totalMs !== null ? `Finished in ${formatDuration(facts.totalMs)}` : 'Finished'}
          {facts.stages.length > 0 ? `: ${stageTimesText(facts.stages)}` : ''}
        </StatusLine>
      </ul>
    </section>
  )
}
