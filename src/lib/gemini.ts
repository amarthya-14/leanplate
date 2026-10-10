import type { ParseResult } from './menuParser'
import { emptyDay } from './menuParser'
import type { Targets } from './nutrition'
import { ACTIVITY, MEAL_SHARE, PACE } from './nutrition'
import type { DayMenu, MealKey, MealPlan, MenuSheet, Profile } from './types'
import { MEALS } from './types'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const DEFAULT_MODEL = 'gemini-2.5-flash'

export class GeminiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

export interface Turn {
  role: 'user' | 'model'
  text: string
}

interface GenOpts {
  apiKey: string
  model: string
  system?: string
  turns: Turn[]
  json?: boolean
  temperature?: number
  signal?: AbortSignal
}

function body(o: GenOpts) {
  return JSON.stringify({
    ...(o.system ? { systemInstruction: { parts: [{ text: o.system }] } } : {}),
    contents: o.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: {
      temperature: o.temperature ?? 0.6,
      ...(o.json ? { responseMimeType: 'application/json' } : {}),
    },
  })
}

async function explain(res: Response): Promise<GeminiError> {
  let msg = `Gemini error ${res.status}`
  try {
    const j = await res.json()
    msg = j?.error?.message ?? msg
  } catch {
    /* ignore */
  }
  if (res.status === 404) msg = `Model not available for your key. Open Settings → Gemini and pick another model. (${msg})`
  if (res.status === 400 && /API key/i.test(msg)) msg = 'That API key was rejected. Double-check it in Settings.'
  if (res.status === 429) msg = 'Rate limit hit on the free tier. Wait a minute and try again.'
  return new GeminiError(msg, res.status)
}

type Part = { text?: string; thought?: boolean }
const partsText = (parts: Part[] | undefined) =>
  (parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')

export async function generate(o: GenOpts): Promise<string> {
  if (!o.apiKey) throw new GeminiError('Add your Gemini API key in Settings first.')
  const res = await fetch(`${BASE}/models/${o.model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': o.apiKey },
    body: body(o),
    signal: o.signal,
  })
  if (!res.ok) throw await explain(res)
  const j = await res.json()
  const text = partsText(j?.candidates?.[0]?.content?.parts)
  if (!text) {
    const reason = j?.promptFeedback?.blockReason ?? j?.candidates?.[0]?.finishReason
    throw new GeminiError(reason ? `Gemini returned nothing (${reason}).` : 'Gemini returned an empty response.')
  }
  return text
}

export async function* stream(o: GenOpts): AsyncGenerator<string> {
  if (!o.apiKey) throw new GeminiError('Add your Gemini API key in Settings first.')
  const res = await fetch(`${BASE}/models/${o.model}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': o.apiKey },
    body: body(o),
    signal: o.signal,
  })
  if (!res.ok || !res.body) throw await explain(res)
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line.startsWith('data:')) continue
      try {
        const j = JSON.parse(line.slice(5))
        const t = partsText(j?.candidates?.[0]?.content?.parts)
        if (t) yield t
      } catch {
        /* partial line */
      }
    }
  }
}

export async function listModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } })
  if (!res.ok) throw await explain(res)
  const j = await res.json()
  return (j.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[]; name: string }) =>
      m.supportedGenerationMethods?.includes('generateContent') && /gemini/i.test(m.name) && !/embed|image|tts|audio|live|vision/i.test(m.name),
    )
    .map((m: { name: string }) => m.name.replace(/^models\//, ''))
    .sort((a: string, b: string) => rankModel(b) - rankModel(a) || b.localeCompare(a))
}

function rankModel(m: string) {
  const v = parseFloat(m.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0')
  return v * 10 + (/flash/.test(m) ? 3 : 0) + (/lite/.test(m) ? -1 : 0) + (/preview|exp/.test(m) ? -2 : 0)
}

export function parseJson<T>(raw: string): T {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a >= 0 && b > a) s = s.slice(a, b + 1)
  return JSON.parse(s) as T
}

// ── Prompts ─────────────────────────────────────────────────────────

const DIET_TEXT = { veg: 'vegetarian (no egg, no meat)', egg: 'eggetarian (eggs ok, no meat/fish)', nonveg: 'non-vegetarian' }

export function profileBrief(p: Profile, t: Targets, currentKg: number) {
  return [
    `Name: ${p.name || 'the user'}; ${p.sex}, ${p.age} y, ${p.heightCm} cm.`,
    `Weight now ${currentKg} kg (started ${p.startKg} kg), goal ${p.goalKg} kg, pace ${PACE[p.pace].kgPerWeek} kg/week.`,
    `Activity: ${ACTIVITY[p.activity].label}. Diet: ${DIET_TEXT[p.diet]}.`,
    `Daily targets: ${t.kcal} kcal (TDEE ≈ ${t.tdee}), protein ${t.protein} g, added sugar under ${t.sugarG} g.`,
    `Lives in a college hostel and eats from the mess (South-Indian, Andhra-style menu). Struggles with sugar cravings.`,
    p.notes ? `Extra notes from user: ${p.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

const PLAN_SYSTEM = `You are a precise, practical sports nutritionist who knows Indian hostel mess food very well (pulka, pappu, sambar, rasam, poriyal, pulihora, curd, etc.).
Your job: from today's mess menu, build the plate for each meal that helps the user lose fat without feeling deprived, and kill sugar cravings.
Rules:
- Only pick items that are actually on the menu for that meal. Respect the diet strictly.
- Portions in mess units: pcs (roti/pulka/idli/dosa), cups of cooked rice, katori (≈150 ml bowl), glass, plate of salad.
- Prioritise protein and fibre: salad, dal/pappu, eggs/chicken/paneer/soya/chana, curd, sabzi. Carbs fill what's left.
- Skip or strictly limit: sweets, sugary drinks/juices, deep-fried snacks, papad/fryums, ghee+podi, pickle, bread-butter-jam.
- Calorie numbers must be realistic for mess cooking (oily). Use whole numbers.
- Notes are short (max 10 words), warm, direct. No emojis. No moralising.
- Respond with JSON only.`

export function planPrompt(dateLabel: string, menu: DayMenu, t: Targets) {
  const budget = MEALS.map((m) => `${m}: ~${Math.round(t.kcal * MEAL_SHARE[m])} kcal`).join(', ')
  return `Date: ${dateLabel}
Meal budgets (soft): ${budget}. Daily total should land within ±100 kcal of ${t.kcal}, protein as close to ${t.protein} g as the menu allows.

TODAY'S MESS MENU
${MEALS.map((m) => `${m.toUpperCase()}:\n${(menu[m] ?? []).map((i) => `- ${i}`).join('\n') || '- (nothing listed)'}`).join('\n\n')}

Return exactly this JSON shape:
{
  "summary": "2 sentences: what today looks like and the single biggest trap to avoid",
  "meals": {
    "breakfast": { "picks": [{"item": "...", "portion": "2 pcs", "kcal": 0, "protein": 0, "note": "optional"}], "skip": [{"item": "...", "reason": "max 8 words"}], "tip": "one actionable line" },
    "lunch": { ... }, "snacks": { ... }, "dinner": { ... }
  }
}`
}

export async function aiPlanDay(o: { apiKey: string; model: string; brief: string; dateLabel: string; menu: DayMenu; targets: Targets }) {
  const raw = await generate({
    apiKey: o.apiKey,
    model: o.model,
    system: PLAN_SYSTEM + '\n\nUSER PROFILE\n' + o.brief,
    turns: [{ role: 'user', text: planPrompt(o.dateLabel, o.menu, o.targets) }],
    json: true,
    temperature: 0.4,
  })
  const j = parseJson<{ summary?: string; meals?: Partial<Record<MealKey, Partial<MealPlan>>> }>(raw)
  const meals = {} as Record<MealKey, MealPlan>
  for (const m of MEALS) {
    const mp = j.meals?.[m] ?? {}
    meals[m] = {
      picks: (mp.picks ?? []).map((p) => ({
        item: String(p.item ?? ''),
        portion: String(p.portion ?? ''),
        kcal: Math.round(Number(p.kcal) || 0),
        protein: Math.round(Number(p.protein) || 0),
        note: p.note ? String(p.note) : undefined,
      })),
      skip: (mp.skip ?? []).map((s) => ({ item: String(s.item ?? ''), reason: String(s.reason ?? '') })),
      tip: mp.tip ? String(mp.tip) : undefined,
    }
  }
  return { meals, summary: j.summary ?? '' }
}

export async function aiEstimate(o: { apiKey: string; model: string; text: string; diet: string }) {
  const raw = await generate({
    apiKey: o.apiKey,
    model: o.model,
    system:
      'You estimate calories and protein for food eaten in an Indian college hostel / campus canteen. Be realistic about oil. Respond with JSON only.',
    turns: [
      {
        role: 'user',
        text: `Food eaten: "${o.text}"
Return: {"items":[{"name":"...","qty":"2 pcs","kcal":0,"protein":0}],"kcal":0,"protein":0,"comment":"max 15 words, kind and practical, mention sugar if relevant"}`,
      },
    ],
    json: true,
    temperature: 0.2,
  })
  const j = parseJson<{ items?: { name: string; qty: string; kcal: number; protein: number }[]; kcal?: number; protein?: number; comment?: string }>(raw)
  const items = (j.items ?? []).map((i) => ({ name: i.name, qty: i.qty, kcal: Math.round(+i.kcal || 0), protein: Math.round(+i.protein || 0) }))
  return {
    items,
    kcal: Math.round(j.kcal ?? items.reduce((s, i) => s + i.kcal, 0)),
    protein: Math.round(j.protein ?? items.reduce((s, i) => s + i.protein, 0)),
    comment: j.comment ?? '',
  }
}

export async function aiParseMenu(o: { apiKey: string; model: string; sheets: { name: string; text: string }[]; fileName: string }): Promise<ParseResult> {
  const raw = await generate({
    apiKey: o.apiKey,
    model: o.model,
    system: 'You convert messy hostel mess-menu spreadsheets into clean JSON. Respond with JSON only.',
    turns: [
      {
        role: 'user',
        text: `File: ${o.fileName}
Below are the sheets as pipe-separated rows. For every day of the month, list the dishes per meal. If a row says something like "Mon 5, 19" it applies to all those dates. If an item has date-specific variants like "Veg Puff (1, 29), Peanuts (15)" keep only the right one per date. If the menu is weekly without dates, use keys "sun".."sat" instead of numbers.

${o.sheets.map((s) => `### SHEET: ${s.name}\n${s.text}`).join('\n\n')}

Return: {"month": 1-12 or null, "year": 2026 or null, "title": "...", "sheets": [{"name": "sheet name", "days": {"1": {"breakfast": [], "lunch": [], "snacks": [], "dinner": []}}}]}`,
      },
    ],
    json: true,
    temperature: 0,
  })
  const j = parseJson<{ month?: number; year?: number; title?: string; sheets?: { name: string; days: Record<string, Partial<DayMenu>> }[] }>(raw)
  const wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const sheets: MenuSheet[] = (j.sheets ?? []).map((s) => {
    const out: MenuSheet = { name: s.name, days: {}, weekdays: {} }
    for (const [k, v] of Object.entries(s.days ?? {})) {
      const d = emptyDay()
      for (const m of MEALS) d[m] = (v[m] ?? []).map(String).filter(Boolean)
      const n = parseInt(k, 10)
      if (n >= 1 && n <= 31) out.days[n] = d
      else if (wd.includes(k.slice(0, 3).toLowerCase())) out.weekdays[wd.indexOf(k.slice(0, 3).toLowerCase())] = d
    }
    return out
  })
  return { title: j.title ?? o.fileName, month: j.month ?? null, year: j.year ?? null, sheets, timings: {} }
}

export function coachSystem(brief: string, context: string) {
  return `You are the user's personal fat-loss coach inside an app called Leanplate. You are a calm, sharp, evidence-based nutritionist and habit coach — like a good friend who happens to be an expert.

Style:
- Short and specific. Use the actual mess menu items and numbers. Bullets when listing.
- Mess units: pcs, cups of rice, katori, glass.
- Never preachy, never cringe, no emojis, no "Great question!". Light humour is fine.
- For sugar cravings: be practical — acknowledge, give a 2-minute action, a swap available in a hostel, and a reason that makes sense.
- If the user slipped, no guilt; tell them exactly what to do for the next meal.
- You are not a doctor; flag genuinely medical issues briefly.

USER PROFILE
${brief}

LIVE CONTEXT
${context}`
}
