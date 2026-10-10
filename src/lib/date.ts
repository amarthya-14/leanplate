import type { MealKey } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => iso(new Date())
export const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (s: string, n: number) => {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}
export const daysBetween = (a: string, b: string) => Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000)

export const fmtLong = (s: string) => fromISO(s).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
export const fmtShort = (s: string) => fromISO(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
export const fmtWeekday = (s: string) => fromISO(s).toLocaleDateString('en-IN', { weekday: 'short' })
export const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString('en-IN', { month: 'long' })
export const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate()

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export type Timings = Partial<Record<MealKey, { start: number; end: number }>>
const DEFAULT_END: Record<MealKey, number> = { breakfast: 10 * 60, lunch: 15 * 60, snacks: 18 * 60 + 30, dinner: 24 * 60 }

/** Which meal is "now" or next up, using the mess timings when the sheet has them. */
export function currentMeal(timings: Timings = {}, d = new Date()): MealKey {
  const mins = d.getHours() * 60 + d.getMinutes()
  for (const m of ['breakfast', 'lunch', 'snacks', 'dinner'] as MealKey[]) {
    const end = timings[m]?.end ?? DEFAULT_END[m]
    if (mins <= end + 30) return m
  }
  return 'dinner'
}

export const fmtTime = (mins: number) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${((h + 11) % 12) + 1}${m ? ':' + pad(m) : ''} ${h >= 12 ? 'pm' : 'am'}`
}
