export interface NavItem {
  label: string
  to: string
  /** Only active on an exact match (the overview). */
  end?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Overview', to: '/', end: true },
  { label: 'Analyze', to: '/analyze' },
  { label: 'Map', to: '/map' },
  { label: 'Observations', to: '/observations' },
  { label: 'Settings', to: '/settings' },
]
