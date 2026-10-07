import { useEffect } from 'react'
import { ENV } from '@/lib/env'

/** Sets the browser tab title to "<page> · <app name>". */
export function useDocumentTitle(pageTitle: string | null): void {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${ENV.appName}` : ENV.appName
  }, [pageTitle])
}
