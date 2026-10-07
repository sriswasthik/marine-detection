import { createContext, useContext, type Dispatch } from 'react'
import type { AnalyzeDraft, DraftAction } from './draft'

export interface DraftContextValue {
  draft: AnalyzeDraft
  dispatch: Dispatch<DraftAction>
}

export const AnalyzeDraftContext = createContext<DraftContextValue | null>(null)

/** The Analyze form's draft. Kept above the routes so leaving the page does not lose it. */
export function useAnalyzeDraft(): DraftContextValue {
  const value = useContext(AnalyzeDraftContext)
  if (!value) throw new Error('useAnalyzeDraft must be used inside AnalyzeDraftProvider.')
  return value
}
