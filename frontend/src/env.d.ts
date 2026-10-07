interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_DEMO_FAST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
