import { Measure, SectionLabel, SegmentedControl } from '@/components/ui'
import type { Observation } from '@/features/observations/types'
import { useSettings, useUpdateSettings } from '@/features/settings/settingsContext'
import { KPI_CELL_3, KPI_ROW_3 } from '@/features/overview/kpiLayout'
import { AREA_UNIT_LABELS, AREA_UNITS } from '@/lib/settings'
import { evidenceMetrics } from '@/lib/evidence'

const UNIT_OPTIONS = AREA_UNITS.map((unit) => ({ value: unit, label: AREA_UNIT_LABELS[unit] }))

/**
 * The six measurements as one ruled grid of figures, with the area unit taken from (and saved
 * to) the display preferences.
 */
export function EvidenceMetrics({
  observation,
  hotspotCount,
}: {
  observation: Observation
  hotspotCount: number
}) {
  const preferences = useSettings()
  const setPreferences = useUpdateSettings()
  const metrics = evidenceMetrics(observation, hotspotCount, preferences.areaUnit)
  return (
    <section aria-labelledby="metrics-title" className="flex flex-col gap-4">
      <SectionLabel
        id="metrics-title"
        action={
          <SegmentedControl
            label="Area unit"
            size="sm"
            options={UNIT_OPTIONS}
            value={preferences.areaUnit}
            onChange={(areaUnit) => setPreferences({ areaUnit })}
          />
        }
      >
        Measurements
      </SectionLabel>
      <div className={KPI_ROW_3}>
        {metrics.map((metric) => (
          <Measure
            key={metric.id}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            footnote={metric.footnote}
            className={KPI_CELL_3}
          />
        ))}
      </div>
    </section>
  )
}
