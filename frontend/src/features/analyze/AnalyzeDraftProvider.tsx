import { useMemo, useReducer, type ReactNode } from 'react'
import { draftReducer, initialDraft } from './draft'
import { AnalyzeDraftContext } from './draftContext'

/** Holds the Analyze draft (file, source, region, time, bounds) for the whole session. */
export function AnalyzeDraftProvider({ children }: { children: ReactNode }) {
  const [draft, dispatch] = useReducer(draftReducer, undefined, () => initialDraft(new Date()))
  const value = useMemo(() => ({ draft, dispatch }), [draft])
  return <AnalyzeDraftContext value={value}>{children}</AnalyzeDraftContext>
}
