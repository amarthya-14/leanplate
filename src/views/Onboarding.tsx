import { ArrowLeft, ArrowRight, Check, Lock, Minus, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CountUp, EASE, SplitWords } from '../components/motion'
import { Button, Choice, cx, Label, Segmented } from '../components/ui'
import { addDays, fromISO, todayISO } from '../lib/date'
import { ACTIVITY, bmi, bmiBand, PACE, targets } from '../lib/nutrition'
import { useStore } from '../lib/store'
import type { Activity, Diet, Pace, Profile, Sex } from '../lib/types'

export function Onboarding() {
  const [started, setStarted] = useState(false)
  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg">
      <div className="ambient" />
      <AnimatePresence mode="wait">
        {started ? (
          <motion.div key="steps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="relative z-10">
            <Steps onExit={() => setStarted(false)} />
          </motion.div>
        ) : (
          <motion.div key="welcome" exit={{ opacity: 0, y: -16, filter: 'blur(6px)' }} transition={{ duration: 0.45, ease: EASE }} className="relative z-10">
            <Welcome onStart={() => setStarted(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Welcome ──────────────────────────────────────────────────────────

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      <motion.header
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <Wordmark />
        <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
          <Lock size={12} /> Private · no sign-up
        </span>
      </motion.header>

      <main className="grid flex-1 items-center gap-10 py-8 md:grid-cols-[1.05fr_1fr] md:gap-6 md:py-0">
        <div className="order-2 md:order-1">
          <motion.div
            className="eyebrow mb-5 flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <span className="h-px w-6 bg-ink-3" /> For people who eat at the hostel mess
          </motion.div>
          <h1 className="display text-[52px] leading-[0.98] sm:text-[72px] lg:text-[84px]">
            <span className="block">
              <SplitWords text="Eat from the mess." delay={0.25} />
            </span>
            <span className="text-balance block text-accent-text italic">
              <SplitWords text="Still lose the weight." delay={0.55} />
            </span>
          </h1>
          <motion.p
            className="text-pretty mt-6 max-w-md text-[16.5px] leading-relaxed text-ink-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.8, ease: EASE }}
          >
            Upload this month's mess menu. Every meal, Leanplate tells you what to take, exactly how much, and what to leave on the counter — and helps you
            break the sugar habit for good.
          </motion.p>

          <motion.ol
            className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-5"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 1.2 } } }}
          >
            {[
              ['Reads your', 'mess menu'],
              ['Portions every', 'single meal'],
              ['Talks you down', 'from cravings'],
            ].map(([a, b], i) => (
              <motion.li
                key={i}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}
                className="text-[13px] leading-snug text-ink-2"
              >
                <div className="num mb-1.5 text-[11px] font-medium text-ink-3">0{i + 1}</div>
                {a}
                <br />
                {b}
              </motion.li>
            ))}
          </motion.ol>

          <motion.div
            className="mt-10 flex flex-wrap items-center gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.7, ease: EASE }}
          >
            <Button variant="primary" size="lg" className="shine h-14 px-8 text-[15.5px]" onClick={onStart}>
              Build my plan <ArrowRight size={17} />
            </Button>
            <span className="text-[13px] text-ink-3">Takes about a minute</span>
          </motion.div>
        </div>

        <div className="order-1 flex justify-center md:order-2">
          <PlateHero />
        </div>
      </main>
    </div>
  )
}

const SEGMENTS = [
  { from: 0, to: 0.5, color: 'var(--accent-text)', label: 'Salad & sabzi', share: '½' },
  { from: 0.5, to: 0.75, color: 'var(--gold)', label: 'Protein', share: '¼' },
  { from: 0.75, to: 1, color: 'var(--ink-3)', label: 'Carbs', share: '¼' },
]

function PlateHero() {
  const size = 340
  const c = size / 2
  return (
    <div className="relative aspect-square w-[min(78vw,400px)]">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full overflow-visible">
        <motion.circle
          cx={c}
          cy={c}
          r={160}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth={1}
          strokeDasharray="2 6"
          initial={{ opacity: 0, rotate: -30 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ duration: 2.4, ease: EASE }}
          style={{ transformOrigin: 'center' }}
        />
        <motion.circle
          cx={c}
          cy={c}
          r={138}
          fill="var(--surface)"
          stroke="var(--line)"
          initial={{ scale: 0.86, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.1 }}
          style={{ transformOrigin: 'center', filter: 'drop-shadow(0 30px 40px rgb(26 25 21 / 0.10))' }}
        />
        <circle cx={c} cy={c} r={104} fill="none" stroke="var(--line)" />
        {SEGMENTS.map((s, i) => (
          <motion.circle
            key={s.label}
            cx={c}
            cy={c}
            r={121}
            fill="none"
            stroke={s.color}
            strokeWidth={22}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: s.to - s.from - 0.035 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.7 + i * 0.35 }}
            style={{ rotate: s.from * 360 - 90 + 6, transformOrigin: 'center' }}
          />
        ))}
        <motion.text
          x={c}
          y={c - 6}
          textAnchor="middle"
          className="display"
          fontSize="44"
          fill="var(--ink)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
        >
          your plate
        </motion.text>
        <motion.text
          x={c}
          y={c + 22}
          textAnchor="middle"
          fontSize="11"
          letterSpacing="2.2"
          fill="var(--ink-3)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.8 }}
        >
          FROM TODAY'S MENU
        </motion.text>
      </svg>

      <FloatCard className="top-[6%] -left-[4%] sm:-left-[10%]" delay={2.1} float={7}>
        <div className="text-[11px] text-ink-3">Lunch · take</div>
        <div className="text-[14px] font-medium">
          Pulka <span className="text-accent-text">3 pcs</span>
        </div>
      </FloatCard>
      <FloatCard className="top-[44%] -right-[2%] sm:-right-[8%]" delay={2.35} float={9}>
        <div className="text-[11px] text-ink-3">Protein today</div>
        <div className="num text-[14px] font-medium">
          104 <span className="text-ink-3">/ 120 g</span>
        </div>
      </FloatCard>
      <FloatCard className="bottom-[4%] left-[6%]" delay={2.6} float={6}>
        <div className="text-[11px] text-skip">Leave on the counter</div>
        <div className="text-[14px] font-medium text-ink-2 line-through decoration-skip/50">Gulab jamun</div>
      </FloatCard>
    </div>
  )
}

function FloatCard({ children, className, delay, float }: { children: ReactNode; className: string; delay: number; float: number }) {
  return (
    <motion.div
      className={cx('absolute rounded-2xl border border-line bg-surface/90 px-3.5 py-2.5 shadow-[0_16px_40px_-18px_rgb(26_25_21/0.35)] backdrop-blur', className)}
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: [0, -float, 0], scale: 1 }}
      transition={{
        opacity: { delay, duration: 0.6 },
        scale: { delay, duration: 0.6, ease: EASE },
        y: { delay, duration: 5 + float / 3, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      {children}
    </motion.div>
  )
}

// ── Steps ────────────────────────────────────────────────────────────

const STEP_COUNT = 5

function Steps({ onExit }: { onExit: () => void }) {
  const setProfile = useStore((s) => s.setProfile)
  const updateSettings = useStore((s) => s.updateSettings)
  const apiKey = useStore((s) => s.settings.apiKey)
  const [[step, dir], setStep] = useState<[number, number]>([0, 1])
  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState(20)
  const [height, setHeight] = useState(172)
  const [weight, setWeight] = useState(85)
  const [goal, setGoal] = useState(72)
  const [goalTouched, setGoalTouched] = useState(false)
  const [activity, setActivity] = useState<Activity>('light')
  const [diet, setDiet] = useState<Diet>('nonveg')
  const [pace, setPace] = useState<Pace>('steady')
  const [key, setKey] = useState(apiKey)

  const healthy = Math.round(22.9 * (height / 100) ** 2)
  useEffect(() => {
    if (!goalTouched) setGoal(Math.max(healthy, Math.round(weight * 0.82)))
  }, [weight, height, goalTouched, healthy])

  const profile: Profile = { name: name.trim(), sex, age, heightCm: height, startKg: weight, goalKg: goal, activity, diet, pace, startDate: todayISO(), notes: '' }
  const valid = [true, age >= 14 && height > 120, goal < weight && goal > 35, true, true, true][step]

  const go = (d: number) => {
    if (d > 0 && !valid) return
    if (step === 0 && d < 0) return onExit()
    setStep([step + d, d])
  }

  function finish() {
    if (key) updateSettings({ apiKey: key })
    setProfile(profile)
  }

  const isReveal = step === STEP_COUNT

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-8 sm:pt-10">
      <div className="mb-10 flex items-center gap-4">
        <button onClick={() => go(-1)} aria-label="Back" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 transition hover:bg-surface-2">
          <ArrowLeft size={18} />
        </button>
        <div className="flex flex-1 gap-1.5">
          {Array.from({ length: STEP_COUNT + 1 }, (_, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
              <motion.div className="h-full rounded-full bg-accent-text" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: 0.6, ease: EASE }} />
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex-1">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 36, filter: 'blur(4px)' }),
              center: { opacity: 1, x: 0, filter: 'blur(0px)' },
              exit: (d: number) => ({ opacity: 0, x: d * -24, filter: 'blur(4px)' }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.42, ease: EASE }}
          >
            {step === 0 && (
              <>
                <Eyebrow>01 — Hello</Eyebrow>
                <H>What should we call you?</H>
                <input
                  className="display mt-10 w-full border-b border-line-strong bg-transparent pb-3 text-[40px] outline-none placeholder:text-ink-3/50 focus:border-accent-text sm:text-[48px]"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your first name"
                  onKeyDown={(e) => e.key === 'Enter' && go(1)}
                />
                <P>Just for greetings. Nothing leaves your device.</P>
              </>
            )}

            {step === 1 && (
              <>
                <Eyebrow>02 — Body</Eyebrow>
                <H>A few numbers.</H>
                <P>Used only to calculate how much energy your body burns.</P>
                <div className="mt-8 space-y-4">
                  <Segmented className="w-full" value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
                  <div className="grid grid-cols-2 gap-3">
                    <BigNumber label="Age" value={age} onChange={setAge} unit="yrs" min={14} max={80} />
                    <BigNumber label="Height" value={height} onChange={setHeight} unit="cm" min={130} max={220} />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <Eyebrow>03 — Weight</Eyebrow>
                <H>Where you are. Where you're headed.</H>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <BigNumber label="Today" value={weight} onChange={setWeight} unit="kg" step={0.5} min={35} max={250} />
                  <BigNumber
                    label="Goal"
                    value={goal}
                    onChange={(v) => {
                      setGoal(v)
                      setGoalTouched(true)
                    }}
                    unit="kg"
                    step={0.5}
                    min={35}
                    max={weight}
                    accent
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                  <div className="rounded-2xl bg-surface-2 px-4 py-3">
                    <div className="text-ink-3">BMI now</div>
                    <div className="num mt-0.5 font-medium">
                      {bmi(weight, height).toFixed(1)} <span className="font-normal text-ink-3">· {bmiBand(bmi(weight, height))}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-accent-soft px-4 py-3">
                    <div className="text-accent-text/80">At goal</div>
                    <div className="num mt-0.5 font-medium text-accent-text">
                      {bmi(goal, height).toFixed(1)} <span className="font-normal opacity-80">· {bmiBand(bmi(goal, height))}</span>
                    </div>
                  </div>
                </div>
                <P>
                  Healthy for your height is around <strong className="font-medium text-ink">{healthy} kg</strong>. If that feels far, set a nearer milestone — you can
                  change it any time.
                </P>
              </>
            )}

            {step === 3 && (
              <>
                <Eyebrow>04 — Movement</Eyebrow>
                <H>How active is a normal week?</H>
                <P>Be honest — overestimating is the #1 reason plans stall.</P>
                <div className="mt-7 space-y-2">
                  {(Object.keys(ACTIVITY) as Activity[]).map((a, i) => (
                    <motion.div key={a} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05, duration: 0.4, ease: EASE }}>
                      <Choice selected={activity === a} onClick={() => setActivity(a)} title={ACTIVITY[a].label} hint={ACTIVITY[a].hint} />
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <Eyebrow>05 — Preferences</Eyebrow>
                <H>What you eat, and how fast.</H>
                <div className="mt-8 space-y-7">
                  <div>
                    <Label>Diet</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ['veg', 'Veg', 'No egg or meat'],
                          ['egg', 'Egg', 'Eggs, no meat'],
                          ['nonveg', 'Non-veg', 'Everything'],
                        ] as [Diet, string, string][]
                      ).map(([v, t, h]) => (
                        <Choice key={v} selected={diet === v} onClick={() => setDiet(v)} title={t} hint={h} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Pace</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(PACE) as Pace[]).map((p) => (
                        <Choice key={p} selected={pace === p} onClick={() => setPace(p)} title={PACE[p].label} hint={`${PACE[p].kgPerWeek} kg / week`} />
                      ))}
                    </div>
                    <p className="mt-2 text-[12.5px] text-ink-3">{PACE[pace].hint}. Steady is sustainable on a mess diet without feeling starved.</p>
                  </div>
                </div>
              </>
            )}

            {isReveal && <Reveal profile={profile} keyValue={key} setKey={setKey} onFinish={finish} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {!isReveal && (
        <motion.div className="mt-10 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Button variant="primary" size="lg" className="h-13 min-w-40" onClick={() => go(1)} disabled={!valid}>
            {step === STEP_COUNT - 1 ? 'Build my plan' : 'Continue'} <ArrowRight size={16} />
          </Button>
        </motion.div>
      )}
    </div>
  )
}

function Reveal({ profile, keyValue, setKey, onFinish }: { profile: Profile; keyValue: string; setKey: (k: string) => void; onFinish: () => void }) {
  const t = targets(profile, profile.startKg)
  const weeks = Math.max(1, Math.round((profile.startKg - profile.goalKg) / PACE[profile.pace].kgPerWeek))
  const goalDate = fromISO(addDays(todayISO(), weeks * 7)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const lines = [
    'Reading your body stats',
    `Maintenance: ${t.tdee.toLocaleString('en-IN')} kcal a day`,
    `Safe deficit of ${t.deficit} kcal`,
    'Tuning protein for a mess diet',
  ]
  const [done, setDone] = useState(0)
  const timer = useRef<number>(0)
  useEffect(() => {
    timer.current = window.setInterval(() => setDone((d) => d + 1), 520)
    return () => clearInterval(timer.current)
  }, [])
  useEffect(() => {
    if (done > lines.length) clearInterval(timer.current)
  }, [done, lines.length])
  const revealed = done > lines.length

  return (
    <AnimatePresence mode="wait">
      {!revealed ? (
        <motion.div key="building" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }} className="pt-6">
          <Eyebrow>Building your plan</Eyebrow>
          <ul className="mt-8 space-y-5">
            {lines.map((l, i) => (
              <motion.li
                key={l}
                className="flex items-center gap-4 text-[17px]"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: i <= done ? 1 : 0.25, x: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: i * 0.05 }}
              >
                <span className={cx('grid size-7 place-items-center rounded-full border transition-colors duration-300', i < done ? 'border-accent-text bg-accent-text text-accent-ink' : 'border-line-strong')}>
                  {i < done ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                      <Check size={14} strokeWidth={3} />
                    </motion.span>
                  ) : i === done ? (
                    <span className="size-2 animate-pulse rounded-full bg-accent-text" />
                  ) : null}
                </span>
                <span className={i <= done ? 'text-ink' : 'text-ink-3'}>{l}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      ) : (
        <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <Eyebrow>{profile.name ? `${profile.name}, here's the plan` : "Here's the plan"}</Eyebrow>
          <h1 className="display text-[44px] leading-[1.02] sm:text-[52px]">
            <SplitWords text={`${profile.goalKg} kg by ${goalDate}.`} />
          </h1>
          <motion.p className="mt-4 text-[15.5px] leading-relaxed text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            {(profile.startKg - profile.goalKg).toFixed(1)} kg in about {weeks} weeks — no crash diet, just the right plate from the mess, every meal.
          </motion.p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { label: 'Calories a day', value: t.kcal, suffix: '', hint: `you burn ≈ ${t.tdee.toLocaleString('en-IN')}` },
              { label: 'Protein', value: t.protein, suffix: ' g', hint: 'keeps you full' },
              { label: 'Water', value: t.waterGlasses, suffix: ' glasses', hint: 'cuts false hunger' },
              { label: 'Added sugar', value: t.sugarG, suffix: ' g max', hint: '≈ 6 teaspoons' },
            ].map((c, i) => (
              <motion.div
                key={c.label}
                className="card p-5"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.35 + i * 0.09, duration: 0.6, ease: EASE }}
              >
                <div className="eyebrow mb-2">{c.label}</div>
                <div className="display num text-[36px]">
                  <CountUp value={c.value} duration={1.3} />
                  <span className="font-sans text-[13px] text-ink-3">{c.suffix}</span>
                </div>
                <div className="mt-1 text-[12px] text-ink-3">{c.hint}</div>
              </motion.div>
            ))}
          </div>

          <motion.div className="mt-8" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6, ease: EASE }}>
            <Label
              hint={
                <a className="underline underline-offset-2 hover:text-ink" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                  Get one free ↗
                </a>
              }
            >
              Gemini API key <span className="font-normal text-ink-3">· optional</span>
            </Label>
            <input className="field font-mono text-[13px]" type="password" value={keyValue} onChange={(e) => setKey(e.target.value.trim())} placeholder="AIza… — or add it later in Settings" autoComplete="off" />
            <p className="mt-2 text-[12.5px] text-ink-3">Adds the AI coach and smarter plates. Without it, the built-in engine still plans every meal.</p>
          </motion.div>

          <motion.div className="mt-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
            <Button variant="primary" size="lg" className="shine h-14 w-full text-[15.5px]" onClick={onFinish}>
              Enter Leanplate <ArrowRight size={17} />
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function BigNumber({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min = 0,
  max = 999,
  accent,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  unit: string
  step?: number
  min?: number
  max?: number
  accent?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const hold = useRef<number>(0)
  const latest = useRef(value)
  latest.current = value
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  const bump = (d: number) => onChange(clamp(latest.current + d * step))
  const start = (d: number) => {
    bump(d)
    let delay = 380
    const tick = () => {
      bump(d)
      delay = Math.max(50, delay * 0.8)
      hold.current = window.setTimeout(tick, delay)
    }
    hold.current = window.setTimeout(tick, delay)
  }
  const stop = () => clearTimeout(hold.current)

  return (
    <div className={cx('rounded-3xl border p-4 transition-colors', accent ? 'border-accent-text/30 bg-accent-soft/60' : 'border-line bg-surface')}>
      <div className="eyebrow mb-1">{label}</div>
      <div className="flex items-baseline justify-center gap-1 py-2">
        <input
          inputMode="decimal"
          aria-label={label}
          className={cx('display num w-[3.2ch] bg-transparent text-center text-[52px] outline-none', accent && 'text-accent-text')}
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ''))}
          onBlur={() => {
            if (draft !== null && draft !== '' && !isNaN(+draft)) onChange(clamp(+draft))
            setDraft(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'ArrowUp') bump(1)
            if (e.key === 'ArrowDown') bump(-1)
          }}
        />
        <span className="text-[13px] text-ink-3">{unit}</span>
      </div>
      <div className="flex justify-between">
        {[-1, 1].map((d) => (
          <button
            key={d}
            aria-label={d < 0 ? `Decrease ${label}` : `Increase ${label}`}
            onPointerDown={() => start(d)}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            onContextMenu={(e) => e.preventDefault()}
            className="grid size-10 cursor-pointer touch-none place-items-center rounded-full border border-line-strong bg-surface text-ink-2 transition select-none hover:text-ink active:scale-90"
          >
            {d < 0 ? <Minus size={16} /> : <Plus size={16} />}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" />
        <path d="M32 6a26 26 0 0 1 26 26H32z" fill="var(--gold)" />
      </svg>
      <span className="display text-[25px]">Leanplate</span>
    </div>
  )
}

const Eyebrow = ({ children }: { children: ReactNode }) => <div className="eyebrow mb-4">{children}</div>
const H = ({ children }: { children: ReactNode }) => <h1 className="display text-balance text-[42px] leading-[1.02] sm:text-[52px]">{children}</h1>
const P = ({ children }: { children: ReactNode }) => <p className="text-pretty mt-4 text-[15.5px] leading-relaxed text-ink-2">{children}</p>
