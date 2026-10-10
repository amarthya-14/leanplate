import { daysBetween, fmtTime, type Timings } from './date'
import type { Targets } from './nutrition'
import { MEAL_LABEL, type DayMenu, type DayPlan, type LogEntry, type MealKey, type WeightEntry } from './types'

export interface Insight {
  eyebrow: string
  title: string
  body: string
  action?: { label: string; view: string; prompt?: string }
}

const DEFAULT: Record<MealKey, { start: number; end: number }> = {
  breakfast: { start: 7 * 60 + 15, end: 9 * 60 + 30 },
  lunch: { start: 12 * 60 + 30, end: 14 * 60 + 30 },
  snacks: { start: 16 * 60 + 45, end: 18 * 60 + 15 },
  dinner: { start: 19 * 60 + 15, end: 21 * 60 + 30 },
}

const topPicks = (plan: DayPlan | null, m: MealKey, n = 3) =>
  plan?.meals[m].picks
    .filter((p) => p.kcal > 20)
    .slice(0, n)
    .map((p) => `${p.item.replace(/\s*\(.*?\)\s*/g, ' ').trim()} ${p.portion}`)
    .join(', ')

/** One contextual "do this next" card for the Today screen. */
export function nextMove(o: {
  now: Date
  timings?: Timings
  plan: DayPlan | null
  hasMenu: boolean
  logs: LogEntry[]
  targets: Targets
  weights: WeightEntry[]
  today: string
  water: number
  tomorrow: DayMenu | null
}): Insight {
  const mins = o.now.getHours() * 60 + o.now.getMinutes()
  const t = (m: MealKey) => ({ ...DEFAULT[m], ...(o.timings?.[m] ?? {}) })
  const eaten = o.logs.reduce((s, l) => s + l.kcal, 0)
  const protein = o.logs.reduce((s, l) => s + l.protein, 0)
  const loggedMeals = new Set(o.logs.map((l) => l.meal))
  const lastWeigh = o.weights[o.weights.length - 1]?.date
  const sinceWeigh = lastWeigh ? daysBetween(lastWeigh, o.today) : 99

  if (!o.hasMenu)
    return {
      eyebrow: 'First things first',
      title: "Add this month's mess menu.",
      body: 'Upload the Excel sheet your hostel shares and every meal gets planned for you — portions included.',
      action: { label: 'Upload menu', view: 'menu' },
    }

  if (mins < 11 * 60 && sinceWeigh >= 4)
    return {
      eyebrow: 'Weigh-in',
      title: sinceWeigh > 30 ? 'Step on the scale today.' : `${sinceWeigh} days since your last weigh-in.`,
      body: 'Morning, after the bathroom, before breakfast. One number a few times a week is enough to see the trend.',
      action: { label: 'Log weight', view: 'progress' },
    }

  if (mins >= 22 * 60 || mins < 5 * 60) {
    const b = o.tomorrow?.breakfast.slice(0, 3).join(', ')
    return {
      eyebrow: 'Kitchen closed',
      title: eaten > o.targets.kcal * 1.08 ? 'Over today — reset tomorrow, no skipping.' : 'Done for today. Brush your teeth.',
      body: `A mint-clean mouth is the simplest late-night craving off-switch. Aim for 7+ hours — short sleep makes tomorrow's cravings louder.${b ? ` ${mins < 5 * 60 ? 'Breakfast in a few hours' : "Tomorrow's breakfast"}: ${b}.` : ''}`,
    }
  }

  const over = eaten - o.targets.kcal
  if (over > 150)
    return {
      eyebrow: 'Over budget',
      title: `${over} kcal over — that's fine.`,
      body: "Don't skip the next meal; that sets up a binge. Keep it to salad, dal or curd and one roti, and drink a big glass of water first.",
      action: { label: 'Ask the coach', view: 'coach', prompt: `I'm ${over} kcal over my target today. What should I eat for the rest of the day?` },
    }

  const snack = t('snacks')
  if (mins >= snack.start - 45 && mins <= snack.end)
    return {
      eyebrow: 'Craving window',
      title: '5 pm is when sugar hits hardest.',
      body: 'Take tea without sugar, skip the fried counter, and eat the fruit you saved. If a craving shows up, run the 10-minute reset.',
      action: { label: 'Open cravings', view: 'cravings' },
    }

  const dinner = t('dinner')
  const proteinGap = o.targets.protein - protein
  if (mins >= dinner.start - 90 && mins <= dinner.end && proteinGap > 30 && loggedMeals.size >= 2)
    return {
      eyebrow: 'Protein gap',
      title: `${proteinGap} g of protein to go.`,
      body: `Make dinner protein-first: ${topPicks(o.plan, 'dinner', 2) || 'dal and curd'} — and an extra katori of dal or curd if they have it.`,
    }

  for (const m of ['breakfast', 'lunch', 'dinner'] as MealKey[]) {
    const w = t(m)
    if (mins < w.end && !loggedMeals.has(m) && !o.plan?.meals[m].skipped) {
      const picks = topPicks(o.plan, m)
      const kcal = o.plan?.meals[m].picks.reduce((s, p) => s + p.kcal, 0) ?? 0
      const trap = o.plan?.meals[m].skip.find((s) => /sugar|craving|fried/i.test(s.reason))
      const open = mins >= w.start
      return {
        eyebrow: open ? `${MEAL_LABEL[m]} is on` : `${MEAL_LABEL[m]} at ${fmtTime(w.start)}`,
        title: picks ? `Take ${picks}.` : `${MEAL_LABEL[m]} next.`,
        body: `About ${Math.round(kcal / 10) * 10} kcal.${trap ? ` Leave the ${trap.item.replace(/\s*\(.*?\)\s*/g, ' ').trim().toLowerCase()} on the counter.` : ''}${
          m !== 'breakfast' ? ' Salad first, carbs last.' : ' Protein first keeps you full till lunch.'
        }`,
      }
    }
  }

  if (o.water < o.targets.waterGlasses / 2 && mins > 15 * 60)
    return {
      eyebrow: 'Hydration',
      title: `Only ${o.water} glasses so far.`,
      body: 'Thirst often feels like hunger — especially for something sweet. Fill your bottle now.',
    }

  return {
    eyebrow: 'On track',
    title: 'Nothing to fix right now.',
    body: 'Stick to the plate, keep water close, and log what you eat. Consistency beats perfection.',
  }
}
