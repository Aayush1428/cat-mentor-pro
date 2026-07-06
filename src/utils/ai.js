const getSettings = () => { try { return JSON.parse(localStorage.getItem('cat_settings') || '{}') } catch { return {} } }

const parseJSON = (raw) => {
  try { return JSON.parse(raw) } catch {
    const clean = raw.replace(/```json\n?|```\n?/g, '').trim()
    const s = clean.search(/[{\[]/)
    const e = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'))
    if (s === -1) throw new Error('Invalid JSON')
    return JSON.parse(clean.substring(s, e + 1))
  }
}

const sanitizeHeader = (val) => {
  if (!val) return ''
  return String(val).replace(/[^\x00-\x7F]/g, '?')
}

const callProvider = async (provider, apiKey, messages, maxTokens) => {
  const endpoint = provider === 'groq' ? '/api/groq' : '/api/deepseek'
  const model = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'deepseek-chat'
  if (!apiKey) throw new Error(`No ${provider} API key configured`)
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sanitizeHeader(apiKey)}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.2 }),
    })
    const data = await r.json()
    if (data.error) throw new Error(data.error.message)
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new Error('Empty response')
    return text
  } catch (e) {
    if (e.message.includes('ISO-8859-1')) throw new Error(`${provider}: Invalid API key format (contains special characters)`)
    throw e
  }
}

export const callAI = async (systemPrompt, userMessage, maxTokens = 2000) => {
  const s = getSettings()
  if (!s.groqKey && !s.deepseekKey) throw new Error('NO_API_KEY')
  const order = s.preferredProvider === 'deepseek'
    ? [['deepseek', s.deepseekKey], ['groq', s.groqKey]]
    : [['groq', s.groqKey], ['deepseek', s.deepseekKey]]
  let last
  for (const [p, k] of order) {
    if (!k) continue
    try {
      const raw = await callProvider(p, k, [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }], maxTokens)
      return parseJSON(raw)
    } catch (e) { last = e }
  }
  throw last
}

export const chatAI = async (systemPrompt, history, maxTokens = 1500) => {
  const s = getSettings()
  if (!s.groqKey && !s.deepseekKey) throw new Error('NO_API_KEY')
  const order = s.preferredProvider === 'deepseek'
    ? [['deepseek', s.deepseekKey], ['groq', s.groqKey]]
    : [['groq', s.groqKey], ['deepseek', s.deepseekKey]]
  let last
  for (const [p, k] of order) {
    if (!k) continue
    try { return await callProvider(p, k, [{ role: 'system', content: systemPrompt }, ...history], maxTokens) }
    catch (e) { last = e }
  }
  throw last
}

export const getCachedContent = async (key, system, user, maxTokens = 2000) => {
  const cKey = `cat_cache_${key.replace(/[\s/\\'"]/g, '_').toLowerCase()}`
  const cached = localStorage.getItem(cKey)
  if (cached) { try { return JSON.parse(cached) } catch { localStorage.removeItem(cKey) } }
  const data = await callAI(system, user, maxTokens)
  localStorage.setItem(cKey, JSON.stringify(data))
  return data
}

export const clearCache = (key) => localStorage.removeItem(`cat_cache_${key.replace(/[\s/\\'"]/g, '_').toLowerCase()}`)
export const clearAllCache = () => Object.keys(localStorage).filter(k => k.startsWith('cat_cache_')).forEach(k => localStorage.removeItem(k))

export const testGroqConnection = async (k) => { await callProvider('groq', k, [{ role: 'user', content: 'Say OK' }], 10); return true }
export const testDeepseekConnection = async (k) => { await callProvider('deepseek', k, [{ role: 'user', content: 'Say OK' }], 10); return true }
