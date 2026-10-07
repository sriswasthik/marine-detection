import { createContext, useContext } from 'react'
import { getDefaultObservationsApi } from './index'
import type { ObservationsApi } from './types'

/** Lets tests and stories inject an implementation. Null means "use the app default". */
export const ObservationsApiContext = createContext<ObservationsApi | null>(null)

export function useObservationsApi(): ObservationsApi {
  return useContext(ObservationsApiContext) ?? getDefaultObservationsApi()
}
