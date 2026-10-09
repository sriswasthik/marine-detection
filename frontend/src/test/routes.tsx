/**
 * The app's route tree with every page imported eagerly, so component tests render a page in the
 * same tick instead of waiting for a lazy chunk. App.test.tsx keeps using the real lazy routes.
 */
import { buildRoutes } from '@/app/router'
import { AnalyzePage } from '@/pages/AnalyzePage'
import { ComparePage } from '@/pages/ComparePage'
import { MapPage } from '@/pages/MapPage'
import { ObservationDetailPage } from '@/pages/ObservationDetailPage'
import { ObservationsPage } from '@/pages/ObservationsPage'
import { OverviewPage } from '@/pages/OverviewPage'
import { ReportPage } from '@/pages/ReportPage'
import { SettingsPage } from '@/pages/SettingsPage'

export const routes = buildRoutes({
  overview: { Component: OverviewPage },
  analyze: { Component: AnalyzePage },
  map: { Component: MapPage },
  observations: { Component: ObservationsPage },
  detail: { Component: ObservationDetailPage },
  report: { Component: ReportPage },
  settings: { Component: SettingsPage },
  compare: { Component: ComparePage },
})
