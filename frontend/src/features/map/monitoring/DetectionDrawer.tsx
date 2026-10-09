import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useClaimPrimaryAction } from '@/app/shell/primaryAction'
import { buttonStyles, ConfidenceTag, SeverityTag } from '@/components/ui'
import type { ExportSource } from '@/features/export/exportFiles'
import { ExportMenu } from '@/features/export/ExportMenu'
import type { Detection, Observation } from '@/features/observations/types'
import { shortId } from '@/lib/format'
import type { Hotspot } from '@/lib/hotspots'
import { DetectionDetails } from './DetectionDetails'
import { HotspotDetails } from './HotspotDetails'
import { MapDrawerPanel } from './MapDrawerPanel'

export interface DetectionDrawerProps {
  observation: Observation
  /** Detections currently shown (after filters). */
  detections: readonly Detection[]
  detection: Detection | null
  hotspot: Hotspot | null
  hotspotCount: number
  onClose: () => void
  onSelectDetection: (id: string) => void
  onShowDetectionOnMap: (id: string) => void
  /** What the Export menu exports: the map's filtered detections and their analysis. */
  exportSource: ExportSource
  /** `side` from 768px, `bottom` below. */
  layout: 'side' | 'bottom'
}

/** Where "View evidence" goes: the detail page, focused on the detection when there is one. */
function evidencePath(observationId: string, detection: Detection | null): string {
  const base = `/observations/${encodeURIComponent(observationId)}`
  return detection ? `${base}?detection=${encodeURIComponent(detection.id)}` : base
}

/**
 * The selected detection or hotspot, docked beside the map (under it on phones). "View evidence"
 * is the view's one primary action while it is open; the top bar steps back.
 */
export function DetectionDrawer({
  observation,
  detections,
  detection,
  hotspot,
  hotspotCount,
  onClose,
  onSelectDetection,
  onShowDetectionOnMap,
  exportSource,
  layout,
}: DetectionDrawerProps) {
  const open = Boolean(detection ?? hotspot)
  useClaimPrimaryAction(open)
  if (!open) return null

  const title = detection ? (
    <span className="flex flex-wrap items-center gap-2">
      <span>
        Detection <span className="data">{shortId(detection.id)}</span>
      </span>
      <SeverityTag level={detection.densityLevel} />
      <ConfidenceTag value={detection.confidence} />
    </span>
  ) : hotspot ? (
    <span className="flex flex-wrap items-center gap-2">
      <span>Hotspot {hotspot.rank}</span>
      <SeverityTag level={hotspot.level} />
    </span>
  ) : null

  return (
    <MapDrawerPanel
      key={detection?.id ?? hotspot?.id}
      layout={layout}
      onClose={onClose}
      title={title}
      description={observation.name ?? observation.region}
      footer={
        <>
          <Link
            to={evidencePath(observation.id, detection)}
            className={buttonStyles({ variant: 'primary', size: 'sm' })}
          >
            View evidence
            <ArrowRight aria-hidden />
          </Link>
          <ExportMenu
            source={exportSource}
            detection={detection}
            align="end"
            side="top"
            size="sm"
          />
        </>
      }
    >
      {detection ? (
        <DetectionDetails
          detection={detection}
          observation={observation}
          onShowOnMap={() => onShowDetectionOnMap(detection.id)}
        />
      ) : hotspot ? (
        <HotspotDetails
          hotspot={hotspot}
          hotspotCount={hotspotCount}
          detections={detections}
          onSelectDetection={onSelectDetection}
        />
      ) : null}
    </MapDrawerPanel>
  )
}
