/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: they change far less often than the app, so they stay cached
        // across deploys. Leaflet is only fetched by the pages that draw a map.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
              // Highest: React is a dependency of the other groups and must not be pulled into them.
              priority: 30,
            },
            {
              name: 'motion',
              test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
              priority: 20,
            },
            {
              name: 'leaflet',
              test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Only the token file is read in tests (as ?raw, to check it against src/lib/density.ts).
    css: { include: [/tokens\.css/] },
    include: ['src/**/*.test.{ts,tsx}'],
    // Whole-app renders (shell, palette, glyphs for every row) take several seconds in jsdom
    // when files run in parallel; 5s made them flaky.
    testTimeout: 15_000,
  },
})
