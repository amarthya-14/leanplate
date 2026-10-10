// Creates an already-confirmed email/password account, so sign-up is instant
// (no confirmation email). Runs on Vercel with the server-only service key.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return res.status(500).json({ error: 'Sign-up is not configured.' })

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')
  if (!EMAIL.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email.' })
  if (password.length < 6 || password.length > 128) return res.status(400).json({ error: 'Password needs at least 6 characters.' })

  const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (r.ok) return res.status(200).json({ ok: true })

  const j = await r.json().catch(() => ({}))
  const msg = String(j.msg || j.message || j.error_description || j.error || '')
  if (r.status === 422 || /already/i.test(msg)) return res.status(409).json({ error: 'An account with this email exists — sign in instead.' })
  return res.status(400).json({ error: msg || 'Could not create the account.' })
}
