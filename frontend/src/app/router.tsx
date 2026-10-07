import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { AnalyzePage } from '@/pages/AnalyzePage'
import { ComparePage } from '@/pages/ComparePage'
import { MapPage } from '@/pages/MapPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ObservationDetailPage } from '@/pages/ObservationDetailPage'
import { ObservationsPage } from '@/pages/ObservationsPage'
import { OverviewPage } from '@/pages/OverviewPage'
import { ReportPage } from '@/pages/ReportPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AppShell } from './AppShell'
import { RouteErrorBoundary } from './RouteErrorBoundary'

/** Dev-only design QA page. Vite removes this branch, and the page chunk, from production builds. */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'design',
        lazy: async () => {
          const { DesignPage } = await import('@/pages/design/DesignPage')
          return { Component: DesignPage }
        },
      },
      {
        path: 'design/states',
        lazy: async () => {
          const { StatesPage } = await import('@/pages/design/StatesPage')
          return { Component: StatesPage }
        },
      },
    ]
  : []

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        // Pathless layout: a failing page shows the error inside the shell.
        errorElement: <RouteErrorBoundary />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'analyze', element: <AnalyzePage /> },
          { path: 'map/:observationId?', element: <MapPage /> },
          { path: 'observations', element: <ObservationsPage /> },
          { path: 'observations/:id', element: <ObservationDetailPage /> },
          { path: 'observations/:id/report', element: <ReportPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'compare', element: <ComparePage /> },
          ...devRoutes,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(routes)
}
