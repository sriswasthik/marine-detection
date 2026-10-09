import {
  LayoutList,
  Map as MapIcon,
  Rows3,
  ScanSearch,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  /** Only active on an exact match (the overview). */
  end?: boolean
  /** Icon for the phone tab bar. */
  icon: LucideIcon
  /** Shown in the phone tab bar; the rest live in the More sheet. */
  tab: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Overview', to: '/', end: true, icon: LayoutList, tab: true },
  { label: 'Analyze', to: '/analyze', icon: ScanSearch, tab: true },
  { label: 'Map', to: '/map', icon: MapIcon, tab: true },
  { label: 'Observations', to: '/observations', icon: Rows3, tab: true },
  { label: 'Settings', to: '/settings', icon: SettingsIcon, tab: false },
]

/** The one primary action of most views, carried by the top bar. */
export const ANALYZE_LABEL = 'Analyze new imagery'
