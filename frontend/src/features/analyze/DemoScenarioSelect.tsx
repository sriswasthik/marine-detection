import { Select } from '@/components/ui'
import { isMockScenario, type MockScenario } from '@/features/observations/mock/scenario'
import { useMockScenario } from '@/features/observations/mock/useMockScenario'

const OPTIONS: { value: MockScenario; label: string }[] = [
  { value: 'success', label: 'Success' },
  { value: 'nodebris', label: 'No debris' },
  { value: 'lowconf', label: 'Low confidence' },
  { value: 'partial', label: 'Partial georeferencing' },
  { value: 'invalid', label: 'Invalid image' },
  { value: 'modelfail', label: 'Model failure' },
  { value: 'network', label: 'Network failure' },
  { value: 'empty', label: 'No observations yet' },
]

/** Quiet footer control for rehearsing every state. Only rendered in mock mode. */
export function DemoScenarioSelect() {
  const [scenario, setScenario] = useMockScenario()
  return (
    <div className="flex flex-wrap items-center gap-3 text-small text-ink-2">
      <Select
        label="Demo scenario"
        hideLabel
        size="sm"
        value={scenario}
        onChange={(e) => {
          if (isMockScenario(e.target.value)) setScenario(e.target.value)
        }}
        options={OPTIONS}
        className="w-56"
      />
      <span>Demo scenario for the sample backend. Applies to the next run.</span>
    </div>
  )
}
