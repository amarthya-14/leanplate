import { CalendarDays, Flame, House, MessageCircle, Settings as SettingsIcon, TrendingDown } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { cx } from './components/ui'
import { useStore } from './lib/store'
import { Coach } from './views/Coach'
import { Cravings } from './views/Cravings'
import { MenuView } from './views/MenuView'
import { Onboarding } from './views/Onboarding'
import { Progress } from './views/Progress'
import { Settings } from './views/Settings'
import { Today } from './views/Today'

type View = 'today' | 'menu' | 'progress' | 'cravings' | 'coach' | 'settings'
const NAV: { id: View; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: 'today', label: 'Today', icon: House },
  { id: 'menu', label: 'Menu', icon: CalendarDays },
  { id: 'cravings', label: 'Cravings', icon: Flame },
  { id: 'coach', label: 'Coach', icon: MessageCircle },
  { id: 'progress', label: 'Progress', icon: TrendingDown },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

const readHash = (): View => {
  const h = window.location.hash.slice(1) as View
  return NAV.some((n) => n.id === h) ? h : 'today'
}

function useTheme() {
  const theme = useStore((s) => s.settings.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export function App() {
  useTheme()
  const profile = useStore((s) => s.profile)
  const [view, setView] = useState<View>(readHash)
  const [coachPrompt, setCoachPrompt] = useState<string | undefined>()

  useEffect(() => {
    const onHash = () => setView(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (v: string, prompt?: string) => {
    if (prompt) setCoachPrompt(prompt)
    window.location.hash = v
    window.scrollTo({ top: 0 })
  }

  if (!profile) return <Onboarding />

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-4 py-7 md:flex">
        <Wordmark />
        <nav className="mt-10 space-y-0.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={cx(
                'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
                view === n.id ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:bg-surface-2/60 hover:text-ink-2',
              )}
            >
              <n.icon size={17} strokeWidth={view === n.id ? 2.2 : 1.8} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-3 text-[12px] leading-relaxed text-ink-3">
          {profile.name || 'You'} · {profile.goalKg} kg goal
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-md md:hidden">
        <Wordmark />
        <button onClick={() => go('settings')} aria-label="Settings" className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-surface-2">
          <SettingsIcon size={18} />
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:px-10 md:pt-12 md:pb-16">
        {view === 'today' && <Today go={go} />}
        {view === 'menu' && <MenuView />}
        {view === 'progress' && <Progress />}
        {view === 'cravings' && <Cravings go={go} />}
        {view === 'coach' && <Coach go={go} initialPrompt={coachPrompt} clearPrompt={() => setCoachPrompt(undefined)} />}
        {view === 'settings' && <Settings />}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => n.id !== 'settings').map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={cx('flex cursor-pointer flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition', view === n.id ? 'text-ink' : 'text-ink-3')}
            >
              <n.icon size={20} strokeWidth={view === n.id ? 2.2 : 1.7} />
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" />
        <path d="M32 6a26 26 0 0 1 26 26H32z" fill="var(--gold)" />
      </svg>
      <span className="display text-[24px]">Leanplate</span>
    </div>
  )
}
