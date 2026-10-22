import { ArrowLeftRight, Check, ChevronDown, Lightbulb, Plus, RefreshCw, Sparkles, Undo2, Wand2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { currentMeal, fmtTime, mealOver, todayISO } from '../lib/date'
import { mealTotals, swapOptions } from '../lib/foods'
import { addFromCounter, skipMeal, swapPick, topUpAfter, unskipMeal } from '../lib/planEdit'
import { useStore, useTargets } from '../lib/store'
import { MEAL_LABEL, MEALS, type DayPlan, type MealKey, type MealPlan, type PlanItem } from '../lib/types'
import { useDayPlan } from '../lib/usePlan'
import { LogFoodSheet } from './LogFoodSheet'
import { EASE } from './motion'
import { toast } from './Toast'
import { Button, cx, Pill, Spinner } from './ui'

export function PlanBoard({ date, onUploadClick }: { date: string; onUploadClick?: () => void }) {
  const { dayMenu, plan, loading, error, generate, canAI } = useDayPlan(date)
  const removePlan = useStore((s) => s.removePlan)
  const savePlan = useStore((s) => s.savePlan)
  const isToday = date === todayISO()
  const now = currentMeal(dayMenu?.month.timings)
  const [open, setOpen] = useState<MealKey | null>(isToday ? now : 'breakfast')
  const [logFor, setLogFor] = useState<MealKey | 'extra' | null>(null)
  const profile = useStore((s) => s.profile)
  const logs = useStore((s) => s.logs)
  const t = useTargets()

  if (!dayMenu || !plan) {
    return (
      <div className="card flex flex-col items-start gap-4 p-7">
        <div className="eyebrow">No menu for this day</div>
        <p className="max-w-md text-[15px] leading-relaxed text-ink-2">
          Upload this month's mess menu (the Excel sheet the hostel shares) and Leanplate will plan every meal for you — what to take, how much, and what to
          leave on the counter.
        </p>
        <div className="flex flex-wrap gap-2">
          {onUploadClick && (
            <Button variant="primary" onClick={onUploadClick}>
              Upload mess menu
            </Button>
          )}
          <Button onClick={() => setLogFor('extra')}>
            <Plus size={15} /> Log food manually
          </Button>
        </div>
        <LogFoodSheet open={!!logFor} onClose={() => setLogFor(null)} date={date} meal={logFor ?? undefined} />
      </div>
    )
  }

  const key = `${date}|${dayMenu.sheet}`
  const diet = profile?.diet ?? 'veg'
  const loggedMeals = new Set(logs.filter((l) => l.date === date).map((l) => l.meal as MealKey))
  const current = plan

  /** Save a change to the plate, with an undo that restores exactly what was there. */
  function change(next: DayPlan, message: string) {
    const wasSaved = !!useStore.getState().plans[key]
    savePlan(next)
    toast(message, { label: 'Undo', run: () => (wasSaved ? savePlan(current) : removePlan(key)) })
  }

  const actions: MealActions = {
    swapOptions: (meal, i) =>
      swapOptions(current.meals[meal].picks[i], dayMenu.menu[meal] ?? [], diet, current.meals[meal].picks.map((p) => p.item)),
    swap: (meal, i, item) => change(swapPick(current, meal, i, item), `Swapped in ${item.item}`),
    topUp: (meal) => (t ? topUpAfter(current, meal, dayMenu.menu, diet, t.kcal, loggedMeals) : null),
    skip: (meal, withTopUp) => {
      const top = withTopUp && t ? topUpAfter(current, meal, dayMenu.menu, diet, t.kcal, loggedMeals) : null
      change(skipMeal(current, meal, top), top ? `${MEAL_LABEL[meal]} skipped · ${top.item.item} added to ${MEAL_LABEL[top.meal].toLowerCase()}` : `${MEAL_LABEL[meal]} skipped`)
    },
    unskip: (meal) => change(unskipMeal(current, meal), `${MEAL_LABEL[meal]} is back on the plan`),
    skippedCount: () => MEALS.filter((m) => current.meals[m].skipped).length,
    add: (meal, i) => change(addFromCounter(current, meal, i), `${current.meals[meal].skip[i].item} added to your plate`),
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="display text-[30px]">The plate</h2>
          {plan.source === 'ai' ? (
            <Pill tone="accent">
              <Sparkles size={12} /> Gemini
            </Pill>
          ) : (
            <Pill>Offline engine</Pill>
          )}
          {plan.edited && (
            <Pill tone="gold">
              <Wand2 size={12} /> Adjusted
            </Pill>
          )}
          <span className="hidden text-[12px] text-ink-3 sm:inline">{dayMenu.sheet}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {canAI && (
            <Button size="sm" variant="ghost" onClick={generate} disabled={loading}>
              {loading ? <Spinner size={14} /> : plan.source === 'ai' ? <RefreshCw size={14} /> : <Sparkles size={14} />}
              {loading ? 'Planning…' : plan.source === 'ai' ? 'Re-plan' : 'Plan with Gemini'}
            </Button>
          )}
          <Button size="sm" onClick={() => setLogFor('extra')}>
            <Plus size={14} /> Log food
          </Button>
        </div>
      </div>

      {plan.edited ? (
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-gold/30 bg-[color-mix(in_oklab,var(--gold)_8%,transparent)] px-4 py-3 text-[14px]">
          <span className="min-w-0 flex-1 text-ink-2">
            <span className="font-medium text-ink">Changed today:</span> {plan.edited.note}
          </span>
          <button
            onClick={() => (plan.edited?.original && plan.edited.original.source !== 'smart' ? savePlan(plan.edited.original) : removePlan(key))}
            className="flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-ink-3 transition hover:text-ink"
          >
            <Undo2 size={13} /> Back to original plan
          </button>
        </div>
      ) : (
        plan.summary && <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-ink-2">{plan.summary}</p>
      )}
      {error && (
        <p className="mb-4 rounded-xl bg-skip-soft px-4 py-3 text-[13px] text-skip">
          {error} {plan.source === 'smart' && 'Showing the offline plan.'}
        </p>
      )}
      {loading && plan.source === 'smart' && (
        <p className="mb-4 flex items-center gap-2 text-[13px] text-ink-3">
          <Spinner size={13} /> Gemini is reading today's menu — offline plan shown meanwhile.
        </p>
      )}

      <div className="space-y-3">
        {MEALS.map((m) => (
          <MealCard
            key={m}
            meal={m}
            plan={plan.meals[m]}
            date={date}
            isNow={isToday && m === now}
            open={open === m}
            onToggle={() => setOpen(open === m ? null : m)}
            onLogOther={() => setLogFor(m)}
            time={dayMenu.month.timings?.[m]}
            raw={dayMenu.menu[m]}
            actions={actions}
            over={isToday && mealOver(m, dayMenu.month.timings)}
          />
        ))}
      </div>
      <LogFoodSheet open={!!logFor} onClose={() => setLogFor(null)} date={date} meal={logFor ?? undefined} />
    </section>
  )
}

interface MealActions {
  swapOptions: (meal: MealKey, index: number) => ReturnType<typeof swapOptions>
  swap: (meal: MealKey, index: number, item: PlanItem) => void
  topUp: (meal: MealKey) => { meal: MealKey; item: PlanItem } | null
  skip: (meal: MealKey, withTopUp: boolean) => void
  unskip: (meal: MealKey) => void
  add: (meal: MealKey, skipIndex: number) => void
  skippedCount: () => number
}

function MealCard({
  meal,
  plan,
  date,
  isNow,
  open,
  onToggle,
  onLogOther,
  time,
  raw,
  actions,
  over,
}: {
  meal: MealKey
  plan: MealPlan
  date: string
  isNow: boolean
  open: boolean
  onToggle: () => void
  onLogOther: () => void
  time?: { start: number; end: number }
  raw: string[]
  actions: MealActions
  /** today's serving window has closed */
  over: boolean
}) {
  const logs = useStore((s) => s.logs)
  const addLog = useStore((s) => s.addLog)
  const removeLog = useStore((s) => s.removeLog)
  const [off, setOff] = useState<Set<number>>(new Set())
  const [showSkip, setShowSkip] = useState(false)
  const [swapping, setSwapping] = useState<number | null>(null)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const topUp = confirmSkip ? actions.topUp(meal) : null
  const skippedToday = actions.skippedCount()
  const totals = mealTotals(plan)
  const logged = useMemo(() => logs.filter((l) => l.date === date && l.meal === meal), [logs, date, meal])
  const loggedKcal = logged.reduce((s, l) => s + l.kcal, 0)
  const empty = !raw.length

  const chosen = plan.picks.filter((_, i) => !off.has(i))
  const chosenK = chosen.reduce((s, p) => s + p.kcal, 0)
  const chosenP = chosen.reduce((s, p) => s + p.protein, 0)

  function logPlate() {
    const id = addLog({
      date,
      meal,
      label: chosen.map((p) => `${p.item} (${p.portion})`).join(', ') || `${MEAL_LABEL[meal]} plate`,
      kcal: chosenK,
      protein: chosenP,
    })
    toast(`${MEAL_LABEL[meal]} logged · ${chosenK} kcal`, { label: 'Undo', run: () => removeLog(id) })
  }

  return (
    <article className={cx('card overflow-hidden transition-shadow duration-300', isNow && !plan.skipped && 'ring-1 ring-accent-text/40', !open && 'card-hover', plan.skipped && 'opacity-70')}>
      <button onClick={onToggle} className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-semibold tracking-tight">{MEAL_LABEL[meal]}</h3>
            {plan.skipped && <Pill tone="skip">Skipped today</Pill>}
            {isNow && !plan.skipped && <Pill tone="accent">Up next</Pill>}
            {logged.length > 0 && (
              <Pill tone="neutral">
                <Check size={11} /> Logged
              </Pill>
            )}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-ink-3">
            {time && `${fmtTime(time.start)} – ${fmtTime(time.end)} · `}
            {empty ? 'Nothing listed' : plan.skipped ? 'Not eating this one today' : `${plan.picks.length} to take · ${plan.skip.length} to skip`}
          </div>
        </div>
        <div className="text-right">
          <div className="num text-[17px] font-medium">{logged.length ? loggedKcal : totals.kcal}</div>
          <div className="text-[11px] text-ink-3">{logged.length ? 'kcal eaten' : 'kcal planned'}</div>
        </div>
        <ChevronDown size={18} className={cx('shrink-0 text-ink-3 transition-transform duration-300', open && 'rotate-180')} />
      </button>

      <AnimatePresence initial={false}>
      {open && !empty && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { duration: 0.42, ease: EASE }, opacity: { duration: 0.25 } }}
          className="overflow-hidden"
        >
        <div className="border-t border-line px-5 pt-4 pb-5 sm:px-6">
          <ul className="divide-y divide-line">
            {plan.picks.map((p, i) => {
              const disabled = off.has(i)
              return (
                <motion.li
                  key={`${i}-${p.item}`}
                  className="py-2.5"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.035, duration: 0.35, ease: EASE }}
                >
                  <div className="flex items-start gap-3">
                  <button
                    aria-label={disabled ? `Include ${p.item}` : `Exclude ${p.item}`}
                    onClick={() => {
                      const n = new Set(off)
                      if (n.has(i)) n.delete(i)
                      else n.add(i)
                      setOff(n)
                    }}
                    disabled={logged.length > 0}
                    className={cx(
                      'mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-md border transition',
                      disabled ? 'border-line-strong bg-transparent' : 'border-accent-text bg-accent-text text-accent-ink',
                    )}
                  >
                    <AnimatePresence initial={false}>
                      {!disabled && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 24 }}>
                          <Check size={12} strokeWidth={3} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                  <div className={cx('min-w-0 flex-1', disabled && 'opacity-45')}>
                    <div className="text-[15px] leading-snug">
                      {p.item}
                      <span className="ml-2 text-[13px] font-medium text-accent-text">{p.portion}</span>
                    </div>
                    {p.note && <div className="mt-0.5 text-[12.5px] text-ink-3">{p.note}</div>}
                  </div>
                  <div className={cx('num pt-0.5 text-right text-[13px] text-ink-3', disabled && 'opacity-45')}>
                    {p.kcal}
                    <span className="ml-2 hidden text-ink-3/70 sm:inline">{p.protein}g</span>
                  </div>
                  {!logged.length && (
                    <button
                      aria-label={`Swap ${p.item}`}
                      aria-expanded={swapping === i}
                      onClick={() => setSwapping(swapping === i ? null : i)}
                      className={cx(
                        '-my-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-full transition',
                        swapping === i ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
                      )}
                    >
                      <ArrowLeftRight size={14} />
                    </button>
                  )}
                  </div>
                  <AnimatePresence initial={false}>
                    {swapping === i && (
                      <SwapList
                        item={p}
                        options={actions.swapOptions(meal, i)}
                        onPick={(o) => {
                          actions.swap(meal, i, o)
                          setSwapping(null)
                        }}
                      />
                    )}
                  </AnimatePresence>
                </motion.li>
              )
            })}
          </ul>

          {plan.skip.length > 0 && (
            <div className="mt-3">
              <button onClick={() => setShowSkip(!showSkip)} className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-skip">
                Leave on the counter ({plan.skip.length})
                <ChevronDown size={14} className={cx('transition', showSkip && 'rotate-180')} />
              </button>
              {showSkip ? (
                <ul className="mt-2 space-y-1">
                  {plan.skip.map((s, i) => (
                    <li key={`${i}-${s.item}`} className="flex items-start gap-3 text-[13.5px]">
                      <span className="min-w-0 flex-1 py-1">
                        <span className="text-ink-2 line-through decoration-skip/50">{s.item}</span>
                        <span className="text-ink-3"> — {s.reason}</span>
                      </span>
                      {!logged.length && !plan.skipped && (
                        <button
                          onClick={() => actions.add(meal, i)}
                          aria-label={`Add ${s.item} to my plate`}
                          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 transition hover:border-line-strong hover:text-ink"
                        >
                          <Plus size={12} /> Add
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 line-clamp-1 text-[13px] text-ink-3">{plan.skip.map((s) => s.item).join(' · ')}</p>
              )}
            </div>
          )}

          {plan.tip && (
            <div className="mt-4 flex gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-[13.5px] leading-relaxed text-ink-2">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-gold" />
              {plan.tip}
            </div>
          )}

          {plan.skipped ? (
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => actions.unskip(meal)}>
                <Undo2 size={14} /> Eating it after all
              </Button>
            </div>
          ) : confirmSkip ? (
            <div className="mt-4 rounded-xl border border-line px-4 py-3">
              <p className="text-[14px] text-ink-2">
                {over ? `Missed ${MEAL_LABEL[meal].toLowerCase()}?` : `Skip ${MEAL_LABEL[meal].toLowerCase()} today?`}{' '}
                {skippedToday >= 2 && (
                  <span className="mb-2 block text-ink">
                    That would be your third skipped meal today. Going this low often turns into big hunger later; a small plate usually works better.{' '}
                  </span>
                )}
                {topUp ? (
                  <>
                    You can add <span className="font-medium text-ink">{topUp.item.item}</span> ({topUp.item.portion}, {topUp.item.protein} g protein) to{' '}
                    {MEAL_LABEL[topUp.meal].toLowerCase()} so your protein stays on track.
                  </>
                ) : (
                  'Make protein the first thing on your next plate.'
                )}
              </p>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmSkip(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant={topUp ? 'secondary' : 'primary'} onClick={() => (setConfirmSkip(false), actions.skip(meal, false))}>
                  Just skip
                </Button>
                {topUp && (
                  <Button size="sm" variant="primary" onClick={() => (setConfirmSkip(false), actions.skip(meal, true))}>
                    Skip + extra protein
                  </Button>
                )}
              </div>
            </div>
          ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="num text-[13px] text-ink-3">
              {chosenK} kcal · {chosenP} g protein
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {logged.length ? (
                <Button size="sm" variant="ghost" onClick={() => logged.forEach((l) => removeLog(l.id))}>
                  <Undo2 size={14} /> Undo log
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmSkip(true)}>
                    {over ? 'I missed it' : 'Skip meal'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onLogOther}>
                    Ate something else
                  </Button>
                  <Button size="sm" variant="primary" onClick={logPlate} disabled={!chosen.length}>
                    <Check size={14} /> Ate this
                  </Button>
                </>
              )}
            </div>
          </div>
          )}
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </article>
  )
}

function SwapList({ item, options, onPick }: { item: PlanItem; options: ReturnType<typeof swapOptions>; onPick: (p: PlanItem) => void }) {
  const [showOthers, setShowOthers] = useState(false)
  const good = options.filter((o) => o.ok)
  const others = options.filter((o) => !o.ok)
  const row = (o: (typeof options)[number]) => (
    <li key={o.pick.item}>
      <button
        onClick={() => onPick(o.pick)}
        className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-surface"
      >
        <span className="min-w-0 flex-1 text-[14px] leading-snug">
          {o.pick.item}
          <span className="ml-2 text-[12.5px] font-medium text-accent-text">{o.pick.portion}</span>
          <span className={cx('mt-0.5 block text-[12px]', o.ok ? 'text-ink-3' : 'text-skip')}>{o.why}</span>
        </span>
        <span className="num pt-0.5 text-[12.5px] text-ink-3">{o.pick.kcal}</span>
      </button>
    </li>
  )
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="overflow-hidden"
    >
      <div className="mt-2 ml-8 rounded-xl bg-surface-2 p-1.5">
        <div className="px-2.5 pt-1.5 pb-1 text-[12px] text-ink-3">Instead of {item.item}, from today's menu</div>
        {good.length ? (
          <ul>{good.map(row)}</ul>
        ) : (
          <p className="px-2.5 py-2 text-[13px] text-ink-2">Nothing on today's menu is a like-for-like swap for this.</p>
        )}
        {others.length > 0 && (
          <div className="px-2.5 pt-1 pb-1.5">
            <button onClick={() => setShowOthers(!showOthers)} className="flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-ink-3 hover:text-ink">
              Not great swaps ({others.length})
              <ChevronDown size={13} className={cx('transition', showOthers && 'rotate-180')} />
            </button>
          </div>
        )}
        {showOthers && <ul>{others.map(row)}</ul>}
      </div>
    </motion.div>
  )
}
