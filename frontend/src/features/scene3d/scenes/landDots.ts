import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import land110 from 'world-atlas/land-110m.json'
import { globeSamplePositions, latLngToVector3 } from '@/lib/scene3d'

const WIDTH = 1024
const HEIGHT = 512

/**
 * Positions (x, y, z per dot) of evenly spaced dots on land, from Natural Earth's 1:110m land
 * polygons (world-atlas). The land is drawn once into an equirectangular canvas and sampled, which
 * is much faster than a point-in-polygon test per dot.
 */
export function landDotPositions(stepDeg: number, radius: number): Float32Array {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return new Float32Array()

  const topology = land110 as unknown as Topology<{ land: GeometryCollection }>
  const land = feature(topology, topology.objects.land)
  const projection = geoEquirectangular()
    .scale(WIDTH / (2 * Math.PI))
    .translate([WIDTH / 2, HEIGHT / 2])
  context.fillStyle = '#fff'
  context.beginPath()
  geoPath(projection, context)(land)
  context.fill()
  const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data

  const out: number[] = []
  for (const { lat, lng } of globeSamplePositions(stepDeg)) {
    const x = Math.min(WIDTH - 1, Math.floor(((lng + 180) / 360) * WIDTH))
    const y = Math.min(HEIGHT - 1, Math.floor(((90 - lat) / 180) * HEIGHT))
    if ((pixels[(y * WIDTH + x) * 4 + 3] ?? 0) > 127) out.push(...latLngToVector3(lat, lng, radius))
  }
  return Float32Array.from(out)
}
