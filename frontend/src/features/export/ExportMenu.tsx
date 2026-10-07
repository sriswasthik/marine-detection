import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Link2,
  MapPinned,
  Shapes,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { buttonStyles, DropdownMenu, type DropdownMenuEntry } from '@/components/ui'
import type { Detection } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { formatInteger, shortId } from '@/lib/format'
import {
  detectionsCsvFile,
  detectionsGeoJsonFile,
  hotspotsGeoJsonFile,
  singleDetectionFile,
  type ExportSource,
} from './exportFiles'
import { useExportActions } from './useExportActions'

const count = (n: number, one: string, many: string) =>
  `${formatInteger(n)} ${n === 1 ? one : many}`

export interface ExportMenuProps {
  source: ExportSource
  /** In the detection drawer: adds an export of just this detection. */
  detection?: Detection | null
  align?: 'start' | 'end'
  /** Open upwards, for triggers near the bottom of the screen. */
  side?: 'bottom' | 'top'
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Exports for one observation: detections and hotspots as GeoJSON, a CSV table, the one-page
 * report, and a link to the current view. From the map, exports follow the active filters and the
 * menu says so.
 */
export function ExportMenu({
  source,
  detection = null,
  align = 'end',
  side = 'bottom',
  size = 'md',
  className,
}: ExportMenuProps) {
  const navigate = useNavigate()
  const { download, copyLink } = useExportActions()
  const { observation, detections, analysis, filters } = source
  const shown = detections.length
  const hotspots = analysis.hotspots.length
  const filtered = filters !== null
  const detectionsLabel = filtered
    ? count(shown, 'filtered detection', 'filtered detections')
    : count(shown, 'detection', 'detections')

  const items: DropdownMenuEntry[] = [
    ...(detection
      ? ([
          {
            id: 'detection',
            label: `This detection (${shortId(detection.id)})`,
            description: 'Its outline and facts, for GIS tools.',
            aside: 'GeoJSON',
            icon: <MapPinned />,
            onSelect: () => download(() => singleDetectionFile(observation, detection)),
          },
          { type: 'separator', id: 'detection-separator' },
        ] satisfies DropdownMenuEntry[])
      : []),
    {
      id: 'detections',
      label: 'Detections (GeoJSON)',
      description:
        shown === 0
          ? filtered
            ? 'No detections match the filters: an empty, valid collection.'
            : 'No debris detected: an empty, valid collection.'
          : `${detectionsLabel} with area, confidence and density level.`,
      aside: 'GeoJSON',
      icon: <Download />,
      onSelect: () => download(() => detectionsGeoJsonFile(source)),
    },
    {
      id: 'hotspots',
      label: 'Hotspots (GeoJSON)',
      description:
        hotspots === 0
          ? 'No hotspots: an empty, valid collection.'
          : `${count(hotspots, 'hotspot', 'hotspots')} as polygons, ranked by priority${filtered ? ', from the filtered detections' : ''}.`,
      aside: 'GeoJSON',
      icon: <Shapes />,
      onSelect: () => download(() => hotspotsGeoJsonFile(source)),
    },
    {
      id: 'csv',
      label: 'Detections table (CSV)',
      description:
        shown === 0
          ? 'Column headers only: nothing to list.'
          : `${detectionsLabel}, one row each. Opens in Excel.`,
      aside: 'CSV',
      icon: <FileSpreadsheet />,
      onSelect: () => download(() => detectionsCsvFile(source)),
    },
    {
      id: 'report',
      label: 'Summary report (PDF)',
      description: 'One A4 page with the map, figures and hotspots. Opens the print dialog.',
      aside: 'PDF',
      icon: <FileText />,
      onSelect: () =>
        navigate(`/observations/${encodeURIComponent(observation.id)}/report?print=1`),
    },
    { type: 'separator', id: 'link-separator' },
    {
      id: 'link',
      label: 'Copy link to this view',
      description: 'Opens this view with the same filters and selection.',
      icon: <Link2 />,
      onSelect: () => void copyLink(),
    },
  ]

  return (
    <DropdownMenu
      align={align}
      side={side}
      className={className}
      menuClassName="w-[22rem] max-w-[calc(100vw-2rem)]"
      items={items}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={cn(buttonStyles({ variant: 'secondary', size }))}
        >
          <Download aria-hidden />
          Export
          <ChevronDown aria-hidden />
        </button>
      )}
    />
  )
}
