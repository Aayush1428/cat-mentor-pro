export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const auth = req.headers['authorization']
  if (!auth) return res.status(401).json({ error: 'Missing Authorization' })
  try {
    const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': auth },
      body: JSON.stringify({ ...req.body, stream: false }),
    })
    // NVIDIA can return a non-JSON body (error page / gateway) — surface it instead of crashing on r.json().
    const text = await r.text()
    try {
      return res.status(r.status).json(JSON.parse(text))
    } catch {
      return res.status(r.status >= 400 ? r.status : 502).json({ error: { message: `NVIDIA returned a non-JSON response (HTTP ${r.status}): ${text.slice(0, 200)}` } })
    }
  } catch (e) { res.status(500).json({ error: { message: e.message } }) }
}
