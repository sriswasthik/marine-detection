import { ConfidenceBadge, Drawer, SeverityBadge } from '@/components/ui'
import type { ExportSource } from '@/features/export/exportFiles'
import { ExportMenu } from '@/features/export/ExportMenu'
import type { Detection, Observation } from '@/features/observations/types'
import { shortId } from '@/lib/format'
import type { Hotspot } from '@/lib/hotspots'
import { DetectionDetails } from './DetectionDetails'
import { HotspotDetails } from './HotspotDetails'

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
}

/**
 * Right-side drawer (bottom sheet on mobile) for the selected detection or hotspot.
 * It overlays the map without dimming it.
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
}: DetectionDrawerProps) {
  const open = Boolean(detection ?? hotspot)

  const title = detection ? (
    <span className="flex flex-wrap items-center gap-2">
      <span>
        Detection <span className="mono-label text-heading">{shortId(detection.id)}</span>
      </span>
      <SeverityBadge level={detection.densityLevel} />
      <ConfidenceBadge value={detection.confidence} />
    </span>
  ) : hotspot ? (
    <span className="flex flex-wrap items-center gap-2">
      <span>Hotspot {hotspot.rank}</span>
      <SeverityBadge level={hotspot.level} />
    </span>
  ) : (
    ''
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      description={observation.name ?? observation.region}
      footer={
        detection || hotspot ? (
          <ExportMenu
            source={exportSource}
            detection={detection}
            align="end"
            side="top"
            size="sm"
          />
        ) : null
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
    </Drawer>
  )
}
