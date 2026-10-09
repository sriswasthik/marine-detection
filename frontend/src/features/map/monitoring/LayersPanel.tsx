import { Checkbox, SegmentedControl } from '@/components/ui'
import { formatInteger, formatLength } from '@/lib/format'
import { BASEMAP_ORDER, BASEMAPS, type BasemapId } from '@/lib/map/basemaps'
import {
  MAP_LAYER_IDS,
  MAP_LAYER_LABELS,
  type MapLayerId,
  type VisibleLayers,
} from '@/lib/map/layers'

export interface LayersPanelProps {
  visibleLayers: VisibleLayers
  onToggleLayer: (layer: MapLayerId) => void
  /** What each layer holds, shown beside its toggle. Null for layers without a count. */
  counts: Readonly<Record<MapLayerId, number | null>>
  basemap: BasemapId
  onBasemapChange: (basemap: BasemapId) => void
  /** Grid cell edge in meters. */
  cellSizeM: number
}

const COUNT_NOUNS: Readonly<Record<MapLayerId, [string, string]>> = {
  detections: ['region', 'regions'],
  density: ['cell', 'cells'],
  hotspots: ['hotspot', 'hotspots'],
  footprint: ['', ''],
}

/** Layer toggles with what each holds, the basemap, and the density grid's cell size. */
export function LayersPanel({
  visibleLayers,
  onToggleLayer,
  counts,
  basemap,
  onBasemapChange,
  cellSizeM,
}: LayersPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col">
        <legend className="label mb-2 text-ink-2">Layers</legend>
        {MAP_LAYER_IDS.map((layer) => {
          const count = counts[layer]
          const [one, many] = COUNT_NOUNS[layer]
          return (
            <div key={layer} className="flex h-10 items-center gap-3 border-b border-hairline">
              <Checkbox
                size="sm"
                label={MAP_LAYER_LABELS[layer]}
                checked={visibleLayers[layer]}
                onChange={() => onToggleLayer(layer)}
                className="flex-1"
              />
              {count === null ? null : (
                <span className="data whitespace-nowrap text-ink-2">
                  {formatInteger(count)} {count === 1 ? one : many}
                </span>
              )}
            </div>
          )
        })}
      </fieldset>
      <div className="flex flex-col gap-2">
        <p className="label text-ink-2">Basemap</p>
        <SegmentedControl
          label="Basemap"
          size="sm"
          value={basemap}
          onChange={onBasemapChange}
          options={BASEMAP_ORDER.map((id) => ({ value: id, label: BASEMAPS[id].label }))}
          className="self-start"
        />
      </div>
      <p className="text-small text-ink-2">
        Density is measured on a grid of {formatLength(cellSizeM)} cells.
      </p>
    </div>
  )
}
