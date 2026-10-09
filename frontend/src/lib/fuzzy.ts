/**
 * Fuzzy matching for the command palette: the query's characters must appear in order. Matches at
 * word starts, consecutive runs and the very start score higher. Case and accents are ignored.
 */

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const isWordStart = (text: string, index: number) =>
  index === 0 || /[\s/_\-.,:(·]/.test(text[index - 1] ?? '')

/** A score above 0 when every query character is found in order, else null. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = fold(query).replace(/\s+/g, '')
  if (!q) return 0
  const t = fold(text)
  let score = 0
  let from = 0
  let previous = -2
  for (const char of q) {
    // Prefer the next occurrence at a word start, else the next occurrence at all.
    let index = -1
    for (let i = t.indexOf(char, from); i !== -1; i = t.indexOf(char, i + 1)) {
      if (index === -1) index = i
      if (isWordStart(t, i) || i === previous + 1) {
        index = i
        break
      }
    }
    if (index === -1) return null
    score += 1
    if (index === previous + 1) score += 3
    if (isWordStart(t, index)) score += 2
    if (index === 0) score += 2
    previous = index
    from = index + 1
  }
  // Shorter texts are tighter matches.
  return score - t.length * 0.01
}

export interface Searchable {
  id: string
  label: string
  /** Extra text that also matches (ids, dates, synonyms). */
  keywords?: readonly string[]
}

/**
 * Ranks items for a query. An empty query lists recent items first (most recent first), then the
 * rest in their given order. Otherwise only matches, best first; a recent item wins a tie.
 */
export function rankItems<T extends Searchable>(
  items: readonly T[],
  query: string,
  recentIds: readonly string[] = [],
): T[] {
  const recency = new Map(recentIds.map((id, index) => [id, recentIds.length - index]))
  if (!query.trim()) {
    const recent = recentIds
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is T => item !== undefined)
    return [...recent, ...items.filter((item) => !recency.has(item.id))]
  }
  return items
    .map((item, index) => {
      const scores = [item.label, ...(item.keywords ?? [])]
        .map((text) => fuzzyScore(query, text))
        .filter((value): value is number => value !== null)
      return { item, index, score: scores.length ? Math.max(...scores) : null }
    })
    .filter((entry): entry is { item: T; index: number; score: number } => entry.score !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (recency.get(b.item.id) ?? 0) - (recency.get(a.item.id) ?? 0) ||
        a.index - b.index,
    )
    .map((entry) => entry.item)
}

/** Most recent first, without duplicates, at most `limit`. */
export function pushRecent(recent: readonly string[], id: string, limit = 5): string[] {
  return [id, ...recent.filter((value) => value !== id)].slice(0, limit)
}
