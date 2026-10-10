export type MealKey = 'breakfast' | 'lunch' | 'snacks' | 'dinner'
export const MEALS: MealKey[] = ['breakfast', 'lunch', 'snacks', 'dinner']
export const MEAL_LABEL: Record<MealKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active'
export type Diet = 'veg' | 'egg' | 'nonveg'
export type Pace = 'gentle' | 'steady' | 'fast'

export interface Profile {
  name: string
  sex: Sex
  age: number
  heightCm: number
  startKg: number
  goalKg: number
  activity: Activity
  diet: Diet
  pace: Pace
  startDate: string
  notes: string
}

export type DayMenu = Record<MealKey, string[]>

export interface MenuSheet {
  name: string
  /** Day of month → menu */
  days: Record<number, DayMenu>
  /** Weekday (0 = Sun) → menu, for weekly menus without dates */
  weekdays: Record<number, DayMenu>
}

export interface MonthMenu {
  id: string
  fileName: string
  title: string
  month: number // 1-12
  year: number
  sheets: MenuSheet[]
  timings?: Partial<Record<MealKey, { start: number; end: number }>>
  uploadedAt: number
}

export interface PlanItem {
  item: string
  portion: string
  kcal: number
  protein: number
  note?: string
}

export interface SkipItem {
  item: string
  reason: string
}

export interface MealPlan {
  picks: PlanItem[]
  skip: SkipItem[]
  tip?: string
}

export interface DayPlan {
  date: string
  sheet: string
  source: 'ai' | 'smart'
  meals: Record<MealKey, MealPlan>
  summary: string
  createdAt: number
}

export interface LogEntry {
  id: string
  date: string
  meal: MealKey | 'extra'
  label: string
  kcal: number
  protein: number
  at: number
}

export interface WeightEntry {
  date: string
  kg: number
}

export type CravingOutcome = 'resisted' | 'swapped' | 'gave_in'
export interface CravingEntry {
  id: string
  at: number
  date: string
  intensity: number
  outcome: CravingOutcome
}

export interface ChatMsg {
  role: 'user' | 'model'
  text: string
  at: number
}

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  apiKey: string
  model: string
  sheetName: string
  theme: Theme
}
