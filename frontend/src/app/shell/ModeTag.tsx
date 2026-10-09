import { Badge, Tooltip } from '@/components/ui'
import { useSettings } from '@/features/settings/settingsContext'

/** Says where the figures come from. Sample data is always labelled. */
export function ModeChip() {
  const { dataSource, apiBaseUrl } = useSettings()
  if (dataSource === 'live') {
    return (
      <Tooltip content={`Results come from the analysis service at ${apiBaseUrl}.`} align="end">
        <Badge tone="success" dot tabIndex={0}>
          Live data
        </Badge>
      </Tooltip>
    )
  }
  return (
    <Tooltip
      content="Every figure on screen comes from synthetic sample observations, not from real imagery."
      align="end"
    >
      <Badge tone="warning" dot tabIndex={0} className="cursor-default">
        Sample data
      </Badge>
    </Tooltip>
  )
}
