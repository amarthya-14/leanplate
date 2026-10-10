import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, Choice, cx, Label, NumberField, Segmented } from '../components/ui'
import { todayISO } from '../lib/date'
import { ACTIVITY, bmi, bmiBand, PACE, targets } from '../lib/nutrition'
import { useStore } from '../lib/store'
import type { Activity, Diet, Pace, Profile, Sex } from '../lib/types'

export function Onboarding() {
  const setProfile = useStore((s) => s.setProfile)
  const updateSettings = useStore((s) => s.updateSettings)
  const apiKey = useStore((s) => s.settings.apiKey)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState<number | ''>(20)
  const [height, setHeight] = useState<number | ''>('')
  const [weight, setWeight] = useState<number | ''>('')
  const [goal, setGoal] = useState<number | ''>('')
  const [activity, setActivity] = useState<Activity>('light')
  const [diet, setDiet] = useState<Diet>('nonveg')
  const [pace, setPace] = useState<Pace>('steady')
  const [key, setKey] = useState(apiKey)

  const profile: Profile = {
    name: name.trim(),
    sex,
    age: Number(age) || 20,
    heightCm: Number(height) || 170,
    startKg: Number(weight) || 80,
    goalKg: Number(goal) || 70,
    activity,
    diet,
    pace,
    startDate: todayISO(),
    notes: '',
  }
  const t = targets(profile, profile.startKg)
  const b = height && weight ? bmi(Number(weight), Number(height)) : null
  const suggestedGoal = height ? Math.round(22.5 * (Number(height) / 100) ** 2) : null

  const steps: { valid: boolean; node: ReactNode }[] = [
    {
      valid: true,
      node: (
        <>
          <Eyebrow>Leanplate</Eyebrow>
          <H>Eat from the mess. Still lose the weight.</H>
          <P>
            Upload your hostel's monthly menu and get told, every meal, what to take, how much, and what to leave on the counter. Plus a way out of the
            sugar cravings.
          </P>
          <div className="mt-8">
            <Label>What should we call you?</Label>
            <input className="field h-12 text-[16px]" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" onKeyDown={(e) => e.key === 'Enter' && setStep(1)} />
          </div>
        </>
      ),
    },
    {
      valid: !!age && !!height && Number(height) > 120,
      node: (
        <>
          <Eyebrow>About you</Eyebrow>
          <H>The basics.</H>
          <P>Used only to calculate your calorie needs.</P>
          <div className="mt-8 space-y-5">
            <div>
              <Label>Sex</Label>
              <Segmented className="w-full" value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Age</Label>
                <NumberField value={age} onChange={setAge} suffix="yrs" />
              </div>
              <div>
                <Label>Height</Label>
                <NumberField value={height} onChange={setHeight} suffix="cm" />
              </div>
            </div>
          </div>
        </>
      ),
    },
    {
      valid: !!weight && !!goal && Number(goal) < Number(weight) && Number(goal) > 35,
      node: (
        <>
          <Eyebrow>Weight</Eyebrow>
          <H>Where you are, where you're going.</H>
          <P>Weigh yourself in the morning, after the bathroom, before eating — that's your honest number.</P>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div>
              <Label>Current</Label>
              <NumberField value={weight} onChange={setWeight} suffix="kg" step={0.1} />
            </div>
            <div>
              <Label>Goal</Label>
              <NumberField value={goal} onChange={setGoal} suffix="kg" step={0.1} />
            </div>
          </div>
          {b && (
            <p className="mt-4 text-[13.5px] text-ink-3">
              BMI {b.toFixed(1)} · {bmiBand(b)}.{suggestedGoal && ` A healthy target for your height is around ${suggestedGoal} kg — start with a closer milestone if that feels far.`}
            </p>
          )}
        </>
      ),
    },
    {
      valid: true,
      node: (
        <>
          <Eyebrow>Lifestyle</Eyebrow>
          <H>How much do you move?</H>
          <P>Be honest — overestimating is the most common reason plans stall.</P>
          <div className="mt-8 space-y-2">
            {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
              <Choice key={a} selected={activity === a} onClick={() => setActivity(a)} title={ACTIVITY[a].label} hint={ACTIVITY[a].hint} />
            ))}
          </div>
        </>
      ),
    },
    {
      valid: true,
      node: (
        <>
          <Eyebrow>Preferences</Eyebrow>
          <H>What do you eat, and how fast?</H>
          <div className="mt-8 space-y-6">
            <div>
              <Label>Diet</Label>
              <Segmented className="w-full" value={diet} onChange={setDiet} options={[{ value: 'veg', label: 'Veg' }, { value: 'egg', label: 'Egg' }, { value: 'nonveg', label: 'Non-veg' }]} />
            </div>
            <div>
              <Label>Pace</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PACE) as Pace[]).map((p) => (
                  <Choice key={p} selected={pace === p} onClick={() => setPace(p)} title={PACE[p].label} hint={`${PACE[p].kgPerWeek} kg/wk · ${PACE[p].hint}`} />
                ))}
              </div>
            </div>
          </div>
        </>
      ),
    },
    {
      valid: true,
      node: (
        <>
          <Eyebrow>Your numbers</Eyebrow>
          <H>Here's the plan.</H>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <Big label="Daily calories" value={t.kcal.toLocaleString('en-IN')} hint={`maintenance ≈ ${t.tdee}`} />
            <Big label="Protein" value={`${t.protein} g`} hint="the thing that keeps you full" />
            <Big label="Added sugar" value={`< ${t.sugarG} g`} hint="about 6 teaspoons" />
            <Big
              label="Goal in"
              value={`~${Math.max(1, Math.round((profile.startKg - profile.goalKg) / PACE[pace].kgPerWeek))} wks`}
              hint={`at ${PACE[pace].kgPerWeek} kg / week`}
            />
          </div>
          <div className="mt-8">
            <Label hint={<a className="underline underline-offset-2" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get one free ↗</a>}>
              Gemini API key (optional)
            </Label>
            <input className="field font-mono text-[13px]" type="password" value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="AIza… — you can add it later in Settings" autoComplete="off" />
            <p className="mt-2 text-[12.5px] text-ink-3">Without a key, Leanplate uses its built-in offline engine. With one, Gemini plans your plate and you get the AI coach.</p>
          </div>
        </>
      ),
    },
  ]

  const last = step === steps.length - 1
  const cur = steps[step]

  function next() {
    if (!cur.valid) return
    if (!last) return setStep(step + 1)
    if (key) updateSettings({ apiKey: key })
    setProfile(profile)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pt-10 pb-8 sm:pt-20">
        <div className="mb-10 flex gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={cx('h-1 flex-1 rounded-full transition-colors duration-500', i <= step ? 'bg-accent-text' : 'bg-surface-3')} />
          ))}
        </div>
        <div key={step} className="rise flex-1">{cur.node}</div>
        <div className="mt-10 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} /> Back
            </Button>
          ) : <span />}
          <Button variant="primary" size="lg" onClick={next} disabled={!cur.valid}>
            {last ? 'Start' : 'Continue'} <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}

const Eyebrow = ({ children }: { children: ReactNode }) => <div className="eyebrow mb-4">{children}</div>
const H = ({ children }: { children: ReactNode }) => <h1 className="display text-[44px] leading-[1.02] sm:text-[52px]">{children}</h1>
const P = ({ children }: { children: ReactNode }) => <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{children}</p>
const Big = ({ label, value, hint }: { label: string; value: string; hint: string }) => (
  <div className="card p-5">
    <div className="eyebrow mb-2">{label}</div>
    <div className="display num text-[34px]">{value}</div>
    <div className="mt-1 text-[12px] text-ink-3">{hint}</div>
  </div>
)
