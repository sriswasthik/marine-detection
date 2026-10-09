let webglSupport: boolean | null = null

/**
 * True where a WebGL scene can run. False in jsdom and in browsers without WebGL. Probed once:
 * the probe's context is released at once, since browsers allow only a few at a time.
 */
export function canUseWebGL(): boolean {
  if (webglSupport !== null) return webglSupport
  if (typeof window === 'undefined' || typeof window.WebGLRenderingContext === 'undefined') {
    return (webglSupport = false)
  }
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    webglSupport = Boolean(context)
  } catch {
    webglSupport = false
  }
  return webglSupport
}
