import { useThree } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { createRandom } from '@/features/observations/mock/random'

/** The one easing curve (tokens.css --ease-out), approximated for per-frame use. */
export function easeOut(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - x, 3)
}

/** Frame-rate independent damping towards a target. */
export function damp(current: number, target: number, lambda: number, delta: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * delta))
}

/** Seeded 2D value noise with smooth interpolation, 0 to 1. */
export function createNoise2D(seed: string): (x: number, y: number) => number {
  const random = createRandom(seed)
  const size = 256
  const table = Float32Array.from({ length: size * size }, () => random.next())
  const at = (x: number, y: number) =>
    table[(((y % size) + size) % size) * size + (((x % size) + size) % size)] ?? 0
  return (x, y) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const sx = x - x0
    const sy = y - y0
    const u = sx * sx * (3 - 2 * sx)
    const v = sy * sy * (3 - 2 * sy)
    const top = THREE.MathUtils.lerp(at(x0, y0), at(x0 + 1, y0), u)
    const bottom = THREE.MathUtils.lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), u)
    return THREE.MathUtils.lerp(top, bottom, v)
  }
}

/** Fractal noise: four octaves of value noise, 0 to 1. */
export function fbm(noise: (x: number, y: number) => number, x: number, y: number): number {
  let sum = 0
  let amplitude = 0.5
  let frequency = 1
  let norm = 0
  for (let octave = 0; octave < 4; octave++) {
    sum += amplitude * noise(x * frequency, y * frequency)
    norm += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return sum / norm
}

export interface DragState {
  /** Radians added by the user around the vertical axis. */
  yaw: number
  /** Radians added by the user around the horizontal axis. */
  pitch: number
  dragging: boolean
  /** performance.now() of the last drag, so idle motion can wait before resuming. */
  lastInput: number
}

/**
 * Drag to turn the scene. Horizontal drags turn it; vertical drags tilt it within `pitchLimit`.
 * The canvas keeps `touch-action: pan-y` (set on the Canvas), so a vertical swipe on a phone
 * still scrolls the page.
 */
export function useDragRotate(pitchLimit = 0.5): RefObject<DragState> {
  const element = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  const drag = useRef<DragState>({ yaw: 0, pitch: 0, dragging: false, lastInput: -Infinity })

  useEffect(() => {
    let lastX = 0
    let lastY = 0
    const down = (event: PointerEvent) => {
      drag.current.dragging = true
      lastX = event.clientX
      lastY = event.clientY
    }
    const move = (event: PointerEvent) => {
      if (!drag.current.dragging) return
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY
      drag.current.yaw += dx * 0.006
      drag.current.pitch = THREE.MathUtils.clamp(
        drag.current.pitch + dy * 0.004,
        -pitchLimit,
        pitchLimit,
      )
      drag.current.lastInput = performance.now()
      // Scenes under reduced motion render on demand: a drag asks for the next frame.
      invalidate()
    }
    const up = () => {
      drag.current.dragging = false
      drag.current.lastInput = performance.now()
    }
    element.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      element.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [element, invalidate, pitchLimit])

  return drag
}

/** Canvas styles shared by every scene: transparent over the page, grab cursor, vertical scroll. */
export const CANVAS_STYLE = { touchAction: 'pan-y', cursor: 'grab' } as const

/**
 * Lit bars for InstancedMesh: colour per instance and one soft key light, so the tops read
 * lighter than the sides. Box geometry must span -0.5 to 0.5 in y.
 */
export function createBarMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vColor;
      varying vec3 vNormal;
      void main() {
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(1.0);
        #endif
        vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying vec3 vNormal;
      void main() {
        vec3 key = normalize(vec3(0.45, 1.0, 0.65));
        float light = 0.62 + 0.38 * max(dot(normalize(vNormal), key), 0.0);
        gl_FragColor = vec4(vColor * light, 1.0);
      }
    `,
  })
}
