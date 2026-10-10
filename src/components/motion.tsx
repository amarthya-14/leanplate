import { animate, motion, useInView, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export const EASE = [0.22, 0.8, 0.24, 1] as const
export const SPRING = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } as const

/** Number that counts up to `value` when it first appears and eases between updates. */
export function CountUp({ value, duration = 1.1, decimals = 0, className }: { value: number; duration?: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const from = useRef(0)
  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const [text, setText] = useState(fmt(reduce ? value : 0))

  useEffect(() => {
    if (!inView) return
    if (reduce) {
      setText(fmt(value))
      return
    }
    const controls = animate(from.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setText(fmt(v)),
    })
    from.current = value
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView])

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  )
}

/** Fades + lifts children in, staggered by `index`. */
export function Reveal({ index = 0, children, className, delay = 0, ...rest }: { index?: number; delay?: number; children: ReactNode; className?: string } & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: delay + index * 0.06 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/** Word-by-word reveal for display headlines. */
export function SplitWords({ text, className, delay = 0, stagger = 0.06 }: { text: string; className?: string; delay?: number; stagger?: number }) {
  const words = text.split(' ')
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom" aria-hidden>
          <motion.span
            className="inline-block"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: delay + i * stagger }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  )
}
