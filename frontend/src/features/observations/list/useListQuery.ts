import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DEFAULT_LIST_QUERY,
  parseListSearch,
  serializeListSearch,
  type ListQuery,
} from '@/lib/observationList'

/** The table's search, filters and sort, kept in the URL. Typing replaces history; clicks add to it. */
export function useListQuery() {
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => parseListSearch(params), [params])

  const update = useCallback(
    (patch: Partial<ListQuery>, options: { replace?: boolean } = {}) => {
      setParams((current) => serializeListSearch({ ...parseListSearch(current), ...patch }), {
        replace: options.replace ?? false,
        preventScrollReset: true,
      })
    },
    [setParams],
  )

  const reset = useCallback(
    () =>
      setParams(
        (current) => {
          const { sort, direction } = parseListSearch(current)
          return serializeListSearch({ ...DEFAULT_LIST_QUERY, sort, direction })
        },
        { preventScrollReset: true },
      ),
    [setParams],
  )

  return { query, update, reset }
}
