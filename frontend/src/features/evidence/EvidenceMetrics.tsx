import { MetricCard, SegmentedControl } from '@/components/ui'
import type { Observation } from '@/features/observations/types'
import { AREA_UNIT_LABELS, AREA_UNITS } from '@/features/settings/preferences'
import { usePreferences } from '@/features/settings/usePreferences'
import { evidenceMetrics } from '@/lib/evidence'

const UNIT_OPTIONS = AREA_UNITS.map((unit) => ({ value: unit, label: AREA_UNIT_LABELS[unit] }))

/** The six measurements, with the area unit taken from (and saved to) the display preferences. */
export function EvidenceMetrics({
  observation,
  hotspotCount,
}: {
  observation: Observation
  hotspotCount: number
}) {
  const [preferences, setPreferences] = usePreferences()
  const metrics = evidenceMetrics(observation, hotspotCount, preferences.areaUnit)
  return (
    <section aria-labelledby="metrics-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="metrics-title" className="text-heading text-ink">
          Measurements
        </h2>
        <SegmentedControl
          label="Area unit"
          size="sm"
          options={UNIT_OPTIONS}
          value={preferences.areaUnit}
          onChange={(areaUnit) => setPreferences({ areaUnit })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            footnote={metric.footnote}
          />
        ))}
      </div>
    </section>
  )
}
