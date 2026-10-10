import { FileSpreadsheet, Sparkles, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { daysInMonth, monthName } from '../lib/date'
import { aiParseMenu } from '../lib/gemini'
import { parseCsv, parseWorkbook, sheetToText, type ParseResult, type RawSheet } from '../lib/menuParser'
import { uid, useStore } from '../lib/store'
import { Button, Choice, cx, Label, Spinner } from './ui'

export function MenuUpload({ onDone }: { onDone?: () => void }) {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const addMenu = useStore((s) => s.addMenu)
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [fileName, setFileName] = useState('')
  const [raw, setRaw] = useState<RawSheet[]>([])
  const [res, setRes] = useState<ParseResult | null>(null)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [sheet, setSheet] = useState('')

  async function handle(file: File) {
    setErr('')
    setRes(null)
    setFileName(file.name)
    setBusy(true)
    try {
      let sheets: RawSheet[]
      if (/\.csv$/i.test(file.name)) {
        sheets = [{ sheet: file.name.replace(/\.csv$/i, ''), data: parseCsv(await file.text()) }]
      } else if (/\.xls$/i.test(file.name)) {
        throw new Error('Old .xls files are not supported. Open it and “Save As” .xlsx, then upload again.')
      } else {
        const { default: readXlsxFile } = await import('read-excel-file/browser')
        sheets = (await readXlsxFile(file)) as unknown as RawSheet[]
      }
      setRaw(sheets)
      const r = parseWorkbook(sheets, file.name)
      accept(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  function accept(r: ParseResult) {
    setRes(r)
    if (r.month) setMonth(r.month)
    if (r.year) setYear(r.year)
    const preferred = r.sheets.find((s) => s.name === settings.sheetName) ?? r.sheets.find((s) => !/spl|special/i.test(s.name)) ?? r.sheets[0]
    setSheet(preferred?.name ?? '')
  }

  async function readWithAI() {
    setBusy(true)
    setErr('')
    try {
      const r = await aiParseMenu({
        apiKey: settings.apiKey,
        model: settings.model,
        fileName,
        sheets: raw.map((s) => ({ name: s.sheet, text: sheetToText(s) })),
      })
      if (!r.sheets.length) throw new Error('Gemini could not find a menu in this file either.')
      accept(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function save() {
    if (!res) return
    addMenu({
      id: uid(),
      fileName,
      title: res.title,
      month,
      year,
      sheets: res.sheets,
      timings: res.timings,
      uploadedAt: Date.now(),
    })
    if (sheet) updateSettings({ sheetName: sheet })
    setRes(null)
    setRaw([])
    onDone?.()
  }

  const found = res?.sheets.length ?? 0

  return (
    <div>
      {!res || !found ? (
        <>
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              const f = e.dataTransfer.files?.[0]
              if (f) handle(f)
            }}
            className={cx(
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition',
              drag ? 'border-accent-text bg-accent-soft' : 'border-line-strong hover:border-ink-3 hover:bg-surface-2/50',
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handle(f)
                e.target.value = ''
              }}
            />
            <div className="grid size-12 place-items-center rounded-full bg-surface-2 text-ink-2">{busy ? <Spinner size={20} /> : <Upload size={20} />}</div>
            <div>
              <div className="text-[15px] font-medium">{busy ? 'Reading the menu…' : 'Drop the monthly mess menu here'}</div>
              <div className="mt-1 text-[13px] text-ink-3">.xlsx or .csv — the sheet your hostel shares every month</div>
            </div>
          </label>
          {res && !found && (
            <div className="mt-4 rounded-2xl bg-surface-2 p-4 text-[14px] text-ink-2">
              <p>Couldn't spot a Breakfast / Lunch / Snacks / Dinner layout in “{fileName}”.</p>
              {settings.apiKey ? (
                <Button size="sm" variant="primary" className="mt-3" onClick={readWithAI} disabled={busy}>
                  {busy ? <Spinner size={14} /> : <Sparkles size={14} />} Let Gemini read it
                </Button>
              ) : (
                <p className="mt-2 text-ink-3">Add a Gemini key in Settings and it can read unusual layouts for you.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="rise space-y-5">
          <div className="flex items-start gap-3 rounded-2xl bg-surface-2 p-4">
            <FileSpreadsheet size={20} className="mt-0.5 shrink-0 text-accent-text" />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium">{fileName}</div>
              <div className="mt-0.5 text-[13px] text-ink-3">
                {found} {found === 1 ? 'menu' : 'menus'} found ·{' '}
                {res.sheets.map((s) => `${s.name} (${Object.keys(s.days).length || Object.keys(s.weekdays).length + ' weekdays'}${Object.keys(s.days).length ? ' days' : ''})`).join(', ')}
                {Object.keys(res.timings).length > 0 && ' · mess timings detected'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Month</Label>
              <select className="field" value={month} onChange={(e) => setMonth(+e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {monthName(i + 1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Year</Label>
              <select className="field" value={year} onChange={(e) => setYear(+e.target.value)}>
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {found > 1 && (
            <div>
              <Label>Which mess are you registered for?</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {res.sheets.map((s) => (
                  <Choice
                    key={s.name}
                    selected={sheet === s.name}
                    onClick={() => setSheet(s.name)}
                    title={s.name}
                    hint={/spl|special/i.test(s.name) ? 'Extra items: juices, soups, sweets' : 'Regular menu'}
                  />
                ))}
              </div>
            </div>
          )}

          {res.sheets[0] && Object.keys(res.sheets[0].days).length > 0 && Object.keys(res.sheets[0].days).length < daysInMonth(year, month) - 3 && (
            <p className="text-[13px] text-limit">
              Only {Object.keys(res.sheets[0].days).length} days were found — some dates may be missing from the sheet.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="primary" onClick={save}>
              Save {monthName(month)} menu
            </Button>
            <Button variant="ghost" onClick={() => setRes(null)}>
              Choose another file
            </Button>
          </div>
        </div>
      )}
      {err && <p className="mt-3 text-[13px] text-skip">{err}</p>}
    </div>
  )
}
