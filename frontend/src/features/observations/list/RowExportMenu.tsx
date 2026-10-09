import { useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, FileText, Shapes } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DropdownMenu, useToast, type DropdownMenuEntry } from '@/components/ui'
import { downloadFile } from '@/features/export/download'
import {
  detectionsCsvFile,
  detectionsGeoJsonFile,
  hotspotsGeoJsonFile,
  type ExportFile,
  type ExportSource,
} from '@/features/export/exportFiles'
import { analyzeObservation } from '@/lib/analysis'
import { toAppError } from '@/lib/errors/appError'
import { useObservationsApi } from '../api/apiContext'
import { observationKeys } from '../hooks'
import type { ObservationSummary } from '../types'

/**
 * Export from a table row. The list holds summaries only, so the full observation is fetched
 * (or taken from the cache) when an export is chosen.
 */
export function RowExportMenu({ observation }: { observation: ObservationSummary }) {
  const api = useObservationsApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  const run = async (build: (source: ExportSource) => ExportFile) => {
    try {
      const result = await queryClient.fetchQuery({
        queryKey: observationKeys.detail(observation.id),
        queryFn: ({ signal }) => api.getObservation(observation.id, { signal }),
      })
      const full = result.data
      const file = build({
        observation: full,
        detections: full.detections,
        analysis: analyzeObservation(full),
        filters: null,
      })
      downloadFile(file.filename, file.text, file.mimeType)
      toast.show({ title: 'Export downloaded', description: file.filename, tone: 'success' })
    } catch (error) {
      const appError = toAppError(error)
      toast.show({
        title: appError.code === 'UNEXPECTED' ? 'The export could not be created' : appError.title,
        description: appError.message,
        tone: 'danger',
      })
    }
  }

  const items: DropdownMenuEntry[] = [
    {
      id: 'detections',
      label: 'Detections (GeoJSON)',
      aside: 'GeoJSON',
      icon: <Download />,
      onSelect: () => void run(detectionsGeoJsonFile),
    },
    {
      id: 'hotspots',
      label: 'Hotspots (GeoJSON)',
      aside: 'GeoJSON',
      icon: <Shapes />,
      onSelect: () => void run(hotspotsGeoJsonFile),
    },
    {
      id: 'csv',
      label: 'Detections table (CSV)',
      aside: 'CSV',
      icon: <FileSpreadsheet />,
      onSelect: () => void run(detectionsCsvFile),
    },
    {
      id: 'report',
      label: 'Summary report (PDF)',
      aside: 'PDF',
      icon: <FileText />,
      onSelect: () =>
        navigate(`/observations/${encodeURIComponent(observation.id)}/report?print=1`),
    },
  ]

  return (
    <DropdownMenu
      align="end"
      menuClassName="w-64"
      items={items}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`Export ${observation.region}`}
          className="inline-flex size-8 items-center justify-center rounded-control text-ink-2 hover:bg-ink/5 hover:text-ink aria-expanded:bg-ink/5"
        >
          <Download aria-hidden className="size-4" />
        </button>
      )}
    />
  )
}
