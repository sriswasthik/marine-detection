/**
 * Rows of headline figures ruled with hairlines instead of cards: a rule above the row, one under
 * each cell and one between cells in a line. Two columns on phones; three or four from 1024px.
 * Shared by the real rows and their loading skeletons so both line up. The first cell of each line
 * sits flush with the page text.
 */
export const KPI_ROW = 'grid grid-cols-2 border-t border-hairline lg:grid-cols-4'
export const KPI_ROW_3 = 'grid grid-cols-2 border-t border-hairline lg:grid-cols-3'

const CELL = 'border-b border-hairline px-4 py-5 max-lg:odd:pl-0 max-lg:even:border-l'

/** A cell in a four-column row (the Overview). */
export const KPI_CELL = `${CELL} lg:[&:nth-child(4n+1)]:pl-0 lg:[&:not(:nth-child(4n+1))]:border-l`

/** A cell in a three-column row (the detail page's measurements). */
export const KPI_CELL_3 = `${CELL} lg:[&:nth-child(3n+1)]:pl-0 lg:[&:not(:nth-child(3n+1))]:border-l`
