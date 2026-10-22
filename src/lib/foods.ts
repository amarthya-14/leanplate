import { splitTopLevel } from './menuParser'
import { MEAL_SHARE } from './nutrition'
import type { DayMenu, Diet, MealKey, MealPlan, PlanItem, SkipItem } from './types'

export type Kind =
  | 'protein'
  | 'dal'
  | 'dairy'
  | 'veg'
  | 'salad'
  | 'soup'
  | 'fruit'
  | 'carb'
  | 'drink'
  | 'condiment'
  | 'fried'
  | 'refined'
  | 'sweet'
  | 'unknown'

export type Verdict = 'good' | 'limit' | 'skip'

export interface Food {
  re: RegExp
  kind: Kind
  /** kcal / protein for ONE unit */
  kcal: number
  protein: number
  unit: string
  /** default quantity in a plan */
  qty: number
  max?: number
  step?: number
  /** 0–10: how well it fits a fat-loss plate */
  score: number
  meat?: boolean
  egg?: boolean
  why?: string
}

const F = (
  re: RegExp,
  kind: Kind,
  kcal: number,
  protein: number,
  unit: string,
  score: number,
  extra: Partial<Food> = {},
): Food => ({ re, kind, kcal, protein, unit, qty: 1, score, ...extra })

// Order matters: first match wins, so specific patterns come first.
export const FOODS: Food[] = [
  // ── Tricky names that contain other keywords ─────────────────────
  F(/sweet lime|mosambi/i, 'fruit', 60, 1, 'pc', 9),
  F(/sweet potato/i, 'veg', 130, 2, 'cup', 7),
  F(/sweet ?corn soup|corn soup/i, 'soup', 110, 3, 'bowl', 7),
  F(/peanut butter/i, 'condiment', 95, 4, 'tbsp', 4, { why: 'Calorie-dense; one thin layer max' }),

  // ── Sweets & sugary drinks ───────────────────────────────────────
  F(/custard|pudding/i, 'sweet', 190, 4, 'cup', 0),
  F(/ice ?cream|kulfi|chocobar|\bcone\b|frozen dessert/i, 'sweet', 180, 3, 'scoop', 0),
  F(/payasam|kheer|basundi|rabri|halwa|kesari|sheera|laddu|ladoo|jalebi|jamun|mysore ?pak|tukda|tukra|ka meetha|rasgulla|rasagulla|rasmalai|barfi|burfi|peda|cake|pastry|brownie|muffin|donut|doughnut|bobbatlu|poornam|kova|khova|chikki|sweet\b|gulkand|shrikhand|malpua|sandesh|soan/i,
    'sweet', 230, 3, 'serving', 0, { why: 'Added sugar — this is exactly what keeps the cravings alive' }),
  F(/juice|sharbath|sharbat|sherbet|badam milk|rose milk|lassi|milk ?shake|shake\b|horlicks|boost|bournvita|chocos|corn ?flakes|cold coffee|frooti|soft drink|cola|nannari/i,
    'sweet', 150, 3, 'glass', 1, { why: 'Liquid sugar — no fullness, straight spike' }),

  // ── Condiments & sides ──────────────────────────────────────────
  F(/pickle|avakaya|avakai|achar|thokku|uragaya/i, 'condiment', 30, 0, 'tsp', 2, { why: 'Mostly oil and salt — water retention' }),
  F(/coconut .*chutney|chutney.*coconut/i, 'condiment', 60, 1, 'tbsp', 4),
  F(/chutney|pachadi|thogayal|thuvaiyal|raita? chutney/i, 'condiment', 45, 1, 'tbsp', 5),
  F(/\bpodi\b(?! ?(dosa|idl|uttap))|\bkaram\b(?! ?dosa)|gun ?powder/i, 'condiment', 45, 2, 'tsp', 2, { why: 'Podi is always eaten with ghee — ~100 kcal per spoon' }),
  F(/^\W*ghee\W*$/i, 'condiment', 45, 0, 'tsp', 1, { why: 'Pure fat, ~45 kcal a spoon' }),
  F(/^\W*(amul |salted )?butter\W*$/i, 'condiment', 36, 0, 'tsp', 1, { why: 'Pure fat' }),
  F(/\bjam\b/i, 'sweet', 50, 0, 'tbsp', 0, { why: 'Basically sugar syrup' }),
  F(/sauce|ketchup|mayo/i, 'condiment', 20, 0, 'tbsp', 2, { why: 'Ketchup is ~25% sugar' }),
  F(/papad|appalam|fryums|vadiyalu|vadam|onion rings|golden fingers/i, 'fried', 90, 1, 'pc', 1, { why: 'Deep-fried filler, zero fullness' }),
  F(/potato chips|\bchips\b|french fries/i, 'fried', 160, 2, 'serving', 0, { why: 'Deep-fried potato' }),
  F(/^onions?$|^onion (small|pieces|slices)|salt mirchi|green chilli|lemon wedge|^lemon$/i, 'salad', 10, 0, 'serving', 8),

  // ── Drinks ──────────────────────────────────────────────────────
  F(/butter ?milk|majiga(?! pulusu)|chaas|chhach|spiced milk/i, 'dairy', 40, 2, 'glass', 9),
  F(/lemon water|nimbu|sabja|chia/i, 'drink', 15, 0, 'glass', 9),
  F(/ragi malt|ambali|ragi java/i, 'carb', 110, 3, 'glass', 7),
  F(/\btea\b|cof+e+|\bmilk\b/i, 'drink', 90, 4, 'cup', 6, { why: 'Fine without sugar' }),

  // ── Soups ───────────────────────────────────────────────────────
  F(/creamy|cream of/i, 'soup', 160, 3, 'bowl', 4),
  F(/rasam|soup|charu|chaaru|pachi pulusu/i, 'soup', 60, 2, 'bowl', 8),

  F(/sprout/i, 'protein', 90, 6, 'cup', 10),
  // ── Protein-rich salads ─────────────────────────────────────────
  F(/(chana|channa|chickpea|chick pea|sprout|peanut|moong|rajma|corn).*(salad|chaat|sundal)|(salad|sundal).*(chana|chickpea)|boiled (chana|channa|chickpeas?|peanuts?)/i,
    'protein', 150, 8, 'cup', 9),
  F(/salad|kachumber|kosambari|cucumber|beetroot (&|and) carrot|carrot (&|and) cucumber/i, 'salad', 35, 1, 'plate', 10),

  // ── Fried & refined (before proteins so "chole bhature" etc. land here) ──
  F(/bhatur/i, 'fried', 250, 6, 'pc', 1, { why: 'Deep-fried maida — ~250 kcal each' }),
  F(/vada ?pav|pav ?bhaji|\bpav\b/i, 'refined', 300, 7, 'serving', 2, { why: 'Maida bun + buttery masala' }),
  F(/pani ?p[ou]ri|dahi ?p[ou]ri|papdi|ragda|bhel|\bsev\b|cha+t\b|chat$|chaat/i, 'refined', 280, 6, 'plate', 2, { why: 'Fried puris + sweet chutney' }),
  F(/maggi|noodles|pasta|macaroni|pizza|burger|sandwich|fried rice|schezwan|hakka/i, 'refined', 280, 6, 'cup', 2, { why: 'Refined carbs + oil, digests in no time' }),
  F(/sambar vada|sambar vadai/i, 'fried', 150, 4, 'pc', 3, { why: 'Fried — if you must, 1 piece' }),
  F(/dahi vada/i, 'fried', 160, 5, 'pc', 3, { why: 'Fried dough in sweet curd' }),
  F(/poori|\bpuri\b/i, 'fried', 110, 2, 'pc', 2, { max: 2, why: 'Deep-fried — ~110 kcal each' }),
  F(/manchuria|manchurian|\b65\b|crispy|chilli (paneer|chicken|gobi|baby ?corn)/i, 'fried', 280, 8, 'serving', 2, { why: 'Battered and deep-fried' }),
  F(/samosa|kachori|puff/i, 'fried', 260, 5, 'pc', 1, { why: 'Pastry + potato, ~260 kcal each' }),
  F(/punugulu|pakoda|pakora|pakodi|bonda|bajji|bhajji|bhaji(?! pav)|fritter|cutlet|mirchi|vada|vadai|wada|deep ?fry/i,
    'fried', 120, 3, 'pc', 2, { why: 'Deep-fried batter soaks up oil' }),

  // ── Meat / fish / egg ───────────────────────────────────────────
  F(/(chicken|mutton|fish|prawn|egg).*biryani|biryani.*(chicken|mutton)/i, 'carb', 450, 22, 'cup', 4, { meat: true, max: 1 }),
  F(/fish/i, 'protein', 230, 24, 'serving', 9, { meat: true }),
  F(/chicken|mutton|prawn|\bmeat\b|keema|kheema/i, 'protein', 290, 30, 'serving', 9, { meat: true }),
  F(/boiled egg|egg boiled|^eggs?$/i, 'protein', 75, 6, 'egg', 10, { egg: true, qty: 2, max: 3 }),
  F(/egg.*curry|egg.*masala|egg bhujji curry/i, 'protein', 115, 7, 'egg', 8, { egg: true, qty: 2, max: 2 }),
  F(/om[e]?l[e]?t|omelette/i, 'protein', 190, 12, 'pc', 8, { egg: true }),
  F(/egg|scrambled|bhurji|burji|bhujji/i, 'protein', 160, 11, 'serving', 8, { egg: true }),

  // ── Vegetarian protein ──────────────────────────────────────────
  F(/(paneer|mushroom|soya|veg|vegetable).*biryani|biryani/i, 'carb', 320, 7, 'cup', 3, { max: 1 }),
  F(/paneer|panneer/i, 'protein', 280, 15, 'serving', 8),
  F(/soya|meal maker/i, 'protein', 190, 16, 'katori', 9),
  F(/chole|chola|chana|channa|chickpea|rajma|red beans|kidney|lobia|black ?eyed|ulava|horse ?gram|sundal|peanuts?|green gram|pesalu|moong(?! dal)|sprout/i,
    'protein', 180, 9, 'katori', 9),
  F(/mushroom/i, 'veg', 140, 5, 'katori', 7),

  // ── Carbs ───────────────────────────────────────────────────────
  F(/khichdi|kichdi|kitchidi|kichadi|khichadi/i, 'carb', 220, 8, 'cup', 7, { step: 0.5, max: 1.5 }),
  F(/dal makhani|dal maharani/i, 'dal', 220, 9, 'katori', 6),
  F(/sambar|samber|sambhar/i, 'dal', 110, 5, 'katori', 8),
  F(/\bdal\b|\bdaal\b|dhal|pappu|lentil|kootu/i, 'dal', 150, 7, 'katori', 9),
  F(/curd rice|daddojanam/i, 'carb', 220, 6, 'cup', 5, { step: 0.5, max: 1 }),
  F(/curd|dahi|yogh?urt|raita|raitha|perugu/i, 'dairy', 100, 6, 'katori', 9),
  F(/paratha|parotta|lacha|kulcha|naan/i, 'carb', 220, 5, 'pc', 3, { max: 2, why: 'Layered with oil/ghee' }),
  F(/pulka|phulka/i, 'carb', 70, 2.5, 'pc', 9, { max: 4 }),
  F(/chapath?i|chapati|roti|rotti/i, 'carb', 90, 3, 'pc', 8, { max: 4 }),
  F(/idl[iy]/i, 'carb', 60, 2, 'pc', 7, { max: 4 }),
  F(/pesarattu|adai|ragi dosa|multi ?grain dosa|oats dosa/i, 'carb', 140, 6, 'pc', 8, { max: 3 }),
  F(/ghee.*dosa|dosa.*ghee|ghee roast|podi dosa|butter dosa/i, 'carb', 230, 4, 'pc', 3, { max: 2, why: 'Dosa roasted in ghee' }),
  F(/masala dosa/i, 'carb', 220, 5, 'pc', 5, { max: 2 }),
  F(/dosa|dosai/i, 'carb', 130, 3, 'pc', 6, { max: 3 }),
  F(/ut+h?ap+am|uttappa/i, 'carb', 170, 4, 'pc', 6, { max: 2 }),
  F(/daliya|dalia|oats|ragi|millet|jowar|bajra|quinoa/i, 'carb', 180, 6, 'cup', 8, { max: 1.5, step: 0.5 }),
  F(/upma|uggani|poha|atukulu|khara bath|kara bath|sevai|shavige|semiya|vermicelli|rava|sooji/i, 'carb', 220, 5, 'cup', 6, { max: 1.5, step: 0.5 }),
  F(/pongal/i, 'carb', 260, 7, 'cup', 5, { max: 1, step: 0.5 }),
  F(/muesli|museli|granola/i, 'carb', 220, 6, 'bowl', 5),
  F(/brown bread|wheat bread|multigrain bread/i, 'carb', 70, 3, 'slice', 6, { qty: 2, max: 2 }),
  F(/bread|toast/i, 'carb', 75, 2, 'slice', 4, { qty: 2, max: 2 }),
  F(/pulihora|tamarind rice|jeera rice|pudina rice|tomato rice|lemon rice|coconut rice|bagara|bhagara|carrot rice|pulav|pulao|bisi ?bele|bisbel|bisibel|veg rice|ghee rice|kaju rice/i,
    'carb', 260, 5, 'cup', 4, { step: 0.5, max: 1 }),
  F(/rice/i, 'carb', 200, 4, 'cup', 5, { step: 0.5, max: 1.5 }),
  F(/corn/i, 'carb', 150, 4, 'cup', 6),

  // ── Vegetables ──────────────────────────────────────────────────
  F(/aloo|potato|arbi|colocasia|yam|raw banana|plantain/i, 'veg', 170, 3, 'katori', 5),
  F(/curry|fry|poriyal|stir|masala|kurma|korma|sabzi|sabji|kura|koora|pulusu|thoran|vepudu|gravy|kadai|kadhai|pyaza|bhindi|gourd|cabbage|beans|brinjal|vankaya|baingan|gobi|cauliflower|palak|spinach|methi|dondakaya|beerakaya|bendakaya|okra|ladies finger|pumpkin|squash|carrot|beetroot|lauki|capsicum|mutter|peas|tindora|salan|veg/i,
    'veg', 130, 3, 'katori', 7),

  // ── Fruit (last so "mango pickle", "mango dal" match earlier) ────
  F(/banana/i, 'fruit', 100, 1, 'pc', 8),
  F(/fruit|apple|guava|papaya|watermelon|muskmelon|melon|pine ?apple|grapes|pomegranate|chikoo|sapota|orange|mango|pear|kiwi|plum/i,
    'fruit', 70, 1, 'cup', 9),
]

const UNKNOWN: Food = F(/./, 'unknown', 150, 4, 'katori', 5)

export function classify(name: string): Food {
  return FOODS.find((f) => f.re.test(name)) ?? UNKNOWN
}

export function verdict(f: Food): Verdict {
  if (f.kind === 'sweet' || f.kind === 'refined' || (f.kind === 'fried' && f.score <= 2)) return 'skip'
  if (f.kind === 'condiment' || f.kind === 'fried' || f.score <= 4) return 'limit'
  return 'good'
}

// ── Diet filtering ──────────────────────────────────────────────────
const MEAT = /chicken|mutton|fish|prawn|\bmeat\b|keema|kheema|\bnv\b|non[- ]?veg/i
const EGG = /\begg(?!\s*-?\s*less)|om[e]?l[e]?t|omelette|bhurji(?!.*paneer)|burji/i
const VEG_TAG = /\((veg|v)\)/i

export function isMeat(s: string) {
  return MEAT.test(s) && !/\(veg\)/i.test(s) && !(/\bnv\b|non[- ]?veg/i.test(s) && EGG.test(s) && !/chicken|mutton|fish|prawn|meat/i.test(s))
}
export function isEgg(s: string) {
  return EGG.test(s) && !/paneer bhurji/i.test(s)
}

export function allowed(s: string, diet: Diet) {
  if (diet === 'nonveg') return true
  if (isMeat(s)) return false
  if (diet === 'veg' && isEgg(s)) return false
  return true
}

const clean = (s: string) =>
  s
    .replace(/\((non[- ]?veg|nv|veg|v)\)/gi, '')
    .replace(/\(must be kept sep[ae]rately\)|\(sep[a]?rately\)|\(seprately\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,–-]+|[\s,–-]+$/g, '')
    .trim()

export interface Atom {
  label: string
  food: Food
}

/** "Chicken curry / Paneer curry" → both choices; "Puri/Bhaji" stays one dish. */
function alternatives(part: string) {
  const hasAlt = / \/ |\/ | \/|\//.test(part) && (/ \/|\/ /.test(part) || MEAT.test(part) || EGG.test(part) || VEG_TAG.test(part))
  return hasAlt ? part.split('/').map((a) => a.trim()).filter(Boolean) : [part]
}

const dishParts = (line: string) => splitTopLevel(line).flatMap((p) => splitTopLevel(p, '+'))

/** Break a menu line into individual dishes, applying diet and picking the best alternative. */
export function atomize(line: string, diet: Diet): Atom[] {
  const out: Atom[] = []
  for (const part of dishParts(line)) {
    const ok = alternatives(part).filter((a) => allowed(a, diet))
    if (!ok.length) continue
    const ranked = ok
      .map((a) => ({ label: clean(a), food: classify(a) }))
      .sort((a, b) => b.food.protein * 2 + b.food.score * 10 - (a.food.protein * 2 + a.food.score * 10))
    const best = ranked[0]
    if (!best.label) continue
    out.push(best)
  }
  return out
}

// ── Portion text helpers ────────────────────────────────────────────
const FRACTIONS: Record<string, string> = { '0.5': '½', '1.5': '1½', '2.5': '2½' }
export function portionText(qty: number, unit: string) {
  const q = FRACTIONS[String(qty)] ?? String(qty)
  const plural = qty > 1 && !['katori', 'serving'].includes(unit) ? (unit === 'glass' ? 'es' : unit.endsWith('s') ? '' : 's') : ''
  const u = unit === 'pc' ? (qty > 1 ? 'pcs' : 'pc') : unit + plural
  return `${q} ${u}`
}

function pick(a: Atom, qty = a.food.qty, note?: string): PlanItem {
  return {
    item: a.label,
    portion: portionText(qty, a.food.unit),
    kcal: Math.round(a.food.kcal * qty),
    protein: Math.round(a.food.protein * qty),
    note: note ?? (a.food.why && a.food.kind === 'drink' ? 'No sugar' : undefined),
  }
}

function skip(a: Atom, extra?: string): SkipItem {
  const f = a.food
  let reason = f.why ?? ''
  if (!reason) {
    if (f.kind === 'sweet') reason = 'Added sugar — the craving trap'
    else if (f.kind === 'fried') reason = `Deep-fried · ~${f.kcal} kcal each`
    else if (f.kind === 'refined') reason = 'Refined carbs, low fullness'
    else if (f.kind === 'condiment') reason = 'Adds oil and salt without filling you up'
    else if (f.kind === 'carb') reason = 'You already have a better carb on the plate'
    else if (f.kind === 'fruit') reason = 'Over budget here — carry it back for the 5 pm craving'
    else if (f.kind === 'drink') reason = 'Not needed'
    else reason = 'Plate is full for your budget — only as a swap'
  }
  return { item: a.label, reason: extra ?? reason }
}

const MEAL_TIPS: Record<MealKey, string[]> = {
  breakfast: [
    'Protein first: eggs or sprouts before the carbs keep you full till lunch.',
    'Skip the bread-jam corner entirely; it is the easiest 250 kcal of the day.',
    'Black coffee or tea without sugar — ask for it before they pour.',
  ],
  lunch: [
    'Eat in order: salad → dal/protein → sabzi → carbs last. It blunts the sugar spike.',
    'Fill half the plate with salad and sabzi before touching rice.',
    'Put the spoon down between bites; fullness takes ~20 minutes to register.',
  ],
  snacks: [
    'This is the danger window for cravings. Tea without sugar plus a fruit you saved from lunch is ideal.',
    'Hungry? A handful of roasted chana or peanuts beats anything fried here.',
    'Walk to the mess, take your tea, walk back — skip the fried counter.',
  ],
  dinner: [
    'Lighter carbs at night: rotis over rice, and stop at the planned count.',
    'Curd at dinner helps — protein plus it settles the sweet craving.',
    'Finish dinner at least 2 hours before bed; brush your teeth right after to close the kitchen.',
  ],
}

function dayHash(seed: string) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

/** Rule-based plate builder used when Gemini isn't configured (or as a fallback). */
export function planMeal(meal: MealKey, lines: string[], budget: number, diet: Diet, seed = ''): MealPlan {
  const atoms = lines.flatMap((l) => atomize(l, diet))
  const picks: PlanItem[] = []
  const skips: SkipItem[] = []
  const used = new Set<Atom>()
  const take = (a: Atom, qty?: number, note?: string) => {
    picks.push(pick(a, qty, note))
    used.add(a)
  }
  const by = (k: Kind) => atoms.filter((a) => a.food.kind === k).sort((x, y) => y.food.score - x.food.score)
  const total = () => picks.reduce((s, p) => s + p.kcal, 0)

  const carbs = by('carb').filter((a) => a.food.score >= 4)
  const carbFloor = meal === 'snacks' || !carbs[0] ? 0 : Math.min(...carbs.map((c) => c.food.kcal * (c.food.unit === 'pc' || c.food.unit === 'slice' ? 1 : c.food.step ?? 1)))
  /** Add only if it still leaves room for the minimum carb portion. */
  const fits = (kcal: number) => total() + kcal <= budget - carbFloor

  const salads = by('salad')
  if (salads[0] && salads[0].food.kcal > 15) take(salads[0], 1, 'Eat this first, as much as you like')
  salads.forEach((a) => used.add(a))

  const proteins = by('protein').sort((x, y) => y.food.protein * 2 + y.food.score * 10 - (x.food.protein * 2 + x.food.score * 10))
  const mainProtein = proteins[0]
  if (mainProtein) take(mainProtein)
  if (proteins[1] && meal === 'breakfast' && fits(proteins[1].food.kcal * proteins[1].food.qty)) take(proteins[1])

  const dals = by('dal')
  if (dals[0] && meal !== 'snacks') {
    const strong = mainProtein && mainProtein.food.protein * mainProtein.food.qty >= 15
    const qty = strong && dals[0].food.score < 8 ? 0.5 : 1
    take(dals[0], qty, mainProtein ? undefined : 'Main protein source of this meal')
  }

  const veg = by('veg')
  if (veg[0] && meal !== 'snacks') take(veg[0])

  const soup = by('soup')[0]
  if (soup && soup.food.kcal <= 80) take(soup, 1, 'Great filler, very low calorie')

  // Nice-to-haves, in priority order, only while there is budget
  const optional: [Atom | undefined, number, string | undefined][] = [
    [by('dairy')[0], 1, undefined],
    [by('fruit')[0], 1, undefined],
    [dals[1] && !mainProtein && meal !== 'snacks' ? dals[1] : undefined, 1, undefined],
    [meal !== 'breakfast' && meal !== 'snacks' && veg[1]?.food.score >= 7 ? veg[1] : undefined, 0.5, undefined],
    [by('dairy')[1], 1, undefined],
  ]
  for (const [a, qty, note] of optional) if (a && fits(a.food.kcal * qty)) take(a, qty, note)

  const drinks = by('drink')
  drinks.forEach((a) => used.add(a))
  const drink = drinks[0]
  if (drink) {
    if (drink.food.kcal <= 30) take(drink)
    else if (fits(drink.food.kcal) || meal === 'breakfast' || meal === 'snacks') take(drink, 1, 'No sugar — ask before they pour')
    else take(drink, 0.5, 'Half cup, no sugar — or skip')
  }

  // Carbs fill whatever budget is left, best quality first
  const remaining = budget - total()
  if (carbs[0] && meal !== 'snacks') {
    const c = carbs[0].food
    const step = c.step ?? 1
    const max = c.max ?? 3
    let qty = Math.floor(remaining / c.kcal / step) * step
    qty = Math.max(c.unit === 'pc' || c.unit === 'slice' ? 1 : step, Math.min(max, qty))
    take(carbs[0], qty, remaining < c.kcal * 1.5 ? 'Keep it to this — budget is tight' : undefined)
    const left = budget - total()
    const rice = carbs.find((a) => a !== carbs[0] && /rice/i.test(a.label) && a.food.kcal <= 200)
    if (rice && left >= 100 && meal !== 'breakfast') take(rice, 0.5, 'Optional — only if still hungry')
  } else if (meal === 'breakfast' && !carbs[0]) {
    const fallback = atoms.find((a) => a.food.kind === 'fried' && a.food.unit === 'pc' && a.food.score >= 2)
    if (fallback) take(fallback, 2, 'Only option today — stop at 2')
  }

  // Chutney only makes sense with a south-Indian tiffin
  const tiffin = picks.some((p) => /dosa|idl|uttap|ut+ap|pesarattu|adai|upma|pongal|vada|uggani|poha/i.test(p.item))
  const chutney = by('condiment').find((a) => /chutney|pachadi/i.test(a.label))
  if (chutney && tiffin) take(chutney, 1, 'Just one spoon')

  for (const a of atoms) if (!used.has(a)) skips.push(skip(a))

  const tips = MEAL_TIPS[meal]
  return { picks, skip: dedupeSkips(skips), tip: tips[dayHash(seed + meal) % tips.length] }
}

function dedupeSkips(s: SkipItem[]) {
  const seen = new Set<string>()
  return s.filter((x) => {
    const k = x.item.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export function planDay(menu: DayMenu, kcal: number, diet: Diet, seed = '') {
  const meals = {} as Record<MealKey, MealPlan>
  for (const m of ['breakfast', 'lunch', 'snacks', 'dinner'] as MealKey[]) {
    meals[m] = planMeal(m, menu[m] ?? [], kcal * MEAL_SHARE[m], diet, seed)
  }
  const sum = Object.values(meals).flatMap((m) => m.picks)
  const tk = sum.reduce((s, p) => s + p.kcal, 0)
  const tp = sum.reduce((s, p) => s + p.protein, 0)
  const traps = (['lunch', 'dinner', 'snacks', 'breakfast'] as MealKey[])
    .flatMap((m) => meals[m].skip.filter((s) => /craving trap|liquid sugar|keeps the cravings/i.test(s.reason)).map((s) => `${s.item} at ${m}`))
  const summary =
    `About ${Math.round(tk / 10) * 10} kcal and ${tp} g protein if you stick to this.` +
    (traps.length ? ` Watch out for ${traps.slice(0, 2).join(' and ')}.` : ' No big sugar traps on the menu today.')
  return { meals, summary }
}

// ── Swaps ───────────────────────────────────────────────────────────
// What a dish does on the plate. A swap should fill the same role: dal for paneer, roti for rice.
type Role = 'protein' | 'carb' | 'veg' | 'dairy' | 'fruit' | 'drink' | 'side'
const ROLE: Record<Kind, Role> = {
  protein: 'protein', dal: 'protein', dairy: 'dairy', veg: 'veg', salad: 'veg', soup: 'veg', carb: 'carb', fried: 'carb',
  refined: 'carb', fruit: 'fruit', sweet: 'fruit', drink: 'drink', condiment: 'side', unknown: 'side',
}

/** Every dish on these menu lines that the diet allows, including both sides of "A / B" choices. */
export function menuAtoms(lines: string[], diet: Diet): Atom[] {
  const seen = new Set<string>()
  const out: Atom[] = []
  for (const line of lines)
    for (const part of dishParts(line))
      for (const alt of alternatives(part)) {
        const label = clean(alt)
        if (!label || !allowed(alt, diet) || seen.has(label.toLowerCase())) continue
        seen.add(label.toLowerCase())
        out.push({ label, food: classify(alt) })
      }
  return out
}

/** The portion of `f` closest to `kcal`, in steps that make sense for its unit. */
function portionFor(f: Food, kcal: number) {
  const step = f.step ?? (['pc', 'slice', 'egg'].includes(f.unit) ? 1 : 0.5)
  const qty = Math.round(kcal / f.kcal / step) * step
  return Math.max(step, Math.min(f.max ?? 3, qty))
}

export interface SwapOption {
  pick: PlanItem
  /** a like-for-like swap: not sugary/fried, not many more calories, not much less protein */
  ok: boolean
  /** e.g. "−40 kcal · +3 g protein", or why it isn't a good swap */
  why: string
}

/** Dishes from the same meal's menu that can take `current`'s place on the plate. */
export function swapOptions(current: PlanItem, lines: string[], diet: Diet, onPlate: string[]): SwapOption[] {
  const role = ROLE[classify(current.item).kind]
  const taken = new Set(onPlate.map((x) => x.toLowerCase()))
  return menuAtoms(lines, diet)
    .filter((a) => ROLE[a.food.kind] === role && !taken.has(a.label.toLowerCase()))
    .map((a) => {
      const v = verdict(a.food)
      const p = pick(a, portionFor(a.food, current.kcal), v === 'limit' ? 'Keep it to this portion' : undefined)
      const dk = p.kcal - current.kcal
      const dp = p.protein - current.protein
      const delta = [dk ? `${dk > 0 ? '+' : '−'}${Math.abs(dk)} kcal` : 'same kcal', dp ? `${dp > 0 ? '+' : '−'}${Math.abs(dp)} g protein` : '']
        .filter(Boolean)
        .join(' · ')
      const tooMuch = dk > Math.max(60, current.kcal * 0.25)
      const lessProtein = dp < -(role === 'protein' ? 3 : 5)
      if (v === 'skip') return { pick: p, ok: false, why: a.food.why ?? `${a.food.kind === 'sweet' ? 'Sugary' : 'Fried or refined'} — ${delta}` }
      // "Limit" foods (butter, papad, parotta) are fine in small amounts but never a like-for-like swap
      return { pick: p, ok: v === 'good' && !tooMuch && !lessProtein, why: v === 'limit' ? `${a.food.why ?? 'Only a small portion'} — ${delta}` : delta }
    })
    .sort((x, y) => Number(y.ok) - Number(x.ok) || y.pick.protein - x.pick.protein || x.pick.kcal - y.pick.kcal)
}

/** When a meal is skipped: a protein dish to add to the next main meal, from that meal's menu. */
export function proteinTopUp(lines: string[], diet: Diet, onPlate: string[], kcal: number): PlanItem | null {
  const taken = new Set(onPlate.map((x) => x.toLowerCase()))
  const best = menuAtoms(lines, diet)
    .filter((a) => ['protein', 'dal', 'dairy'].includes(a.food.kind) && verdict(a.food) === 'good' && !taken.has(a.label.toLowerCase()))
    .sort((x, y) => y.food.protein / y.food.kcal - x.food.protein / x.food.kcal)[0]
  return best ? pick(best, Math.min(portionFor(best.food, kcal), best.food.max ?? 2)) : null
}

/** A normal portion of any dish, for when you decide to have something the plan left out. */
export function planItemFor(name: string): PlanItem {
  const f = classify(name)
  const v = verdict(f)
  const note = v === 'skip' ? 'Your call — not in the plan' : v === 'limit' ? 'Your call — keep it small' : 'Added by you'
  // sweets, fried and condiments at one unit; everything else at its usual portion
  return pick({ label: name, food: f }, v === 'good' ? f.qty : 1, note)
}

export function mealTotals(p: MealPlan) {
  return {
    kcal: p.picks.reduce((s, x) => s + x.kcal, 0),
    protein: p.picks.reduce((s, x) => s + x.protein, 0),
  }
}

// ── Free-text estimate ("2 rotis, dal and a cup of rice") ────────────
const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5 }

export function estimateText(text: string, diet: Diet = 'nonveg') {
  const parts = text
    .split(/,|\band\b|\+|\n|&/i)
    .map((s) => s.trim())
    .filter(Boolean)
  const items = parts.map((p) => {
    const m = p.match(/^(\d+(?:\.\d+)?|½|a|an|one|two|three|four|five|six|half)\s*(?:x\s*)?(.*)$/i)
    let qty = 1
    let name = p
    if (m) {
      qty = m[1] === '½' ? 0.5 : WORD_NUM[m[1].toLowerCase()] ?? parseFloat(m[1])
      name = m[2] || p
    }
    name = name.replace(/^(cups?|katoris?|bowls?|plates?|glass(es)?|pieces?|pcs?|slices?|spoons?|tbsp|tsp)\s+(of\s+)?/i, '')
    const f = classify(name)
    return { name, qty, kcal: Math.round(f.kcal * qty), protein: Math.round(f.protein * qty), kind: f.kind }
  })
  void diet
  return {
    items,
    kcal: items.reduce((s, i) => s + i.kcal, 0),
    protein: items.reduce((s, i) => s + i.protein, 0),
  }
}
