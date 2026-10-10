import { BellRing, CalendarPlus, Check, Download, Eye, EyeOff, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, Card, Label, NumberField, PageHeader, Segmented, Spinner } from '../components/ui'
import { listModels } from '../lib/gemini'
import { downloadIcs, enableNotifications, notificationsSupported, testNotification } from '../lib/reminders'
import { findMenu } from '../lib/store'
import { todayISO } from '../lib/date'
import { toast } from '../components/Toast'
import { ACTIVITY, PACE, targets } from '../lib/nutrition'
import { currentKg, useStore } from '../lib/store'
import type { Activity, Diet, Pace, Profile, Sex, Theme } from '../lib/types'

export function Settings() {
  const store = useStore()
  const { settings, updateSettings, setProfile, weights } = store
  const [p, setP] = useState<Profile>(store.profile!)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [testing, setTesting] = useState(false)
  const [keyMsg, setKeyMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [importErr, setImportErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const t = targets(p, currentKg(weights, p))
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setP({ ...p, [k]: v })
    setSaved(false)
  }

  async function test() {
    setTesting(true)
    setKeyMsg(null)
    try {
      const list = await listModels(settings.apiKey.trim())
      setModels(list)
      if (list.length && !list.includes(settings.model)) updateSettings({ model: list.find((m) => /flash/.test(m) && !/lite|preview/.test(m)) ?? list[0] })
      setKeyMsg({ ok: true, text: `Key works · ${list.length} models available` })
    } catch (e) {
      setKeyMsg({ ok: false, text: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  function exportData() {
    const { profile, menus, logs, weights, cravings, slips, water, chat, plans } = useStore.getState()
    const s = { ...useStore.getState().settings, apiKey: '' }
    const blob = new Blob([JSON.stringify({ profile, menus, logs, weights, cravings, slips, water, chat, plans, settings: s }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `leanplate-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importData(f: File) {
    try {
      const data = JSON.parse(await f.text())
      if (!data.profile) throw new Error('Not a Leanplate backup')
      store.importAll({ ...data, settings: { ...data.settings, apiKey: settings.apiKey } })
      setP(data.profile)
      setImportErr('')
    } catch (e) {
      setImportErr((e as Error).message)
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Settings" title="Settings" />

      <Section title="You" desc="Changing these recalculates your targets.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Name</Label>
            <input className="field" value={p.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <Label>Sex</Label>
            <Segmented className="w-full" value={p.sex} onChange={(v: Sex) => set('sex', v)} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
          </div>
          <div>
            <Label>Age</Label>
            <NumberField value={p.age} onChange={(v) => set('age', Number(v) || 0)} suffix="yrs" />
          </div>
          <div>
            <Label>Height</Label>
            <NumberField value={p.heightCm} onChange={(v) => set('heightCm', Number(v) || 0)} suffix="cm" />
          </div>
          <div>
            <Label>Starting weight</Label>
            <NumberField value={p.startKg} onChange={(v) => set('startKg', Number(v) || 0)} suffix="kg" step={0.1} />
          </div>
          <div>
            <Label>Goal weight</Label>
            <NumberField value={p.goalKg} onChange={(v) => set('goalKg', Number(v) || 0)} suffix="kg" step={0.1} />
          </div>
          <div>
            <Label>Activity</Label>
            <select className="field" value={p.activity} onChange={(e) => set('activity', e.target.value as Activity)}>
              {Object.entries(ACTIVITY).map(([k, a]) => (
                <option key={k} value={k}>{a.label} — {a.hint}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Pace</Label>
            <select className="field" value={p.pace} onChange={(e) => set('pace', e.target.value as Pace)}>
              {Object.entries(PACE).map(([k, a]) => (
                <option key={k} value={k}>{a.label} — {a.kgPerWeek} kg/week</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Diet</Label>
            <Segmented
              className="w-full"
              value={p.diet}
              onChange={(v: Diet) => set('diet', v)}
              options={[{ value: 'veg', label: 'Vegetarian' }, { value: 'egg', label: 'Eggetarian' }, { value: 'nonveg', label: 'Non-veg' }]}
            />
          </div>
          <div className="sm:col-span-2">
            <Label hint="The AI reads this">Anything else? (allergies, gym days, foods you hate)</Label>
            <textarea className="field min-h-[80px] resize-none" value={p.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Gym Mon/Wed/Fri evening. Don't like bitter gourd. Thyroid is normal." />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px]">
          <span className="text-ink-2">
            <span className="num font-medium text-ink">{t.kcal} kcal</span> · <span className="num">{t.protein} g</span> protein · maintenance <span className="num">{t.tdee}</span>
          </span>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setProfile(p)
              store.clearPlans()
              setSaved(true)
            }}
          >
            {saved ? <><Check size={14} /> Saved</> : 'Save changes'}
          </Button>
        </div>
      </Section>

      <Section title="Gemini" desc="Powers the AI plate, food estimates and the coach. The key is stored only in this browser.">
        <Label hint={<a className="underline decoration-line-strong underline-offset-2 hover:text-ink" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get a free key ↗</a>}>API key</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className="field pr-11 font-mono text-[13px]"
              type={showKey ? 'text' : 'password'}
              value={settings.apiKey}
              placeholder="AIza…"
              onChange={(e) => {
                updateSettings({ apiKey: e.target.value.trim() })
                setKeyMsg(null)
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-ink-3 hover:text-ink" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Hide key' : 'Show key'}>
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <Button onClick={test} disabled={!settings.apiKey || testing}>
            {testing ? <Spinner size={14} /> : null} Test
          </Button>
        </div>
        {keyMsg && <p className={`mt-2 text-[13px] ${keyMsg.ok ? 'text-good' : 'text-skip'}`}>{keyMsg.text}</p>}
        <div className="mt-4">
          <Label hint="Flash models are fast and free-tier friendly">Model</Label>
          {models.length ? (
            <select className="field" value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })}>
              {models.map((m) => <option key={m}>{m}</option>)}
            </select>
          ) : (
            <input className="field font-mono text-[13px]" value={settings.model} onChange={(e) => updateSettings({ model: e.target.value.trim() })} />
          )}
        </div>
      </Section>

      <Section title="Meal reminders" desc="Get the plate — what to take and what to skip — right when the mess opens.">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[14.5px] font-medium">
                <BellRing size={16} className="text-accent-text" /> App notifications
              </div>
              <p className="mt-1 max-w-md text-[13px] text-ink-3">
                Fire while Leanplate is open or running in the background (best after “Add to Home Screen”). Skipped if you've already logged that meal.
              </p>
            </div>
            <Toggle
              on={!!settings.reminders}
              onChange={async (on) => {
                if (!on) return updateSettings({ reminders: false })
                const r = await enableNotifications()
                if (r === 'granted') {
                  updateSettings({ reminders: true })
                  testNotification()
                  toast('Meal reminders on')
                } else toast(r === 'denied' ? 'Notifications are blocked — allow them in browser settings' : 'This browser does not support notifications')
              }}
              disabled={!notificationsSupported()}
            />
          </div>
          {settings.reminders && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] text-ink-2">Remind me</span>
              <Segmented
                size="sm"
                value={String(settings.reminderLead ?? 0)}
                onChange={(v) => updateSettings({ reminderLead: Number(v) })}
                options={[
                  { value: '0', label: 'When it opens' },
                  { value: '10', label: '10 min before' },
                  { value: '20', label: '20 min before' },
                ]}
              />
              <Button size="sm" variant="ghost" onClick={() => testNotification()}>
                Send a test
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
            <div>
              <div className="flex items-center gap-2 text-[14.5px] font-medium">
                <CalendarPlus size={16} className="text-accent-text" /> Calendar reminders
              </div>
              <p className="mt-1 max-w-md text-[13px] text-ink-3">
                Works even when the app is closed. Adds every remaining meal this month to your phone's calendar, with an alert and the full plate in the notes.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                const m = findMenu(store.menus, todayISO())
                if (!m) return toast('Upload this month’s menu first')
                downloadIcs(m)
                toast('Calendar file downloaded — open it to add the reminders')
              }}
            >
              <Download size={14} /> Add month to calendar
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Appearance">
        <Segmented
          value={settings.theme}
          onChange={(v: Theme) => updateSettings({ theme: v })}
          options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        />
      </Section>

      <Section title="Your data" desc="Everything lives in this browser. Export a backup before clearing your browser or switching phones.">
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportData}><Download size={15} /> Export backup</Button>
          <Button onClick={() => fileRef.current?.click()}><Upload size={15} /> Import backup</Button>
          <Button variant="ghost" onClick={() => store.clearPlans()}>Clear cached plans</Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = '' }} />
        </div>
        {importErr && <p className="mt-2 text-[13px] text-skip">{importErr}</p>}
        <div className="mt-6 border-t border-line pt-5">
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[14px] text-ink-2">Delete everything — profile, menus, logs, weights?</span>
              <Button variant="danger" size="sm" onClick={() => store.reset()}>Yes, delete all</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="ghost" className="text-skip hover:text-skip" onClick={() => setConfirmReset(true)}>Reset app</Button>
          )}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4 p-6">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      {desc && <p className="mt-1 mb-5 text-[13.5px] text-ink-3">{desc}</p>}
      {!desc && <div className="mb-4" />}
      {children}
    </Card>
  )
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-300 disabled:opacity-40 ${on ? 'bg-accent-text' : 'bg-surface-3'}`}
    >
      <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-300 ${on ? 'translate-x-5' : ''}`} />
    </button>
  )
}
