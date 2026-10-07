import { ChevronsLeftRight } from 'lucide-react'
import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { formatInteger } from '@/lib/format'
import {
  clampSwipe,
  SWIPE_DEFAULT,
  swipeClipPath,
  swipeFromKey,
  swipeFromPointer,
} from '@/lib/swipe'

function SideLabel({ children, side }: { children: ReactNode; side: 'left' | 'right' }) {
  return (
    <span
      className={`pointer-events-none absolute top-3 z-[520] rounded-badge border border-border bg-surface/95 px-2 py-0.5 text-caption font-medium text-ink shadow-subtle ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
    >
      {children}
    </span>
  )
}

/**
 * Two identical fitted views stacked: `after` underneath, `before` on top clipped at the divider.
 * The divider is a slider: drag it, or focus it and use the arrow keys (Shift for bigger steps),
 * Page Up / Page Down, Home and End. Neither view pans, so they always line up.
 */
export function SwipeCompare({
  before,
  after,
  beforeLabel,
  afterLabel,
  initial = SWIPE_DEFAULT,
}: {
  before: ReactNode
  after: ReactNode
  beforeLabel: string
  afterLabel: string
  initial?: number
}) {
  const [position, setPosition] = useState(() => clampSwipe(initial))
  const frameRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)

  const moveTo = (clientX: number) => {
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    setPosition(swipeFromPointer(clientX, { left: rect.left, width: rect.width }))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    handleRef.current?.focus({ preventScroll: true })
    moveTo(event.clientX)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) moveTo(event.clientX)
  }
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = swipeFromKey(event.key, position, { large: event.shiftKey })
    if (next === null) return
    event.preventDefault()
    setPosition(next)
  }

  const shown = Math.round(position)

  return (
    <div ref={frameRef} className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">{after}</div>
      <div className="absolute inset-0" style={{ clipPath: swipeClipPath(position) }}>
        {before}
      </div>
      <SideLabel side="left">{beforeLabel}</SideLabel>
      <SideLabel side="right">{afterLabel}</SideLabel>

      {/* Wide, invisible hit area around the line; the handle inside carries the slider role. */}
      <div
        className="absolute inset-y-0 z-[510] flex w-8 -translate-x-1/2 cursor-ew-resize touch-none justify-center"
        style={{ left: `${position}%` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span
          aria-hidden
          className="h-full w-0.5 bg-surface shadow-[0_0_0_1px_rgba(24,33,43,0.25)]"
        />
        <div
          ref={handleRef}
          role="slider"
          tabIndex={0}
          aria-label="Compare divider"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={shown}
          aria-valuetext={`${formatInteger(shown)}% ${beforeLabel.toLowerCase()}, ${formatInteger(100 - shown)}% ${afterLabel.toLowerCase()}`}
          onKeyDown={onKeyDown}
          className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-surface text-ink shadow-popover outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <ChevronsLeftRight aria-hidden className="size-4" />
        </div>
      </div>
    </div>
  )
}
