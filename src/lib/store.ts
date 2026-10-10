import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { daysBetween, fromISO, todayISO } from './date'
import { DEFAULT_MODEL } from './gemini'
import { targets } from './nutrition'
import type {
  ChatMsg,
  CravingEntry,
  DayMenu,
  DayPlan,
  LogEntry,
  MonthMenu,
  Profile,
  Settings,
  WeightEntry,
} from './types'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

interface State {
  profile: Profile | null
  settings: Settings
  menus: MonthMenu[]
  plans: Record<string, DayPlan>
  logs: LogEntry[]
  weights: WeightEntry[]
  cravings: CravingEntry[]
  slips: string[]
  water: Record<string, number>
  chat: ChatMsg[]

  setProfile: (p: Profile) => void
  updateSettings: (s: Partial<Settings>) => void
  addMenu: (m: MonthMenu) => void
  removeMenu: (id: string) => void
  savePlan: (p: DayPlan) => void
  clearPlans: () => void
  addLog: (l: Omit<LogEntry, 'id' | 'at'>) => string
  removeLog: (id: string) => void
  logWeight: (date: string, kg: number) => void
  removeWeight: (date: string) => void
  addCraving: (c: Omit<CravingEntry, 'id' | 'at' | 'date'>) => void
  toggleSlip: (date: string) => void
  setWater: (date: string, n: number) => void
  pushChat: (m: ChatMsg) => void
  patchLastChat: (text: string) => void
  clearChat: () => void
  importAll: (data: Partial<State>) => void
  reset: () => void
}

const initialSettings: Settings = {
  apiKey: (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? '',
  model: (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? DEFAULT_MODEL,
  sheetName: '',
  theme: 'system',
  reminders: false,
  reminderLead: 0,
}

const initial = {
  profile: null,
  settings: initialSettings,
  menus: [],
  plans: {},
  logs: [],
  weights: [],
  cravings: [],
  slips: [],
  water: {},
  chat: [],
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...initial,
      setProfile: (profile) =>
        set((s) => ({
          profile,
          weights: s.weights.length ? s.weights : [{ date: profile.startDate, kg: profile.startKg }],
        })),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      addMenu: (m) =>
        set((s) => ({
          menus: [...s.menus.filter((x) => !(x.month === m.month && x.year === m.year)), m].sort(
            (a, b) => b.year * 12 + b.month - (a.year * 12 + a.month),
          ),
          // Plans for that month were built from the old menu
          plans: Object.fromEntries(
            Object.entries(s.plans).filter(([k]) => !k.startsWith(`${m.year}-${String(m.month).padStart(2, '0')}`)),
          ),
        })),
      removeMenu: (id) => set((s) => ({ menus: s.menus.filter((m) => m.id !== id) })),
      savePlan: (p) => set((s) => ({ plans: { ...s.plans, [`${p.date}|${p.sheet}`]: p } })),
      clearPlans: () => set({ plans: {} }),
      addLog: (l) => {
        const id = uid()
        set((s) => ({ logs: [...s.logs, { ...l, id, at: Date.now() }] }))
        return id
      },
      removeLog: (id) => set((s) => ({ logs: s.logs.filter((l) => l.id !== id) })),
      logWeight: (date, kg) =>
        set((s) => ({
          weights: [...s.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date)),
        })),
      removeWeight: (date) => set((s) => ({ weights: s.weights.filter((w) => w.date !== date) })),
      addCraving: (c) =>
        set((s) => {
          const date = todayISO()
          const entry = { ...c, id: uid(), at: Date.now(), date }
          const slips = c.outcome === 'gave_in' && !s.slips.includes(date) ? [...s.slips, date] : s.slips
          return { cravings: [...s.cravings, entry], slips }
        }),
      toggleSlip: (date) =>
        set((s) => ({ slips: s.slips.includes(date) ? s.slips.filter((d) => d !== date) : [...s.slips, date] })),
      setWater: (date, n) => set((s) => ({ water: { ...s.water, [date]: Math.max(0, n) } })),
      pushChat: (m) => set((s) => ({ chat: [...s.chat, m].slice(-80) })),
      patchLastChat: (text) =>
        set((s) => {
          const chat = s.chat.slice()
          chat[chat.length - 1] = { ...chat[chat.length - 1], text }
          return { chat }
        }),
      clearChat: () => set({ chat: [] }),
      importAll: (data) => set((s) => ({ ...s, ...data })),
      reset: () => set({ ...initial, settings: { ...initialSettings } }),
    }),
    { name: 'leanplate-v1', version: 1 },
  ),
)

// ── Derived helpers ────────────────────────────────────────────────

export function currentKg(weights: WeightEntry[], profile: Profile) {
  return weights.length ? weights[weights.length - 1].kg : profile.startKg
}

export function useTargets() {
  const profile = useStore((s) => s.profile)
  const weights = useStore((s) => s.weights)
  return useMemo(() => (profile ? targets(profile, currentKg(weights, profile)) : null), [profile, weights])
}

export function findMenu(menus: MonthMenu[], date: string) {
  const d = fromISO(date)
  return menus.find((m) => m.month === d.getMonth() + 1 && m.year === d.getFullYear()) ?? null
}

export function pickSheet(menu: MonthMenu, preferred: string) {
  return (
    menu.sheets.find((s) => s.name === preferred) ??
    menu.sheets.find((s) => s.name.toLowerCase() === preferred.toLowerCase()) ??
    menu.sheets.find((s) => /veg/i.test(s.name) && !/spl|special/i.test(s.name)) ??
    menu.sheets[0]
  )
}

export function dayMenuFor(menus: MonthMenu[], preferred: string, date: string): { menu: DayMenu; sheet: string; month: MonthMenu } | null {
  const month = findMenu(menus, date)
  if (!month) return null
  const sheet = pickSheet(month, preferred)
  if (!sheet) return null
  const d = fromISO(date)
  const menu = sheet.days[d.getDate()] ?? sheet.weekdays[d.getDay()]
  return menu ? { menu, sheet: sheet.name, month } : null
}

/** Consecutive days (ending today) without a sugar slip. */
export function sugarStreak(slips: string[], startDate: string) {
  const today = todayISO()
  const last = slips.filter((d) => d <= today).sort().pop()
  const from = last && last > startDate ? last : startDate
  const n = daysBetween(from, today)
  return last && last >= startDate ? n : n + 1
}
