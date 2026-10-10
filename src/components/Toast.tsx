import { Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { create } from 'zustand'
import { SPRING } from './motion'

interface Toast {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let seq = 0
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] })
    setTimeout(() => get().dismiss(id), 4200)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export const toast = (text: string, action?: Toast['action']) => useToasts.getState().push({ text, action })

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.18 } }}
            transition={SPRING}
            className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-4 text-[13.5px] text-bg shadow-2xl"
          >
            <span className="grid size-5 place-items-center rounded-full bg-bg/15">
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="max-w-[60vw] truncate">{t.text}</span>
            {t.action ? (
              <button
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
                className="cursor-pointer rounded-full bg-bg/15 px-3 py-1 text-[12.5px] font-medium transition hover:bg-bg/25"
              >
                {t.action.label}
              </button>
            ) : (
              <span className="w-2" />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
