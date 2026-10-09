import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { createRandom } from '@/features/observations/mock/random'
import { DENSITY_LEVELS } from '@/lib/density'
import {
  globeFocus,
  latLngToVector3,
  orbitPosition,
  orbitRadius,
  SENTINEL2,
  swathHalfAngle,
  type GlobeMarker,
} from '@/lib/scene3d'
import type { SceneRuntime } from '../SceneHost'
import { landDotPositions } from './landDots'
import { CANVAS_STYLE, damp, useDragRotate } from './shared'

/** A valid "no debris" result is success green on the globe. */
const NO_DEBRIS_COLOR = '#2e6343'
const INK = '#0b1520'
/** Ultramarine: the satellite, its orbit and its swath. */
const ORBIT = '#2235c9'

export interface OrbitalGlobeSceneProps extends SceneRuntime {
  markers: GlobeMarker[]
  highlightedId: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  /** DOM labels by marker id; the scene moves each one to follow its marker. */
  labels: RefObject<Map<string, HTMLElement>>
}

/** The Earth from orbit: where each observation was imaged, and the satellite that imaged it. */
export default function OrbitalGlobeScene(props: OrbitalGlobeSceneProps) {
  return (
    <Canvas
      aria-hidden
      dpr={[1, 2]}
      camera={{ fov: 30, position: [0, 0, 4.6], near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      frameloop={!props.active ? 'never' : props.reducedMotion ? 'demand' : 'always'}
      style={CANVAS_STYLE}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 3, 5]} intensity={1.6} />
      <Globe {...props} />
    </Canvas>
  )
}

function markerColor(marker: GlobeMarker): string {
  return marker.level ? DENSITY_LEVELS[marker.level].color : NO_DEBRIS_COLOR
}

/** The spin that brings a longitude to face the camera, and the tilt that centres a latitude. */
const yawFor = (lng: number) => THREE.MathUtils.degToRad(-90 - lng)
const pitchFor = (lat: number) => THREE.MathUtils.degToRad(lat) * 0.85

function Globe({
  markers,
  highlightedId,
  onHover,
  onSelect,
  labels,
  reducedMotion,
}: OrbitalGlobeSceneProps) {
  const tilt = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const drag = useDragRotate(0.6)
  const invalidate = useThree((state) => state.invalidate)
  const focus = useMemo(() => globeFocus(markers), [markers])
  const highlighted = markers.find((m) => m.id === highlightedId) ?? null
  const scratch = useRef(new THREE.Vector3())
  const normal = useRef(new THREE.Vector3())
  const labelAnchors = useMemo(
    () =>
      markers.map((m) => ({
        id: m.id,
        top: new THREE.Vector3(...latLngToVector3(m.lat, m.lng, 1 + m.beamHeight + 0.02)),
      })),
    [markers],
  )

  // Under reduced motion the scene renders on demand: redraw when what it shows changes.
  useEffect(() => invalidate(), [invalidate, markers, highlightedId])

  useFrame((state, delta) => {
    const spinGroup = spin.current
    const tiltGroup = tilt.current
    if (!spinGroup || !tiltGroup) return
    const t = state.clock.elapsedTime
    const sway = reducedMotion ? 0 : Math.sin(t * 0.08) * 0.5
    const target = highlighted ?? focus
    const yaw = yawFor(target.lng) + (highlighted ? 0 : sway) + drag.current.yaw
    const pitch = pitchFor(target.lat) + drag.current.pitch
    if (reducedMotion) {
      spinGroup.rotation.y = yaw
      tiltGroup.rotation.x = pitch
      spinGroup.scale.setScalar(1)
    } else {
      spinGroup.rotation.y = damp(spinGroup.rotation.y, yaw, highlighted ? 3 : 1.2, delta)
      tiltGroup.rotation.x = damp(tiltGroup.rotation.x, pitch, 2, delta)
      spinGroup.scale.setScalar(damp(spinGroup.scale.x, 1, 1.5, delta))
    }

    // Move each DOM label to its beam's tip; hide it while the marker is round the back.
    spinGroup.updateMatrixWorld()
    const { width, height } = state.size
    for (const anchor of labelAnchors) {
      const element = labels.current?.get(anchor.id)
      if (!element) continue
      const world = scratch.current.copy(anchor.top).applyMatrix4(spinGroup.matrixWorld)
      const facing = normal.current
        .copy(world)
        .normalize()
        .dot(state.camera.position.clone().sub(world).normalize())
      const ndc = world.project(state.camera)
      const x = ((ndc.x + 1) / 2) * width
      const y = ((1 - ndc.y) / 2) * height
      element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      const opacity = THREE.MathUtils.clamp((facing - 0.15) * 4, 0, 1)
      element.style.opacity = String(opacity)
      element.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none'
      element.style.visibility = opacity > 0.01 ? 'visible' : 'hidden'
    }
  })

  return (
    <group ref={tilt}>
      <group ref={spin} scale={0.86}>
        <Ocean />
        <Graticule />
        <LandDots />
        {markers.map((marker, index) => (
          <Marker
            key={marker.id}
            marker={marker}
            index={index}
            highlighted={marker.id === highlightedId}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))}
        <Satellite reducedMotion={reducedMotion} />
      </group>
    </group>
  )
}

/** The sea: a white sphere that greys towards the limb, like a globe printed on paper. */
function Ocean() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uDeep: { value: new THREE.Color('#ffffff') },
          uRim: { value: new THREE.Color('#e2e4e8') },
        },
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uDeep;
          uniform vec3 uRim;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.5);
            vec3 color = mix(uDeep, uRim, fresnel);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [],
  )
  return (
    <mesh material={material}>
      <sphereGeometry args={[0.995, 96, 96]} />
    </mesh>
  )
}

/** Meridians and parallels every 30 degrees: the survey chart, wrapped round the globe. */
function Graticule() {
  const lines = useMemo(() => {
    const points: number[] = []
    const push = (a: readonly number[], b: readonly number[]) => points.push(...a, ...b)
    for (let lng = -180; lng < 180; lng += 30) {
      for (let lat = -88; lat < 88; lat += 4) {
        push(latLngToVector3(lat, lng, 1.001), latLngToVector3(lat + 4, lng, 1.001))
      }
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lng = -180; lng < 180; lng += 4) {
        push(latLngToVector3(lat, lng, 1.001), latLngToVector3(lat, lng + 4, 1.001))
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    const material = new THREE.LineBasicMaterial({
      color: INK,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    })
    return new THREE.LineSegments(geometry, material)
  }, [])
  return <primitive object={lines} />
}

/** The coastlines as a field of ink dots. */
function LandDots() {
  const points = useRef<THREE.Points>(null)
  const object = useMemo(() => {
    const positions = landDotPositions(0.85, 1.003)
    const count = positions.length / 3
    const random = createRandom('land-dots')
    const seeds = Float32Array.from({ length: count }, () => random.next())
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 9 },
        uColorA: { value: new THREE.Color('#0b1520') },
        uColorB: { value: new THREE.Color('#565e68') },
      },
      vertexShader: /* glsl */ `
        uniform float uSize;
        attribute float aSeed;
        varying float vSeed;
        varying float vFacing;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normalize(position));
          vFacing = dot(n, normalize(-mv.xyz));
          vSeed = aSeed;
          gl_PointSize = uSize / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vSeed;
        varying float vFacing;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float core = smoothstep(0.5, 0.35, d);
          float twinkle = 0.55;
          float limb = smoothstep(-0.05, 0.5, vFacing);
          vec3 color = mix(uColorA, uColorB, smoothstep(0.2, 1.0, vSeed));
          gl_FragColor = vec4(color, core * limb * twinkle);
        }
      `,
      transparent: true,
      depthWrite: false,
    })
    return new THREE.Points(geometry, material)
  }, [])

  useFrame((state) => {
    const material = points.current?.material
    if (material instanceof THREE.ShaderMaterial) {
      material.uniforms.uTime!.value = state.clock.elapsedTime
      material.uniforms.uSize!.value = 9 * state.viewport.dpr
    }
  })

  return <primitive ref={points} object={object} />
}

/**
 * One observation: a light beam rising from where the image was taken, its height growing with the
 * number of detections and its colour the observation's density level, with a sonar ring at its
 * foot. Hovering or clicking it works like the list beside the globe.
 */
function Marker({
  marker,
  index,
  highlighted,
  onHover,
  onSelect,
}: {
  marker: GlobeMarker
  index: number
  highlighted: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const color = markerColor(marker)
  const ring = useRef<THREE.Mesh>(null)
  const beam = useRef<THREE.Group>(null)
  const { position, quaternion } = useMemo(() => {
    const p = new THREE.Vector3(...latLngToVector3(marker.lat, marker.lng, 1))
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      p.clone().normalize(),
    )
    return { position: p, quaternion: q }
  }, [marker.lat, marker.lng])

  useFrame((state, delta) => {
    const phase = ((state.clock.elapsedTime + index * 0.73) % 2.6) / 2.6
    const ringMesh = ring.current
    if (ringMesh) {
      ringMesh.scale.setScalar(1 + phase * (highlighted ? 5 : 3.2))
      const material = ringMesh.material
      if (material instanceof THREE.MeshBasicMaterial) material.opacity = (1 - phase) * 0.85
    }
    const beamGroup = beam.current
    if (beamGroup) {
      beamGroup.scale.y = damp(beamGroup.scale.y, highlighted ? 1.6 : 1, 6, delta)
      beamGroup.scale.x = beamGroup.scale.z = damp(
        beamGroup.scale.x,
        highlighted ? 1.8 : 1,
        6,
        delta,
      )
    }
  })

  const enter = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    document.body.style.cursor = 'pointer'
    onHover(marker.id)
  }
  const leave = () => {
    document.body.style.cursor = ''
    onHover(null)
  }

  return (
    <group position={position} quaternion={quaternion}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
        <circleGeometry args={[0.013, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.003}>
        <ringGeometry args={[0.016, 0.0195, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <group ref={beam}>
        <mesh position-y={marker.beamHeight / 2}>
          <cylinderGeometry args={[0.0032, 0.0032, marker.beamHeight, 8, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} />
        </mesh>
        <mesh position-y={marker.beamHeight / 2}>
          <cylinderGeometry args={[0.011, 0.004, marker.beamHeight, 16, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
        </mesh>
        <mesh position-y={marker.beamHeight}>
          <sphereGeometry args={[0.0105, 16, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
      {/* A generous invisible target, so a thin beam is easy to point at. */}
      <mesh
        position-y={marker.beamHeight / 2}
        onPointerOver={enter}
        onPointerOut={leave}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(marker.id)
        }}
      >
        <cylinderGeometry args={[0.045, 0.045, marker.beamHeight + 0.08, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

const TRAIL_POINTS = 140
const TRAIL_STEP = 0.014

/**
 * Sentinel-2 on its real orbit (786 km, 98.62 degrees, to scale with the globe), its 290 km swath
 * as a cone of light down to the surface, and the ground track fading out behind it.
 */
function Satellite({ reducedMotion }: { reducedMotion: boolean }) {
  const node = useRef<THREE.Group>(null)
  const craft = useRef<THREE.Group>(null)
  const beacon = useRef<THREE.Mesh>(null)
  const radius = orbitRadius()
  const height = radius - 1
  const swathRadius = height * Math.tan(swathHalfAngle())

  const orbit = useMemo(() => {
    const points: number[] = []
    for (let i = 0; i <= 256; i++) {
      points.push(...orbitPosition((i / 256) * Math.PI * 2, radius, SENTINEL2.inclinationDeg))
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    const material = new THREE.LineDashedMaterial({
      color: ORBIT,
      transparent: true,
      opacity: 0.35,
      dashSize: 0.02,
      gapSize: 0.018,
      depthWrite: false,
    })
    const line = new THREE.Line(geometry, material)
    line.computeLineDistances()
    return line
  }, [radius])

  const trail = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3),
    )
    geometry.setAttribute(
      'aFade',
      new THREE.BufferAttribute(
        Float32Array.from({ length: TRAIL_POINTS }, (_, i) => 1 - i / (TRAIL_POINTS - 1)),
        1,
      ),
    )
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(ORBIT) } },
      vertexShader: /* glsl */ `
        attribute float aFade;
        varying float vFade;
        void main() {
          vFade = aFade;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vFade;
        void main() {
          gl_FragColor = vec4(uColor, vFade * vFade * 0.8);
        }
      `,
      transparent: true,
      depthWrite: false,
    })
    return new THREE.Line(geometry, material)
  }, [])

  useFrame((state) => {
    const t = reducedMotion ? 1.4 : state.clock.elapsedTime
    // About one orbit every 20 seconds; the track drifts west as the Earth turns beneath it.
    const angle = 1.1 + t * 0.3
    if (node.current) node.current.rotation.y = t * 0.025
    const group = craft.current
    if (group) {
      group.position.set(...orbitPosition(angle, radius, SENTINEL2.inclinationDeg))
      group.lookAt(0, 0, 0)
    }
    if (beacon.current) beacon.current.visible = reducedMotion || Math.sin(t * 6) > 0.2
    const attribute = trail.geometry.getAttribute('position')
    if (attribute instanceof THREE.BufferAttribute) {
      for (let i = 0; i < TRAIL_POINTS; i++) {
        const [x, y, z] = orbitPosition(angle - i * TRAIL_STEP, 1.004, SENTINEL2.inclinationDeg)
        attribute.setXYZ(i, x, y, z)
      }
      attribute.needsUpdate = true
    }
  })

  return (
    <group ref={node}>
      <primitive object={orbit} />
      <primitive object={trail} />
      <group ref={craft}>
        {/* +z points at the Earth (lookAt). */}
        <mesh>
          <boxGeometry args={[0.016, 0.012, 0.024]} />
          <meshStandardMaterial color={INK} metalness={0.2} roughness={0.6} />
        </mesh>
        <mesh position-x={0.034}>
          <boxGeometry args={[0.048, 0.0015, 0.018]} />
          <meshStandardMaterial
            color={ORBIT}
            emissive={ORBIT}
            emissiveIntensity={0.3}
            metalness={0.3}
            roughness={0.4}
          />
        </mesh>
        <mesh ref={beacon} position={[0, 0.009, -0.006]}>
          <sphereGeometry args={[0.003, 8, 8]} />
          <meshBasicMaterial color={ORBIT} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-z={height / 2}>
          <coneGeometry args={[swathRadius, height, 40, 1, true]} />
          <meshBasicMaterial
            color={ORBIT}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position-z={height - 0.002}>
          <ringGeometry args={[swathRadius * 0.86, swathRadius, 48]} />
          <meshBasicMaterial
            color={ORBIT}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  )
}
