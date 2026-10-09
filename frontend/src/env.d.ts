interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_DEMO_FAST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Natural Earth land polygons as TopoJSON (world-atlas), typed at the one place that reads it. */
declare module 'world-atlas/land-110m.json' {
  const topology: unknown
  export default topology
}
