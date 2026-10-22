// Free Supabase projects are paused after about a week without database activity, which breaks
// sign-in and sync ("Can't reach the server"). Vercel calls this once a day (see vercel.json) so the
// project always has recent activity. It only runs a tiny read that row-level security keeps empty.

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' })

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return res.status(500).json({ error: 'Supabase is not configured.' })

  const r = await fetch(`${url}/rest/v1/user_state?select=user_id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status })
}
