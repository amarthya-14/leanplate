import type { DayMenu, MealKey, MenuSheet } from './types'

type Cell = unknown
export interface RawSheet {
  sheet: string
  data: Cell[][]
}

export type Timings = Partial<Record<MealKey, { start: number; end: number }>>

export interface ParseResult {
  timings: Timings
  title: string
  month: number | null
  year: number | null
  sheets: MenuSheet[]
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const MEAL_PATTERNS: [MealKey, RegExp][] = [
  ['breakfast', /break\s*fast|morning|tiffin/i],
  ['lunch', /lunch|afternoon/i],
  ['snacks', /snack|evening|high\s*tea/i],
  ['dinner', /dinner|supper|night/i],
]

const STOP_ROW = /instruction|terms\s*&|terms and|^note[s]?\b|^n\.?b\.?\b/i

export const emptyDay = (): DayMenu => ({ breakfast: [], lunch: [], snacks: [], dinner: [] })

function text(c: Cell): string {
  if (c === null || c === undefined) return ''
  if (c instanceof Date) return c.toISOString()
  return String(c).replace(/\s+/g, ' ').trim()
}

/** Split on commas that are not inside parentheses. */
export function splitTopLevel(s: string, sep = ','): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((x) => x.trim()).filter(Boolean)
}

/** Extract the dates a "day" cell refers to, plus its weekday if present. */
function parseDayCell(c: Cell): { dates: number[]; weekday: number | null } | null {
  if (c instanceof Date) return { dates: [c.getDate()], weekday: c.getDay() }
  if (typeof c === 'number') {
    if (c >= 1 && c <= 31 && Number.isInteger(c)) return { dates: [c], weekday: null }
    if (c > 30000 && c < 80000) {
      const d = new Date(Math.round((c - 25569) * 86400 * 1000))
      return { dates: [d.getUTCDate()], weekday: d.getUTCDay() }
    }
    return null
  }
  const s = text(c).toLowerCase()
  if (!s) return null
  const wdMatch = s.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/)
  const weekday = wdMatch ? WEEKDAYS.indexOf(wdMatch[1]) : null
  let dates: number[] = []
  const full = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/)
  if (full) dates = [parseInt(full[1], 10)]
  else {
    const stripped = s.replace(/\b(19|20)\d{2}\b/g, '')
    dates = (stripped.match(/\d{1,2}/g) ?? []).map(Number).filter((n) => n >= 1 && n <= 31)
  }
  if (!dates.length && weekday === null) return null
  // "Day 1" style labels with no weekday are still treated as dates
  return { dates: [...new Set(dates)], weekday }
}

const ORD = '\\d{1,2}(?:st|nd|rd|th)?'
const MON = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?'
const DATE_LIST = `${ORD}(?:\\s*(?:,|&|and)\\s*${ORD})*`
const DATE_PARENS = new RegExp(`\\(\\s*(${DATE_LIST})\\s*(?:${MON})?\\s*\\)`, 'i')
/** A line inside a cell that is only a date label, e.g. "6th Mar" or "(20th)". */
const DATE_LABEL_LINE = new RegExp(`^\\(?\\s*(${DATE_LIST})\\s*(?:${MON})?\\s*\\)?\\s*:?$`, 'i')
const nums = (s: string) => (s.match(/\d{1,2}/g) ?? []).map(Number)

/**
 * Menus often pack date-specific variants into one cell:
 *   "Veg Puff (1, 29), Boiled Peanuts (15)"
 * Return only what is served on `date`.
 */
export function resolveVariants(cell: string, date: number, blockDates: number[]): string {
  if (blockDates.length < 2) return cell
  const parts = splitTopLevel(cell)
  const tagged = parts.map((p) => {
    const m = p.match(DATE_PARENS)
    if (!m) return { p, dates: null as number[] | null }
    const ds = nums(m[1])
    const valid = ds.length > 0 && ds.every((d) => blockDates.includes(d))
    return { p, dates: valid ? ds : null }
  })
  const taggedCount = tagged.filter((t) => t.dates).length
  if (taggedCount === 0) return cell
  const single = taggedCount === 1 ? tagged.find((t) => t.dates)! : null
  // A single tag covering every date isn't a variant, it's a quantity like "(1)"
  if (single && single.dates!.length === blockDates.length) return cell
  const kept = tagged
    .filter((t) => !t.dates || t.dates.includes(date))
    .map((t) =>
      t.dates
        ? t.p
            .replace(DATE_PARENS, '')
            .replace(/^(and|&)\s+/i, '')
            .replace(/\s{2,}/g, ' ')
            .replace(/\s+-\s*$/, '')
            .trim()
            .replace(/^\(([^()]*)\)$/, '$1')
        : t.p,
    )
    .filter(Boolean)
  return kept.join(', ')
}

function findHeader(rows: Cell[][]): { row: number; cols: Partial<Record<MealKey, number>>; dayCol: number } | null {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const cols: Partial<Record<MealKey, number>> = {}
    rows[r].forEach((c, i) => {
      const t = text(c)
      if (!t || t.length > 40) return
      for (const [meal, re] of MEAL_PATTERNS) {
        if (re.test(t) && cols[meal] === undefined) {
          cols[meal] = i
          break
        }
      }
    })
    if (Object.keys(cols).length >= 2) {
      const used = new Set(Object.values(cols))
      let dayCol = 0
      while (used.has(dayCol)) dayCol++
      return { row: r, cols, dayCol }
    }
  }
  return null
}

function parseSheet(raw: RawSheet): MenuSheet | null {
  const rows = raw.data
  const header = findHeader(rows)
  if (!header) return null
  const sheet: MenuSheet = { name: raw.sheet.trim(), days: {}, weekdays: {} }

  type Line = { t: string; only: number[] | null }
  type Block = {
    dates: number[]
    weekday: number | null
    cells: Record<MealKey, Line[]>
    label: Partial<Record<MealKey, number[]>>
  }
  const menuWidth = Math.max(header.dayCol, ...Object.values(header.cols)) + 1
  const blocks: Block[] = []
  let cur: Block | null = null

  for (let r = header.row + 1; r < rows.length; r++) {
    const row = rows[r] ?? []
    const area = row.slice(0, menuWidth)
    if (area.some((c) => STOP_ROW.test(text(c)))) break
    const day = parseDayCell(row[header.dayCol])
    if (day) {
      cur = { ...day, cells: { breakfast: [], lunch: [], snacks: [], dinner: [] }, label: {} }
      blocks.push(cur)
    }
    if (!cur) continue
    for (const [meal, col] of Object.entries(header.cols) as [MealKey, number][]) {
      const v = row[col]
      if (v === null || v === undefined || v instanceof Date) continue
      String(v)
        .split(/\r?\n/)
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s && s !== '-' && !/^n\/?a$/i.test(s))
        .forEach((s) => {
          const lbl = s.match(DATE_LABEL_LINE)
          if (lbl && cur!.dates.length > 1) cur!.label[meal] = nums(lbl[1])
          else cur!.cells[meal].push({ t: s, only: cur!.label[meal] ?? null })
        })
    }
  }

  for (const b of blocks) {
    if (b.dates.length) {
      for (const d of b.dates) {
        const menu = emptyDay()
        for (const meal of Object.keys(b.cells) as MealKey[]) {
          menu[meal] = b.cells[meal]
            .filter((c) => !c.only || c.only.includes(d))
            .map((c) => resolveVariants(c.t, d, b.dates))
            .filter(Boolean)
        }
        sheet.days[d] = menu
      }
    } else if (b.weekday !== null) {
      const menu = emptyDay()
      for (const meal of Object.keys(b.cells) as MealKey[]) menu[meal] = b.cells[meal].map((c) => c.t)
      sheet.weekdays[b.weekday] = menu
    }
  }
  if (!Object.keys(sheet.days).length && !Object.keys(sheet.weekdays).length) return null
  return sheet
}

export function detectMonthYear(haystack: string): { month: number | null; year: number | null } {
  const s = haystack.toLowerCase()
  let month: number | null = null
  for (let i = 0; i < 12; i++) {
    if (new RegExp(`\\b${MONTHS[i]}\\b|\\b${MONTHS[i].slice(0, 3)}(?=[\\s_\\-.\\d]|$)`).test(s)) {
      month = i + 1
      break
    }
  }
  const y = s.match(/\b(20\d{2})\b/)
  return { month, year: y ? parseInt(y[1], 10) : null }
}

export function parseWorkbook(sheets: RawSheet[], fileName: string): ParseResult {
  const parsed = sheets.map(parseSheet).filter((s): s is MenuSheet => !!s)
  const firstRows = sheets
    .flatMap((s) => s.data.slice(0, 4))
    .flat()
    .map(text)
    .join(' ')
  const titleCell =
    sheets[0]?.data
      .slice(0, 6)
      .flat()
      .map(text)
      .find((t) => /menu/i.test(t) && t.length < 120) ?? ''
  const fromTitle = detectMonthYear(firstRows)
  const fromFile = detectMonthYear(fileName.replace(/[_]/g, ' '))
  return {
    timings: detectTimings(sheets),
    title: titleCell || fileName.replace(/\.[^.]+$/, ''),
    month: fromTitle.month ?? fromFile.month,
    year: fromTitle.year ?? fromFile.year,
    sheets: parsed,
  }
}

/** Plain-text dump of a sheet, used as AI fallback input. */
export function sheetToText(raw: RawSheet, maxChars = 40000): string {
  const lines = raw.data
    .map((row) => row.map(text).join(' | ').replace(/(\s\|\s)+$/, ''))
    .filter((l) => l.replace(/[\s|]/g, ''))
  return lines.join('\n').slice(0, maxChars)
}

export function parseCsv(textIn: string): Cell[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let q = false
  for (let i = 0; i < textIn.length; i++) {
    const ch = textIn[i]
    if (q) {
      if (ch === '"' && textIn[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') q = false
      else field += ch
    } else if (ch === '"') q = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && textIn[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.map((r) => r.map((c) => (c.trim() === '' ? null : c)))
}

function toMinutes(h: number, m: number, ap: string | undefined): number {
  let hh = h % 12
  if (ap?.toLowerCase().startsWith('p')) hh += 12
  else if (!ap && h >= 1 && h < 6) hh += 12
  return hh * 60 + m
}

/** Finds a "MESS TIMINGS" style table: a meal label with "7.15 AM to 9 AM" next to it. */
export function detectTimings(sheets: RawSheet[]): Timings {
  const out: Timings = {}
  const range = /(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)?\s*(?:to|-|–)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)?/i
  for (const sh of sheets) {
    for (const row of sh.data.slice(0, 60)) {
      row.forEach((c, i) => {
        const t = text(c)
        if (!t || t.length > 20) return
        const meal = MEAL_PATTERNS.find(([, re]) => re.test(t))?.[0]
        if (!meal || out[meal]) return
        for (const n of row.slice(i + 1, i + 3)) {
          const m = text(n).match(range)
          if (!m) continue
          const endAp = m[6] ?? m[3]
          out[meal] = {
            start: toMinutes(+m[1], +(m[2] ?? 0), m[3] ?? endAp),
            end: toMinutes(+m[4], +(m[5] ?? 0), endAp),
          }
          break
        }
      })
    }
    if (Object.keys(out).length) break
  }
  return out
}
