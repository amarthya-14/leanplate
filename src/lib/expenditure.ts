import { addDays, daysBetween, todayISO } from './date'
import type { LogEntry, WeightEntry } from './types'

/**
 * Adaptive daily energy expenditure ("your real burn"), learned from what you ate and how your
 * weight trend moved, in the spirit of MacroFactor's published method:
 *   burn = average intake on fully logged days − (weight change per day × 7700 kcal/kg)
 * The weight change is a straight-line fit through the weigh-ins of the last few weeks, which
 * averages out water swings without the lag of a moving average. The formula estimate is the
 * starting point, and the learned value takes over as logged days build up. Plain arithmetic,
 * never the LLM.
 */

export const KCAL_PER_KG = 7700
const WINDOW = 21 // days looked back over
const MIN_LOGGED = 7 // fully logged days needed before learning anything
const FULL_TRUST = 28 // logged days at which the learned value fully replaces the formula
const SMOOTHING = 0.1 // daily EWMA weight for the trend (about a 20-day memory)

/** A smoothed weight for every day from the first weigh-in to `to`, gaps filled linearly. */
export function weightTrend(weights: WeightEntry[], to = todayISO()): Map<string, number> {
  const out = new Map<string, number>()
  if (!weights.length) return out
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  let trend = sorted[0].kg
  let i = 0
  for (let d = sorted[0].date; d <= to; d = addDays(d, 1)) {
    while (i + 1 < sorted.length && sorted[i + 1].date <= d) i++
    const prev = sorted[i]
    const next = sorted[i + 1]
    // Weight for this day: the weigh-in itself, or a straight line between the two around it
    const raw = prev.date === d || !next ? prev.kg : prev.kg + ((next.kg - prev.kg) * daysBetween(prev.date, d)) / daysBetween(prev.date, next.date)
    trend += SMOOTHING * (raw - trend)
    out.set(d, trend)
  }
  return out
}

/** Days whose intake is complete enough to learn from: at least two main meals, or a full day's food. */
export function fullyLoggedDays(logs: LogEntry[]): Map<string, number> {
  const byDay = new Map<string, { kcal: number; meals: Set<string> }>()
  for (const l of logs) {
    const d = byDay.get(l.date) ?? { kcal: 0, meals: new Set<string>() }
    d.kcal += l.kcal
    if (l.meal === 'breakfast' || l.meal === 'lunch' || l.meal === 'dinner') d.meals.add(l.meal)
    byDay.set(l.date, d)
  }
  const out = new Map<string, number>()
  for (const [date, d] of byDay) if (d.meals.size >= 2 || d.kcal >= 1000) out.set(date, d.kcal)
  return out
}

/** Least-squares slope of weight against day number, in kg per day. */
function slopePerDay(ws: WeightEntry[]): number | null {
  if (ws.length < 2) return null
  const xs = ws.map((w) => daysBetween(ws[0].date, w.date))
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ws.reduce((a, w) => a + w.kg, 0) / ws.length
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  return sxx ? xs.reduce((a, x, i) => a + (x - mx) * (ws[i].kg - my), 0) / sxx : null
}

export interface Expenditure {
  /** the burn to plan with: formula, learned, or a blend */
  tdee: number
  formula: number
  learned: number | null
  status: 'learning' | 'adjusting' | 'confident'
  loggedDays: number
  /** trend weight change per week over the window (negative = losing) */
  kgPerWeek: number | null
  note: string
}

export function estimateExpenditure(formula: number, weights: WeightEntry[], logs: LogEntry[], today = todayISO()): Expenditure {
  // Today is still in progress; learn from the days before it
  const end = addDays(today, -1)
  const start = addDays(end, -(WINDOW - 1))
  const allLogged = [...fullyLoggedDays(logs)].filter(([d]) => d <= end)
  const logged = allLogged.filter(([d]) => d >= start)
  const inWindow = weights.filter((w) => w.date >= start && w.date <= end)
  const span = inWindow.length ? daysBetween(inWindow[0].date, end) + 1 : 0
  const slope = slopePerDay(inWindow)
  const kgPerWeek = slope !== null && inWindow.length >= 4 && daysBetween(inWindow[0].date, inWindow[inWindow.length - 1].date) >= 10 ? slope * 7 : null

  const base = { formula: Math.round(formula), loggedDays: allLogged.length, kgPerWeek }
  if (allLogged.length < MIN_LOGGED || kgPerWeek === null || !logged.length) {
    const need = Math.max(0, MIN_LOGGED - logged.length)
    return {
      ...base,
      tdee: Math.round(formula),
      learned: null,
      status: 'learning',
      note: need
        ? `Using the formula for now. ${need} more fully logged day${need === 1 ? '' : 's'} and a few weigh-ins, and it starts learning your real burn.`
        : 'Using the formula for now. Weigh in a few more mornings so it can see your trend.',
    }
  }
  // Too many unlogged days in the window would make the average meaningless: hold instead of guessing
  if (logged.length < span / 2) {
    return { ...base, tdee: Math.round(formula), learned: null, status: 'learning', note: 'Fewer than half the recent days are fully logged, so the estimate is on hold.' }
  }
  const intake = logged.reduce((s, [, k]) => s + k, 0) / logged.length
  // Keep a wild estimate (bad logs, a water swing) from moving targets far from the formula
  const learned = Math.min(formula * 1.35, Math.max(formula * 0.7, intake - (kgPerWeek / 7) * KCAL_PER_KG))
  const trust = Math.min(1, allLogged.length / FULL_TRUST)
  const tdee = Math.round(formula * (1 - trust) + learned * trust)
  return {
    ...base,
    tdee,
    learned: Math.round(learned),
    status: trust >= 1 ? 'confident' : 'adjusting',
    note: `Learned from your logged days and your weight trend${trust < 1 ? ', blended with the formula until there are more' : ''}.`,
  }
}
