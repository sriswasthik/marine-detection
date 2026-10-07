/** Helpers for <input type="datetime-local">, which works in local time without a zone. */

const pad = (value: number) => String(value).padStart(2, '0')

/** A Date as "YYYY-MM-DDTHH:mm" in the viewer's local time. */
export function toDateTimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/** "YYYY-MM-DDTHH:mm" (local time) as an ISO 8601 UTC string, or null when unreadable. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
