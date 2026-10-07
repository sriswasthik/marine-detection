/**
 * Basemap failure tracking. A few failed tiles are normal; a run of failures with no successful
 * tile in between means the basemap is unreachable (offline demo, blocked network).
 */
export const TILE_FAILURE_THRESHOLD = 6

export interface TileFailureState {
  consecutiveErrors: number
  loadedTiles: number
  /** True once the threshold is reached. A later successful tile clears it. */
  unavailable: boolean
}

export const INITIAL_TILE_FAILURE_STATE: TileFailureState = {
  consecutiveErrors: 0,
  loadedTiles: 0,
  unavailable: false,
}

export type TileEvent = { type: 'tileerror' } | { type: 'tileload' } | { type: 'reset' }

export function tileFailureReducer(state: TileFailureState, event: TileEvent): TileFailureState {
  switch (event.type) {
    case 'tileload':
      return { consecutiveErrors: 0, loadedTiles: state.loadedTiles + 1, unavailable: false }
    case 'tileerror': {
      const consecutiveErrors = state.consecutiveErrors + 1
      return {
        ...state,
        consecutiveErrors,
        unavailable: state.unavailable || consecutiveErrors >= TILE_FAILURE_THRESHOLD,
      }
    }
    case 'reset':
      return INITIAL_TILE_FAILURE_STATE
  }
}
