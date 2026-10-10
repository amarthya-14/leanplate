import { ArrowRight, MessageCircle, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, Card, cx, PageHeader, Pill } from '../components/ui'
import { addDays, todayISO } from '../lib/date'
import { sugarStreak, useStore } from '../lib/store'
import type { CravingOutcome } from '../lib/types'

const DURATION = 10 * 60

const STEPS = [
  { at: 0, title: 'Drink a full glass of water', body: 'Thirst often shows up as a sweet craving. Drink it slowly.' },
  { at: 90, title: 'Change the room', body: 'Walk to the corridor, the balcony, anywhere away from the canteen route. Movement breaks the loop.' },
  { at: 210, title: 'Brush your teeth or chew mint gum', body: 'A mint-clean mouth makes sugar taste wrong. It works surprisingly well.' },
  { at: 330, title: 'Ask: hungry, or just habit?', body: 'If you could eat plain curd, eggs or chana right now, you are hungry — eat that. If only sweets sound good, it is a habit cue.' },
  { at: 450, title: 'Breathe it down', body: 'Cravings rise and fall like a wave — they peak and fade in 10–20 minutes. You are near the top.' },
]

const SWAPS = [
  { from: 'Gulab jamun, payasam, mess sweets', to: 'Banana or the cut fruit, eaten slowly after the meal' },
  { from: 'Juice, sharbath, cold drinks', to: 'Lemon water with sabja, or a glass of buttermilk' },
  { from: 'Chocolate bar from the store', to: 'One square of 70%+ dark chocolate, after a meal only' },
  { from: 'Biscuits or chips at night', to: 'Roasted chana or a handful of peanuts (keep a jar in the room)' },
  { from: 'Ice cream', to: 'Thick curd, chilled, with a few pieces of fruit' },
  { from: 'Tea with 2 sugars', to: 'Ginger or masala tea — cut sugar by half a spoon each week' },
  { from: 'Badam milk', to: 'Plain milk with a pinch of cardamom or cinnamon' },
]

const WHY = [
  ['Refined-carb crash', 'Poori, white bread, sweets → fast spike → crash 2 hours later → your brain asks for sugar. Protein and fibre at every meal flatten this.'],
  ['Short sleep', 'Under 6–7 hours raises ghrelin (hunger) and lowers leptin. Late-night study sessions are the biggest craving trigger in hostels.'],
  ['Low-protein breakfast', 'Bread-jam or only poha means you are starving by 11. Eggs or sprouts at breakfast cut afternoon cravings noticeably.'],
  ['The 5 pm cue', 'Snack time + tea + friends = habit loop. Change one piece: take tea without sugar and walk out.'],
  ['Stress and boredom', 'Assignments and exams make sugar feel like a reward. Name it — “I am stressed, not hungry” — and pick a non-food break.'],
]

export function Cravings({ go }: { go: (v: string, prompt?: string) => void }) {
  const profile = useStore((s) => s.profile)!
  const slips = useStore((s) => s.slips)
  const cravings = useStore((s) => s.cravings)
  const addCraving = useStore((s) => s.addCraving)
  const toggleSlip = useStore((s) => s.toggleSlip)
  const today = todayISO()
  const streak = sugarStreak(slips, profile.startDate)
  const slippedToday = slips.includes(today)

  const [intensity, setIntensity] = useState(3)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [done, setDone] = useState<CravingOutcome | null>(null)

  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const elapsed = startedAt ? Math.min(DURATION, Math.floor((now - startedAt) / 1000)) : 0
  const remaining = DURATION - elapsed
  const step = [...STEPS].reverse().find((s) => elapsed >= s.at) ?? STEPS[0]

  function finish(outcome: CravingOutcome) {
    addCraving({ intensity, outcome })
    setDone(outcome)
    setStartedAt(null)
  }

  const stats = useMemo(() => {
    const weekAgo = addDays(today, -6)
    const week = cravings.filter((c) => c.date >= weekAgo)
    const beat = cravings.filter((c) => c.outcome !== 'gave_in').length
    const hours = new Array(24).fill(0)
    cravings.forEach((c) => hours[new Date(c.at).getHours()]++)
    const peak = hours.indexOf(Math.max(...hours))
    return { week: week.length, rate: cravings.length ? Math.round((beat / cravings.length) * 100) : null, peak: cravings.length >= 3 ? peak : null }
  }, [cravings, today])

  // last 28 days, slip calendar
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27))

  return (
    <div className="rise">
      <PageHeader eyebrow="Cravings" title="Ride the wave" />

      <div className="mb-3 grid gap-3 md:grid-cols-[1fr_1.3fr]">
        <Card className="flex flex-col justify-between p-6">
          <div>
            <div className="eyebrow mb-2">Without added sugar</div>
            <div className="flex items-baseline gap-2">
              <span className="display num text-[72px]">{streak}</span>
              <span className="text-ink-3">{streak === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-14 gap-1" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
            {days.map((d) => (
              <div
                key={d}
                title={d}
                className={cx(
                  'aspect-square rounded-[4px]',
                  d < profile.startDate ? 'bg-surface-2' : slips.includes(d) ? 'bg-skip/70' : d <= today ? 'bg-accent-text/75' : 'bg-surface-2',
                )}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[12px] text-ink-3">Last 4 weeks</span>
            <Button size="sm" variant="ghost" onClick={() => toggleSlip(today)}>
              {slippedToday ? (
                <>
                  <RotateCcw size={13} /> Undo today's slip
                </>
              ) : (
                'I had sugar today'
              )}
            </Button>
          </div>
          {slippedToday && <p className="mt-2 text-[13px] text-ink-2">One slip doesn't undo anything. Make the next meal a normal plate — don't compensate by skipping it.</p>}
        </Card>

        <Card className="relative overflow-hidden p-6">
          {!startedAt && !done && (
            <div className="flex h-full flex-col">
              <div className="eyebrow mb-2">Craving right now?</div>
              <p className="max-w-md text-[15px] leading-relaxed text-ink-2">
                Give it ten minutes. Most cravings peak and fade on their own — you just need something to do while it passes.
              </p>
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-[13px]">
                  <span className="text-ink-2">How strong?</span>
                  <span className="text-ink-3">{['', 'Mild', 'Noticeable', 'Strong', 'Very strong', 'Overwhelming'][intensity]}</span>
                </div>
                <input type="range" min={1} max={5} value={intensity} onChange={(e) => setIntensity(+e.target.value)} className="w-full" />
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                <Button variant="primary" size="lg" onClick={() => { setStartedAt(Date.now()); setNow(Date.now()) }}>
                  Start 10-minute reset <ArrowRight size={16} />
                </Button>
                <Button size="lg" variant="ghost" onClick={() => go('coach', 'I have a strong sugar craving right now. Help me get through it.')}>
                  <MessageCircle size={16} /> Talk to coach
                </Button>
              </div>
            </div>
          )}

          {startedAt && (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="eyebrow mb-1">Step {STEPS.indexOf(step) + 1} of {STEPS.length}</div>
                  <h3 className="display text-[30px] leading-tight">{step.title}</h3>
                </div>
                <div className="relative grid size-20 shrink-0 place-items-center">
                  <div className="breathe absolute inset-0 rounded-full bg-accent-soft" />
                  <span className="num relative text-[17px] font-medium">
                    {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>
              <p key={step.title} className="rise mt-3 max-w-md text-[15px] leading-relaxed text-ink-2">{step.body}</p>
              <div className="mt-5 h-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full bg-accent-text transition-all duration-1000" style={{ width: `${(elapsed / DURATION) * 100}%` }} />
              </div>
              <div className="mt-auto pt-6">
                <div className="mb-2 text-[13px] text-ink-3">{remaining ? 'Done early? How did it go?' : 'Ten minutes. How is it now?'}</div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => finish('resisted')}>It passed</Button>
                  <Button onClick={() => finish('swapped')}>Had a healthy swap</Button>
                  <Button variant="ghost" onClick={() => finish('gave_in')}>I gave in</Button>
                </div>
              </div>
            </div>
          )}

          {done && (
            <div className="rise flex h-full flex-col">
              <div className="eyebrow mb-2">Logged</div>
              <h3 className="display text-[32px] leading-tight">
                {done === 'resisted' ? 'That is the habit getting weaker.' : done === 'swapped' ? 'Smart swap. That counts.' : 'Fine. Next meal, normal plate.'}
              </h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-2">
                {done === 'gave_in'
                  ? 'No guilt, no skipping meals to “make up for it” — that just sets up the next craving. Drink water, and have protein at your next meal.'
                  : 'Every craving you ride out makes the next one a little quieter. The streak is just the scoreboard.'}
              </p>
              <div className="mt-auto pt-6">
                <Button onClick={() => setDone(null)}>Back</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-3">
        <Mini label="This week" value={String(stats.week)} hint="cravings logged" />
        <Mini label="Beaten" value={stats.rate === null ? '—' : `${stats.rate}%`} hint="resisted or swapped" />
        <Mini
          label="Peak hour"
          value={stats.peak === null ? '—' : `${((stats.peak + 11) % 12) + 1}${stats.peak >= 12 ? 'pm' : 'am'}`}
          hint={stats.peak === null ? 'log 3+ to see' : 'plan a snack before this'}
        />
      </div>

      <section className="mt-10">
        <h2 className="display mb-4 text-[30px]">Swaps that work in a hostel</h2>
        <Card className="divide-y divide-line">
          {SWAPS.map((s) => (
            <div key={s.from} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[1fr_auto_1.3fr] sm:items-center sm:gap-4">
              <span className="text-[14px] text-ink-3 line-through decoration-skip/40">{s.from}</span>
              <ArrowRight size={14} className="hidden text-ink-3 sm:block" />
              <span className="text-[14px] text-ink">{s.to}</span>
            </div>
          ))}
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="display mb-4 text-[30px]">Why it keeps happening</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {WHY.map(([t, b]) => (
            <Card key={t} className="p-5">
              <Pill tone="gold" className="mb-2">{t}</Pill>
              <p className="text-[14px] leading-relaxed text-ink-2">{b}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

function Mini({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="display num text-[28px] sm:text-[34px]">{value}</div>
      <div className="mt-1 text-[11.5px] text-ink-3">{hint}</div>
    </Card>
  )
}
