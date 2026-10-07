export const EVIDENCE_MODES = ['original', 'segmentation', 'compare', 'geographic'] as const
export type EvidenceMode = (typeof EVIDENCE_MODES)[number]

export const EVIDENCE_MODE_LABELS: Readonly<Record<EvidenceMode, string>> = {
  original: 'Original',
  segmentation: 'Segmentation',
  compare: 'Compare',
  geographic: 'Geographic result',
}

/** One line under the viewer saying what the current view shows. */
export const EVIDENCE_MODE_DESCRIPTIONS: Readonly<Record<EvidenceMode, string>> = {
  original: 'The image as captured, fitted to its footprint.',
  segmentation: 'Model output: every outlined region was classified as floating debris.',
  compare: 'Drag the divider, or focus it and use the arrow keys, to compare image and output.',
  geographic: 'Detections placed on satellite imagery. Use the buttons to zoom.',
}

export const DEFAULT_EVIDENCE_MODE: EvidenceMode = 'segmentation'
