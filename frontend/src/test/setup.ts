import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach } from 'vitest'

// Animations finish instantly in tests, so exits do not leave elements behind.
MotionGlobalConfig.skipAnimations = true

// jsdom has no matchMedia. Report every query as not matching (the mobile layout).
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// jsdom has no canvas. Leaflet's canvas renderer only needs a 2D context that accepts calls,
// so give it one where every method is a no-op and every property can be set.
function noopContext(canvas: HTMLCanvasElement): object {
  return new Proxy(
    { canvas },
    {
      get: (target, prop) => (prop in target ? Reflect.get(target, prop) : () => undefined),
    },
  )
}
HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement) {
  return noopContext(this)
} as unknown as HTMLCanvasElement['getContext']

// jsdom does not implement scrolling; React Router scroll restoration calls it.
window.scrollTo = () => {}

afterEach(() => {
  cleanup()
})
