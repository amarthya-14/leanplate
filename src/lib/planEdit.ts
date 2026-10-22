import { addDays, todayISO, type Timings } from './date'
import { planDay, planItemFor, proteinTopUp } from './foods'
import { MEAL_SHARE } from './nutrition'
import { adaptiveTargets, dayMenuFor, useStore } from './store'
import { MEAL_LABEL, MEALS, type DayMenu, type DayPlan, type Diet, type MealChange, type MealKey, type MealPlan, type PlanItem, type Proposal } from './types'

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

/** Record a change made from the plate itself, keeping the first version for "Back to original plan". */
function edited(base: DayPlan, meals: Record<MealKey, MealPlan>, note: string): DayPlan {
  return {
    ...base,
    meals,
    edited: { note: base.edited ? `${base.edited.note}; ${note}` : note, at: Date.now(), original: base.edited?.original ?? base },
    createdAt: Date.now(),
  }
}

export function swapPick(base: DayPlan, meal: MealKey, index: number, next: PlanItem): DayPlan {
  const old = base.meals[meal]
  const out = old.picks[index]
  const picks = old.picks.map((p, i) => (i === index ? { ...next, note: next.note ?? `Instead of ${out.item}` } : p))
  const skip = [{ item: out.item, reason: `Swapped for ${next.item}` }, ...old.skip.filter((x) => x.item.toLowerCase() !== next.item.toLowerCase())]
  return edited(base, { ...base.meals, [meal]: { ...old, picks, skip } }, `${out.item} → ${next.item}`)
}

/** Have something from "Leave on the counter" after all. */
export function addFromCounter(base: DayPlan, meal: MealKey, index: number): DayPlan {
  const old = base.meals[meal]
  const item = planItemFor(old.skip[index].item)
  const meals = { ...base.meals, [meal]: { ...old, picks: [...old.picks, item], skip: old.skip.filter((_, i) => i !== index) } }
  return edited(base, meals, `added ${item.item}`)
}

const TOP_UP = (meal: MealKey) => `Extra protein, since you skipped ${MEAL_LABEL[meal].toLowerCase()}`

/** The next main meal that can take extra protein after skipping `meal`, and what to add there. */
export function topUpAfter(plan: DayPlan, meal: MealKey, menu: DayMenu, diet: Diet, dayKcal: number, logged: Set<MealKey>) {
  const later = MEALS.slice(MEALS.indexOf(meal) + 1).filter((m) => !plan.meals[m].skipped && !logged.has(m) && menu[m]?.length)
  const target = later.find((m) => m !== 'snacks')
  if (!target) return null
  // Make up about half the skipped meal's calories, as protein; the rest stays as a bigger deficit.
  const item = proteinTopUp(menu[target], diet, plan.meals[target].picks.map((p) => p.item), dayKcal * MEAL_SHARE[meal] * 0.5)
  return item ? { meal: target, item: { ...item, note: TOP_UP(meal) } } : null
}

export function skipMeal(base: DayPlan, meal: MealKey, topUp: { meal: MealKey; item: PlanItem } | null): DayPlan {
  const old = base.meals[meal]
  const meals = { ...base.meals }
  meals[meal] = {
    picks: [],
    skip: [...old.picks.map((x) => ({ item: x.item, reason: 'Skipped today' })), ...old.skip],
    tip: topUp
      ? `Skipped. ${MEAL_LABEL[topUp.meal]} gets ${topUp.item.item} so your protein stays on track.`
      : 'Skipped. That is a bigger deficit today; make protein the first thing on your next plate.',
    skipped: true,
  }
  if (topUp) {
    const t = meals[topUp.meal]
    const name = topUp.item.item.toLowerCase()
    meals[topUp.meal] = { ...t, picks: [...t.picks, topUp.item], skip: t.skip.filter((x) => x.item.toLowerCase() !== name) }
  }
  return edited(base, meals, `skipped ${MEAL_LABEL[meal].toLowerCase()}`)
}

/** Bring a skipped meal back, and take back the protein added elsewhere because of it. */
export function unskipMeal(base: DayPlan, meal: MealKey): DayPlan {
  const original = base.edited?.original?.meals[meal]
  const meals = { ...base.meals }
  for (const m of MEALS) {
    const added = meals[m].picks.filter((p) => p.note === TOP_UP(meal)).map((p) => p.item.toLowerCase())
    if (!added.length) continue
    // Put it back on the counter list if that's where it was before
    const was = base.edited?.original?.meals[m].skip.filter((x) => added.includes(x.item.toLowerCase())) ?? []
    meals[m] = { ...meals[m], picks: meals[m].picks.filter((p) => p.note !== TOP_UP(meal)), skip: [...meals[m].skip, ...was] }
  }
  meals[meal] = original && !original.skipped ? original : { ...meals[meal], skipped: false }
  return edited(base, meals, `${MEAL_LABEL[meal].toLowerCase()} back on`)
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
  const t = adaptiveTargets(s.profile, s.weights, s.logs)
  const p = planDay(dm.menu, t.kcal, s.profile.diet, date)
  return { plan: { date, sheet: dm.sheet, source: 'smart', createdAt: 0, ...p }, key, timings: dm.month.timings }
}
