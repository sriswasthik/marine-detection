import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { DensityLevel } from '@/features/observations/types'
import { DENSITY_LEVELS } from '@/lib/density'
import type { ReliefBar } from '@/lib/scene3d'
import type { SceneRuntime } from '../SceneHost'
import { CANVAS_STYLE, createBarMaterial, damp, easeOut, useDragRotate } from './shared'

export interface ReliefHotspot {
  id: string
  rank: number
  level: DensityLevel
  x: number
  z: number
}

export interface DensityReliefSceneProps extends SceneRuntime {
  bars: ReliefBar[]
  extent: { width: number; depth: number }
  rows: number
  cols: number
  hotspots: ReliefHotspot[]
  onHover: (bar: ReliefBar | null) => void
  /** DOM labels by hotspot id; the scene moves each one above its beacon. */
  labels: RefObject<Map<string, HTMLElement>>
}

/** The density grid in relief: every cell holding debris as a bar, the hotspots as beacons. */
export default function DensityReliefScene(props: DensityReliefSceneProps) {
  return (
    <Canvas
      aria-hidden
      dpr={[1, 2]}
      camera={{ fov: 32, position: [1.95, 1.75, 2.25], near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true }}
      frameloop={!props.active ? 'never' : props.reducedMotion ? 'demand' : 'always'}
      style={CANVAS_STYLE}
      onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}
    >
      <Relief {...props} />
    </Canvas>
  )
}

function Relief({
  bars,
  extent,
  rows,
  cols,
  hotspots,
  onHover,
  labels,
  reducedMotion,
}: DensityReliefSceneProps) {
  const root = useRef<THREE.Group>(null)
  const mesh = useRef<THREE.InstancedMesh>(null)
  const hovered = useRef<number | null>(null)
  const born = useRef<number | null>(null)
  const scratch = useRef(new THREE.Object3D())
  const point = useRef(new THREE.Vector3())
  const drag = useDragRotate(0.35)
  const invalidate = useThree((state) => state.invalidate)
  const material = useMemo(() => createBarMaterial(), [])
  const colors = useMemo(
    () => bars.map((bar) => new THREE.Color(DENSITY_LEVELS[bar.level].color)),
    [bars],
  )
  const tallest = useMemo(() => bars.reduce((max, bar) => Math.max(max, bar.height), 0.2), [bars])

  useLayoutEffect(() => {
    const instances = mesh.current
    if (!instances) return
    const flat = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001)
    colors.forEach((color, i) => {
      instances.setColorAt(i, color)
      instances.setMatrixAt(i, flat)
    })
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true
    instances.instanceMatrix.needsUpdate = true
    born.current = null
  }, [colors])

  useEffect(() => invalidate(), [invalidate, bars, hotspots])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    if (born.current === null) born.current = t
    const age = t - born.current
    const group = root.current
    if (group) {
      const sway = reducedMotion ? 0 : Math.sin(t * 0.12) * 0.45
      const yaw = -0.35 + sway + drag.current.yaw
      group.rotation.y = reducedMotion ? yaw : damp(group.rotation.y, yaw, 2, delta)
      group.rotation.x = reducedMotion
        ? drag.current.pitch
        : damp(group.rotation.x, drag.current.pitch, 3, delta)
    }

    // Bars grow out of the water, the tallest last, then hold.
    const instances = mesh.current
    if (instances) {
      const dummy = scratch.current
      bars.forEach((bar, i) => {
        const delay = (bar.height / tallest) * 0.6
        const grow = reducedMotion ? 1 : easeOut((age - delay) / 1.1)
        const lift = hovered.current === i ? 1.12 : 1
        const h = Math.max(0.0001, bar.height * grow * lift)
        dummy.position.set(bar.x, h / 2, bar.z)
        dummy.scale.set(bar.width * 0.86, h, bar.depth * 0.86)
        dummy.updateMatrix()
        instances.setMatrixAt(i, dummy.matrix)
      })
      instances.instanceMatrix.needsUpdate = true
    }

    // Hotspot labels follow their beacons.
    if (group) {
      group.updateMatrixWorld()
      const { width, height } = state.size
      for (const spot of hotspots) {
        const element = labels.current?.get(spot.id)
        if (!element) continue
        const p = point.current.set(spot.x, tallest + 0.32, spot.z).applyMatrix4(group.matrixWorld)
        p.project(state.camera)
        element.style.transform = `translate(${(((p.x + 1) / 2) * width).toFixed(1)}px, ${(((1 - p.y) / 2) * height).toFixed(1)}px)`
        element.style.opacity = '1'
      }
    }
  })

  const move = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    const index = event.instanceId ?? null
    if (index === hovered.current) return
    hovered.current = index
    document.body.style.cursor = index === null ? '' : 'crosshair'
    onHover(index === null ? null : (bars[index] ?? null))
    invalidate()
  }
  const leave = () => {
    hovered.current = null
    document.body.style.cursor = ''
    onHover(null)
    invalidate()
  }

  return (
    <group ref={root}>
      <Water width={extent.width} depth={extent.depth} rows={rows} cols={cols} />
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, Math.max(1, bars.length)]}
        material={material}
        onPointerMove={move}
        onPointerOut={leave}
        visible={bars.length > 0}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {hotspots.map((spot) => (
        <Beacon key={spot.id} spot={spot} top={tallest + 0.26} reducedMotion={reducedMotion} />
      ))}
    </group>
  )
}

/** The scene's water: a pale plate ruled with the grid of cells, framed in ink. */
function Water({
  width,
  depth,
  rows,
  cols,
}: {
  width: number
  depth: number
  rows: number
  cols: number
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uCells: { value: new THREE.Vector2(cols, rows) } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec2 uCells;
          varying vec2 vUv;
          void main() {
            vec2 g = abs(fract(vUv * uCells - 0.5) - 0.5) / fwidth(vUv * uCells);
            float line = 1.0 - min(min(g.x, g.y), 1.0);
            vec2 e = min(vUv, 1.0 - vUv);
            float frame = 1.0 - smoothstep(0.0, 0.004, min(e.x, e.y));
            vec3 water = vec3(0.92, 0.94, 0.95);
            vec3 ink = vec3(0.04, 0.08, 0.13);
            vec3 color = mix(water, ink, line * 0.14 + frame * 0.85);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [rows, cols],
  )
  return (
    <mesh rotation-x={-Math.PI / 2} material={material}>
      <planeGeometry args={[width, depth]} />
    </mesh>
  )
}

/** A hotspot: a beam from the water up to a ring at its rank, pulsing slowly. */
function Beacon({
  spot,
  top,
  reducedMotion,
}: {
  spot: ReliefHotspot
  top: number
  reducedMotion: boolean
}) {
  const ring = useRef<THREE.Mesh>(null)
  const color = DENSITY_LEVELS[spot.level].color
  useFrame((state) => {
    const r = ring.current
    if (!r) return
    const phase = reducedMotion ? 0.3 : ((state.clock.elapsedTime + spot.rank * 0.8) % 2.2) / 2.2
    r.scale.setScalar(1 + phase * 1.6)
    if (r.material instanceof THREE.MeshBasicMaterial) r.material.opacity = (1 - phase) * 0.9
  })
  return (
    <group position={[spot.x, 0, spot.z]}>
      <mesh position-y={top / 2}>
        <cylinderGeometry args={[0.004, 0.004, top, 8, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position-y={top} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.05, 0.062, 48]} />
        <meshBasicMaterial color={spot.rank === 1 ? '#0b1520' : color} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring} position-y={0.004} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.06, 0.07, 48]} />
        <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}
