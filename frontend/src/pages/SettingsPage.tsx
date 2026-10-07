import { CircleCheck } from 'lucide-react'
import { Badge, Card, PageSkeleton, SegmentedControl, Skeleton } from '@/components/ui'
import { isMockMode } from '@/features/observations/api'
import { LoadError } from '@/features/observations/components/ObservationStates'
import { useHealth } from '@/features/observations/hooks'
import { AREA_UNIT_LABELS, AREA_UNITS } from '@/features/settings/preferences'
import { usePreferences } from '@/features/settings/usePreferences'
import { ENV } from '@/lib/env'
import { PageContainer, PageHeader } from './PageHeader'

const UNIT_OPTIONS = AREA_UNITS.map((unit) => ({ value: unit, label: AREA_UNIT_LABELS[unit] }))

/** Which service the figures come from, and whether it answers right now. */
function DataSource() {
  const health = useHealth()
  const mock = isMockMode()
  return (
    <Card
      title="Data source"
      headingLevel={2}
      description={
        mock
          ? 'Sample data generated in the browser. Every screen labels it "Sample data".'
          : `Live processing service at ${ENV.apiBaseUrl}.`
      }
      actions={mock ? <Badge tone="warning">Sample data</Badge> : null}
    >
      {health.isPending ? (
        <PageSkeleton label="Checking the service">
          <Skeleton className="h-5 w-64" />
        </PageSkeleton>
      ) : health.isError ? (
        <LoadError
          error={health.error}
          onRetry={() => void health.refetch()}
          headingLevel={3}
          className="py-4"
        />
      ) : (
        <p className="flex items-center gap-2 text-small text-ink">
          <CircleCheck aria-hidden className="size-4 text-success" />
          Connected · {health.data.modelName} {health.data.modelVersion}
        </p>
      )}
    </Card>
  )
}

/** Display preferences and the data source. */
export function SettingsPage() {
  const [preferences, setPreferences] = usePreferences()
  return (
    <PageContainer>
      <div className="flex max-w-2xl flex-col gap-8">
        <PageHeader
          title="Settings"
          description="Units, display preferences and the data source."
        />
        <Card
          title="Area unit"
          headingLevel={2}
          description="Used for areas in measurements. Auto picks m², ha or km² to fit each figure. Saved in this browser."
        >
          <SegmentedControl
            label="Area unit"
            options={UNIT_OPTIONS}
            value={preferences.areaUnit}
            onChange={(areaUnit) => setPreferences({ areaUnit })}
          />
        </Card>
        <DataSource />
      </div>
    </PageContainer>
  )
}
