import { useCallback, useRef } from 'react'
import { useToast } from '@/components/ui'
import { createAppError } from '@/lib/errors/appError'
import { downloadFile } from './download'
import type { ExportFile } from './exportFiles'

/** Download and copy-link actions with toast feedback: what was saved, or why it was not. */
export function useExportActions() {
  const toast = useToast()
  /** The last file saved and when: a double click within a second saves it once. */
  const last = useRef<{ filename: string; at: number } | null>(null)

  const download = useCallback(
    (build: () => ExportFile) => {
      try {
        const file = build()
        const now = Date.now()
        if (last.current?.filename === file.filename && now - last.current.at < 1000) return
        last.current = { filename: file.filename, at: now }
        downloadFile(file.filename, file.text, file.mimeType)
        toast.show({ title: 'Export downloaded', description: file.filename, tone: 'success' })
      } catch {
        const error = createAppError('EXPORT_FAILED')
        toast.show({ title: error.title, description: error.message, tone: 'danger' })
      }
    },
    [toast],
  )

  /** The address as it is now: the map keeps its filters, view and selection in it. */
  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.show({
        title: 'Link copied',
        description: 'It opens this view with the same filters and selection.',
        tone: 'success',
      })
    } catch {
      const error = createAppError('CLIPBOARD_BLOCKED')
      toast.show({ title: error.title, description: error.message, tone: 'warning' })
    }
  }, [toast])

  return { download, copyLink }
}
