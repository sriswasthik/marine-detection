import type { ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AppShell } from './AppShell'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { ShellFallback } from './ShellFallback'

/**
 * Each page is its own chunk, so the first load carries only the shell. The map pages pull in
 * Leaflet, the Analyze page GeoTIFF reading, and so on, only when they are opened.
 */
function page(load: () => Promise<ComponentType>): PageRoute {
  return { lazy: async () => ({ Component: await load() }) }
}

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

/** How each page's component is provided: lazily in the app, eagerly in tests (src/test/routes.tsx). */
export type PageRoute = Pick<RouteObject, 'lazy' | 'Component'>
export type PageKey =
  'overview' | 'analyze' | 'map' | 'observations' | 'detail' | 'report' | 'settings' | 'compare'

const lazyPages: Record<PageKey, PageRoute> = {
  overview: page(async () => (await import('@/pages/OverviewPage')).OverviewPage),
  analyze: page(async () => (await import('@/pages/AnalyzePage')).AnalyzePage),
  map: page(async () => (await import('@/pages/MapPage')).MapPage),
  observations: page(async () => (await import('@/pages/ObservationsPage')).ObservationsPage),
  detail: page(async () => (await import('@/pages/ObservationDetailPage')).ObservationDetailPage),
  report: page(async () => (await import('@/pages/ReportPage')).ReportPage),
  settings: page(async () => (await import('@/pages/SettingsPage')).SettingsPage),
  compare: page(async () => (await import('@/pages/ComparePage')).ComparePage),
}

/** The route tree, the same for every way of providing the pages. */
export function buildRoutes(pages: Record<PageKey, PageRoute>): RouteObject[] {
  return [
    {
      element: <AppShell />,
      errorElement: <RouteErrorBoundary />,
      // Shown for the moment the first page's chunk takes to arrive.
      HydrateFallback: ShellFallback,
      children: [
        {
          // Pathless layout: a failing page shows the error inside the shell.
          errorElement: <RouteErrorBoundary />,
          children: [
            { index: true, ...pages.overview },
            { path: 'analyze', ...pages.analyze },
            { path: 'map/:observationId?', ...pages.map },
            { path: 'observations', ...pages.observations },
            { path: 'observations/:id', ...pages.detail },
            { path: 'observations/:id/report', ...pages.report },
            { path: 'settings', ...pages.settings },
            { path: 'compare', ...pages.compare },
            ...devRoutes,
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ]
}

export const routes: RouteObject[] = buildRoutes(lazyPages)

export function createAppRouter() {
  return createBrowserRouter(routes)
}
