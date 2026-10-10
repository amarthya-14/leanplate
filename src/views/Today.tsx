import { ArrowRight, BellRing, Droplet, Flame, Minus, Plus, Scale, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { CountUp, EASE, Reveal, SplitWords } from '../components/motion'
import { PlanBoard } from '../components/PlanBoard'
import { toast } from '../components/Toast'
import { Bar, Button, Card, IconButton, Ring } from '../components/ui'
import { addDays, daysBetween, fmtLong, greeting, todayISO } from '../lib/date'
import { nextMove } from '../lib/insights'
import { enableNotifications, notificationsSupported, testNotification } from '../lib/reminders'
import { currentKg, dayMenuFor, sugarStreak, useStore, useTargets } from '../lib/store'
import { MEAL_LABEL } from '../lib/types'
import { useDayPlan } from '../lib/usePlan'

const DISMISS_KEY = 'leanplate-reminder-prompt-dismissed'

export function Today({ go }: { go: (v: string, prompt?: string) => void }) {
  const date = todayISO()
  const profile = useStore((s) => s.profile)!
  const logs = useStore((s) => s.logs)
  const menus = useStore((s) => s.menus)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const weights = useStore((s) => s.weights)
  const water = useStore((s) => s.water[date] ?? 0)
  const addWater = useStore((s) => s.addWater)
  const removeLog = useStore((s) => s.removeLog)
  const slips = useStore((s) => s.slips)
  const t = useTargets()!
  const { plan, dayMenu } = useDayPlan(date)

  const today = useMemo(() => logs.filter((l) => l.date === date), [logs, date])
  const eaten = today.reduce((s, l) => s + l.kcal, 0)
  const protein = today.reduce((s, l) => s + l.protein, 0)
  const left = t.kcal - eaten
  const streak = sugarStreak(slips, profile.startDate)
  const kg = currentKg(weights, profile)
  const lost = +(profile.startKg - kg).toFixed(1)
  const day = daysBetween(profile.startDate, date) + 1
  const first = profile.name.split(' ')[0]

  const insight = useMemo(
    () =>
      nextMove({
        now: new Date(),
        timings: dayMenu?.month.timings,
        plan,
        hasMenu: !!dayMenu,
        logs: today,
        targets: t,
        weights,
        today: date,
        water,
        tomorrow: dayMenuFor(menus, settings.sheetName, new Date().getHours() < 5 ? date : addDays(date, 1))?.menu ?? null,
      }),
    [dayMenu, plan, today, t, weights, date, water, menus, settings.sheetName],
  )

  const [promptHidden, setPromptHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const showReminderPrompt = notificationsSupported() && !settings.reminders && !promptHidden && !!dayMenu

  async function turnOnReminders() {
    const r = await enableNotifications()
    if (r === 'granted') {
      updateSettings({ reminders: true })
      testNotification()
      toast('Meal reminders on')
    } else toast(r === 'denied' ? 'Notifications are blocked in browser settings' : 'Notifications not supported here')
  }
  function hidePrompt() {
    setPromptHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <header className="mb-8">
        <Reveal className="eyebrow mb-3">
          {fmtLong(date)} <span className="mx-1.5 text-line-strong">/</span> Day {day}
        </Reveal>
        <h1 className="display text-[46px] leading-[1] sm:text-[60px]">
          <SplitWords text={`${greeting()}${first ? `, ${first}` : ''}.`} delay={0.05} />
        </h1>
      </header>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <Reveal index={1}>
          <div className="hero-card relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-[24px] border border-transparent p-6 sm:p-7">
            <div className="pointer-events-none absolute -right-16 -bottom-16 size-56 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-4 -bottom-28 size-56 rounded-full border border-white/5" />
            <div className="text-[11px] font-medium tracking-[0.16em] text-[#d8c28e] uppercase">{insight.eyebrow}</div>
            <AnimatePresence mode="wait">
              <motion.div key={insight.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>
                <h2 className="display text-balance mt-3 text-[30px] leading-[1.08] sm:text-[34px]">{insight.title}</h2>
                <p className="text-pretty mt-3 max-w-lg text-[14.5px] leading-relaxed text-white/70">{insight.body}</p>
              </motion.div>
            </AnimatePresence>
            {insight.action && (
              <button
                onClick={() => go(insight.action!.view, insight.action!.prompt)}
                className="group mt-auto flex w-fit cursor-pointer items-center gap-2 pt-5 text-[13.5px] font-medium text-white"
              >
                {insight.action.label}
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </button>
            )}
          </div>
        </Reveal>

        <Reveal index={2}>
          <Card className="flex h-full items-center gap-6 p-6">
            <Ring value={eaten} max={t.kcal} over={left < 0} size={156}>
              <div>
                <div className="display num text-[42px]">
                  <CountUp value={Math.abs(left)} />
                </div>
                <div className="mt-1 text-[11.5px] text-ink-3">{left >= 0 ? 'kcal left' : 'kcal over'}</div>
              </div>
            </Ring>
            <div className="min-w-0 flex-1 space-y-5">
              <div>
                <div className="eyebrow mb-1">Eaten</div>
                <div className="flex items-baseline gap-1.5">
                  <CountUp value={eaten} className="num text-[24px] font-medium tracking-tight" />
                  <span className="truncate text-[13px] text-ink-3">/ {t.kcal.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div>
                <div className="eyebrow mb-1">Protein</div>
                <div className="flex items-baseline gap-1.5">
                  <CountUp value={protein} className="num text-[24px] font-medium tracking-tight" />
                  <span className="text-[13px] text-ink-3">/ {t.protein} g</span>
                </div>
                <Bar className="mt-2" value={protein} max={t.protein} tone="gold" />
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Reveal index={3}>
          <Card className="card-hover flex h-full flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Water</span>
              <Droplet size={15} className="text-ink-3" />
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <motion.span key={water} initial={{ y: -6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="display num text-[38px]">
                {water}
              </motion.span>
              <span className="text-[13px] text-ink-3">/ {t.waterGlasses}</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {Array.from({ length: Math.min(t.waterGlasses, 12) }, (_, i) => (
                <span key={i} className="h-1.5 flex-1 rounded-full transition-colors duration-500" style={{ background: i < water ? 'var(--accent-text)' : 'var(--surface-3)' }} />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <IconButton label="Remove a glass" onClick={() => addWater(date, -1)} className="size-8 border border-line">
                <Minus size={14} />
              </IconButton>
              <button
                aria-label="Add a glass"
                onClick={() => addWater(date, 1)}
                className="grid size-8 cursor-pointer place-items-center rounded-full bg-accent text-accent-ink transition hover:opacity-90 active:scale-90"
              >
                <Plus size={14} />
              </button>
            </div>
          </Card>
        </Reveal>
        <Reveal index={4}>
          <button onClick={() => go('cravings')} className="card card-hover flex h-full w-full cursor-pointer flex-col justify-between p-5 text-left">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Sugar-free</span>
              <Flame size={15} className="text-gold" />
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <CountUp value={streak} className="display num text-[38px]" />
              <span className="text-[13px] text-ink-3">{streak === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="mt-auto pt-3 text-[12.5px] text-ink-3">Craving? Tap for the reset.</div>
          </button>
        </Reveal>
        <Reveal index={5} className="col-span-2 lg:col-span-1">
          <button onClick={() => go('progress')} className="card card-hover flex h-full w-full cursor-pointer flex-col justify-between p-5 text-left">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Weight</span>
              <Scale size={15} className="text-ink-3" />
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <CountUp value={kg} decimals={1} className="display num text-[38px]" />
              <span className="text-[13px] text-ink-3">kg</span>
            </div>
            <div className="mt-3">
              <Bar value={Math.max(0, lost)} max={Math.max(0.1, profile.startKg - profile.goalKg)} />
              <div className="mt-2 text-[12.5px] text-ink-3">
                {lost > 0 ? `${lost} kg down` : 'Just getting started'} · goal {profile.goalKg} kg
              </div>
            </div>
          </button>
        </Reveal>
      </div>

      <AnimatePresence>
        {showReminderPrompt && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap items-center gap-4 rounded-[20px] border border-dashed border-line-strong px-5 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text">
                <BellRing size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-medium">Get your plate at meal time</div>
                <div className="text-[13px] text-ink-3">A reminder when the mess opens: what to take, what to skip.</div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="primary" onClick={turnOnReminders}>
                  Turn on
                </Button>
                <IconButton label="Dismiss" onClick={hidePrompt} className="size-8">
                  <X size={15} />
                </IconButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Reveal index={6} className="mt-12">
        <PlanBoard date={date} onUploadClick={() => go('menu')} />
      </Reveal>

      {today.length > 0 && (
        <section className="mt-12">
          <h2 className="eyebrow mb-3">Logged today</h2>
          <Card className="overflow-hidden">
            <AnimatePresence initial={false}>
              {today.map((l) => (
                <motion.div
                  key={l.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="border-b border-line last:border-0"
                >
                  <div className="flex items-center gap-4 px-5 py-3">
                    <div className="w-20 shrink-0 text-[12px] font-medium text-ink-3">{l.meal === 'extra' ? 'Extra' : MEAL_LABEL[l.meal]}</div>
                    <div className="min-w-0 flex-1 truncate text-[14px] text-ink-2">{l.label}</div>
                    <div className="num text-[13px] text-ink-3">{l.kcal} kcal</div>
                    <IconButton label="Delete entry" onClick={() => removeLog(l.id)} className="size-8">
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </Card>
        </section>
      )}
    </div>
  )
}
