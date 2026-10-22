import { Sparkles, Trash2 } from 'lucide-react'
import { Markdown } from '../components/Markdown'
import { CountUp, Reveal } from '../components/motion'
import { generate, profileBrief } from '../lib/gemini'
import { useMemo, useState } from 'react'
import { Bar, Button, Card, IconButton, NumberField, PageHeader, Spinner } from '../components/ui'
import { addDays, daysBetween, fmtShort, fromISO, todayISO } from '../lib/date'
import { weightTrend } from '../lib/expenditure'
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
    <div className="">
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
          <Stat
            label="Your daily burn"
            value={t.tdee.toLocaleString('en-IN')}
            hint={t.expenditure.status === 'learning' ? 'Formula estimate · learning' : t.expenditure.status === 'adjusting' ? 'Learning from your data' : 'Learned from your data'}
          />
          <Stat label="Protein" value={`${t.protein} g`} hint="per day" />
        </div>
      </div>

      <Card className="mb-3 p-6">
        <div className="eyebrow mb-2">How your target is set</div>
        <p className="max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
          Your burn is {t.tdee.toLocaleString('en-IN')} kcal a day. {t.expenditure.note}
          {t.expenditure.learned !== null && t.expenditure.learned !== t.formulaTdee && (
            <> The formula alone said {t.formulaTdee.toLocaleString('en-IN')}; your data says {t.expenditure.learned.toLocaleString('en-IN')}.</>
          )}{' '}
          Your target is {t.kcal.toLocaleString('en-IN')} kcal, a {t.deficit.toLocaleString('en-IN')} kcal deficit.
        </p>
        {t.guard && <p className="mt-3 rounded-xl bg-[color-mix(in_oklab,var(--gold)_10%,transparent)] px-4 py-3 text-[14px] text-ink-2">{t.guard}</p>}
        <p className="mt-3 text-[12.5px] text-ink-3">It learns most from fully logged days and regular morning weigh-ins. Days you didn't log are left out, not counted as zero.</p>
      </Card>

      <WeeklyReview />

      <Card className="mb-3 p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Weight trend</h2>
          <span className="text-[12px] text-ink-3">Line is your smoothed trend — daily numbers jump with water</span>
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
  const trend = weightTrend(weights, weights[weights.length - 1].date)
  const avg = weights.map((w) => trend.get(w.date) ?? w.kg)
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

function WeeklyReview() {
  const profile = useStore((s) => s.profile)!
  const logs = useStore((s) => s.logs)
  const weights = useStore((s) => s.weights)
  const slips = useStore((s) => s.slips)
  const cravings = useStore((s) => s.cravings)
  const settings = useStore((s) => s.settings)
  const t = useTargets()!
  const today = todayISO()
  const [review, setReview] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const w = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).filter((d) => d >= profile.startDate)
    const per = days.map((d) => {
      const l = logs.filter((x) => x.date === d)
      return { d, kcal: l.reduce((s, x) => s + x.kcal, 0), protein: l.reduce((s, x) => s + x.protein, 0), n: l.length }
    })
    const logged = per.filter((p) => p.n > 0)
    const onTarget = logged.filter((p) => Math.abs(p.kcal - t.kcal) <= t.kcal * 0.1 || (p.kcal < t.kcal && p.kcal > t.kcal * 0.75)).length
    const proteinDays = logged.filter((p) => p.protein >= t.protein * 0.85).length
    const sugarFree = days.filter((d) => !slips.includes(d)).length
    const inWeek = weights.filter((x) => x.date >= addDays(today, -7))
    const before = [...weights].reverse().find((x) => x.date < addDays(today, -6))
    const startW = before ?? inWeek[0]
    const endW = weights[weights.length - 1]
    const delta = startW && endW && startW !== endW ? +(endW.kg - startW.kg).toFixed(1) : null
    const cr = cravings.filter((c) => c.date >= addDays(today, -6))
    return {
      days: days.length,
      logged: logged.length,
      avg: logged.length ? Math.round(logged.reduce((s, p) => s + p.kcal, 0) / logged.length) : 0,
      onTarget,
      proteinDays,
      sugarFree,
      delta,
      cravings: cr.length,
      beaten: cr.filter((c) => c.outcome !== 'gave_in').length,
      per,
    }
  }, [logs, weights, slips, cravings, today, t, profile.startDate])

  async function ask() {
    setBusy(true)
    setErr('')
    try {
      const text = await generate({
        apiKey: settings.apiKey,
        model: settings.model,
        system:
          'You are a sharp, warm fat-loss coach for a college student eating from a hostel mess. Write a weekly review: 1 line verdict, then 3 short bullets (what went well, the one thing to fix, a specific plan for next week using mess food). Under 120 words. No emojis, no fluff.',
        turns: [
          {
            role: 'user',
            text: `${profileBrief(profile, t, currentKg(weights, profile))}

LAST 7 DAYS
Days logged: ${w.logged}/${w.days}; average ${w.avg} kcal on logged days (target ${t.kcal}); on-target days ${w.onTarget}; protein-target days ${w.proteinDays}.
Sugar-free days: ${w.sugarFree}/${w.days}. Cravings: ${w.cravings} (${w.beaten} beaten).
Weight change: ${w.delta === null ? 'not enough weigh-ins' : `${w.delta} kg`}.
Per day: ${w.per.map((p) => `${p.d}: ${p.kcal} kcal / ${p.protein} g`).join('; ')}`,
          },
        ],
        temperature: 0.6,
      })
      setReview(text)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const stats = [
    { label: 'Days logged', value: w.logged, suffix: `/${w.days}` },
    { label: 'Avg calories', value: w.avg, suffix: '' },
    { label: 'On target', value: w.onTarget, suffix: ' days' },
    { label: 'Protein hit', value: w.proteinDays, suffix: ' days' },
    { label: 'Sugar-free', value: w.sugarFree, suffix: ` /${w.days}` },
  ]

  return (
    <Card className="mb-3 p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">This week</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            {w.delta === null ? 'Weigh in twice this week to see the change' : `${w.delta <= 0 ? '' : '+'}${w.delta} kg vs last week`}
          </p>
        </div>
        {settings.apiKey && (
          <Button size="sm" variant="ghost" onClick={ask} disabled={busy}>
            {busy ? <Spinner size={14} /> : <Sparkles size={14} />} {review ? 'Review again' : 'Review my week'}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-5">
        {stats.map((s, i) => (
          <Reveal key={s.label} index={i}>
            <div className="eyebrow mb-1.5">{s.label}</div>
            <div className="display num text-[30px]">
              <CountUp value={s.value} />
              <span className="font-sans text-[12px] text-ink-3">{s.suffix}</span>
            </div>
          </Reveal>
        ))}
      </div>
      {err && <p className="mt-4 text-[13px] text-skip">{err}</p>}
      {review && (
        <Reveal className="mt-5 rounded-2xl bg-surface-2 p-5 text-[14.5px] leading-relaxed">
          <Markdown text={review} />
        </Reveal>
      )}
    </Card>
  )
}
