import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { SplitWords } from './motion'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 select-none',
        'disabled:opacity-45 disabled:pointer-events-none active:scale-[0.97] cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-soft',
        size === 'sm' && 'h-8 px-3.5 text-[13px]',
        size === 'md' && 'h-10 px-5 text-sm',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        variant === 'primary' && 'bg-accent text-accent-ink shadow-[0_6px_20px_-8px_color-mix(in_oklab,var(--accent)_60%,transparent)] hover:-translate-y-px hover:shadow-[0_10px_24px_-8px_color-mix(in_oklab,var(--accent)_55%,transparent)]',
        variant === 'secondary' && 'bg-surface border border-line-strong text-ink hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:text-ink hover:bg-surface-2',
        variant === 'danger' && 'bg-skip text-white hover:opacity-90',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function IconButton({ className, children, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-9 items-center justify-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink cursor-pointer',
        'disabled:opacity-40 disabled:pointer-events-none',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('card', className)}>
      {children}
    </div>
  )
}

export function Ring({
  value,
  max,
  size = 168,
  stroke = 12,
  children,
  over,
}: {
  value: number
  max: number
  size?: number
  stroke?: number
  children?: ReactNode
  over?: boolean
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(1, max ? value / max : 0)
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--skip)' : 'var(--accent-text)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.4, ease: [0.22, 0.8, 0.24, 1], delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function Bar({ value, max, tone = 'accent', className }: { value: number; max: number; tone?: 'accent' | 'gold' | 'skip'; className?: string }) {
  const pct = Math.min(100, max ? (value / max) * 100 : 0)
  const color = tone === 'gold' ? 'var(--gold)' : tone === 'skip' ? 'var(--skip)' : 'var(--accent-text)'
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.7s cubic-bezier(0.2,0.7,0.2,1)' }} />
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={cx('inline-flex rounded-full bg-surface-2 p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-full font-medium whitespace-nowrap transition cursor-pointer',
            size === 'sm' ? 'px-3 py-1 text-[12px]' : 'px-4 py-1.5 text-[13px]',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Choice({
  selected,
  onClick,
  title,
  hint,
  className,
}: {
  selected: boolean
  onClick: () => void
  title: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'w-full rounded-2xl border px-4 py-3.5 text-left transition cursor-pointer',
        selected ? 'border-accent-text bg-accent-soft' : 'border-line-strong bg-surface hover:border-ink-3',
        className,
      )}
    >
      <div className="text-[15px] font-medium text-ink">{title}</div>
      {hint && <div className="mt-0.5 text-[13px] text-ink-3">{hint}</div>}
    </button>
  )
}

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            className="absolute inset-0 bg-black/35 backdrop-blur-[3px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className={cx(
              'relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border border-line bg-surface p-6 shadow-2xl sm:rounded-[28px]',
              wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
            )}
          >
            <div className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="display text-[28px]">{title}</h2>
              <IconButton label="Close" onClick={onClose}>
                <X size={18} />
              </IconButton>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-[13px] font-medium text-ink-2">{children}</span>
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </div>
  )
}

export function NumberField({
  value,
  onChange,
  suffix,
  step = 1,
  min,
  max,
  className,
}: {
  value: number | ''
  onChange: (v: number | '') => void
  suffix?: string
  step?: number
  min?: number
  max?: number
  className?: string
}) {
  return (
    <div className={cx('relative', className)}>
      <input
        type="number"
        inputMode="decimal"
        className="field num pr-12"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[13px] text-ink-3">{suffix}</span>}
    </div>
  )
}

export function VerdictDot({ v }: { v: 'good' | 'limit' | 'skip' }) {
  return (
    <span
      className="mt-[7px] inline-block size-1.5 shrink-0 rounded-full"
      style={{ background: v === 'good' ? 'var(--good)' : v === 'limit' ? 'var(--limit)' : 'var(--skip)' }}
    />
  )
}

export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'gold' | 'skip'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium',
        tone === 'neutral' && 'bg-surface-2 text-ink-2',
        tone === 'accent' && 'bg-accent-soft text-accent-text',
        tone === 'gold' && 'bg-[color-mix(in_oklab,var(--gold)_16%,transparent)] text-gold',
        tone === 'skip' && 'bg-skip-soft text-skip',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <motion.div className="eyebrow mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
            {eyebrow}
          </motion.div>
        )}
        <h1 className="display text-[42px] leading-[1.02] sm:text-[52px]">{typeof title === 'string' ? <SplitWords text={title} /> : title}</h1>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  )
}
