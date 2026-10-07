/** Saves text as a file in the browser. Side effect only; the content comes from tested builders. */
export function downloadFile(filename: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke after the click has been handled.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
