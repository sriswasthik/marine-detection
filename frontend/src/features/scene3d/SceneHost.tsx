import { useReducedMotion } from 'framer-motion'
import {
  Component,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
  type RefObject,
} from 'react'
import { cn } from '@/lib/cn'
import { canUseWebGL } from './webgl'

/** What every scene is told by its host. */
export interface SceneRuntime {
  /** False while the scene is scrolled out of view: it stops rendering. */
  active: boolean
  /** Under prefers-reduced-motion: no idle animation, one still frame per change. */
  reducedMotion: boolean
}

/** A failed scene (lost context, shader error) falls back quietly: the page around it still works. */
class SceneBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn('A 3D scene failed and was replaced by its still version.', error, info)
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '120px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, inView]
}

/**
 * The frame every 3D scene sits in. Runs the scene where WebGL is available (three.js loads with
 * it, outside the main bundle) and shows `fallback` everywhere else, while it loads, and if it
 * fails. The canvas is decorative: each use pairs it with text that says the same thing.
 */
export function SceneHost({
  children,
  fallback,
  className,
  overlay,
}: {
  children: (runtime: SceneRuntime) => ReactNode
  fallback: ReactNode
  className?: string
  /** DOM laid over the canvas (labels, tooltips, captions); a function hears if WebGL runs. */
  overlay?: ReactNode | ((live: boolean) => ReactNode)
}) {
  const [supported] = useState(canUseWebGL)
  const reducedMotion = useReducedMotion() ?? false
  const [ref, inView] = useInView<HTMLDivElement>()

  return (
    <div ref={ref} className={cn('relative isolate', className)}>
      {supported ? (
        <SceneBoundary fallback={fallback}>
          <Suspense fallback={fallback}>{children({ active: inView, reducedMotion })}</Suspense>
        </SceneBoundary>
      ) : (
        fallback
      )}
      {typeof overlay === 'function' ? overlay(supported) : overlay}
    </div>
  )
}
