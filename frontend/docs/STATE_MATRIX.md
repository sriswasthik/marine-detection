# UI state coverage matrix

Every surface against every state a person can meet. Each cell is one of:

- **implemented**: designed and handled
- **n/a**: the state cannot occur on this surface
- **missing**: the state can occur but was not handled

The audit table records what was found before this pass. The current table records the state after the fixes, with where each state lives. Automated checks are in `src/pages/SurfaceStates.test.tsx`, and every shared variant can be reviewed at `/design/states` (development only).

## State definitions

| State | Meaning |
|---|---|
| Empty | No observations exist yet. On observation pages it means the id matches nothing (not found). |
| Uploading | An image is being sent to the processing service. |
| Processing | An analysis is running: the run on Analyze, or an observation whose status is `queued` or `processing`. |
| Success | A completed result is shown. |
| Partial success | Detections are available but the geospatial metadata is incomplete: no CRS, no bounds, `PARTIAL_GEOREF`, or detections dropped because they failed validation. |
| Low confidence | Average confidence is below `CONFIDENCE_THRESHOLDS.low`, or the result carries `LOW_CONFIDENCE`. |
| Invalid image | The uploaded file cannot be analysed. The message says what to do. |
| Server/model failure | A request or the model failed. Retry keeps what the user entered. On observation pages this also covers a `failed` observation. |
| No debris | A valid result with zero detections, stated plainly rather than shown as an empty map. |
| Loading | Data is on its way. The skeleton matches the real layout. |
| Offline | The device has no connection. Requests fail at once instead of hanging, and a quiet bar says so. |

## Audit (before)

| Surface | Empty | Uploading | Processing | Success | Partial success | Low confidence | Invalid image | Server/model failure | No debris | Loading | Offline |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Overview | implemented | n/a | missing | implemented | missing | missing ¹ | n/a | implemented ² | implemented | implemented | missing |
| Analyze | implemented | implemented | implemented | implemented | missing | missing | implemented | implemented | implemented | implemented | missing |
| Map | missing ³ | n/a | missing | implemented | implemented | missing ¹ | n/a | implemented ² | implemented | implemented ⁴ | missing |
| Observation detail | implemented | n/a | implemented | implemented | implemented | missing ¹ | n/a | implemented ² | implemented | implemented | missing |
| Observations list | missing | n/a | missing | missing | missing | missing | n/a | missing | missing | missing | missing |
| Settings | n/a | n/a | n/a | missing | n/a | n/a | n/a | missing | n/a | missing | missing |
| Report | missing | n/a | missing | missing | missing | missing | n/a | missing | missing | missing | missing |

1. Only the `LOW_CONFIDENCE` flag was shown, inside a side panel. The average-confidence rule was not applied, and there was no banner at the top.
2. The copy was generic and written separately on each page. A 404 and a network failure looked the same on the map.
3. With no observations, the map waited on a spinner indefinitely.
4. It showed a spinner, not the layout's shape.

On every surface, an offline request was paused by TanStack Query, so the spinner stayed up indefinitely.

## Current (after)

| Surface | Empty | Uploading | Processing | Success | Partial success | Low confidence | Invalid image | Server/model failure | No debris | Loading | Offline |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Overview | implemented | n/a | implemented | implemented | implemented | implemented | n/a | implemented | implemented | implemented | implemented |
| Analyze | implemented | implemented | implemented | implemented | implemented | implemented | implemented | implemented | implemented | implemented | implemented |
| Map | implemented | n/a | implemented | implemented | implemented | implemented | n/a | implemented | implemented | implemented | implemented |
| Observation detail | implemented | n/a | implemented | implemented | implemented | implemented | n/a | implemented | implemented | implemented | implemented |
| Observations list | implemented | n/a | implemented | implemented | implemented | implemented | n/a | implemented | implemented | implemented | implemented |
| Settings | n/a | n/a | n/a | implemented | n/a | n/a | n/a | implemented | n/a | implemented | implemented |
| Report | implemented | n/a | implemented | implemented | implemented | implemented | n/a | implemented | implemented | implemented | implemented |

There are no missing cells.

### Why the n/a cells are n/a

- **Uploading:** only Analyze uploads. The run belongs to the Analyze page.
- **Invalid image:** files are only chosen and checked on Analyze. Elsewhere a broken response is an `INVALID_RESPONSE` server failure.
- **Settings:** it shows preferences and the service status, not results. Empty, processing, partial, low confidence and no debris do not apply.

## Where each state lives

| State | Shared component or rule | Used by |
|---|---|---|
| Empty | `NoObservations`, `ObservationNotFound` (`features/observations/components/ObservationStates.tsx`). The map has its own "Nothing to map yet". | Overview, Observations list, Map, Detail, Report |
| Uploading, Processing (run) | `ProcessingStepper`, `runReducer` | Analyze |
| Processing, failed (observation) | `ObservationStatusState`, `hasResult` (`features/observations/status.ts`) | Overview, Map, Detail, Report. The list shows status badges. |
| Partial success | `observationNotices` and `hasApproximatePositions` (`lib/warnings.ts`), `ObservationNotices` | Overview, Map, Detail, Report, Analyze success, list row badges |
| Low confidence | `isLowConfidenceResult` (`lib/warnings.ts`). Detections are dashed and lighter through `getDetectionStyle`, which is also used by the trace view and the segmentation thumbnail. | Overview, Map, Detail, Report, Analyze success, list row badges |
| Invalid image | `failureFromAppError` → danger `Banner` with "Choose another file" | Analyze |
| Server/model failure | `toAppError` → `ErrorState` / `LoadError`, and `FailurePanel` on Analyze. Retry keeps the file and details. | All surfaces |
| No debris | `NoDebrisCard`, a no-debris statement, and real zeros in the figures | Overview, Map, Detail, Report, list, Analyze |
| Loading | `PageSkeleton`, `SkeletonPageHeader`, `SkeletonCard`, `SkeletonMetricCards`, `SkeletonTable`, `SkeletonMap` | All surfaces |
| Offline | `withResilience` (the API fails fast), `networkMode: 'always'`, `OfflineBanner` (refetches failed queries on reconnect), and Run detection blocked on Analyze | All surfaces |
| Broken panel | `ErrorBoundary` (component level), `RouteErrorBoundary` (route level) | Every major panel. Routes fall back to the route boundary. |

Error copy for every code lives in `src/lib/errors/errorCopy.ts`. The normalizer is `src/lib/errors/appError.ts`.
