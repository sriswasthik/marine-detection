import { useEffect, useState } from 'react'

/** Milliseconds since `startedAt`, ticking every second while `running`; frozen at `endedAt`. */
export function useElapsed(startedAt: number | null, endedAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  const running = startedAt !== null && endedAt === null
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])
  if (startedAt === null) return null
  return Math.max(0, (endedAt ?? now) - startedAt)
}
