import { Flag } from 'lucide-react'
import { ConfidenceTag, SeverityTag } from '@/components/ui'
import type { Detection } from '@/features/observations/types'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatConfidence, formatInteger, shortId } from '@/lib/format'
import { HOTSPOT_LEVEL_WEIGHTS, PRIORITY_SCORE_RULE, type Hotspot } from '@/lib/hotspots'
import { Fact, Section } from './DetectionDetails'
import { useFormat } from '@/features/settings/settingsContext'

export interface HotspotDetailsProps {
  hotspot: Hotspot
  hotspotCount: number
  detections: readonly Detection[]
  onSelectDetection: (id: string) => void
}

/** Hotspot variant of the drawer: why it ranks where it does and what is in it. */
export function HotspotDetails({
  hotspot,
  hotspotCount,
  detections,
  onSelectDetection,
}: HotspotDetailsProps) {
  const fmt = useFormat()
  const members = detections
    .filter((d) => hotspot.detectionIds.includes(d.id))
    .sort((a, b) => b.areaM2 - a.areaM2)
  const weight = HOTSPOT_LEVEL_WEIGHTS[hotspot.level]

  return (
    <div className="flex flex-col gap-5">
      {hotspot.level === 'critical' ? (
        <div className="flex items-start gap-3 border-l-2 border-critical py-1 pl-3 text-small text-ink">
          <Flag aria-hidden className="mt-1 size-4 shrink-0 text-critical" />
          <span>
            <span className="font-medium">Priority for inspection.</span> Critical density: send a
            team or a drone pass here first.
          </span>
        </div>
      ) : null}

      <Section title="Key facts">
        <dl className="flex flex-col gap-3">
          <Fact label="Rank">
            <span className="num font-medium">
              {hotspot.rank} of {formatInteger(hotspotCount)}
            </span>
          </Fact>
          <Fact label="Density level">
            <span className="flex flex-col items-start gap-1">
              <SeverityTag level={hotspot.level} />
              <span className="text-small text-ink-2">{DENSITY_LEVELS[hotspot.level].meaning}</span>
            </span>
          </Fact>
          <Fact label="Total area">
            <span className="num">{fmt.area(hotspot.totalAreaM2)}</span>
          </Fact>
          <Fact label="Detections">
            <span className="num">{formatInteger(members.length)}</span>
          </Fact>
          <Fact label="Mean confidence">
            <span className="num">{formatConfidence(hotspot.meanConfidence)}</span>
          </Fact>
          <Fact label="Centre">
            <span className="data">{fmt.coordinates(hotspot.centroid)}</span>
          </Fact>
        </dl>
      </Section>

      <Section title="Priority score">
        <p className="num text-page text-ink">{formatInteger(hotspot.priorityScore)}</p>
        <p className="data border-l-2 border-rule py-1 pl-3 text-ink">
          {formatInteger(hotspot.totalAreaM2)} m² × {hotspot.meanConfidence.toFixed(2)} confidence ×{' '}
          {weight} ({DENSITY_LEVELS[hotspot.level].label} weight)
        </p>
        <p className="text-small text-ink-2">{PRIORITY_SCORE_RULE}</p>
      </Section>

      <Section title="Detections in this hotspot">
        {members.length === 0 ? (
          <p className="text-small text-ink-2">No detections match the current filters.</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {members.map((detection) => (
              <li key={detection.id}>
                <button
                  type="button"
                  onClick={() => onSelectDetection(detection.id)}
                  className="flex w-full items-center gap-2 px-2 py-2 text-left text-small hover:bg-ink/5"
                >
                  <span className="data w-12 shrink-0 text-ink">{shortId(detection.id)}</span>
                  <SeverityTag level={detection.densityLevel} variant="plain" />
                  <span className="data flex-1 text-right text-ink">
                    {fmt.area(detection.areaM2)}
                  </span>
                  <ConfidenceTag value={detection.confidence} showValue={false} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-small text-ink-2">
          A detection belongs to the hotspot when any part of it lies inside the hotspot cells.
        </p>
      </Section>
    </div>
  )
}
