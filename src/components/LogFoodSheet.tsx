import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { estimateText } from '../lib/foods'
import { aiEstimate } from '../lib/gemini'
import { useStore } from '../lib/store'
import { MEAL_LABEL, MEALS, type MealKey } from '../lib/types'
import { Button, Label, NumberField, Segmented, Sheet, Spinner } from './ui'

type Meal = MealKey | 'extra'

export function LogFoodSheet({ open, onClose, date, meal: initialMeal }: { open: boolean; onClose: () => void; date: string; meal?: Meal }) {
  const settings = useStore((s) => s.settings)
  const diet = useStore((s) => s.profile?.diet ?? 'veg')
  const addLog = useStore((s) => s.addLog)
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
    }
  }, [open, initialMeal])

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
    addLog({ date, meal, label: text.trim() || 'Food', kcal: Number(kcal), protein: Number(protein || 0) })
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
      </div>
    </Sheet>
  )
}
