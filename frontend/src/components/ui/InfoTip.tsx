import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'

/** A small info icon that explains a term in a tooltip. Keyboard focusable, named "About …". */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip content={children} side="top">
      <button
        type="button"
        aria-label={`About ${label.toLowerCase()}`}
        className="hit-area -my-1 inline-flex size-5 items-center justify-center rounded-control align-middle text-ink-2 hover:text-ink"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
    </Tooltip>
  )
}
