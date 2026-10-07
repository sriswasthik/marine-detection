import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { useMemo, type ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/toast/ToastProvider'
import { AnalyzeDraftProvider } from '@/features/analyze/AnalyzeDraftProvider'
import { ObservationsApiProvider } from '@/features/observations/api/ObservationsApiProvider'
import { CurrentObservationProvider } from '@/features/observations/CurrentObservationProvider'
import type { ObservationsApi } from '@/features/observations/api/types'
import { useSettings } from '@/features/settings/settingsContext'
import { SettingsProvider } from '@/features/settings/SettingsProvider'
import type { SettingsStore } from '@/features/settings/settingsStore'
import { createQueryClient } from './queryClient'

interface AppProvidersProps {
  children: ReactNode
  /** Override the API implementation, mainly for tests. */
  api?: ObservationsApi
  /** Override the query client, mainly for tests. */
  queryClient?: QueryClient
  /** Override the settings store, mainly for tests. */
  settingsStore?: SettingsStore
}

/**
 * Everything that depends on where the data comes from. Switching between sample data and the
 * live service starts this part of the app afresh with an empty cache, so nothing from one source
 * is ever shown as if it came from the other.
 */
function DataSourceScope({
  api,
  queryClient,
  children,
}: {
  api?: ObservationsApi
  queryClient?: QueryClient
  children: ReactNode
}) {
  const { dataSource, apiBaseUrl } = useSettings()
  const key = api ? 'injected' : `${dataSource}|${apiBaseUrl}`
  // A fresh cache per data source. The key is the dependency on purpose.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const client = useMemo(() => queryClient ?? createQueryClient(), [queryClient, key])

  return (
    <QueryClientProvider client={client}>
      <ObservationsApiProvider key={key} api={api ?? null}>
        <CurrentObservationProvider>
          <AnalyzeDraftProvider>{children}</AnalyzeDraftProvider>
        </CurrentObservationProvider>
      </ObservationsApiProvider>
    </QueryClientProvider>
  )
}

export function AppProviders({ children, api, queryClient, settingsStore }: AppProvidersProps) {
  return (
    <SettingsProvider store={settingsStore}>
      {/* Honour the OS "reduce motion" setting for every animation. */}
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <DataSourceScope api={api} queryClient={queryClient}>
            {children}
          </DataSourceScope>
        </ToastProvider>
      </MotionConfig>
    </SettingsProvider>
  )
}
