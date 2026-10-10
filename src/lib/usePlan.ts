import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtLong } from './date'
import { planDay } from './foods'
import { aiPlanDay, profileBrief } from './gemini'
import { currentKg, dayMenuFor, useStore, useTargets } from './store'
import type { DayPlan } from './types'

// Remember which days we already auto-asked Gemini for, so errors don't loop.
const attempted = new Set<string>()

export function useDayPlan(date: string) {
  const menus = useStore((s) => s.menus)
  const settings = useStore((s) => s.settings)
  const profile = useStore((s) => s.profile)
  const weights = useStore((s) => s.weights)
  const plans = useStore((s) => s.plans)
  const savePlan = useStore((s) => s.savePlan)
  const t = useTargets()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const dm = useMemo(() => dayMenuFor(menus, settings.sheetName, date), [menus, settings.sheetName, date])
  const key = dm ? `${date}|${dm.sheet}` : ''
  const cached = key ? plans[key] : undefined

  const smart: DayPlan | null = useMemo(() => {
    if (!dm || !profile || !t) return null
    const p = planDay(dm.menu, t.kcal, profile.diet, date)
    return { date, sheet: dm.sheet, source: 'smart', createdAt: 0, ...p }
  }, [dm, profile, t, date])

  const generate = useCallback(async () => {
    if (!dm || !profile || !t || !settings.apiKey) return
    setLoading(true)
    setError('')
    try {
      const r = await aiPlanDay({
        apiKey: settings.apiKey,
        model: settings.model,
        brief: profileBrief(profile, t, currentKg(weights, profile)),
        dateLabel: fmtLong(date),
        menu: dm.menu,
        targets: t,
      })
      const empty = Object.values(r.meals).every((m) => !m.picks.length)
      if (empty) throw new Error('Gemini returned an empty plan.')
      savePlan({ date, sheet: dm.sheet, source: 'ai', createdAt: Date.now(), ...r })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [dm, profile, t, settings.apiKey, settings.model, weights, date, savePlan])

  useEffect(() => {
    if (!key || cached || !settings.apiKey || attempted.has(key)) return
    attempted.add(key)
    generate()
  }, [key, cached, settings.apiKey, generate])

  return {
    dayMenu: dm,
    plan: cached ?? smart,
    loading,
    error,
    generate,
    canAI: !!settings.apiKey,
  }
}
