import { Download } from 'lucide-react'
import { Button, ConfidenceBadge, Drawer, SeverityBadge } from '@/components/ui'
import type { Detection, Observation } from '@/features/observations/types'
import { downloadTextFile } from '@/lib/download'
import { shortId } from '@/lib/format'
import { detectionGeoJsonText } from '@/lib/geojson'
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
        detection ? (
          <Button
            variant="secondary"
            size="sm"
            iconStart={<Download aria-hidden />}
            onClick={() =>
              downloadTextFile(
                `${detection.id}.geojson`,
                detectionGeoJsonText(detection, observation),
                'application/geo+json',
              )
            }
          >
            Export this detection (GeoJSON)
          </Button>
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
