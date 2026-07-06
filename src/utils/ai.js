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
  return String(val).replace(/[^\x00-\x7F]/g, '')
}

const PROVIDER_LABEL = { groq: 'Groq', deepseek: 'DeepSeek' }

const friendlyError = (provider, status, rawMsg) => {
  const name = PROVIDER_LABEL[provider] || provider
  const msg = String(rawMsg || '').toLowerCase()
  if (status === 401 || msg.includes('invalid api key') || msg.includes('invalid_api_key') || msg.includes('unauthorized') || msg.includes('authentication')) {
    return `${name}: API key rejected (invalid, expired, or wrong key in the ${name} field). Re-copy it from the ${name} dashboard into Settings.`
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('quota') || msg.includes('insufficient')) {
    return `${name}: rate limit or quota reached. Wait a moment or check your ${name} account credits.`
  }
  if (msg.includes('model')) return `${name}: model unavailable — ${rawMsg}`
  return `${name}: ${rawMsg || 'request failed'}`
}

const callProvider = async (provider, apiKey, messages, maxTokens) => {
  const endpoint = provider === 'groq' ? '/api/groq' : '/api/deepseek'
  const model = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'deepseek-chat'
  const cleanKey = sanitizeHeader(apiKey).trim()
  if (!cleanKey) throw new Error(`No ${PROVIDER_LABEL[provider] || provider} API key configured`)
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cleanKey}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.2 }),
    })
    const data = await r.json()
    if (data.error || !r.ok) throw new Error(friendlyError(provider, r.status, data.error?.message || data.error))
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new Error(`${PROVIDER_LABEL[provider] || provider}: empty response`)
    return text
  } catch (e) {
    if (e.message.includes('ISO-8859-1')) throw new Error(`${PROVIDER_LABEL[provider] || provider}: invalid API key format (contains special characters — re-copy the key)`)
    throw e
  }
}

export const callAI = async (systemPrompt, userMessage, maxTokens = 2000) => {
  const s = getSettings()
  if (!s.groqKey && !s.deepseekKey) throw new Error('NO_API_KEY')
  const order = s.preferredProvider === 'deepseek'
    ? [['deepseek', s.deepseekKey], ['groq', s.groqKey]]
    : [['groq', s.groqKey], ['deepseek', s.deepseekKey]]
  const errors = []
  for (const [p, k] of order) {
    if (!k) continue
    try {
      const raw = await callProvider(p, k, [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }], maxTokens)
      return parseJSON(raw)
    } catch (e) { errors.push(e.message) }
  }
  throw new Error(errors.join(' | ') || 'All AI providers failed')
}

export const chatAI = async (systemPrompt, history, maxTokens = 1500) => {
  const s = getSettings()
  if (!s.groqKey && !s.deepseekKey) throw new Error('NO_API_KEY')
  const order = s.preferredProvider === 'deepseek'
    ? [['deepseek', s.deepseekKey], ['groq', s.groqKey]]
    : [['groq', s.groqKey], ['deepseek', s.deepseekKey]]
  const errors = []
  for (const [p, k] of order) {
    if (!k) continue
    try { return await callProvider(p, k, [{ role: 'system', content: systemPrompt }, ...history], maxTokens) }
    catch (e) { errors.push(e.message) }
  }
  throw new Error(errors.join(' | ') || 'All AI providers failed')
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
