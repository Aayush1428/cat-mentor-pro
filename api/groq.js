export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const auth = req.headers['authorization']
  if (!auth) return res.status(401).json({ error: 'Missing Authorization' })
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': auth },
      body: JSON.stringify(req.body),
    })
    res.status(r.status).json(await r.json())
  } catch (e) { res.status(500).json({ error: e.message }) }
}
