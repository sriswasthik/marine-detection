import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentObservationId } from '@/features/observations/currentObservationContext'
import { useObservations } from '@/features/observations/hooks'
import { sendCommand, type PageCommand } from '@/lib/commandBus'
import { formatDate } from '@/lib/format'
import type { Searchable } from '@/lib/fuzzy'
import { pathForObservation } from '@/lib/routes'
import { ANALYZE_LABEL, NAV_ITEMS } from '../navigation'
import { useOpenShortcuts } from './shortcutsContext'

export type CommandGroup = 'Pages' | 'Observations' | 'Actions'

export interface CommandItem extends Searchable {
  group: CommandGroup
  /** Second line: a date and id for observations, a hint for actions. */
  detail?: string
  /** Draws the observation's glyph. */
  observationId?: string
  run: () => void
}

/**
 * Everything the palette can reach: every page, every observation (by region, date or id) and the
 * main actions. Map actions open the map for the current observation first when needed.
 */
export function useCommandItems(): CommandItem[] {
  const navigate = useNavigate()
  const location = useLocation()
  const openShortcuts = useOpenShortcuts()
  const list = useObservations()
  const observations = list.data?.data ?? []
  const currentId = useCurrentObservationId(observations)
  const onMap = matchPath('/map/:id?', location.pathname) !== null
  const onDetail = matchPath('/observations/:id', location.pathname) !== null

  /** Map-page actions: open the map first unless it is already in view. */
  const onMapPage = (command: PageCommand) => () => {
    if (!onMap) navigate(currentId ? `/map/${encodeURIComponent(currentId)}` : '/map')
    sendCommand(command)
  }

  const pages: CommandItem[] = NAV_ITEMS.map((item) => ({
    id: `page:${item.to}`,
    label: item.label,
    group: 'Pages',
    keywords: ['go to', 'page'],
    run: () => navigate(item.to),
  }))

  const observationItems: CommandItem[] = observations.map((observation) => ({
    id: `observation:${observation.id}`,
    label: observation.region,
    detail: `${formatDate(observation.capturedAt)} · ${observation.id}`,
    keywords: [observation.id, formatDate(observation.capturedAt), observation.name ?? ''],
    group: 'Observations',
    observationId: observation.id,
    run: () =>
      navigate(
        pathForObservation(location.pathname, observation.id) ??
          `/observations/${encodeURIComponent(observation.id)}`,
      ),
  }))

  const actions: CommandItem[] = [
    {
      id: 'action:analyze',
      label: ANALYZE_LABEL,
      group: 'Actions',
      keywords: ['upload', 'run detection', 'new'],
      run: () => navigate('/analyze'),
    },
    {
      id: 'action:fit',
      label: 'Fit to detections',
      detail: 'Map',
      group: 'Actions',
      keywords: ['zoom', 'map'],
      run: onMapPage('map.fit'),
    },
    {
      id: 'action:density',
      label: 'Toggle density',
      detail: 'Map layer',
      group: 'Actions',
      keywords: ['grid', 'layer', 'map'],
      run: onMapPage('map.toggle-density'),
    },
    {
      id: 'action:export',
      label: 'Export GeoJSON',
      detail: 'Detections of the current observation',
      group: 'Actions',
      keywords: ['download', 'gis', 'detections'],
      run: () => {
        if (!onMap && !onDetail)
          navigate(currentId ? `/map/${encodeURIComponent(currentId)}` : '/map')
        sendCommand('export.geojson')
      },
    },
    {
      id: 'action:settings',
      label: 'Open settings',
      group: 'Actions',
      keywords: ['units', 'data source', 'preferences'],
      run: () => navigate('/settings'),
    },
    {
      id: 'action:shortcuts',
      label: 'Show shortcuts',
      group: 'Actions',
      keywords: ['keyboard', 'keys', 'help'],
      run: openShortcuts,
    },
  ]

  return [...pages, ...observationItems, ...actions]
}
