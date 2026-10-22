import { classify, portionText } from './foods'
import { MEAL_LABEL, MEALS, type DayPlan, type MealKey, type MealPlan, type PlanItem } from './types'

// "Had extra" chips: log the usual mess deviations in one tap (one more roti, the samosa,
// sugar in the chai) and take it out of the next plate instead of flagging the day as failed.
// Logging often matters more than logging precisely, and a rebalanced day beats a red one.

export interface ExtraChip {
  label: string
  kcal: number
  protein: number
}

const TRAPS = new Set(['sweet', 'fried', 'refined'])
const CHAI_SUGAR = 40 // two teaspoons

/** Unit size the plan steps in: one roti, half a cup of rice. */
function step(name: string) {
  const f = classify(name)
  return f.unit === 'pc' || f.unit === 'slice' ? 1 : f.step ?? 1
}

/** How many units a pick is, recovered from its calories (the plan stores the text portion). */
function units(p: PlanItem) {
  const f = classify(p.item)
  const s = step(p.item)
  return f.kcal ? Math.round(p.kcal / f.kcal / s) * s : 0
}

/** Chips for one meal, from what that meal actually served. At most four. */
export function extraChips(plan: MealPlan, meal: MealKey): ExtraChip[] {
  const chips: ExtraChip[] = []
  const carb = plan.picks.find((p) => classify(p.item).kind === 'carb')
  if (carb) {
    const f = classify(carb.item)
    const s = step(carb.item)
    // "+1 Chapathi", "+½ cup Rice"
    const amount = f.unit === 'pc' ? String(s) : portionText(s, f.unit)
    chips.push({ label: `+${amount} ${carb.item}`, kcal: Math.round(f.kcal * s), protein: Math.round(f.protein * s) })
  }
  for (const s of plan.skip) {
    const f = classify(s.item)
    if (!TRAPS.has(f.kind) || chips.length >= 3) continue
    if (chips.some((c) => c.label.toLowerCase().includes(s.item.toLowerCase()))) continue
    chips.push({ label: s.item, kcal: f.kcal, protein: f.protein })
  }
  const tea = plan.picks.find((p) => classify(p.item).kind === 'drink' && /tea|chai|coff|milk/i.test(p.item))
  if (tea) chips.push({ label: `Sugar in the ${/coff/i.test(tea.item) ? 'coffee' : 'chai'}`, kcal: CHAI_SUGAR, protein: 0 })
  else if (chips.length < 4 && (meal === 'breakfast' || meal === 'snacks')) chips.push({ label: 'Chai with sugar', kcal: classify('tea').kcal + CHAI_SUGAR, protein: classify('tea').protein })
  return chips.slice(0, 4)
}

export const TRIMMED = (meal: MealKey) => `Trimmed for the extra at ${MEAL_LABEL[meal].toLowerCase()}`

/**
 * Takes about `kcal` out of the meals still to come, from their carbs only (protein stays),
 * one unit at a time and never below one roti or half a cup. Returns the new plan and what
 * changed, or null when there is nothing left to trim today.
 */
export function absorbExtra(base: DayPlan, meal: MealKey, kcal: number, logged: Set<MealKey>) {
  const later = MEALS.slice(MEALS.indexOf(meal) + 1)
    .filter((m) => !base.meals[m].skipped && !logged.has(m))
    // main meals first: trimming a snack plate rarely has a carb to give
    .sort((a, b) => Number(a === 'snacks') - Number(b === 'snacks'))
  const meals = { ...base.meals }
  const changes: string[] = []
  let saved = 0
  for (const m of later) {
    if (saved >= kcal * 0.75) break
    const picks = meals[m].picks.map((p) => ({ ...p }))
    let touched = false
    for (const p of picks) {
      const f = classify(p.item)
      if (f.kind !== 'carb' || !f.kcal) continue
      const s = step(p.item)
      let qty = units(p)
      const before = qty
      while (qty - s >= s && saved < kcal * 0.75) {
        qty -= s
        saved += Math.round(f.kcal * s)
      }
      if (qty === before) continue
      p.kcal = Math.round(f.kcal * qty)
      p.protein = Math.round(f.protein * qty)
      p.portion = portionText(qty, f.unit)
      p.note = TRIMMED(meal)
      touched = true
      changes.push(`${MEAL_LABEL[m].toLowerCase()}: ${p.item} down to ${p.portion}`)
    }
    if (touched) meals[m] = { ...meals[m], picks }
  }
  if (!changes.length) return null
  const note = `extra at ${MEAL_LABEL[meal].toLowerCase()}, ${changes.join(', ')}`
  const next: DayPlan = {
    ...base,
    meals,
    edited: { note: base.edited ? `${base.edited.note}; ${note}` : note, at: Date.now(), original: base.edited?.original ?? base },
    createdAt: Date.now(),
  }
  return { plan: next, saved, changes }
}
