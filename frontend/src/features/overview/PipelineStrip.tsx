import { cn } from '@/lib/cn'

const STEPS: readonly { label: string; description: string }[] = [
  { label: 'Image', description: '11-band Sentinel-2 image' },
  { label: 'Preprocess', description: 'Bands, masks, water only' },
  { label: 'Detect', description: 'U-Net segmentation' },
  { label: 'Geolocate', description: 'Pixels to coordinates' },
  { label: 'Analyze', description: 'Area, density, hotspots' },
  { label: 'Map', description: 'Regions on the map' },
  { label: 'Act', description: 'Where to inspect next' },
]

/**
 * How it works, as one ruled line from image to action: numbered steps, no icons, no boxes. The
 * last step, Act, is in ink: it is where the product ends up.
 */
export function PipelineStrip({ className }: { className?: string }) {
  return (
    <ol
      aria-label="How it works"
      className={cn(
        'grid grid-cols-2 gap-x-6 gap-y-4 border-y border-hairline py-4 sm:grid-cols-4 lg:grid-cols-7',
        className,
      )}
    >
      {STEPS.map(({ label, description }, index) => {
        const last = index === STEPS.length - 1
        return (
          <li key={label} className="flex min-w-0 flex-col gap-1">
            <span className="data text-ink-2">{String(index + 1).padStart(2, '0')}</span>
            <span className={cn('text-small font-medium', last ? 'text-accent-ink' : 'text-tar')}>
              {label}
            </span>
            <span className="text-small text-ink-2">{description}</span>
          </li>
        )
      })}
    </ol>
  )
}
