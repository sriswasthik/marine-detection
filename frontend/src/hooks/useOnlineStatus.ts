import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

const getOnline = () => navigator.onLine !== false

/** True while the browser reports a network connection; updates on online and offline events. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getOnline, () => true)
}
