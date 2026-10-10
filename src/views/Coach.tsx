import { ArrowUp, KeyRound, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Markdown } from '../components/Markdown'
import { Button, Card, IconButton, PageHeader } from '../components/ui'
import { addDays, fmtLong, todayISO } from '../lib/date'
import { coachSystem, profileBrief, stream } from '../lib/gemini'
import { currentKg, dayMenuFor, sugarStreak, useStore, useTargets } from '../lib/store'
import { MEAL_LABEL, MEALS } from '../lib/types'
import { useDayPlan } from '../lib/usePlan'

const SUGGESTIONS = [
  'What exactly should I take at dinner tonight?',
  'I have a sugar craving right now — help.',
  'I overate at lunch. What should I do for the rest of the day?',
  'Is the Special mess worth it for weight loss?',
  'What can I keep in my room for healthy snacks?',
  'Why am I not losing weight this week?',
]

export function Coach({ go, initialPrompt, clearPrompt }: { go: (v: string) => void; initialPrompt?: string; clearPrompt: () => void }) {
  const settings = useStore((s) => s.settings)
  const profile = useStore((s) => s.profile)!
  const chat = useStore((s) => s.chat)
  const pushChat = useStore((s) => s.pushChat)
  const patchLastChat = useStore((s) => s.patchLastChat)
  const clearChat = useStore((s) => s.clearChat)
  const menus = useStore((s) => s.menus)
  const logs = useStore((s) => s.logs)
  const weights = useStore((s) => s.weights)
  const slips = useStore((s) => s.slips)
  const t = useTargets()!
  const today = todayISO()
  const { plan } = useDayPlan(today)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const context = useMemo(() => {
    const dm = dayMenuFor(menus, settings.sheetName, today)
    const tomorrow = dayMenuFor(menus, settings.sheetName, addDays(today, 1))
    const todays = logs.filter((l) => l.date === today)
    const eaten = todays.reduce((s, l) => s + l.kcal, 0)
    const prot = todays.reduce((s, l) => s + l.protein, 0)
    const recentW = weights.slice(-8).map((w) => `${w.date}: ${w.kg}`).join(', ')
    const lines = [
      `Now: ${new Date().toLocaleString('en-IN', { weekday: 'long', hour: 'numeric', minute: '2-digit' })} (${fmtLong(today)}).`,
      `Eaten so far today: ${eaten} kcal, ${prot} g protein (target ${t.kcal} kcal / ${t.protein} g).`,
      todays.length ? `Logged: ${todays.map((l) => `${l.meal}: ${l.label} (${l.kcal} kcal)`).join('; ')}` : 'Nothing logged yet today.',
      `Sugar-free streak: ${sugarStreak(slips, profile.startDate)} days.`,
      recentW ? `Recent weigh-ins: ${recentW}` : '',
      dm ? `TODAY'S MESS MENU (${dm.sheet}):\n${MEALS.map((m) => `${MEAL_LABEL[m]}: ${dm.menu[m].join(', ') || '—'}`).join('\n')}` : 'No mess menu uploaded for today.',
      plan ? `TODAY'S PLANNED PLATE:\n${MEALS.map((m) => `${MEAL_LABEL[m]}: ${plan.meals[m].picks.map((p) => `${p.item} ${p.portion}`).join(', ') || '—'}`).join('\n')}` : '',
      tomorrow ? `TOMORROW'S MENU:\n${MEALS.map((m) => `${MEAL_LABEL[m]}: ${tomorrow.menu[m].join(', ') || '—'}`).join('\n')}` : '',
    ]
    return lines.filter(Boolean).join('\n')
  }, [menus, settings.sheetName, today, logs, weights, slips, profile.startDate, t, plan])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat])

  async function send(text: string) {
    const msg = text.trim()
    if (!msg || busy) return
    setInput('')
    const history = [...chat, { role: 'user' as const, text: msg, at: Date.now() }]
    pushChat(history[history.length - 1])
    pushChat({ role: 'model', text: '', at: Date.now() })
    setBusy(true)
    const ac = new AbortController()
    abortRef.current = ac
    let acc = ''
    try {
      for await (const chunk of stream({
        apiKey: settings.apiKey,
        model: settings.model,
        system: coachSystem(profileBrief(profile, t, currentKg(weights, profile)), context),
        turns: history.slice(-20).map((m) => ({ role: m.role, text: m.text })),
        temperature: 0.7,
        signal: ac.signal,
      })) {
        acc += chunk
        patchLastChat(acc)
      }
      if (!acc) patchLastChat('_No response — try again._')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') patchLastChat(acc + `\n\n_${(e as Error).message}_`)
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  useEffect(() => {
    if (initialPrompt && settings.apiKey) {
      send(initialPrompt)
      clearPrompt()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt])

  if (!settings.apiKey) {
    return (
      <div className="">
        <PageHeader eyebrow="Coach" title="Your nutrition coach" />
        <Card className="max-w-xl p-7">
          <KeyRound size={20} className="mb-4 text-accent-text" />
          <h2 className="mb-2 text-[17px] font-semibold">Add a Gemini key to talk to the coach</h2>
          <p className="mb-5 text-[14px] leading-relaxed text-ink-2">
            It's free. Get a key from Google AI Studio, paste it in Settings, and the coach will know your menu, your targets and what you've eaten today.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => go('settings')}>Open settings</Button>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              <Button variant="ghost">Get a key ↗</Button>
            </a>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col md:min-h-[calc(100dvh-5rem)]">
      <PageHeader eyebrow="Coach" title="Ask anything">
        {chat.length > 0 && (
          <IconButton label="Clear conversation" onClick={clearChat}>
            <Trash2 size={16} />
          </IconButton>
        )}
      </PageHeader>

      <div className="flex-1 space-y-6 pb-6">
        {chat.length === 0 && (
          <div>
            <p className="mb-5 max-w-lg text-[15px] leading-relaxed text-ink-2">
              The coach can see today's mess menu, your plan, what you've logged and your weight trend. Be as specific as you like.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="cursor-pointer rounded-2xl border border-line bg-surface px-4 py-3 text-left text-[14px] text-ink-2 transition hover:border-line-strong hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-[15px] whitespace-pre-wrap text-accent-ink">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="max-w-[92%] text-[15px] leading-relaxed text-ink">
              {m.text ? <Markdown text={m.text} /> : <div className="flex gap-1.5 py-2">{[0, 1, 2].map((d) => <span key={d} className="size-1.5 animate-pulse rounded-full bg-ink-3" style={{ animationDelay: `${d * 150}ms` }} />)}</div>}
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-20 md:bottom-4">
        <div className="card flex items-end gap-2 p-2 pl-4">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(160, e.target.scrollHeight) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
                if (taRef.current) taRef.current.style.height = 'auto'
              }
            }}
            placeholder="Message your coach…"
            className="max-h-40 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-3"
          />
          {busy ? (
            <IconButton label="Stop" onClick={() => abortRef.current?.abort()} className="bg-surface-2">
              <Square size={14} />
            </IconButton>
          ) : (
            <button
              aria-label="Send"
              onClick={() => send(input)}
              disabled={!input.trim()}
              className="grid size-9 cursor-pointer place-items-center rounded-full bg-accent text-accent-ink transition hover:opacity-90 disabled:opacity-35"
            >
              <ArrowUp size={17} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
