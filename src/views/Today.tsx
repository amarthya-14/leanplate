import { Droplet, Flame, Minus, Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { PlanBoard } from '../components/PlanBoard'
import { Bar, Card, IconButton, Ring } from '../components/ui'
import { fmtLong, greeting, todayISO } from '../lib/date'
import { sugarStreak, useStore, useTargets } from '../lib/store'
import { MEAL_LABEL } from '../lib/types'

export function Today({ go }: { go: (v: string) => void }) {
  const date = todayISO()
  const profile = useStore((s) => s.profile)!
  const logs = useStore((s) => s.logs)
  const water = useStore((s) => s.water[date] ?? 0)
  const setWater = useStore((s) => s.setWater)
  const removeLog = useStore((s) => s.removeLog)
  const slips = useStore((s) => s.slips)
  const t = useTargets()!

  const today = useMemo(() => logs.filter((l) => l.date === date), [logs, date])
  const eaten = today.reduce((s, l) => s + l.kcal, 0)
  const protein = today.reduce((s, l) => s + l.protein, 0)
  const left = t.kcal - eaten
  const streak = sugarStreak(slips, profile.startDate)
  const first = profile.name.split(' ')[0]

  return (
    <div className="rise">
      <header className="mb-8">
        <div className="eyebrow mb-2">{fmtLong(date)}</div>
        <h1 className="display text-[44px] sm:text-[56px]">
          {greeting()}
          {first ? `, ${first}` : ''}.
        </h1>
      </header>

      <div className="mb-10 grid gap-3 md:grid-cols-[1.25fr_1fr]">
        <Card className="flex items-center gap-6 p-6 sm:gap-8">
          <Ring value={eaten} max={t.kcal} over={left < 0}>
            <div>
              <div className="display num text-[44px]">{Math.abs(left).toLocaleString('en-IN')}</div>
              <div className="mt-1 text-[12px] text-ink-3">{left >= 0 ? 'kcal left' : 'kcal over'}</div>
            </div>
          </Ring>
          <div className="min-w-0 flex-1 space-y-5">
            <Metric label="Eaten" value={`${eaten.toLocaleString('en-IN')}`} unit={`/ ${t.kcal.toLocaleString('en-IN')} kcal`} />
            <div>
              <Metric label="Protein" value={`${protein}`} unit={`/ ${t.protein} g`} />
              <Bar className="mt-2" value={protein} max={t.protein} tone="gold" />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Water</span>
              <Droplet size={15} className="text-ink-3" />
            </div>
            <div className="mt-3">
              <span className="display num text-[40px]">{water}</span>
              <span className="ml-1 text-[13px] text-ink-3">/ {t.waterGlasses} glasses</span>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <IconButton label="Remove a glass" onClick={() => setWater(date, water - 1)} className="size-8 border border-line">
                <Minus size={14} />
              </IconButton>
              <button
                aria-label="Add a glass"
                onClick={() => setWater(date, water + 1)}
                className="grid size-8 cursor-pointer place-items-center rounded-full bg-accent text-accent-ink transition hover:opacity-90 active:scale-95"
              >
                <Plus size={14} />
              </button>
            </div>
          </Card>
          <button onClick={() => go('cravings')} className="card flex cursor-pointer flex-col justify-between p-5 text-left transition hover:border-line-strong">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Sugar-free</span>
              <Flame size={15} className="text-gold" />
            </div>
            <div className="mt-3">
              <span className="display num text-[40px]">{streak}</span>
              <span className="ml-1 text-[13px] text-ink-3">{streak === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="mt-3 text-[12.5px] text-ink-3">Craving? Tap here.</div>
          </button>
        </div>
      </div>

      <PlanBoard date={date} onUploadClick={() => go('menu')} />

      {today.length > 0 && (
        <section className="mt-10">
          <h2 className="eyebrow mb-3">Logged today</h2>
          <Card className="divide-y divide-line">
            {today.map((l) => (
              <div key={l.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-20 shrink-0 text-[12px] font-medium text-ink-3">{l.meal === 'extra' ? 'Extra' : MEAL_LABEL[l.meal]}</div>
                <div className="min-w-0 flex-1 truncate text-[14px] text-ink-2">{l.label}</div>
                <div className="num text-[13px] text-ink-3">{l.kcal} kcal</div>
                <IconButton label="Delete entry" onClick={() => removeLog(l.id)} className="size-8">
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="num text-[24px] font-medium tracking-tight">{value}</span>
        <span className="truncate text-[13px] text-ink-3">{unit}</span>
      </div>
    </div>
  )
}
