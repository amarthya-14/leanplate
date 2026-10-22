import type { Activity, Pace, Profile, Sex } from './types'

export const ACTIVITY: Record<Activity, { label: string; hint: string; factor: number }> = {
  sedentary: { label: 'Mostly sitting', hint: 'Classes, laptop, little walking', factor: 1.2 },
  light: { label: 'Lightly active', hint: 'Walk around campus, 6–8k steps', factor: 1.375 },
  moderate: { label: 'Active', hint: 'Workout 3–5× a week', factor: 1.55 },
  active: { label: 'Very active', hint: 'Daily training or sport', factor: 1.725 },
}

export const PACE: Record<Pace, { label: string; kgPerWeek: number; hint: string }> = {
  gentle: { label: 'Gentle', kgPerWeek: 0.25, hint: 'Barely feel it' },
  steady: { label: 'Steady', kgPerWeek: 0.5, hint: 'Recommended' },
  fast: { label: 'Aggressive', kgPerWeek: 0.75, hint: 'Needs discipline' },
}

export function bmr(sex: Sex, kg: number, cm: number, age: number) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161)
}

export interface Targets {
  bmr: number
  tdee: number
  /** the formula estimate, before learning from your logs and weight trend */
  formulaTdee: number
  kcal: number
  protein: number
  fiber: number
  waterGlasses: number
  sugarG: number
  deficit: number
  /** set when a safety rule changed the target */
  guard?: string
}

export interface TargetOptions {
  /** learned daily burn (see expenditure.ts); the formula is used without it */
  tdee?: number
  /** recent trend weight change per week, negative when losing */
  kgPerWeek?: number | null
}

/** Lowest daily target Leanplate will set (AHA/ACC/TOS lower bounds for supervised weight loss). */
export const calorieFloor = (sex: Sex) => (sex === 'male' ? 1500 : 1200)

/** Below this the app plans for maintenance, never a deficit (Asian BMI cut-off for underweight). */
export const MIN_BMI = 18.5

export function targets(p: Profile, currentKg: number, opts: TargetOptions = {}): Targets {
  const b = bmr(p.sex, currentKg, p.heightCm, p.age)
  const formulaTdee = b * ACTIVITY[p.activity].factor
  const tdee = opts.tdee ?? formulaTdee
  const wanted = (PACE[p.pace].kgPerWeek * 7700) / 7
  let deficit = Math.min(wanted, tdee * 0.25)
  let guard: string | undefined
  // Safety rules, enforced here so neither the plan nor the coach can get around them
  if (bmi(currentKg, p.heightCm) < MIN_BMI) {
    deficit = 0
    guard = 'Your BMI is below 18.5, so Leanplate plans for maintenance, not weight loss.'
  } else if (opts.kgPerWeek != null && opts.kgPerWeek < -0.01 * currentKg) {
    // Losing over 1% of body weight a week risks muscle; slow down even if it's going "well"
    deficit = Math.min(deficit, wanted / 2, tdee * 0.12)
    guard = `You're losing about ${Math.abs(opts.kgPerWeek).toFixed(1)} kg a week, faster than is good for muscle, so today's target is a little higher.`
  }
  const floor = calorieFloor(p.sex)
  const kcal = Math.max(floor, Math.round((tdee - deficit) / 10) * 10)
  // Protein on goal weight keeps it realistic for a mostly-veg mess diet
  const protein = Math.round(Math.max(1.6 * p.goalKg, 1.1 * currentKg) / 5) * 5
  return {
    bmr: Math.round(b),
    tdee: Math.round(tdee),
    formulaTdee: Math.round(formulaTdee),
    kcal,
    protein,
    fiber: 30,
    waterGlasses: Math.max(8, Math.round((currentKg * 35) / 250)),
    sugarG: 25,
    deficit: Math.round(tdee - kcal),
    guard,
  }
}

export function bmi(kg: number, cm: number) {
  const m = cm / 100
  return kg / (m * m)
}

export function bmiBand(v: number) {
  if (v < 18.5) return 'Underweight'
  if (v < 23) return 'Healthy'
  if (v < 25) return 'Overweight'
  if (v < 30) return 'Obese I'
  return 'Obese II'
}

/** Share of the daily budget per meal. Snacks kept small on purpose. */
export const MEAL_SHARE = { breakfast: 0.27, lunch: 0.35, snacks: 0.08, dinner: 0.3 } as const
