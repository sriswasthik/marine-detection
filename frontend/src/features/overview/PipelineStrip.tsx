import {
  Crosshair,
  Flag,
  Image,
  LayoutGrid,
  Map as MapIcon,
  ScanSearch,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const STEPS: readonly { label: string; Icon: LucideIcon; description: string }[] = [
  { label: 'Image', Icon: Image, description: 'Satellite or drone image' },
  { label: 'Preprocess', Icon: SlidersHorizontal, description: 'Bands, masks, water only' },
  { label: 'Detect', Icon: ScanSearch, description: 'UNet++ segmentation' },
  { label: 'Geolocate', Icon: Crosshair, description: 'Pixels to coordinates' },
  { label: 'Analyze', Icon: LayoutGrid, description: 'Area, density, hotspots' },
  { label: 'Map', Icon: MapIcon, description: 'Regions on the map' },
  { label: 'Act', Icon: Flag, description: 'Where to inspect next' },
]

/** A quiet legend of the system, from image to action. Static; not an animation. */
export function PipelineStrip({ className }: { className?: string }) {
  return (
    <ol
      aria-label="How it works"
      className={cn('grid grid-cols-4 gap-x-2 gap-y-5 sm:flex sm:items-start', className)}
    >
      {STEPS.map(({ label, Icon, description }, index) => (
        <li key={label} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
          {index < STEPS.length - 1 ? (
            <span
              aria-hidden
              className="absolute top-4 right-[calc(-50%+1.25rem)] left-[calc(50%+1.25rem)] hidden h-px bg-border-strong sm:block"
            />
          ) : null}
          <span
            aria-hidden
            className={cn(
              'flex size-8 items-center justify-center rounded-full border bg-surface [&_svg]:size-4',
              index === STEPS.length - 1
                ? 'border-accent text-accent'
                : 'border-border-strong text-ink-muted',
            )}
          >
            <Icon strokeWidth={1.75} />
          </span>
          <span className="mt-2 text-caption font-medium text-ink">{label}</span>
          <span className="mt-0.5 hidden text-caption text-ink-muted lg:block">{description}</span>
        </li>
      ))}
    </ol>
  )
}
