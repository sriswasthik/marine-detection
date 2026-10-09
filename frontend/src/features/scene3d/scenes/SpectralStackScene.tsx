import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SPECTRAL_BANDS, type PipelinePhase } from '@/lib/scene3d'
import type { SceneRuntime } from '../SceneHost'
import { CANVAS_STYLE, createBarMaterial, createNoise2D, damp, fbm } from './shared'

export interface SpectralStackSceneProps extends SceneRuntime {
  phase: PipelinePhase
  /** Upload progress, 0 to 100, while uploading. */
  uploadPercent: number | null
}

const FIELD = 64
const PLANE = 1.7
const BASE_Y = -0.45
/** Model class 1, possible debris: the High severity colour, so it reads as a finding. */
const DEBRIS_COLOR = '#c4503a'

/** Gap between band planes per phase: packed while arriving, fanned out while being read. */
const SPACING: Record<PipelinePhase, number> = {
  idle: 0.05,
  upload: 0.05,
  preprocess: 0.15,
  detect: 0.15,
  map: 0.018,
  done: 0.018,
  failed: 0.1,
}

interface SceneField {
  texture: THREE.DataTexture
  /** Debris cells for the voxels: centre in plane units, and how much of the cell is debris. */
  debris: { x: number; z: number; weight: number }[]
}

/**
 * An illustrative coastal scene: land, water and a few streaks of floating material. R is land,
 * G is debris, B is texture. The same field drives every band and the debris voxels.
 */
function buildField(): SceneField {
  const noise = createNoise2D('spectral-scene')
  const streaks = createNoise2D('spectral-streaks')
  const data = new Uint8Array(FIELD * FIELD * 4)
  const debrisMask = new Float32Array(FIELD * FIELD)
  for (let y = 0; y < FIELD; y++) {
    for (let x = 0; x < FIELD; x++) {
      const u = x / FIELD
      const v = y / FIELD
      // A coast running down the left side, with bays.
      const coast = fbm(noise, u * 3.2, v * 3.2) * 0.55 + (0.62 - u) * 1.1
      const land = THREE.MathUtils.smoothstep(coast, 0.42, 0.5)
      const detail = fbm(noise, u * 9 + 7, v * 9 + 3)
      const streak = fbm(streaks, u * 5 + v * 9, v * 2.2)
      const nearCoast = 1 - THREE.MathUtils.smoothstep(Math.abs(coast - 0.32), 0.05, 0.22)
      const debris = land < 0.1 && streak > 0.6 && nearCoast > 0.3 ? 1 : 0
      const i = (y * FIELD + x) * 4
      data[i] = land * 255
      data[i + 1] = debris * 255
      data[i + 2] = detail * 255
      data[i + 3] = 255
      debrisMask[y * FIELD + x] = debris
    }
  }
  const texture = new THREE.DataTexture(data, FIELD, FIELD, THREE.RGBAFormat)
  texture.magFilter = THREE.NearestFilter
  texture.needsUpdate = true

  // Voxels on a 32 x 32 grid: a cell stands when any of its pixels is debris.
  const debris: SceneField['debris'] = []
  const cells = FIELD / 2
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      let sum = 0
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) sum += debrisMask[(cy * 2 + dy) * FIELD + cx * 2 + dx] ?? 0
      }
      if (sum > 0) {
        debris.push({
          x: ((cx + 0.5) / cells - 0.5) * PLANE,
          // Texture rows run south to north; plane z runs north (back) to south (front).
          z: (0.5 - (cy + 0.5) / cells) * PLANE,
          weight: sum / 4,
        })
      }
    }
  }
  return { texture, debris }
}

const BAND_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * One band: how bright land, water and floating debris are at this wavelength. Water darkens into
 * the infrared; land and floating material stay bright in the near infrared, which is how debris
 * stands out against the sea.
 */
const BAND_FRAGMENT = /* glsl */ `
  uniform sampler2D uField;
  uniform vec3 uColor;
  uniform float uBand;
  uniform float uOpacity;
  uniform float uScan;
  uniform float uScanOn;
  uniform float uFail;
  uniform float uMask;
  varying vec2 vUv;
  void main() {
    vec4 f = texture2D(uField, vUv);
    float land = f.r;
    float debris = f.g * (1.0 - land);
    float detail = f.b;
    float water = mix(0.6, 0.04, smoothstep(0.0, 0.55, uBand));
    float ground = mix(0.3, 0.95, smoothstep(0.3, 0.7, uBand)) * (0.65 + 0.35 * detail);
    float floating = mix(0.25, 1.0, smoothstep(0.3, 0.6, uBand));
    float value = mix(water * (0.75 + 0.25 * detail), ground, land);
    value = mix(value, floating, debris);
    vec2 edge = min(vUv, 1.0 - vUv);
    float frame = 1.0 - smoothstep(0.0, 0.01, min(edge.x, edge.y));
    float scan = exp(-pow((vUv.x - uScan) * 34.0, 2.0)) * uScanOn;
    // On paper: each band is its hue, stronger where the surface is bright at that wavelength.
    vec3 color = mix(vec3(1.0), uColor, 0.12 + 0.78 * value);
    color = mix(color, vec3(0.04, 0.08, 0.13), frame);
    color = mix(color, vec3(0.13, 0.21, 0.79), scan);
    // The classification layer: water pale, land in rule grey, debris in the debris colour.
    vec3 classes = mix(vec3(0.91, 0.93, 0.95), vec3(0.76, 0.75, 0.7), land);
    classes = mix(classes, vec3(0.77, 0.31, 0.23), debris);
    classes = mix(classes, vec3(0.04, 0.08, 0.13), frame);
    color = mix(color, classes, uMask);
    color = mix(color, vec3(0.59, 0.22, 0.15) * (0.6 + 0.4 * value), uFail);
    float alpha = uOpacity * mix(0.35 + 0.55 * value, 1.0, uMask) + frame * uOpacity + scan * 0.6;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`

/** The analysis as a stack of light: the 11 bands, the scan, and the debris the model finds. */
export default function SpectralStackScene(props: SpectralStackSceneProps) {
  return (
    <Canvas
      aria-hidden
      dpr={[1, 2]}
      camera={{ fov: 34, position: [2.7, 2.1, 2.9], near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true }}
      frameloop={!props.active ? 'never' : props.reducedMotion ? 'demand' : 'always'}
      style={CANVAS_STYLE}
      onCreated={({ camera }) => camera.lookAt(0, -0.05, 0)}
    >
      <Stack {...props} />
    </Canvas>
  )
}

function Stack({ phase, uploadPercent, reducedMotion }: SpectralStackSceneProps) {
  const field = useMemo(() => buildField(), [])
  const root = useRef<THREE.Group>(null)
  const planes = useRef<(THREE.Mesh | null)[]>([])
  const mask = useRef<THREE.Mesh>(null)
  const laser = useRef<THREE.Mesh>(null)
  const voxels = useRef<THREE.InstancedMesh>(null)
  const phaseStart = useRef<number | null>(null)
  const scratch = useRef(new THREE.Object3D())
  const invalidate = useThree((state) => state.invalidate)
  const clock = useThree((state) => state.clock)
  const barMaterial = useMemo(() => createBarMaterial(), [])

  const bandMaterials = useMemo(
    () =>
      SPECTRAL_BANDS.map(
        (band, i) =>
          new THREE.ShaderMaterial({
            uniforms: {
              uField: { value: field.texture },
              uColor: { value: new THREE.Color(band.color) },
              uBand: { value: i / (SPECTRAL_BANDS.length - 1) },
              uOpacity: { value: 0 },
              uScan: { value: -1 },
              uScanOn: { value: 0 },
              uFail: { value: 0 },
              uMask: { value: 0 },
            },
            vertexShader: BAND_VERTEX,
            fragmentShader: BAND_FRAGMENT,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
      ),
    [field],
  )
  const maskMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uField: { value: field.texture },
          uColor: { value: new THREE.Color('#2235c9') },
          uBand: { value: 0.5 },
          uOpacity: { value: 0 },
          uScan: { value: -1 },
          uScanOn: { value: 0 },
          uFail: { value: 0 },
          uMask: { value: 1 },
        },
        vertexShader: BAND_VERTEX,
        fragmentShader: BAND_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [field],
  )

  // Each phase starts its own clock; under reduced motion, redraw once per change.
  useEffect(() => {
    phaseStart.current = clock.elapsedTime
    invalidate()
  }, [phase, uploadPercent, clock, invalidate])

  // Voxels start flat and take the debris colour, before the first frame draws them.
  useLayoutEffect(() => {
    const mesh = voxels.current
    if (!mesh) return
    const color = new THREE.Color(DEBRIS_COLOR)
    const flat = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001)
    for (let i = 0; i < mesh.count; i++) {
      mesh.setColorAt(i, color)
      mesh.setMatrixAt(i, flat)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.instanceMatrix.needsUpdate = true
  }, [field])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const sinceStart = t - (phaseStart.current ?? t)
    // Damp quickly, or jump straight there under reduced motion.
    const ease = (current: number, target: number, rate = 4) =>
      reducedMotion ? target : damp(current, target, rate, delta)
    const spacing = SPACING[phase]
    const arrived =
      phase === 'idle'
        ? SPECTRAL_BANDS.length
        : phase === 'upload'
          ? Math.max(1, ((uploadPercent ?? 0) / 100) * SPECTRAL_BANDS.length)
          : SPECTRAL_BANDS.length
    const scanning = phase === 'detect'
    const scan = scanning ? (reducedMotion ? 0.6 : (sinceStart / 2.4) % 1) : -1
    const collapsed = phase === 'map' || phase === 'done'
    const failed = phase === 'failed'

    if (root.current && !reducedMotion) {
      root.current.rotation.y = Math.sin(t * 0.18) * 0.35 - 0.25
      root.current.position.y = Math.sin(t * 0.9) * 0.02
    }

    planes.current.forEach((mesh, i) => {
      if (!mesh) return
      const material = mesh.material
      if (!(material instanceof THREE.ShaderMaterial)) return
      const present = i < arrived
      const targetY = BASE_Y + 0.12 + i * spacing + (present ? 0 : 1.4)
      mesh.position.y = ease(mesh.position.y, targetY, 5)
      const u = material.uniforms
      const opacity = present ? (collapsed ? 0.15 : 0.85) : 0
      u.uOpacity!.value = ease(u.uOpacity!.value as number, opacity, 5)
      u.uScan!.value = scan
      u.uScanOn!.value = ease(u.uScanOn!.value as number, scanning ? 1 : 0, 6)
      u.uFail!.value = ease(u.uFail!.value as number, failed ? 1 : 0, 3)
    })

    const maskMesh = mask.current
    if (maskMesh && maskMesh.material instanceof THREE.ShaderMaterial) {
      const u = maskMesh.material.uniforms
      const show = scanning || collapsed ? 1 : phase === 'preprocess' ? 0.35 : 0
      u.uOpacity!.value = ease(u.uOpacity!.value as number, failed ? 0 : show, 4)
      maskMesh.position.y = ease(
        maskMesh.position.y,
        collapsed ? BASE_Y + 0.12 + 11 * spacing + 0.04 : BASE_Y,
        3,
      )
    }

    const sheet = laser.current
    if (sheet) {
      sheet.visible = scanning
      sheet.position.x = (scan - 0.5) * PLANE
      sheet.position.y = BASE_Y + 0.12 + (SPECTRAL_BANDS.length * spacing) / 2 - 0.08
      sheet.scale.y = SPECTRAL_BANDS.length * spacing + 0.5
    }

    // Debris voxels rise from the classification layer as the scan passes over them.
    const mesh = voxels.current
    if (mesh && maskMesh) {
      const dummy = scratch.current
      field.debris.forEach((cell, i) => {
        const reached = scanning ? (cell.x / PLANE + 0.5 < scan || sinceStart > 2.4 ? 1 : 0) : 0
        const target = failed ? 0 : collapsed ? 1 : reached
        const height = (0.05 + cell.weight * 0.16) * target
        mesh.getMatrixAt(i, dummy.matrix)
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
        const h = ease(dummy.scale.y, Math.max(height, 0.0001), 6)
        dummy.position.set(cell.x, maskMesh.position.y + h / 2, cell.z)
        dummy.scale.set(PLANE / 32 - 0.006, h, PLANE / 32 - 0.006)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={root}>
      {SPECTRAL_BANDS.map((band, i) => (
        <mesh
          key={band.name}
          ref={(el) => {
            planes.current[i] = el
          }}
          rotation-x={-Math.PI / 2}
          position-y={BASE_Y + 1.6}
          material={bandMaterials[i]}
        >
          <planeGeometry args={[PLANE, PLANE]} />
        </mesh>
      ))}
      <mesh ref={mask} rotation-x={-Math.PI / 2} position-y={BASE_Y} material={maskMaterial}>
        <planeGeometry args={[PLANE, PLANE]} />
      </mesh>
      {/* The scan: a sheet of light crossing the stack from west to east. */}
      <mesh ref={laser} visible={false} rotation-y={Math.PI / 2}>
        <planeGeometry args={[PLANE, 1]} />
        <meshBasicMaterial
          color="#2235c9"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <instancedMesh
        ref={voxels}
        args={[undefined, undefined, Math.max(1, field.debris.length)]}
        material={barMaterial}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  )
}
