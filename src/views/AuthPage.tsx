import { ArrowRight, Check, Eye, EyeOff, Flame, Lock, MailCheck } from 'lucide-react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { GoogleButton } from '../components/GoogleButton'
import { CountUp, EASE, SplitWords } from '../components/motion'
import { cx, Spinner } from '../components/ui'
import { googleEnabled } from '../lib/supabase'
import { resetPassword, setLocalMode, signIn, signUp } from '../lib/sync'

export function AuthPage({ onLocal }: { onLocal: () => void }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-bg">
      <Backdrop />

      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 pt-6 sm:px-8"
      >
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
            <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" />
            <path d="M32 6a26 26 0 0 1 26 26H32z" fill="var(--gold)" />
          </svg>
          <span className="display text-[25px]">Leanplate</span>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
          <Lock size={12} /> Private · Free
        </span>
      </motion.header>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-5 pt-14 text-center sm:px-8 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-[12.5px] text-ink-2 backdrop-blur"
        >
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent-text/60" />
            <span className="relative size-1.5 rounded-full bg-accent-text" />
          </span>
          Built for hostel mess food
        </motion.div>

        <h1 className="display max-w-4xl text-[54px] leading-[0.96] tracking-[-0.02em] sm:text-[84px] lg:text-[104px]">
          <span className="block">
            <SplitWords text="Every meal," delay={0.2} stagger={0.08} />
          </span>
          <span className="block text-accent-text italic">
            <SplitWords text="already planned." delay={0.42} stagger={0.08} />
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.75 }}
          className="text-pretty mt-7 max-w-xl text-[16.5px] leading-relaxed text-ink-2 sm:text-[18px]"
        >
          Upload your hostel's monthly menu. Leanplate tells you what to take, exactly how much, and what to leave on the counter — and keeps you off sugar.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.9 }} className="mt-10 w-full max-w-[380px]">
          <AuthControls onLocal={onLocal} />
        </motion.div>

        <Showcase />
      </main>

      <footer className="relative z-10 mx-auto max-w-6xl px-5 pt-16 pb-10 text-center text-[12px] text-ink-3 sm:px-8">
        Your data is private to your account and synced across your devices.
      </footer>
    </div>
  )
}

/** Soft light and a faint grid that fades out behind the headline. */
function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-[900px] opacity-[0.55] [mask-image:radial-gradient(ellipse_60%_55%_at_50%_30%,black,transparent)]"
        style={{
          backgroundImage: 'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <motion.div
        className="absolute top-[-280px] left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full blur-[90px]"
        style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--accent-text) 20%, transparent), transparent)' }}
        animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.05, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="absolute top-[520px] right-[-200px] h-[520px] w-[620px] rounded-full blur-[100px]"
        style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--gold) 16%, transparent), transparent)' }}
      />
    </div>
  )
}

// ── Auth controls ───────────────────────────────────────────────────

type Mode = 'signin' | 'signup' | 'reset' | 'confirm' | 'resetSent'

function AuthControls({ onLocal }: { onLocal: () => void }) {
  const [showEmail, setShowEmail] = useState(!googleEnabled)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<'' | 'email' | 'google'>('')
  const [err, setErr] = useState('')
  const [shake, setShake] = useState(0)

  const fail = (e: unknown) => {
    setErr(e instanceof Error ? e.message : String(e))
    setShake((n) => n + 1)
  }
  const goLocal = () => {
    setLocalMode(true)
    onLocal()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail(new Error('Enter a valid email.'))
    if (mode !== 'reset' && password.length < 6) return fail(new Error('Password needs at least 6 characters.'))
    setBusy('email')
    try {
      if (mode === 'signin') await signIn(email.trim(), password)
      else if (mode === 'signup') {
        const r = await signUp(email.trim(), password)
        if (r === 'confirm') setMode('confirm')
      } else if (mode === 'reset') {
        await resetPassword(email.trim())
        setMode('resetSent')
      }
    } catch (e) {
      fail(e)
    } finally {
      setBusy('')
    }
  }

  if (mode === 'confirm' || mode === 'resetSent') {
    return (
      <div className="card p-6 text-left">
        <div className="mb-3 grid size-10 place-items-center rounded-full bg-accent-soft text-accent-text">
          <MailCheck size={18} />
        </div>
        <div className="text-[16px] font-medium">Check your inbox</div>
        <p className="mt-1 text-[14px] text-ink-2">
          {mode === 'confirm' ? 'We sent a confirmation link to ' : 'A reset link is on its way to '}
          <span className="font-medium text-ink">{email}</span>.
        </p>
        <button onClick={() => setMode('signin')} className="mt-4 cursor-pointer text-[13.5px] font-medium text-accent-text hover:underline">
          ← Back to sign in
        </button>
      </div>
    )
  }

  const linkCls = 'cursor-pointer text-ink-2 underline decoration-line-strong underline-offset-4 transition hover:text-ink hover:decoration-ink-3'

  return (
    <div>
      {googleEnabled && (
        <>
          <GoogleButton onError={fail} onBusy={(b) => setBusy(b ? 'google' : '')} />
          {!showEmail && (
            <div className="mt-4 flex items-center justify-center gap-4 text-[13.5px]">
              <button onClick={() => setShowEmail(true)} className={linkCls}>
                Use email
              </button>
              <span className="h-3 w-px bg-line-strong" />
              <button onClick={goLocal} className={linkCls}>
                Try without an account
              </button>
            </div>
          )}
        </>
      )}

      <AnimatePresence initial={false}>
        {showEmail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="-mx-2 overflow-hidden px-2 pb-2"
          >
            <div className={cx('card p-5 text-left', googleEnabled && 'mt-4')}>
              {mode !== 'reset' && (
                <div className="relative grid grid-cols-2 rounded-full bg-surface-2 p-1">
                  {(['signin', 'signup'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMode(m)
                        setErr('')
                      }}
                      className={cx('relative z-10 cursor-pointer rounded-full py-1.5 text-[13px] font-medium transition-colors', mode === m ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
                    >
                      {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 -z-10 rounded-full bg-surface shadow-card" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                      {m === 'signin' ? 'Sign in' : 'Create account'}
                    </button>
                  ))}
                </div>
              )}
              <motion.form onSubmit={submit} className="mt-4 space-y-2.5" animate={shake ? { x: [0, -8, 7, -5, 3, 0] } : {}} key={shake} transition={{ duration: 0.45 }} noValidate>
                <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
                {mode !== 'reset' && (
                  <Field
                    label="Password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={setPassword}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    trailing={
                      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="cursor-pointer p-1 text-ink-3 hover:text-ink">
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                )}
                <button
                  type="submit"
                  disabled={!!busy}
                  className="group flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-[14.5px] font-medium text-accent-ink transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
                >
                  {busy === 'email' ? (
                    <Spinner size={16} />
                  ) : (
                    <>
                      {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </motion.form>
              <div className="mt-3 flex justify-between text-[12.5px] text-ink-3">
                {mode === 'signin' ? (
                  <button onClick={() => setMode('reset')} className="cursor-pointer hover:text-ink">
                    Forgot password?
                  </button>
                ) : (
                  <button onClick={() => setMode('signin')} className="cursor-pointer hover:text-ink">
                    ← Back to sign in
                  </button>
                )}
                {!googleEnabled && (
                  <button onClick={goLocal} className="cursor-pointer hover:text-ink">
                    Try without an account →
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {err && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-[13px] text-skip">
            {err}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  trailing,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  trailing?: ReactNode
}) {
  const id = `f-${label.toLowerCase()}`
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder=" "
        className="peer h-[52px] w-full rounded-2xl border border-line-strong bg-surface px-4 pt-5 pb-1.5 text-[15px] text-ink transition outline-none focus:border-accent-text focus:shadow-[0_0_0_4px_var(--accent-soft)]"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[14.5px] text-ink-3 transition-all duration-200 peer-focus:top-[14px] peer-focus:text-[11px] peer-focus:text-accent-text peer-[:not(:placeholder-shown)]:top-[14px] peer-[:not(:placeholder-shown)]:text-[11px]"
      >
        {label}
      </label>
      {trailing && <div className="absolute top-1/2 right-3 -translate-y-1/2">{trailing}</div>}
    </div>
  )
}

// ── Product showcase: a live miniature of the Today screen ──────────

const PICKS = [
  { item: 'Carrot & cucumber salad', portion: '1 plate', kcal: 35 },
  { item: 'Chicken curry', portion: '1 serving', kcal: 290 },
  { item: 'Dal tadka', portion: '1 katori', kcal: 150 },
  { item: 'Thick curd', portion: '1 katori', kcal: 100 },
  { item: 'Pulka', portion: '2 pcs', kcal: 140 },
]
const SKIPS = ['Gulab jamun', 'Fryums', 'Pickle']
const LAST = PICKS.length + 3 // picks → skips struck → logged → hold

function Showcase() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    // per-phase durations (ms): intro, each pick, strike, logged, hold
    const dur = (i: number) => (i === 0 ? 1900 : i <= PICKS.length ? 430 : i === PICKS.length + 1 ? 1000 : i === PICKS.length + 2 ? 1400 : 3600)
    let i = 0
    let t = window.setTimeout(function tick() {
      i = i >= LAST ? 0 : i + 1
      setPhase(i)
      t = window.setTimeout(tick, dur(i))
    }, dur(0))
    return () => clearTimeout(t)
  }, [])

  const picksShown = Math.min(PICKS.length, phase)
  const skipsStruck = phase >= PICKS.length + 1
  const logged = phase >= PICKS.length + 2
  const eaten = logged ? 1955 : 1240
  const left = 2050 - eaten

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-1, 1], [4, -4]), { stiffness: 110, damping: 20 })
  const ry = useSpring(useTransform(mx, [-1, 1], [-5, 5]), { stiffness: 110, damping: 20 })

  return (
    <div
      className="relative mt-20 w-full max-w-5xl [perspective:1800px] sm:mt-24"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1)
        my.set(((e.clientY - r.top) / r.height) * 2 - 1)
      }}
      onPointerLeave={() => {
        mx.set(0)
        my.set(0)
      }}
    >
      <motion.div initial={{ opacity: 0, y: 70, rotateX: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }} transition={{ duration: 1.5, ease: EASE, delay: 1.0 }}>
        <motion.div
          style={{ rotateX: rx, rotateY: ry }}
          className="relative rounded-[28px] border border-line bg-surface/70 p-2 shadow-[0_50px_120px_-40px_rgb(26_25_21/0.35),0_20px_40px_-30px_rgb(26_25_21/0.25)] backdrop-blur-xl"
        >
          <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-2.5">
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="mx-auto rounded-full bg-surface-2 px-3 py-0.5 text-[11px] text-ink-3">Today · Sunday</span>
            <span className="w-10" />
          </div>

          <div className="grid gap-2 rounded-[22px] bg-bg p-2.5 text-left sm:p-5 md:grid-cols-[1fr_1.35fr] md:gap-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1 md:gap-3">
              <div className="card col-span-2 flex items-center gap-4 p-4 sm:p-5 md:col-span-1">
                <MiniRing value={eaten} max={2050} />
                <div>
                  <div className="eyebrow mb-1">Calories left</div>
                  <div className="display num text-[36px] leading-none">
                    <CountUp value={left} duration={0.9} />
                  </div>
                  <div className="mt-2 text-[12px] text-ink-3">of 2,050 today</div>
                </div>
              </div>
              <div className="card p-4">
                <div className="eyebrow mb-1">Protein</div>
                <div className="num text-[20px] font-medium">
                  <CountUp value={logged ? 96 : 58} duration={0.9} /> <span className="text-[12px] font-normal text-ink-3">/ 120 g</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <motion.div className="h-full rounded-full bg-gold" initial={false} animate={{ width: logged ? '80%' : '48%' }} transition={{ duration: 0.9, ease: EASE }} />
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Sugar-free</span>
                  <Flame size={13} className="text-gold" />
                </div>
                <div className="display num mt-1 text-[28px] leading-none">
                  12 <span className="font-sans text-[12px] text-ink-3">days</span>
                </div>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3.5 sm:px-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">Lunch</span>
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-text">{logged ? 'Logged' : 'Up next'}</span>
                  </div>
                  <div className="text-[12px] text-ink-3">12:30 – 2:15 pm · Veg & Non-Veg mess</div>
                </div>
                <div className="text-right">
                  <div className="num text-[16px] font-medium">715</div>
                  <div className="text-[11px] text-ink-3">kcal</div>
                </div>
              </div>
              <ul className="px-4 sm:px-5">
                {PICKS.map((p, i) => (
                  <li key={p.item} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                    <span
                      className={cx(
                        'grid size-[18px] shrink-0 place-items-center rounded-[6px] border transition-colors duration-300',
                        i < picksShown ? 'border-accent-text bg-accent-text text-accent-ink' : 'border-line-strong',
                      )}
                    >
                      <AnimatePresence>
                        {i < picksShown && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 22 }}>
                            <Check size={11} strokeWidth={3} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <span className={cx('min-w-0 flex-1 truncate text-[14px] transition-opacity duration-300', i < picksShown ? 'opacity-100' : 'opacity-40')}>
                      {p.item} <span className="ml-1 text-[12.5px] font-medium text-accent-text">{p.portion}</span>
                    </span>
                    <span className="num text-[12.5px] text-ink-3">{p.kcal}</span>
                  </li>
                ))}
              </ul>
              <div className="px-4 pt-1 pb-4 sm:px-5">
                <div className="text-[12.5px] font-medium text-skip">Leave on the counter</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SKIPS.map((s, i) => (
                    <span key={s} className="relative rounded-full bg-skip-soft px-2.5 py-1 text-[12px] text-skip">
                      {s}
                      <motion.span
                        className="absolute top-1/2 right-2 left-2 h-px origin-left bg-skip/70"
                        initial={false}
                        animate={{ scaleX: skipsStruck ? 1 : 0 }}
                        transition={{ duration: 0.45, ease: EASE, delay: skipsStruck ? i * 0.12 : 0 }}
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 -bottom-5 flex justify-center">
            <AnimatePresence>
              {logged && (
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="flex items-center gap-2.5 rounded-full bg-ink py-2 pr-4 pl-2.5 text-[13px] text-bg shadow-2xl"
                >
                  <span className="grid size-5 place-items-center rounded-full bg-bg/15">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  Lunch logged · 715 kcal
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

function MiniRing({ value, max }: { value: number; max: number }) {
  const size = 72
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent-text)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(1, value / max)) }}
        transition={{ duration: 1, ease: EASE }}
      />
    </svg>
  )
}
