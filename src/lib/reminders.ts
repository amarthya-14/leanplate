import { daysInMonth, iso, todayISO, type Timings } from './date'
import { planDay } from './foods'
import { currentKg, dayMenuFor, useStore } from './store'
import { MEAL_LABEL, MEALS, type DayPlan, type MealKey, type MonthMenu } from './types'
import { targets } from './nutrition'

const DEFAULT: Record<MealKey, { start: number; end: number }> = {
  breakfast: { start: 7 * 60 + 15, end: 9 * 60 },
  lunch: { start: 12 * 60 + 30, end: 14 * 60 + 15 },
  snacks: { start: 16 * 60 + 45, end: 18 * 60 + 15 },
  dinner: { start: 19 * 60 + 15, end: 21 * 60 },
}
const windowFor = (t: Timings | undefined, m: MealKey) => ({ ...DEFAULT[m], ...(t?.[m] ?? {}) })

const clean = (s: string) => s.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()

export function reminderText(plan: DayPlan, m: MealKey) {
  const mp = plan.meals[m]
  const take = mp.picks.map((p) => `${clean(p.item)} ${p.portion}`).join(', ')
  const skip = mp.skip
    .filter((s) => /sugar|craving|fried|refined|maida|syrup/i.test(s.reason))
    .slice(0, 3)
    .map((s) => clean(s.item))
    .join(', ')
  const kcal = mp.picks.reduce((s, p) => s + p.kcal, 0)
  return {
    title: `${MEAL_LABEL[m]} · ~${Math.round(kcal / 10) * 10} kcal`,
    body: `Take: ${take || 'a light plate'}${skip ? `\nSkip: ${skip}` : ''}`,
  }
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

export async function enableNotifications() {
  if (!notificationsSupported()) return 'unsupported' as const
  const p = await Notification.requestPermission()
  return p
}

async function show(title: string, body: string, tag: string) {
  const opts: NotificationOptions = { body, tag, icon: '/icon.svg', badge: '/icon.svg' }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) return reg.showNotification(title, opts)
  } catch {
    /* fall through */
  }
  new Notification(title, opts)
}

export function testNotification() {
  return show('Leanplate reminders are on', 'You will get the plate for each meal right when the mess opens.', 'test')
}

const FIRED_KEY = 'leanplate-fired'
function fired(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function markFired(k: string) {
  try {
    const f = fired()
    f[k] = true
    // keep only today's keys
    const today = todayISO()
    localStorage.setItem(FIRED_KEY, JSON.stringify(Object.fromEntries(Object.entries(f).filter(([key]) => key.startsWith(today)))))
  } catch {
    /* storage unavailable */
  }
}

function planFor(date: string): { plan: DayPlan; timings?: Timings } | null {
  const s = useStore.getState()
  if (!s.profile) return null
  const dm = dayMenuFor(s.menus, s.settings.sheetName, date)
  if (!dm) return null
  const cached = s.plans[`${date}|${dm.sheet}`]
  if (cached) return { plan: cached, timings: dm.month.timings }
  const t = targets(s.profile, currentKg(s.weights, s.profile))
  const p = planDay(dm.menu, t.kcal, s.profile.diet, date)
  return { plan: { date, sheet: dm.sheet, source: 'smart', createdAt: 0, ...p }, timings: dm.month.timings }
}

/** Checks every 30 s while the app is open; fires each meal once, at its start. */
export function startReminderLoop() {
  const tick = () => {
    const s = useStore.getState()
    if (!s.settings.reminders || !notificationsSupported() || Notification.permission !== 'granted') return
    const date = todayISO()
    const p = planFor(date)
    if (!p) return
    const now = new Date()
    const mins = now.getHours() * 60 + now.getMinutes()
    for (const m of MEALS) {
      const w = windowFor(p.timings, m)
      const key = `${date}|${m}`
      const lead = s.settings.reminderLead ?? 0
      if (mins >= w.start - lead && mins < w.end && !fired()[key]) {
        if (s.logs.some((l) => l.date === date && l.meal === m)) continue
        const { title, body } = reminderText(p.plan, m)
        show(title, body, key)
        markFired(key)
      }
    }
  }
  tick()
  const id = window.setInterval(tick, 30_000)
  const onVis = () => document.visibilityState === 'visible' && tick()
  document.addEventListener('visibilitychange', onVis)
  return () => {
    clearInterval(id)
    document.removeEventListener('visibilitychange', onVis)
  }
}

// ── Calendar export (works with the app closed) ─────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
const fold = (line: string) => {
  const out: string[] = []
  let l = line
  while (l.length > 74) {
    out.push(l.slice(0, 74))
    l = ' ' + l.slice(74)
  }
  out.push(l)
  return out.join('\r\n')
}

export function buildMonthIcs(menu: MonthMenu, meals: MealKey[] = ['breakfast', 'lunch', 'snacks', 'dinner'], fromDate = todayISO()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Leanplate//Meal reminders//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Leanplate meals']
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const n = daysInMonth(menu.year, menu.month)
  for (let d = 1; d <= n; d++) {
    const date = iso(new Date(menu.year, menu.month - 1, d))
    if (date < fromDate) continue
    const p = planFor(date)
    if (!p) continue
    for (const m of meals) {
      const w = windowFor(p.timings, m)
      const { title, body } = reminderText(p.plan, m)
      const dt = (mins: number) => `${menu.year}${pad(menu.month)}${pad(d)}T${pad(Math.floor(mins / 60))}${pad(mins % 60)}00`
      lines.push(
        'BEGIN:VEVENT',
        `UID:${date}-${m}@leanplate`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${dt(w.start)}`,
        `DTEND:${dt(Math.min(w.end, w.start + 45))}`,
        fold(`SUMMARY:${icsEscape(title)}`),
        fold(`DESCRIPTION:${icsEscape(body)}`),
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        fold(`DESCRIPTION:${icsEscape(body.split('\n')[0])}`),
        'TRIGGER:PT0M',
        'END:VALARM',
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(menu: MonthMenu, meals?: MealKey[]) {
  const blob = new Blob([buildMonthIcs(menu, meals)], { type: 'text/calendar' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `leanplate-${menu.year}-${pad(menu.month)}-meals.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
