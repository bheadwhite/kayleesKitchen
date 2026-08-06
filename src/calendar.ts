/**
 * Calendar days, as `YYYY-MM-DD` strings.
 *
 * Everything here exists to keep one bug out of the meal plan. A `Date` is an
 * *instant*; a planned dinner is a **day on a wall calendar**. The two disagree
 * either side of midnight UTC, which is to say every evening for anyone west of
 * London — and the disagreement shows up as a recipe appearing on the wrong day,
 * which is the one thing a planner must never do.
 *
 * So the two obvious one-liners are both wrong and neither is used here:
 *
 * - `new Date().toISOString().slice(0, 10)` reads the *UTC* day, so at 6pm in
 *   California it is already tomorrow.
 * - `new Date("2026-08-06")` parses as UTC **midnight**, which is the 5th once
 *   it is rendered locally — so a round trip through it walks the date backwards.
 *
 * Both directions are therefore done by hand, in local time, below.
 */

const pad = (value: number) => String(value).padStart(2, "0")

/** A local `Date` to the calendar day it falls on. */
export const toISODate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** `YYYY-MM-DD` back to local midnight of that day. */
export const fromISODate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export const todayISO = () => toISODate(new Date())

/**
 * `n` days on (or back, for a negative `n`).
 *
 * Through a `Date` rather than by adding to the number, because the answer has
 * to know about month lengths and leap years — and going through local midnight
 * rather than UTC means a day that is 23 or 25 hours long (a clock change) still
 * moves the date by exactly one.
 */
export const addDays = (iso: string, n: number) => {
  const date = fromISODate(iso)
  date.setDate(date.getDate() + n)
  return toISODate(date)
}

/** `from`, and the `days - 1` days after it. */
export const rangeOf = (from: string, days: number) =>
  Array.from({ length: Math.max(0, days) }, (_, index) => addDays(from, index))

/** Whole days between two calendar days; negative when `to` is earlier. */
export const daysBetween = (from: string, to: string) =>
  Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000)

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * "Wed 6 Aug" — the day label, drawn uppercase by the caller's mono styling.
 *
 * Written out rather than handed to `toLocaleDateString`, so the agenda reads
 * the same on every device: the abbreviations a locale picks vary in length, and
 * a row of day headings that changes width between phones looks like a bug in
 * a layout this tight.
 */
export const dayLabel = (iso: string) => {
  const date = fromISODate(iso)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/**
 * "Today" / "Tomorrow" where they apply, the date otherwise. The two days a cook
 * is actually deciding about deserve to be named rather than counted to.
 */
export const relativeDayLabel = (iso: string, today = todayISO()) => {
  const offset = daysBetween(today, iso)
  if (offset === 0) return "Today"
  if (offset === 1) return "Tomorrow"
  if (offset === -1) return "Yesterday"
  return dayLabel(iso)
}
