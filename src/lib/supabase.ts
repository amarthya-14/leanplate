import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null when the app is built without Supabase env vars (local-only mode). */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null

export const cloudEnabled = !!supabase
/** Google Identity Services client ID (one-tap / button → ID token, no redirects). */
export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? ''
export const googleEnabled = cloudEnabled && (!!googleClientId || import.meta.env.VITE_AUTH_GOOGLE === 'true')
