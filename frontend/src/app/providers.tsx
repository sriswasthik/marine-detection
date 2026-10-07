import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/toast/ToastProvider'
import { ObservationsApiProvider } from '@/features/observations/api/ObservationsApiProvider'
import type { ObservationsApi } from '@/features/observations/api/types'
import { createQueryClient } from './queryClient'

interface AppProvidersProps {
  children: ReactNode
  /** Override the API implementation, mainly for tests. */
  api?: ObservationsApi
  /** Override the query client, mainly for tests. */
  queryClient?: QueryClient
}

export function AppProviders({ children, api, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  return (
    <QueryClientProvider client={client}>
      <ObservationsApiProvider api={api ?? null}>
        {/* Honour the OS "reduce motion" setting for every animation. */}
        <MotionConfig reducedMotion="user">
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
      </ObservationsApiProvider>
    </QueryClientProvider>
  )
}
