import { useEffect, useState } from 'react'

/** Keys already counted up in this session: a figure counts up once, on its first view. */
const counted = new Set<string>()

export const COUNT_UP_MS = 400

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Ease-out, close to the design's one curve, for values rather than CSS. */
const easeOut = (t: number) => 1 - (1 - t) ** 3

/**
 * The value to show: counts from 0 to `target` over 400ms the first time `key` is seen in this
 * session, then stays at the target. Off under reduced motion, without a key, or when disabled.
 */
export function useCountUp(
  target: number,
  key: string | null,
): { value: number; running: boolean } {
  const [state, setState] = useState(() => {
    const run = key !== null && !counted.has(key) && !reducedMotion() && target !== 0
    return { value: run ? 0 : target, running: run, key }
  })

  // A new key or target: start again only for a key that has not counted yet.
  if (state.key !== key) {
    const run = key !== null && !counted.has(key) && !reducedMotion() && target !== 0
    setState({ value: run ? 0 : target, running: run, key })
  }

  useEffect(() => {
    if (!state.running || key === null) return
    counted.add(key)
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS)
      setState((current) => ({ ...current, value: target * easeOut(t), running: t < 1 }))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [state.running, key, target])

  return { value: state.running ? state.value : target, running: state.running }
}

/** For tests: forget which figures have counted up. */
export function resetCountUp(): void {
  counted.clear()
}
