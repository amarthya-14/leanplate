import { ArrowUp, Check, KeyRound, Square, Trash2, Undo2, Wand2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Markdown } from '../components/Markdown'
import { EASE } from '../components/motion'
import { toast } from '../components/Toast'
import { Button, Card, cx, IconButton, PageHeader } from '../components/ui'
import { addDays, fmtLong, todayISO } from '../lib/date'
import { COACH_TOOLS, coachSystem, profileBrief, streamEvents } from '../lib/gemini'
import { applyPlanChange, currentPlanFor, planTotals, proposalFromCall, proposalNote } from '../lib/planEdit'
import { currentKg, dayMenuFor, sugarStreak, useStore, useTargets } from '../lib/store'
import { MEAL_LABEL, MEALS, type ChatMsg, type Proposal } from '../lib/types'
import { useDayPlan } from '../lib/usePlan'

const YES = /^(yes|yeah|yep|yup|ok|okay|sure|do it|go ahead|please do|update it|haan|ha|ji|done)\b/i
const NO = /^(no|nope|nah|keep it|don'?t|leave it)\b/i

const SUGGESTIONS = [
  'I woke up late — skip breakfast and fix my plate for today.',
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
  const patchChat = useStore((s) => s.patchChat)
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
      `Today's date: ${today} (use "today"/"tomorrow" or YYYY-MM-DD in tools).`,
      plan
        ? `TODAY'S CURRENT PLATE${plan.edited ? ' (already adjusted by you: ' + plan.edited.note + ')' : ''}:\n${MEALS.map(
            (m) =>
              `${MEAL_LABEL[m]}: ${plan.meals[m].skipped ? 'SKIPPED' : plan.meals[m].picks.map((p) => `${p.item} ${p.portion} (${p.kcal} kcal, ${p.protein} g)`).join(', ') || '—'}`,
          ).join('\n')}`
        : '',
      tomorrow ? `TOMORROW'S MENU:\n${MEALS.map((m) => `${MEAL_LABEL[m]}: ${tomorrow.menu[m].join(', ') || '—'}`).join('\n')}` : '',
    ]
    return lines.filter(Boolean).join('\n')
  }, [menus, settings.sheetName, today, logs, weights, slips, profile.startDate, t, plan])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat])

  function applyProposal(m: ChatMsg) {
    const p = m.proposal
    if (!p || p.status !== 'pending') return
    if (p.kind === 'log') {
      const logId = useStore.getState().addLog({ date: p.date, meal: p.meal, label: p.label, kcal: p.kcal, protein: p.protein })
      patchChat(m.at, { proposal: { ...p, status: 'applied', logId } })
      toast(`Logged · ${p.kcal} kcal`)
      return
    }
    const cur = currentPlanFor(p.date)
    if (!cur) {
      toast('No menu for that day — upload it first')
      return
    }
    const prev = useStore.getState().plans[cur.key] ?? null
    useStore.getState().savePlan(applyPlanChange(cur.plan, p))
    patchChat(m.at, { proposal: { ...p, status: 'applied', prev, before: planTotals(cur.plan.meals) } })
    toast(p.date === today ? "Today's plate updated" : 'Plate updated')
  }

  function undoProposal(m: ChatMsg) {
    const p = m.proposal
    if (!p || p.status !== 'applied') return
    const st = useStore.getState()
    if (p.kind === 'log') {
      if (p.logId) st.removeLog(p.logId)
    } else {
      const cur = currentPlanFor(p.date)
      if (cur) {
        if (p.prev) st.savePlan(p.prev)
        else st.removePlan(cur.key)
      }
    }
    patchChat(m.at, { proposal: p.kind === 'plan' ? { ...p, status: 'pending', prev: undefined } : { ...p, status: 'pending', logId: undefined } })
  }

  function dismissProposal(m: ChatMsg) {
    if (m.proposal?.status === 'pending') patchChat(m.at, { proposal: { ...m.proposal, status: 'dismissed' } })
  }

  async function send(text: string) {
    const msg = text.trim()
    if (!msg || busy) return
    setInput('')
    const now = Date.now()

    // A plain "yes"/"no" answers the pending card without another round-trip
    const pending = [...chat].reverse().find((m) => m.role === 'model')
    if (pending?.proposal?.status === 'pending' && (YES.test(msg) || NO.test(msg)) && msg.length < 40) {
      pushChat({ role: 'user', text: msg, at: now })
      if (YES.test(msg)) {
        applyProposal(pending)
        pushChat({
          role: 'model',
          text: pending.proposal.kind === 'log' ? 'Logged.' : "Done — your plate is updated. Open **Today** to see it.",
          at: now + 1,
        })
      } else {
        dismissProposal(pending)
        pushChat({ role: 'model', text: 'No problem — keeping the plate as it is.', at: now + 1 })
      }
      return
    }

    const history: ChatMsg[] = [...chat, { role: 'user', text: msg, at: now }]
    pushChat(history[history.length - 1])
    const modelAt = now + 1
    pushChat({ role: 'model', text: '', at: modelAt })
    setBusy(true)
    const ac = new AbortController()
    abortRef.current = ac
    let acc = ''
    let proposal: Proposal | null = null
    try {
      for await (const ev of streamEvents({
        apiKey: settings.apiKey,
        model: settings.model,
        system: coachSystem(profileBrief(profile, t, currentKg(weights, profile)), context),
        turns: history.slice(-20).map((m) => ({ role: m.role, text: m.proposal ? `${m.text}\n${proposalNote(m.proposal)}` : m.text })),
        tools: COACH_TOOLS,
        temperature: 0.7,
        signal: ac.signal,
      })) {
        if (ev.type === 'text') {
          acc += ev.text
          patchLastChat(acc)
        } else {
          proposal = proposalFromCall(ev.name, ev.args) ?? proposal
          if (proposal) patchChat(modelAt, { proposal })
        }
      }
      if (proposal && !acc.trim()) {
        acc = proposal.kind === 'plan' ? `${proposal.summary}. Want me to update the plate?` : `Want me to log ${proposal.label}?`
        patchLastChat(acc)
      }
      if (!acc && !proposal) patchLastChat('_No response — try again._')
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
              {m.proposal && (
                <ProposalCard
                  p={m.proposal}
                  onApply={() => applyProposal(m)}
                  onDismiss={() => dismissProposal(m)}
                  onUndo={() => undoProposal(m)}
                  onView={() => go('today')}
                />
              )}
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

function ProposalCard({ p, onApply, onDismiss, onUndo, onView }: { p: Proposal; onApply: () => void; onDismiss: () => void; onUndo: () => void; onView: () => void }) {
  const cur = p.kind === 'plan' ? currentPlanFor(p.date) : null
  const before = cur ? (p.kind === 'plan' && p.status === 'applied' && p.before ? p.before : planTotals(cur.plan.meals)) : null
  const after = cur && p.kind === 'plan' ? planTotals(p.status === 'applied' ? cur.plan.meals : applyPlanChange(cur.plan, p).meals) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={cx('mt-4 overflow-hidden rounded-[22px] border bg-surface', p.status === 'applied' ? 'border-accent-text/40' : 'border-line-strong', p.status === 'dismissed' && 'opacity-55')}
    >
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-accent-text">
          <Wand2 size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">{p.kind === 'plan' ? `Plate change · ${fmtLong(p.date)}` : 'Log this?'}</div>
          <div className="truncate text-[14.5px] font-medium">{p.kind === 'plan' ? p.summary : p.label}</div>
        </div>
      </div>

      {p.kind === 'plan' ? (
        <div className="space-y-3 px-5 py-4">
          {MEALS.filter((m) => p.meals[m]).map((m) => {
            const c = p.meals[m]!
            return (
              <div key={m} className="flex gap-4">
                <div className="w-20 shrink-0 pt-0.5 text-[12.5px] font-medium text-ink-3">{MEAL_LABEL[m]}</div>
                {c.action === 'skip' ? (
                  <div className="text-[14px] text-skip">Skipped</div>
                ) : (
                  <ul className="min-w-0 flex-1 space-y-1">
                    {c.picks!.map((x, i) => (
                      <li key={i} className="flex justify-between gap-3 text-[14px]">
                        <span>
                          {x.item} <span className="text-[12.5px] font-medium text-accent-text">{x.portion}</span>
                        </span>
                        <span className="num shrink-0 text-[12.5px] text-ink-3">{x.kcal}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
          {before && after && (
            <div className="num flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-[12.5px] text-ink-3">
              <span>
                Day: {before.kcal} → <span className="font-medium text-ink">{after.kcal} kcal</span>
              </span>
              <span>
                Protein: {before.protein} → <span className="font-medium text-ink">{after.protein} g</span>
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="num px-5 py-4 text-[14px] text-ink-2">
          {p.kcal} kcal · {p.protein} g protein · {p.meal === 'extra' ? 'Extra' : MEAL_LABEL[p.meal]}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-4 py-3">
        {p.status === 'pending' && (
          <>
            <Button size="sm" variant="primary" onClick={onApply}>
              <Check size={14} /> {p.kind === 'plan' ? 'Update my plate' : 'Log it'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Keep as is
            </Button>
          </>
        )}
        {p.status === 'applied' && (
          <>
            <span className="flex items-center gap-1.5 px-2 text-[13px] font-medium text-accent-text">
              <Check size={14} /> {p.kind === 'plan' ? 'Plate updated' : 'Logged'}
            </span>
            {p.kind === 'plan' && (
              <Button size="sm" variant="ghost" onClick={onView}>
                View plate
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onUndo}>
              <Undo2 size={13} /> Undo
            </Button>
          </>
        )}
        {p.status === 'dismissed' && <span className="px-2 text-[13px] text-ink-3">Kept the original plan</span>}
      </div>
    </motion.div>
  )
}
