import { useCallback } from 'react'
import { useToast } from '@/components/ui'

/** Copies text to the clipboard and confirms with a toast, or explains what to do instead. */
export function useCopy() {
  const toast = useToast()
  return useCallback(
    async (text: string, what: string) => {
      try {
        await navigator.clipboard.writeText(text)
        toast.show({ title: `${what} copied`, tone: 'success', duration: 2500 })
      } catch {
        toast.show({
          title: `Could not copy ${what.toLowerCase()}`,
          description:
            'The browser blocked clipboard access. Select the text and copy it manually.',
          tone: 'warning',
        })
      }
    },
    [toast],
  )
}
