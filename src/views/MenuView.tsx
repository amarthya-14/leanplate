import { Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MenuUpload } from '../components/MenuUpload'
import { PlanBoard } from '../components/PlanBoard'
import { Button, Card, cx, IconButton, PageHeader, Segmented, Sheet, VerdictDot } from '../components/ui'
import { daysInMonth, fmtLong, fmtTime, iso, monthName, todayISO } from '../lib/date'
import { allowed, atomize, verdict } from '../lib/foods'
import { splitTopLevel } from '../lib/menuParser'
import { pickSheet, useStore } from '../lib/store'
import { MEAL_LABEL, MEALS, type Diet } from '../lib/types'

export function MenuView() {
  const menus = useStore((s) => s.menus)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const removeMenu = useStore((s) => s.removeMenu)
  const diet = useStore((s) => s.profile?.diet ?? 'veg')
  const [uploading, setUploading] = useState(false)
  const today = todayISO()

  const initial = menus.find((m) => today.startsWith(`${m.year}-${String(m.month).padStart(2, '0')}`)) ?? menus[0]
  const [menuId, setMenuId] = useState(initial?.id ?? '')
  const month = menus.find((m) => m.id === menuId) ?? initial
  const [date, setDate] = useState(() =>
    month && today.startsWith(`${month.year}-${String(month.month).padStart(2, '0')}`) ? today : month ? iso(new Date(month.year, month.month - 1, 1)) : today,
  )
  const [mode, setMode] = useState<'menu' | 'plate'>('menu')

  useEffect(() => {
    if (!month) return
    const prefix = `${month.year}-${String(month.month).padStart(2, '0')}`
    if (!date.startsWith(prefix)) setDate(today.startsWith(prefix) ? today : `${prefix}-01`)
  }, [month, date, today])

  if (!month) {
    return (
      <div className="rise">
        <PageHeader eyebrow="Mess menu" title="Upload this month's menu" />
        <Card className="p-6 sm:p-8">
          <MenuUpload />
          <p className="mt-6 text-[13px] leading-relaxed text-ink-3">
            Works with the usual hostel format — a Day/Dates column (e.g. “Thu 1, 15, 29”) and columns for Breakfast, Lunch, Snacks and Dinner. Date-specific
            variants like “Veg Puff (1, 29), Peanuts (15)” are resolved per day. Everything stays in your browser.
          </p>
        </Card>
      </div>
    )
  }

  const sheet = pickSheet(month, settings.sheetName)
  const dayNum = Number(date.slice(8, 10))
  const dm = sheet?.days[dayNum] ?? sheet?.weekdays[new Date(month.year, month.month - 1, dayNum).getDay()]

  return (
    <div className="rise">
      <PageHeader eyebrow="Mess menu" title={`${monthName(month.month)} ${month.year}`}>
        {menus.length > 1 && (
          <select className="field h-10 w-auto py-0" value={month.id} onChange={(e) => setMenuId(e.target.value)} aria-label="Month">
            {menus.map((m) => (
              <option key={m.id} value={m.id}>
                {monthName(m.month)} {m.year}
              </option>
            ))}
          </select>
        )}
        <Button onClick={() => setUploading(true)}>
          <Upload size={15} /> Upload
        </Button>
      </PageHeader>

      {month.sheets.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-ink-3">Your mess</span>
          <Segmented
            size="sm"
            value={sheet.name}
            onChange={(v) => updateSettings({ sheetName: v })}
            options={month.sheets.map((s) => ({ value: s.name, label: s.name }))}
          />
        </div>
      )}

      <DateStrip year={month.year} month={month.month} value={date} onChange={setDate} />

      <div className="mt-8 mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="display text-[30px]">{fmtLong(date)}</h2>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'menu', label: 'Full menu' },
            { value: 'plate', label: 'My plate' },
          ]}
        />
      </div>

      {mode === 'plate' ? (
        <PlanBoard key={date} date={date} />
      ) : dm ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {MEALS.map((m) => (
              <Card key={m} className="p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="text-[15px] font-semibold">{MEAL_LABEL[m]}</h3>
                  {month.timings?.[m] && (
                    <span className="text-[12px] text-ink-3">
                      {fmtTime(month.timings[m]!.start)}–{fmtTime(month.timings[m]!.end)}
                    </span>
                  )}
                </div>
                <MenuList lines={dm[m]} diet={diet} />
              </Card>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <VerdictDot v="good" /> Good pick
            </span>
            <span className="flex items-center gap-1.5">
              <VerdictDot v="limit" /> Small portion
            </span>
            <span className="flex items-center gap-1.5">
              <VerdictDot v="skip" /> Skip — sugar, fried or refined
            </span>
          </div>
        </>
      ) : (
        <Card className="p-6 text-[14px] text-ink-3">Nothing listed for this day in “{sheet.name}”.</Card>
      )}

      <div className="mt-12 border-t border-line pt-6">
        <h3 className="eyebrow mb-3">Uploaded menus</h3>
        <ul className="space-y-1">
          {menus.map((m) => (
            <li key={m.id} className="flex items-center gap-3 text-[14px]">
              <span className="font-medium">
                {monthName(m.month)} {m.year}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink-3">{m.fileName}</span>
              <IconButton label={`Remove ${monthName(m.month)} menu`} onClick={() => removeMenu(m.id)} className="size-8">
                <Trash2 size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      </div>

      <Sheet open={uploading} onClose={() => setUploading(false)} title="Upload menu">
        <MenuUpload onDone={() => setUploading(false)} />
      </Sheet>
    </div>
  )
}

function MenuList({ lines, diet }: { lines: string[]; diet: Diet }) {
  const items = useMemo(
    () =>
      lines.flatMap((line) => {
        const atoms = atomize(line, diet)
        if (!atoms.length) return splitTopLevel(line).map((l) => ({ label: l, v: null as null | ReturnType<typeof verdict>, hidden: !allowed(l, diet) }))
        return atoms.map((a) => ({ label: a.label, v: verdict(a.food), hidden: false }))
      }),
    [lines, diet],
  )
  if (!items.length) return <p className="text-[13px] text-ink-3">Nothing listed</p>
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className={cx('flex gap-2.5 text-[14px] leading-snug', it.hidden ? 'text-ink-3 line-through' : 'text-ink-2')}>
          {it.v ? <VerdictDot v={it.v} /> : <span className="mt-[7px] inline-block size-1.5 shrink-0 rounded-full bg-line-strong" />}
          {it.label}
        </li>
      ))}
    </ul>
  )
}

function DateStrip({ year, month, value, onChange }: { year: number; month: number; value: string; onChange: (d: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const today = todayISO()
  const n = daysInMonth(year, month)
  const days = Array.from({ length: n }, (_, i) => iso(new Date(year, month - 1, i + 1)))

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-date="${value}"]`)
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [value])

  return (
    <div ref={ref} className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-0 sm:px-0">
      {days.map((d) => {
        const sel = d === value
        const date = new Date(year, month - 1, Number(d.slice(8)))
        return (
          <button
            key={d}
            data-date={d}
            onClick={() => onChange(d)}
            className={cx(
              'flex w-12 shrink-0 cursor-pointer flex-col items-center rounded-2xl py-2.5 transition',
              sel ? 'bg-accent text-accent-ink' : 'hover:bg-surface-2',
              !sel && d === today && 'ring-1 ring-accent-text/50',
              !sel && d < today && 'text-ink-3',
            )}
          >
            <span className={cx('text-[10.5px] font-medium tracking-wide uppercase', sel ? 'opacity-80' : 'text-ink-3')}>
              {date.toLocaleDateString('en-IN', { weekday: 'narrow' })}
            </span>
            <span className="num mt-0.5 text-[17px] font-medium">{date.getDate()}</span>
          </button>
        )
      })}
    </div>
  )
}
