/**
 * The first moment of a cold load, before the first page's code has arrived: the top bar's frame
 * and the page background, so nothing jumps when the real shell appears. No spinner: it is brief.
 */
export function ShellFallback() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex min-h-dvh flex-col bg-paper">
      <div className="h-topbar shrink-0 border-b border-hairline bg-paper" />
    </div>
  )
}
