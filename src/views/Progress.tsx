import { Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, Button, Card, IconButton, NumberField, PageHeader } from '../components/ui'
import { addDays, daysBetween, fmtShort, fromISO, todayISO } from '../lib/date'
import { bmi, bmiBand } from '../lib/nutrition'
import { currentKg, useStore, useTargets } from '../lib/store'

export function Progress() {
  const profile = useStore((s) => s.profile)!
  const weights = useStore((s) => s.weights)
  const logs = useStore((s) => s.logs)
  const logWeight = useStore((s) => s.logWeight)
  const removeWeight = useStore((s) => s.removeWeight)
  const t = useTargets()!
  const now = currentKg(weights, profile)
  const [kg, setKg] = useState<number | ''>(now)
  const today = todayISO()

  const lost = +(profile.startKg - now).toFixed(1)
  const total = profile.startKg - profile.goalKg
  const toGo = +(now - profile.goalKg).toFixed(1)
  const b = bmi(now, profile.heightCm)

  const projection = useMemo(() => {
    const recent = weights.filter((w) => daysBetween(w.date, today) <= 35)
    if (recent.length < 3 || daysBetween(recent[0].date, recent[recent.length - 1].date) < 6) return null
    const xs = recent.map((w) => daysBetween(recent[0].date, w.date))
    const ys = recent.map((w) => w.kg)
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length
    const my = ys.reduce((a, b) => a + b, 0) / ys.length
    const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0)
    const perWeek = slope * 7
    if (slope >= -0.005) return { perWeek, date: null }
    const days = Math.ceil((now - profile.goalKg) / -slope)
    return { perWeek, date: days > 0 && days < 1500 ? addDays(today, days) : null }
  }, [weights, today, now, profile.goalKg])

  const last14 = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = addDays(today, i - 13)
        return { d, kcal: logs.filter((l) => l.date === d).reduce((s, l) => s + l.kcal, 0) }
      }),
    [logs, today],
  )
  const loggedDays = last14.filter((x) => x.kcal > 0)
  const avg = loggedDays.length ? Math.round(loggedDays.reduce((s, x) => s + x.kcal, 0) / loggedDays.length) : 0

  return (
    <div className="rise">
      <PageHeader eyebrow="Progress" title="The long game" />

      <div className="mb-3 grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-2">Current weight</div>
              <div className="flex items-baseline gap-2">
                <span className="display num text-[64px]">{now}</span>
                <span className="text-ink-3">kg</span>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <NumberField value={kg} onChange={setKg} suffix="kg" step={0.1} className="w-32" />
              <Button variant="primary" onClick={() => kg !== '' && kg > 20 && logWeight(today, Number(kg))} disabled={kg === ''}>
                Log today
              </Button>
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-[12px] text-ink-3">
              <span>Start {profile.startKg} kg</span>
              <span>Goal {profile.goalKg} kg</span>
            </div>
            <Bar value={Math.max(0, lost)} max={total} />
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[14px]">
              <span>
                <span className="num font-medium">{lost > 0 ? lost : 0} kg</span> <span className="text-ink-3">lost</span>
              </span>
              <span>
                <span className="num font-medium">{Math.max(0, toGo)} kg</span> <span className="text-ink-3">to go</span>
              </span>
              {projection && (
                <span className="text-ink-3">
                  {projection.perWeek < 0 ? `${Math.abs(projection.perWeek).toFixed(2)} kg/week` : 'Flat or rising lately'}
                  {projection.date && ` · goal around ${fromISO(projection.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`}
                </span>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="BMI" value={b.toFixed(1)} hint={bmiBand(b) + ' (Asian scale)'} />
          <Stat label="Daily target" value={t.kcal.toLocaleString('en-IN')} hint={`${t.deficit} kcal deficit`} />
          <Stat label="Maintenance" value={t.tdee.toLocaleString('en-IN')} hint={`BMR ${t.bmr}`} />
          <Stat label="Protein" value={`${t.protein} g`} hint="per day" />
        </div>
      </div>

      <Card className="mb-3 p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Weight trend</h2>
          <span className="text-[12px] text-ink-3">Line is the 7-entry average — daily numbers jump with water</span>
        </div>
        <WeightChart weights={weights} goal={profile.goalKg} />
      </Card>

      <Card className="mb-3 p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Last 14 days</h2>
          <span className="text-[12px] text-ink-3">{avg ? `Avg ${avg.toLocaleString('en-IN')} kcal on logged days` : 'Log meals to see this'}</span>
        </div>
        <CalorieBars days={last14} target={t.kcal} />
      </Card>

      {weights.length > 0 && (
        <details className="mt-8">
          <summary className="eyebrow cursor-pointer">All weigh-ins ({weights.length})</summary>
          <ul className="mt-3 divide-y divide-line">
            {[...weights].reverse().map((w) => (
              <li key={w.date} className="flex items-center justify-between py-2 text-[14px]">
                <span className="text-ink-2">{fmtShort(w.date)}</span>
                <span className="flex items-center gap-2">
                  <span className="num">{w.kg} kg</span>
                  <IconButton label="Delete weigh-in" className="size-8" onClick={() => removeWeight(w.date)}>
                    <Trash2 size={13} />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-5">
      <div className="eyebrow mb-2">{label}</div>
      <div className="display num text-[32px]">{value}</div>
      <div className="mt-1 text-[12px] text-ink-3">{hint}</div>
    </Card>
  )
}

function WeightChart({ weights, goal }: { weights: { date: string; kg: number }[]; goal: number }) {
  if (weights.length < 2) return <p className="py-10 text-center text-[14px] text-ink-3">Weigh in a few mornings (after the loo, before food) to see your trend.</p>
  const W = 720
  const H = 220
  const P = { l: 36, r: 12, t: 12, b: 26 }
  const first = weights[0].date
  const span = Math.max(1, daysBetween(first, weights[weights.length - 1].date))
  const vals = weights.map((w) => w.kg).concat(goal)
  const min = Math.floor(Math.min(...vals) - 1)
  const max = Math.ceil(Math.max(...vals) + 1)
  const x = (d: string) => P.l + (daysBetween(first, d) / span) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b)
  const avg = weights.map((_, i) => {
    const s = weights.slice(Math.max(0, i - 6), i + 1)
    return s.reduce((a, b) => a + b.kg, 0) / s.length
  })
  const path = avg.map((v, i) => `${i ? 'L' : 'M'}${x(weights[i].date).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Weight trend chart">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">
            {v.toFixed(0)}
          </text>
        </g>
      ))}
      <line x1={P.l} x2={W - P.r} y1={y(goal)} y2={y(goal)} stroke="var(--gold)" strokeDasharray="4 4" />
      <text x={W - P.r} y={y(goal) - 6} textAnchor="end" fontSize="11" fill="var(--gold)">
        goal {goal}
      </text>
      {weights.map((w) => (
        <circle key={w.date} cx={x(w.date)} cy={y(w.kg)} r={3} fill="var(--ink-3)" opacity={0.45} />
      ))}
      <path d={path} fill="none" stroke="var(--accent-text)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <text x={P.l} y={H - 6} fontSize="11" fill="var(--ink-3)">
        {fmtShort(first)}
      </text>
      <text x={W - P.r} y={H - 6} textAnchor="end" fontSize="11" fill="var(--ink-3)">
        {fmtShort(weights[weights.length - 1].date)}
      </text>
    </svg>
  )
}

function CalorieBars({ days, target }: { days: { d: string; kcal: number }[]; target: number }) {
  const max = Math.max(target * 1.3, ...days.map((d) => d.kcal))
  return (
    <div>
      <div className="relative flex h-36 items-end gap-1.5">
        <div className="absolute inset-x-0 border-t border-dashed border-gold" style={{ bottom: `${(target / max) * 100}%` }} />
        {days.map(({ d, kcal }) => (
          <div key={d} className="group relative flex h-full flex-1 items-end" title={`${fmtShort(d)}: ${kcal} kcal`}>
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${Math.max(kcal ? 3 : 1.5, (kcal / max) * 100)}%`,
                background: !kcal ? 'var(--surface-3)' : kcal > target * 1.08 ? 'var(--skip)' : 'var(--accent-text)',
                opacity: kcal ? 1 : 0.6,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {days.map(({ d }) => (
          <div key={d} className="flex-1 text-center text-[10px] text-ink-3">
            {fromISO(d).getDate()}
          </div>
        ))}
      </div>
    </div>
  )
}
