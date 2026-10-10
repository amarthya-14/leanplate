import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { useStore } from './store'
import { supabase } from './supabase'
import type { ChatMsg, CravingEntry, DayPlan, LogEntry, MonthMenu, Profile, Settings, WeightEntry } from './types'

// ── Auth state ──────────────────────────────────────────────────────

type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn'
  user: User | null
  sync: SyncState
  lastSynced: number | null
  error: string
  /** true once the first pull after sign-in has been merged */
  ready: boolean
}

export const useAuth = create<AuthState>(() => ({
  status: supabase ? 'loading' : 'signedOut',
  user: null,
  sync: 'idle',
  lastSynced: null,
  error: '',
  ready: false,
}))

const LOCAL_MODE = 'leanplate-local-mode'
const META = 'leanplate-sync-meta'

export const isLocalMode = () => {
  try {
    return localStorage.getItem(LOCAL_MODE) === '1'
  } catch {
    return false
  }
}
export const setLocalMode = (on: boolean) => {
  try {
    if (on) localStorage.setItem(LOCAL_MODE, '1')
    else localStorage.removeItem(LOCAL_MODE)
  } catch {
    /* ignore */
  }
}

interface Meta {
  userId: string
  remoteAt: string | null
}
const readMeta = (): Meta | null => {
  try {
    return JSON.parse(localStorage.getItem(META) ?? 'null')
  } catch {
    return null
  }
}
const writeMeta = (m: Meta | null) => {
  try {
    if (m) localStorage.setItem(META, JSON.stringify(m))
    else localStorage.removeItem(META)
  } catch {
    /* ignore */
  }
}

// ── Snapshot & merge ────────────────────────────────────────────────

export interface Snapshot {
  profile: Profile | null
  settings: Settings
  menus: MonthMenu[]
  plans: Record<string, DayPlan>
  logs: LogEntry[]
  weights: WeightEntry[]
  cravings: CravingEntry[]
  slips: string[]
  water: Record<string, number>
  chat: ChatMsg[]
  savedAt: number
}

let localSavedAt = 0

function snapshot(): Snapshot {
  const s = useStore.getState()
  return {
    profile: s.profile,
    settings: s.settings,
    menus: s.menus,
    plans: s.plans,
    logs: s.logs,
    weights: s.weights,
    cravings: s.cravings,
    slips: s.slips,
    water: s.water,
    chat: s.chat,
    savedAt: localSavedAt || Date.now(),
  }
}

const byKey = <T>(a: T[], b: T[], key: (x: T) => string, prefer?: (x: T, y: T) => T) => {
  const m = new Map<string, T>()
  for (const x of a) m.set(key(x), x)
  for (const y of b) {
    const k = key(y)
    const x = m.get(k)
    m.set(k, x && prefer ? prefer(x, y) : y)
  }
  return [...m.values()]
}

/** Union of both sides; scalar fields come from whichever side saved last. */
export function mergeState(local: Snapshot, remote: Snapshot): Snapshot {
  const newer = (remote.savedAt ?? 0) >= (local.savedAt ?? 0) ? remote : local
  const plans: Record<string, DayPlan> = { ...local.plans }
  for (const [k, p] of Object.entries(remote.plans ?? {})) {
    const l = plans[k]
    plans[k] = !l || (p.edited?.at ?? p.createdAt) >= (l.edited?.at ?? l.createdAt) ? p : l
  }
  const water: Record<string, number> = { ...local.water }
  for (const [d, n] of Object.entries(remote.water ?? {})) water[d] = Math.max(water[d] ?? 0, n)
  const chat = (remote.chat?.length ?? 0) >= (local.chat?.length ?? 0) ? remote.chat : local.chat

  return {
    profile: newer.profile ?? local.profile ?? remote.profile,
    // keep this device's API key if the other side has none
    settings: { ...newer.settings, apiKey: newer.settings?.apiKey || local.settings?.apiKey || remote.settings?.apiKey || '' },
    menus: byKey(local.menus ?? [], remote.menus ?? [], (m) => `${m.year}-${m.month}`, (x, y) => (y.uploadedAt >= x.uploadedAt ? y : x)).sort(
      (a, b) => b.year * 12 + b.month - (a.year * 12 + a.month),
    ),
    plans,
    logs: byKey(local.logs ?? [], remote.logs ?? [], (l) => l.id).sort((a, b) => a.at - b.at),
    weights: byKey(newer === local ? remote.weights ?? [] : local.weights ?? [], newer.weights ?? [], (w) => w.date).sort((a, b) => a.date.localeCompare(b.date)),
    cravings: byKey(local.cravings ?? [], remote.cravings ?? [], (c) => c.id).sort((a, b) => a.at - b.at),
    slips: [...new Set([...(local.slips ?? []), ...(remote.slips ?? [])])].sort(),
    water,
    chat: chat ?? [],
    savedAt: Math.max(local.savedAt ?? 0, remote.savedAt ?? 0),
  }
}

let applying = false
function apply(s: Snapshot) {
  applying = true
  const { savedAt, ...rest } = s
  useStore.setState(rest)
  localSavedAt = savedAt
  applying = false
}

const hasData = (s: Snapshot) => !!s.profile || s.logs.length > 0 || s.menus.length > 0

// ── Pull / push ─────────────────────────────────────────────────────

async function pull(user: User) {
  if (!supabase) return
  useAuth.setState({ sync: 'syncing', error: '' })
  const { data, error } = await supabase.from('user_state').select('data, updated_at').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  const meta = readMeta()
  const local = snapshot()

  if (!data) {
    // First time in the cloud: upload whatever this device has (if it's not someone else's)
    if (meta && meta.userId !== user.id) apply({ ...emptySnapshot(), settings: { ...local.settings, apiKey: local.settings.apiKey } })
    writeMeta({ userId: user.id, remoteAt: null })
    if (hasData(snapshot())) await push(user, true)
    else useAuth.setState({ sync: 'synced', lastSynced: Date.now() })
    return
  }

  const remote = data.data as Snapshot
  if (meta && meta.userId !== user.id) {
    // Device last belonged to another account: never mix their data in
    apply({ ...emptySnapshot(), ...remote, settings: { ...remote.settings, apiKey: remote.settings?.apiKey || '' } })
  } else if (meta?.remoteAt === data.updated_at) {
    // Remote unchanged since our last sync; local is the source of truth
  } else {
    apply(hasData(local) ? mergeState(local, remote) : { ...remote, settings: { ...local.settings, ...remote.settings } })
  }
  writeMeta({ userId: user.id, remoteAt: data.updated_at })
  useAuth.setState({ sync: 'synced', lastSynced: Date.now() })
  // If merging changed anything relative to remote, push the union back
  if (hasData(local) && meta?.remoteAt !== data.updated_at) await push(user, true)
}

let pushing: Promise<void> | null = null
async function push(user: User, force = false) {
  if (!supabase) return
  if (pushing && !force) return pushing
  const run = async () => {
    useAuth.setState({ sync: 'syncing' })
    const now = new Date().toISOString()
    const { data, error } = await supabase!
      .from('user_state')
      .upsert({ user_id: user.id, data: snapshot(), updated_at: now }, { onConflict: 'user_id' })
      .select('updated_at')
      .single()
    if (error) throw error
    writeMeta({ userId: user.id, remoteAt: data.updated_at })
    useAuth.setState({ sync: 'synced', lastSynced: Date.now(), error: '' })
  }
  pushing = run()
    .catch((e) => {
      useAuth.setState({ sync: navigator.onLine ? 'error' : 'offline', error: (e as Error).message })
    })
    .finally(() => {
      pushing = null
    })
  return pushing
}

function emptySnapshot(): Snapshot {
  const s = useStore.getState()
  return {
    profile: null,
    settings: { ...s.settings },
    menus: [],
    plans: {},
    logs: [],
    weights: [],
    cravings: [],
    slips: [],
    water: {},
    chat: [],
    savedAt: 0,
  }
}

export async function syncNow() {
  const u = useAuth.getState().user
  if (!u) return
  try {
    await pull(u)
  } catch (e) {
    useAuth.setState({ sync: navigator.onLine ? 'error' : 'offline', error: (e as Error).message })
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────

let started = false
let timer = 0

async function onSession(session: Session | null) {
  const user = session?.user ?? null
  const prev = useAuth.getState().user
  if (!user) {
    useAuth.setState({ status: 'signedOut', user: null, ready: false, sync: 'idle' })
    return
  }
  if (prev?.id === user.id && useAuth.getState().ready) {
    useAuth.setState({ user })
    return
  }
  useAuth.setState({ status: 'signedIn', user, ready: false })
  setLocalMode(false)
  try {
    await pull(user)
  } catch (e) {
    useAuth.setState({ sync: navigator.onLine ? 'error' : 'offline', error: (e as Error).message })
  }
  useAuth.setState({ ready: true })
}

/** Call once at startup. */
export function initSync() {
  if (!supabase || started) return
  started = true
  supabase.auth.getSession().then(({ data }) => onSession(data.session))
  supabase.auth.onAuthStateChange((_e, session) => {
    // defer so we never await inside the auth callback
    setTimeout(() => onSession(session), 0)
  })

  // Push local edits shortly after they happen
  useStore.subscribe(() => {
    if (applying) return
    localSavedAt = Date.now()
    const { user, ready } = useAuth.getState()
    if (!user || !ready) return
    clearTimeout(timer)
    timer = window.setTimeout(() => push(user), 1200)
  })

  // Catch up when coming back to the app (another device may have written)
  const refresh = () => {
    const { user, ready } = useAuth.getState()
    if (user && ready && document.visibilityState === 'visible') pull(user).catch(() => useAuth.setState({ sync: 'offline' }))
  }
  document.addEventListener('visibilitychange', refresh)
  window.addEventListener('online', refresh)
  window.addEventListener('pagehide', () => {
    const { user, ready } = useAuth.getState()
    if (user && ready) push(user)
  })
}

// ── Auth actions ────────────────────────────────────────────────────

const friendly = (m: string) => {
  if (/invalid login/i.test(m)) return 'That email and password don’t match.'
  if (/already registered|already exists/i.test(m)) return 'An account with this email exists — sign in instead.'
  if (/password should be at least/i.test(m)) return 'Use at least 6 characters for the password.'
  if (/email not confirmed/i.test(m)) return 'Confirm your email first — check your inbox.'
  if (/rate limit/i.test(m)) return 'Too many attempts. Wait a minute and try again.'
  if (/fetch|network/i.test(m)) return 'Can’t reach the server. Check your connection.'
  return m
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Cloud sync is not configured.')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(friendly(error.message))
}

export async function signUp(email: string, password: string): Promise<'signedIn' | 'confirm'> {
  if (!supabase) throw new Error('Cloud sync is not configured.')
  // Preferred: server creates a pre-confirmed account, then we sign straight in
  try {
    const r = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    if (r.ok) {
      await signIn(email, password)
      return 'signedIn'
    }
    if (r.status !== 404 && r.status !== 405) {
      const j = await r.json().catch(() => ({}))
      throw new Error(friendly(j.error ?? 'Could not create the account.'))
    }
  } catch (e) {
    if (e instanceof Error && !/fetch|network|JSON|Unexpected/i.test(e.message)) throw e
  }
  // Fallback (local dev without serverless functions): regular sign-up
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
  if (error) throw new Error(friendly(error.message))
  if (data.user && data.user.identities?.length === 0) throw new Error(friendly('already registered'))
  return data.session ? 'signedIn' : 'confirm'
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Cloud sync is not configured.')
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  if (error) throw new Error(friendly(error.message))
}

/** Finish Google sign-in with the ID token from Google Identity Services. */
export async function signInWithGoogleToken(token: string, nonce: string) {
  if (!supabase) throw new Error('Cloud sync is not configured.')
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })
  if (error) throw new Error(/provider is not enabled|Unsupported provider/i.test(error.message) ? 'Google sign-in isn’t switched on in Supabase yet.' : friendly(error.message))
}

export async function resetPassword(email: string) {
  if (!supabase) throw new Error('Cloud sync is not configured.')
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  if (error) throw new Error(friendly(error.message))
}

export async function signOut() {
  const u = useAuth.getState().user
  if (u) await push(u, true)
  await supabase?.auth.signOut()
  writeMeta(null)
  // Don't leave someone's data on a shared device
  useStore.getState().reset()
  useAuth.setState({ status: 'signedOut', user: null, ready: false, sync: 'idle', lastSynced: null })
}
