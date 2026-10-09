/**
 * Plain-language explanations for the technical terms the app shows, used by the info tips next
 * to them. One place, so every screen explains a term the same way.
 */
export const GLOSSARY = {
  precision: 'Of the pixels the model marked as debris, the share that really were debris.',
  recall: 'Of the real debris pixels, the share the model found.',
  f1: 'One figure that balances precision and recall; higher is better.',
  accuracy: 'Share of all pixels the model put in the right class, across all 11 classes.',
  crs: 'The map projection the source image uses. Positions are converted to latitude and longitude for the map.',
} as const

export type GlossaryTerm = keyof typeof GLOSSARY
