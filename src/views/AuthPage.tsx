import { ArrowRight, Cloud, Eye, EyeOff, Lock, MailCheck, Smartphone } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { EASE, SplitWords } from '../components/motion'
import { GoogleButton } from '../components/GoogleButton'
import { PlateOrb } from '../components/PlateOrb'
import { cx, Spinner } from '../components/ui'
import { googleEnabled } from '../lib/supabase'
import { resetPassword, setLocalMode, signIn, signUp } from '../lib/sync'

const CAPTIONS = [
  { eyebrow: 'The plate method', title: 'Half sabzi. A quarter protein. A quarter carbs.', body: 'Built from whatever your mess is serving today.' },
  { eyebrow: 'Every meal, planned', title: 'Your mess menu, portioned to the piece.', body: 'Thirty-one days, four meals a day — what to take, and what to leave.' },
  { eyebrow: 'Steady, not crash', title: 'Half a kilo a week. No starving.', body: 'A calm, sustainable deficit from food you already eat.' },
  { eyebrow: 'Yours, everywhere', title: 'One account. Every device.', body: 'Your plate, streaks and progress follow you — privately.' },
]

type Mode = 'signin' | 'signup' | 'reset' | 'confirm' | 'resetSent'

export function AuthPage({ onLocal }: { onLocal: () => void }) {
  const [scene, setScene] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setScene((s) => (s + 1) % CAPTIONS.length), 5600)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg lg:grid lg:grid-cols-[1.12fr_1fr]">
      {/* ── Motion panel ─────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: EASE }}
        className="relative h-[48dvh] min-h-[360px] overflow-hidden rounded-b-[34px] lg:m-3 lg:h-auto lg:rounded-[30px]"
        style={{
          background:
            'radial-gradient(90% 70% at 85% 10%, rgb(214 173 98 / 0.22), transparent 60%), radial-gradient(80% 60% at 10% 100%, rgb(159 203 173 / 0.14), transparent 60%), linear-gradient(165deg, #1b3426 0%, #0f1c15 55%, #0b140f 100%)',
        }}
      >
        <PlateOrb pulse={scene} className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-5 sm:p-7">
          <div className="flex items-center gap-2.5 text-[#efe7d4]">
            <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
              <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" />
              <path d="M32 6a26 26 0 0 1 26 26H32z" fill="#d6ad62" />
            </svg>
            <span className="display text-[25px]">Leanplate</span>
          </div>
          <span className="hidden items-center gap-2 text-[11px] tracking-[0.18em] text-[#efe7d4]/55 uppercase sm:flex">
            <span className="size-1.5 animate-pulse rounded-full bg-[#d6ad62]" /> Live
          </span>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={scene}
              initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
              transition={{ duration: 0.7, ease: EASE }}
              className="max-w-md"
            >
              <div className="mb-2 text-[11px] font-medium tracking-[0.18em] text-[#d6ad62] uppercase">{CAPTIONS[scene].eyebrow}</div>
              <h2 className="display text-balance text-[26px] leading-[1.08] text-[#f3eee2] sm:text-[34px]">{CAPTIONS[scene].title}</h2>
              <p className="mt-2 hidden text-[14px] leading-relaxed text-[#efe7d4]/60 sm:block">{CAPTIONS[scene].body}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-5 flex gap-1.5">
            {CAPTIONS.map((_, i) => (
              <div key={i} className="h-[2px] w-8 overflow-hidden rounded-full bg-white/15">
                {i === scene && (
                  <motion.div key={scene} className="h-full bg-[#d6ad62]" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 5.6, ease: 'linear' }} />
                )}
                {i < scene && <div className="h-full w-full bg-[#efe7d4]/40" />}
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── Auth card ────────────────────────────────────────────── */}
      <section className="relative z-10 -mt-10 flex justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:px-10 lg:py-10">
        <div className="ambient opacity-70" />
        <AuthCard onLocal={onLocal} />
      </section>
    </div>
  )
}

function AuthCard({ onLocal }: { onLocal: () => void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<'' | 'email' | 'google'>('')
  const [err, setErr] = useState('')
  const [shake, setShake] = useState(0)
  const [showEmail, setShowEmail] = useState(!googleEnabled)

  const fail = (e: unknown) => {
    setErr(e instanceof Error ? e.message : String(e))
    setShake((n) => n + 1)
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

  const heading =
    mode === 'signup'
      ? { eyebrow: 'Create your account', title: 'Start your plate.' }
      : mode === 'reset'
        ? { eyebrow: 'Reset password', title: 'Let’s get you back in.' }
        : { eyebrow: 'Welcome', title: 'Sign in to your plate.' }

  if (mode === 'confirm' || mode === 'resetSent') {
    return (
      <Shell>
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="mb-6 grid size-14 place-items-center rounded-full bg-accent-soft text-accent-text">
          <MailCheck size={24} />
        </motion.div>
        <h1 className="display text-[38px] leading-[1.05]">Check your inbox.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          {mode === 'confirm' ? (
            <>
              We sent a confirmation link to <span className="font-medium text-ink">{email}</span>. Open it on this device and you’ll land straight in.
            </>
          ) : (
            <>
              A reset link is on its way to <span className="font-medium text-ink">{email}</span>.
            </>
          )}
        </p>
        <button onClick={() => setMode('signin')} className="mt-8 cursor-pointer text-[14px] font-medium text-accent-text hover:underline">
          ← Back to sign in
        </button>
      </Shell>
    )
  }

  return (
    <Shell>
      <motion.div className="eyebrow mb-3" key={heading.eyebrow} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {heading.eyebrow}
      </motion.div>
      <h1 className="display min-h-[1.05em] text-[40px] leading-[1.02] sm:text-[46px]">
        <SplitWords key={heading.title} text={heading.title} stagger={0.05} />
      </h1>

      {googleEnabled && mode !== 'reset' && (
        <div className="mt-8">
          <GoogleButton onError={fail} onBusy={(b) => setBusy(b ? 'google' : '')} />
          <p className="mt-3 text-center text-[12.5px] text-ink-3">One tap. No password to remember.</p>
          {!showEmail && (
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="mt-6 flex w-full cursor-pointer items-center gap-3 text-[12px] tracking-[0.14em] text-ink-3 uppercase transition hover:text-ink-2"
            >
              <span className="h-px flex-1 bg-line" /> Use email instead <span className="h-px flex-1 bg-line" />
            </button>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
      {showEmail && (
      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden px-1 -mx-1">
      {mode !== 'reset' && (
        <div className={cx('relative grid grid-cols-2 rounded-full bg-surface-2 p-1', googleEnabled ? 'mt-6' : 'mt-7')}>
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setErr('')
              }}
              className={cx('relative z-10 cursor-pointer rounded-full py-2 text-[13.5px] font-medium transition-colors', mode === m ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
            >
              {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 -z-10 rounded-full bg-surface shadow-card" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}

      <motion.form
        onSubmit={submit}
        className="mt-4 space-y-3 pb-1"
        animate={shake ? { x: [0, -9, 8, -6, 4, 0] } : {}}
        key={shake}
        transition={{ duration: 0.45 }}
        noValidate
      >
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <AnimatePresence initial={false}>
          {mode !== 'reset' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
              <Field
                label="Password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                trailing={
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="cursor-pointer p-1 text-ink-3 hover:text-ink">
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {err && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[13px] text-skip">
              {err}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={!!busy}
          className="shine group relative mt-2 flex h-12 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full bg-accent text-[15px] font-medium text-accent-ink shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--accent)_70%,transparent)] transition hover:-translate-y-px active:scale-[0.99] disabled:opacity-60"
        >
          {busy === 'email' ? (
            <Spinner size={16} />
          ) : (
            <>
              {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </motion.form>

      <div className="mt-4 flex justify-between text-[13px]">
        {mode === 'signin' ? (
          <button onClick={() => setMode('reset')} className="cursor-pointer text-ink-3 hover:text-ink">
            Forgot password?
          </button>
        ) : (
          <button onClick={() => setMode('signin')} className="cursor-pointer text-ink-3 hover:text-ink">
            ← Back to sign in
          </button>
        )}
      </div>
      </motion.div>
      )}
      </AnimatePresence>

      <div className="mt-8 border-t border-line pt-6">
        <button
          onClick={() => {
            setLocalMode(true)
            onLocal()
          }}
          className="group flex w-full cursor-pointer items-center justify-between rounded-2xl px-1 text-left"
        >
          <span>
            <span className="block text-[14px] font-medium text-ink-2 group-hover:text-ink">Continue without an account</span>
            <span className="block text-[12.5px] text-ink-3">Everything stays on this device only.</span>
          </span>
          <ArrowRight size={16} className="text-ink-3 transition-transform group-hover:translate-x-1 group-hover:text-ink" />
        </button>
      </div>

      <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <Lock size={12} /> Private to you
        </span>
        <span className="flex items-center gap-1.5">
          <Cloud size={12} /> Synced automatically
        </span>
        <span className="flex items-center gap-1.5">
          <Smartphone size={12} /> Every device
        </span>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
      className="relative w-full max-w-[420px] rounded-[30px] border border-line bg-surface/85 p-7 shadow-[0_30px_80px_-40px_rgb(26_25_21/0.35)] backdrop-blur-xl sm:p-9 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
    >
      {children}
    </motion.div>
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
    <div className="group relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder=" "
        className="peer h-14 w-full rounded-2xl border border-line-strong bg-surface px-4 pt-5 pb-1.5 text-[15.5px] text-ink transition outline-none focus:border-accent-text focus:shadow-[0_0_0_4px_var(--accent-soft)]"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] text-ink-3 transition-all duration-200 peer-focus:top-[15px] peer-focus:text-[11.5px] peer-focus:text-accent-text peer-[:not(:placeholder-shown)]:top-[15px] peer-[:not(:placeholder-shown)]:text-[11.5px]"
      >
        {label}
      </label>
      {trailing && <div className="absolute top-1/2 right-3 -translate-y-1/2">{trailing}</div>}
    </div>
  )
}
