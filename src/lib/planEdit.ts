import { addDays, todayISO, type Timings } from './date'
import { planDay } from './foods'
import { targets } from './nutrition'
import { currentKg, dayMenuFor, useStore } from './store'
import { MEALS, type DayPlan, type MealChange, type MealKey, type MealPlan, type PlanItem, type Proposal } from './types'

export function resolveDate(d: unknown): string {
  const s = String(d ?? 'today').toLowerCase().trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (s.startsWith('tom')) return addDays(todayISO(), 1)
  return todayISO()
}

const toPick = (p: Record<string, unknown>): PlanItem => ({
  item: String(p.item ?? ''),
  portion: String(p.portion ?? ''),
  kcal: Math.round(Number(p.kcal) || 0),
  protein: Math.round(Number(p.protein) || 0),
  note: p.note ? String(p.note) : undefined,
})

/** Turn a Gemini function call into a proposal card (or null if malformed). */
export function proposalFromCall(name: string, args: Record<string, unknown>): Proposal | null {
  if (name === 'propose_plan_change') {
    const meals: Partial<Record<MealKey, MealChange>> = {}
    for (const m of MEALS) {
      const c = args[m] as Record<string, unknown> | undefined
      if (!c || (c.action !== 'skip' && c.action !== 'replace')) continue
      const picks = Array.isArray(c.picks) ? (c.picks as Record<string, unknown>[]).map(toPick).filter((p) => p.item) : []
      if (c.action === 'replace' && !picks.length) continue
      meals[m] = { action: c.action, picks: c.action === 'replace' ? picks : undefined, tip: c.tip ? String(c.tip) : undefined }
    }
    if (!Object.keys(meals).length) return null
    return { kind: 'plan', date: resolveDate(args.date), summary: String(args.summary ?? 'Adjusted plate'), meals, status: 'pending' }
  }
  if (name === 'propose_log') {
    const meal = String(args.meal ?? 'extra')
    return {
      kind: 'log',
      date: todayISO(),
      meal: (MEALS as string[]).includes(meal) ? (meal as MealKey) : 'extra',
      label: String(args.label ?? 'Food'),
      kcal: Math.round(Number(args.kcal) || 0),
      protein: Math.round(Number(args.protein) || 0),
      status: 'pending',
    }
  }
  return null
}

/** Apply a coach plan change on top of the day's current plan. */
export function applyPlanChange(base: DayPlan, p: Extract<Proposal, { kind: 'plan' }>): DayPlan {
  const meals = { ...base.meals } as Record<MealKey, MealPlan>
  for (const m of MEALS) {
    const c = p.meals[m]
    if (!c) continue
    const old = base.meals[m]
    if (c.action === 'skip') {
      meals[m] = {
        picks: [],
        skip: [...old.picks.map((x) => ({ item: x.item, reason: 'Skipped today' })), ...old.skip],
        tip: c.tip ?? 'Skipped today — the coach moved this meal’s protein to later.',
        skipped: true,
      }
    } else {
      const names = new Set((c.picks ?? []).map((x) => x.item.toLowerCase()))
      meals[m] = {
        picks: c.picks ?? [],
        skip: [
          ...old.picks.filter((x) => !names.has(x.item.toLowerCase())).map((x) => ({ item: x.item, reason: 'Swapped out by the coach' })),
          ...old.skip.filter((x) => !names.has(x.item.toLowerCase())),
        ],
        tip: c.tip ?? old.tip,
      }
    }
  }
  const original = base.edited?.original ?? (base.source === 'ai' ? base : undefined)
  const note = base.edited ? `${base.edited.note}; ${p.summary}` : p.summary
  return { ...base, meals, edited: { note, at: Date.now(), original }, createdAt: Date.now() }
}

export function planTotals(meals: Record<MealKey, MealPlan>) {
  const all = MEALS.flatMap((m) => meals[m].picks)
  return { kcal: all.reduce((s, x) => s + x.kcal, 0), protein: all.reduce((s, x) => s + x.protein, 0) }
}

/** Compact text the model sees for past proposals (keeps history tool-free). */
export function proposalNote(p: Proposal) {
  const st = p.status === 'applied' ? 'user APPLIED it' : p.status === 'dismissed' ? 'user declined' : 'awaiting user'
  if (p.kind === 'log') return `[Proposed log: ${p.label}, ${p.kcal} kcal — ${st}]`
  return `[Proposed plate change for ${p.date}: ${p.summary} — ${st}]`
}

/** The plate currently in effect for a date: saved (AI / coach-edited) or the offline plan. */
export function currentPlanFor(date: string): { plan: DayPlan; key: string; timings?: Timings } | null {
  const s = useStore.getState()
  if (!s.profile) return null
  const dm = dayMenuFor(s.menus, s.settings.sheetName, date)
  if (!dm) return null
  const key = `${date}|${dm.sheet}`
  const cached = s.plans[key]
  if (cached) return { plan: cached, key, timings: dm.month.timings }
  const t = targets(s.profile, currentKg(s.weights, s.profile))
  const p = planDay(dm.menu, t.kcal, s.profile.diet, date)
  return { plan: { date, sheet: dm.sheet, source: 'smart', createdAt: 0, ...p }, key, timings: dm.month.timings }
}
