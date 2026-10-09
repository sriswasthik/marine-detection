import { useMemo } from 'react'
import type { Observation } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { DENSITY_LEVELS } from '@/lib/density'
import { isEmptyGlyph, observationGlyph, type GlyphGrid } from '@/lib/glyph'

const PAPER = '#E7E4DC'
const HAIRLINE = '#ADA89C'
const INK_3 = '#78756C'

export interface ObservationGlyphProps {
  /** The observation with its detections. Null (still loading) draws the empty frame. */
  observation: Pick<Observation, 'detections' | 'bounds' | 'resolutionM'> | null
  size?: 16 | 24 | 48
  className?: string
}

function GlyphCells({ glyph, size }: { glyph: GlyphGrid; size: number }) {
  const cellW = size / glyph.cols
  const cellH = size / glyph.rows
  return (
    <>
      {glyph.cells.map((level, index) =>
        level ? (
          <rect
            key={index}
            x={(index % glyph.cols) * cellW}
            y={Math.floor(index / glyph.cols) * cellH}
            width={cellW}
            height={cellH}
            fill={DENSITY_LEVELS[level].color}
          />
        ) : null,
      )}
    </>
  )
}

/**
 * Signature element 4: a tiny square drawing of the observation's density grid, one cell per
 * glyph cell coloured by level, empty cells paper, in a 1px frame. Deterministic from the
 * observation (it uses the map's own density grid), so the same scene always looks the same.
 * A scene without debris shows an empty grid with a centred tick. Decorative: name the
 * observation in text beside it.
 */
export function ObservationGlyph({ observation, size = 16, className }: ObservationGlyphProps) {
  const glyph = useMemo(() => (observation ? observationGlyph(observation) : null), [observation])
  const empty = !glyph || isEmptyGlyph(glyph)
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      data-empty={empty || undefined}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill={PAPER} />
      {glyph && !empty ? <GlyphCells glyph={glyph} size={size} /> : null}
      {glyph && empty ? (
        <line
          x1={size / 2}
          x2={size / 2}
          y1={size / 2 - size / 8}
          y2={size / 2 + size / 8}
          stroke={INK_3}
          strokeWidth={1}
        />
      ) : null}
      <rect
        x={0.5}
        y={0.5}
        width={size - 1}
        height={size - 1}
        fill="none"
        stroke={HAIRLINE}
        strokeWidth={1}
      />
    </svg>
  )
}
