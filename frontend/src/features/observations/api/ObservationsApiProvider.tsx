import type { ReactNode } from 'react'
import { ObservationsApiContext } from './apiContext'
import type { ObservationsApi } from './types'

export function ObservationsApiProvider({
  api,
  children,
}: {
  api: ObservationsApi | null
  children: ReactNode
}) {
  return <ObservationsApiContext value={api}>{children}</ObservationsApiContext>
}
