import { useEffect, useRef, useState } from 'react'
import { googleClientId } from '../lib/supabase'
import { signInWithGoogle, signInWithGoogleToken } from '../lib/sync'
import { Spinner } from './ui'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: Record<string, unknown>) => void
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
          prompt: () => void
          cancel: () => void
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null
function loadGis() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Google sign-in.'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Google's own button (required for one-tap) styled to sit in our card.
 * Falls back to the Supabase redirect flow if no client ID is configured.
 */
export function GoogleButton({ onError, onBusy }: { onError: (m: string) => void; onBusy?: (b: boolean) => void }) {
  const holder = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!googleClientId) return
    let cancelled = false
    ;(async () => {
      try {
        await loadGis()
        if (cancelled || !holder.current || !window.google) return
        const raw = crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')
        const hashed = await sha256Hex(raw)
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          nonce: hashed,
          use_fedcm_for_prompt: true,
          itp_support: true,
          callback: async (resp: { credential?: string }) => {
            if (!resp.credential) return
            setBusy(true)
            onBusy?.(true)
            try {
              await signInWithGoogleToken(resp.credential, raw)
            } catch (e) {
              onError((e as Error).message)
              setBusy(false)
              onBusy?.(false)
            }
          },
        })
        const width = Math.min(400, holder.current.parentElement?.clientWidth ?? 360)
        window.google.accounts.id.renderButton(holder.current, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'center', width })
        window.google.accounts.id.prompt()
        setReady(true)
      } catch (e) {
        onError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
      window.google?.accounts.id.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!googleClientId) {
    return (
      <button
        type="button"
        onClick={async () => {
          setBusy(true)
          try {
            await signInWithGoogle()
          } catch (e) {
            onError((e as Error).message)
            setBusy(false)
          }
        }}
        className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-line-strong bg-surface text-[15px] font-medium transition hover:-translate-y-px hover:shadow-card active:scale-[0.99]"
      >
        {busy ? <Spinner size={16} /> : <GoogleMark />} Continue with Google
      </button>
    )
  }

  return (
    <div className="relative flex h-[52px] w-full items-center justify-center">
      {(!ready || busy) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 rounded-full border border-line-strong bg-surface text-[15px] font-medium">
          {busy ? <Spinner size={16} /> : <GoogleMark />} {busy ? 'Signing you in…' : 'Continue with Google'}
        </div>
      )}
      <div ref={holder} className="flex w-full justify-center [color-scheme:light]" />
    </div>
  )
}

export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
