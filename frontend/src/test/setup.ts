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

// jsdom does not implement scrolling; React Router scroll restoration calls it.
window.scrollTo = () => {}

afterEach(() => {
  cleanup()
})
