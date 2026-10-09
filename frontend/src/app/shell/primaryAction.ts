import { createContext, useContext, useLayoutEffect } from 'react'

/**
 * Exactly one primary button per view. The top bar carries "Analyze new imagery" unless the view
 * shows a primary of its own (Run detection on Analyze, View evidence in the map drawer): such a
 * view claims the primary while it shows one, and the top bar steps back.
 */
export interface PrimaryActionState {
  /** True while some part of the view shows its own primary button. */
  claimed: boolean
  /** Claims the primary; returns the release. */
  claim: () => () => void
}

export const PrimaryActionContext = createContext<PrimaryActionState>({
  claimed: false,
  claim: () => () => {},
})

export function usePrimaryAction(): PrimaryActionState {
  return useContext(PrimaryActionContext)
}

/** Claims the view's primary action while `active` (layout effect: no flash of two primaries). */
export function useClaimPrimaryAction(active: boolean): void {
  const { claim } = usePrimaryAction()
  useLayoutEffect(() => (active ? claim() : undefined), [active, claim])
}
