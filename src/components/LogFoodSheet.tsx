import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { estimateText } from '../lib/foods'
import { aiEstimate } from '../lib/gemini'
import { useStore } from '../lib/store'
import { MEAL_LABEL, MEALS, type MealKey } from '../lib/types'
import { toast } from './Toast'
import { Button, cx, Label, NumberField, Segmented, Sheet, Spinner } from './ui'

/** Canteen & room staples with realistic numbers. `sugar` marks the craving traps. */
const QUICK: { name: string; kcal: number; protein: number; sugar?: boolean }[] = [
  { name: 'Tea with sugar', kcal: 90, protein: 2, sugar: true },
  { name: 'Coffee with sugar', kcal: 110, protein: 3, sugar: true },
  { name: 'Black tea / coffee', kcal: 10, protein: 0 },
  { name: '2 boiled eggs', kcal: 150, protein: 12 },
  { name: 'Banana', kcal: 100, protein: 1 },
  { name: 'Roasted chana (handful)', kcal: 120, protein: 7 },
  { name: 'Peanuts (handful)', kcal: 170, protein: 7 },
  { name: 'Bread omelette', kcal: 330, protein: 16 },
  { name: 'Samosa', kcal: 260, protein: 5 },
  { name: 'Veg puff', kcal: 280, protein: 5 },
  { name: 'Maggi (1 pack)', kcal: 350, protein: 8 },
  { name: 'Paneer roll', kcal: 450, protein: 16 },
  { name: 'Chicken roll', kcal: 480, protein: 24 },
  { name: 'Lays (small)', kcal: 130, protein: 2 },
  { name: 'Biscuits (4)', kcal: 140, protein: 2, sugar: true },
  { name: 'Dairy Milk (small)', kcal: 130, protein: 2, sugar: true },
  { name: 'Coke / Sprite (250 ml)', kcal: 105, protein: 0, sugar: true },
  { name: 'Fruit juice (glass)', kcal: 140, protein: 1, sugar: true },
  { name: 'Ice cream cup', kcal: 150, protein: 3, sugar: true },
  { name: 'Sweet lassi', kcal: 220, protein: 7, sugar: true },
]

type Meal = MealKey | 'extra'

export function LogFoodSheet({ open, onClose, date, meal: initialMeal }: { open: boolean; onClose: () => void; date: string; meal?: Meal }) {
  const settings = useStore((s) => s.settings)
  const diet = useStore((s) => s.profile?.diet ?? 'veg')
  const addLog = useStore((s) => s.addLog)
  const removeLog = useStore((s) => s.removeLog)
  const [tab, setTab] = useState<'quick' | 'type'>('quick')
  const [meal, setMeal] = useState<Meal>(initialMeal ?? 'extra')
  const [text, setText] = useState('')
  const [kcal, setKcal] = useState<number | ''>('')
  const [protein, setProtein] = useState<number | ''>('')
  const [lines, setLines] = useState<{ name: string; qty: string; kcal: number }[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setMeal(initialMeal ?? 'extra')
      setText('')
      setKcal('')
      setProtein('')
      setLines([])
      setComment('')
      setErr('')
      setTab(initialMeal && initialMeal !== 'extra' ? 'type' : 'quick')
    }
  }, [open, initialMeal])

  function quickAdd(q: (typeof QUICK)[number]) {
    const id = addLog({ date, meal, label: q.name, kcal: q.kcal, protein: q.protein })
    toast(`${q.name} · ${q.kcal} kcal`, { label: 'Undo', run: () => removeLog(id) })
    onClose()
  }

  async function estimate() {
    if (!text.trim()) return
    setErr('')
    setBusy(true)
    try {
      if (settings.apiKey) {
        const r = await aiEstimate({ apiKey: settings.apiKey, model: settings.model, text, diet })
        setLines(r.items.map((i) => ({ name: i.name, qty: i.qty, kcal: i.kcal })))
        setKcal(r.kcal)
        setProtein(r.protein)
        setComment(r.comment)
      } else throw new Error('offline')
    } catch (e) {
      const r = estimateText(text, diet)
      setLines(r.items.map((i) => ({ name: i.name, qty: i.qty === 1 ? '' : `×${i.qty}`, kcal: i.kcal })))
      setKcal(r.kcal)
      setProtein(r.protein)
      setComment('')
      if (settings.apiKey && e instanceof Error && e.message !== 'offline') setErr(`${e.message} — used the offline estimate instead.`)
    } finally {
      setBusy(false)
    }
  }

  function save() {
    if (kcal === '') return
    const id = addLog({ date, meal, label: text.trim() || 'Food', kcal: Number(kcal), protein: Number(protein || 0) })
    toast(`Logged · ${kcal} kcal`, { label: 'Undo', run: () => removeLog(id) })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log food">
      <div className="space-y-5">
        <div>
          <Label>Meal</Label>
          <Segmented
            size="sm"
            className="w-full"
            value={meal}
            onChange={setMeal}
            options={[...MEALS.map((m) => ({ value: m as Meal, label: MEAL_LABEL[m] })), { value: 'extra' as Meal, label: 'Extra' }]}
          />
        </div>
        <Segmented
          className="w-full"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'quick', label: 'Canteen & room' },
            { value: 'type', label: 'Describe it' },
          ]}
        />

        {tab === 'quick' ? (
          <div>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button
                  key={q.name}
                  onClick={() => quickAdd(q)}
                  className={cx(
                    'group flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] transition active:scale-95',
                    q.sugar ? 'border-skip/25 hover:border-skip/50 hover:bg-skip-soft' : 'border-line-strong hover:border-accent-text/50 hover:bg-accent-soft',
                  )}
                >
                  <span className="text-ink">{q.name}</span>
                  <span className="num text-ink-3">{q.kcal}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-3">
              <span className="inline-block size-2 rounded-full border border-skip/50 bg-skip-soft" /> Red outline = added sugar. Logging it honestly still counts as a win.
            </p>
          </div>
        ) : (
        <>
        <div>
          <Label hint={settings.apiKey ? 'Gemini estimates it' : 'Offline estimate'}>What did you eat?</Label>
          <textarea
            className="field min-h-[92px] resize-none"
            placeholder="3 pulka, 1 katori dal, half cup rice, 1 gulab jamun"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) estimate()
            }}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={estimate} disabled={!text.trim() || busy}>
              {busy ? <Spinner size={14} /> : <Sparkles size={14} />} Estimate
            </Button>
          </div>
        </div>

        {lines.length > 0 && (
          <div className="rounded-2xl bg-surface-2 p-4">
            <ul className="space-y-1.5 text-[14px]">
              {lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-ink-2">
                    {l.name} <span className="text-ink-3">{l.qty}</span>
                  </span>
                  <span className="num text-ink-3">{l.kcal}</span>
                </li>
              ))}
            </ul>
            {comment && <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-2">{comment}</p>}
          </div>
        )}
        {err && <p className="text-[13px] text-skip">{err}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Calories</Label>
            <NumberField value={kcal} onChange={setKcal} suffix="kcal" />
          </div>
          <div>
            <Label>Protein</Label>
            <NumberField value={protein} onChange={setProtein} suffix="g" />
          </div>
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={save} disabled={kcal === ''}>
          Add to today
        </Button>
        </>
        )}
      </div>
    </Sheet>
  )
}
