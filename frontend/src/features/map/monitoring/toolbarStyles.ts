/**
 * Every control in the map toolbar shares one frame: 32px tall (40 on phones), a 1px rule border,
 * the control radius, the sheet fill and 13px text. `data-toolbar-control` lets the layout test
 * check they match.
 */
export const TOOLBAR_CONTROL =
  'inline-flex h-8 shrink-0 items-center rounded-control border border-rule bg-sheet text-small text-ink max-sm:h-10'

/** Hover and pressed states for the toolbar's buttons. */
export const TOOLBAR_BUTTON = `${TOOLBAR_CONTROL} gap-2 px-3 transition-colors duration-[120ms] ease-out hover:border-ink aria-expanded:border-ink [&_svg]:size-4 [&_svg]:shrink-0`
