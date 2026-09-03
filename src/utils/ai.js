const getSettings = () => { try { return JSON.parse(localStorage.getItem('cat_settings') || '{}') } catch { return {} } }

const parseJSON = (raw) => {
  try { return JSON.parse(raw) } catch {
    const clean = raw.replace(/```json\n?|```\n?/g, '').trim()
    const s = clean.search(/[{\[]/)
    const e = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'))
    if (s === -1) throw new Error('Invalid JSON')
    try { return JSON.parse(clean.substring(s, e + 1)) }
    catch { throw new Error('the AI response was cut off before it finished (too long). Try again, or use a shorter passage.') }
  }
}

const sanitizeHeader = (val) => {
  if (!val) return ''
  return String(val).replace(/[^\x00-\x7F]/g, '')
}

const PROVIDER_LABEL = { groq: 'Groq', deepseek: 'DeepSeek', nvidia: 'NVIDIA' }
const PROVIDER_ENDPOINT = { groq: '/api/groq', deepseek: '/api/deepseek', nvidia: '/api/nvidia' }
const PROVIDER_MODEL = { groq: 'openai/gpt-oss-120b', deepseek: 'deepseek-chat', nvidia: 'meta/llama-3.3-70b-instruct' }
// Multimodal (image-reading) models. deepseek-chat has no vision, so it is intentionally omitted.
const PROVIDER_VISION_MODEL = { groq: 'meta-llama/llama-4-scout-17b-16e-instruct', nvidia: 'meta/llama-4-scout-17b-16e-instruct' }
const VISION_PROVIDERS = ['groq', 'nvidia']
const PROVIDERS = ['groq', 'deepseek', 'nvidia']

// Ordered [provider, key] pairs: preferred first, then the rest as fallbacks.
const providerOrder = (s) => {
  const keys = { groq: s.groqKey, deepseek: s.deepseekKey, nvidia: s.nvidiaKey }
  const pref = PROVIDERS.includes(s.preferredProvider) ? s.preferredProvider : 'groq'
  return [pref, ...PROVIDERS.filter(p => p !== pref)].map(p => [p, keys[p]])
}
// Same order, but only providers whose model can read images and that have a key configured.
const visionProviderOrder = (s) => providerOrder(s).filter(([p, k]) => VISION_PROVIDERS.includes(p) && !!k)
const hasAnyKey = (s) => !!s.groqKey || !!s.deepseekKey || !!s.nvidiaKey

// True when at least one image-capable provider key is configured (used to enable image upload in the UI).
export const visionAvailable = () => visionProviderOrder(getSettings()).length > 0

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

const callProvider = async (provider, apiKey, messages, maxTokens, opts = {}) => {
  const endpoint = PROVIDER_ENDPOINT[provider]
  const model = opts.vision ? (PROVIDER_VISION_MODEL[provider] || PROVIDER_MODEL[provider]) : PROVIDER_MODEL[provider]
  const cleanKey = sanitizeHeader(apiKey).trim()
  if (!cleanKey) throw new Error(`No ${PROVIDER_LABEL[provider] || provider} API key configured`)
  const body = { model, messages, max_tokens: maxTokens, temperature: 0.2 }
  // gpt-oss is a reasoning model — keep reasoning-token overhead low so it doesn't eat the budget.
  // The Llama-4 vision model is not a reasoning model, so the flag is skipped when reading images.
  if (provider === 'groq' && !opts.vision) body.reasoning_effort = 'low'
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cleanKey}` },
      body: JSON.stringify(body),
    })
    const rawBody = await r.text()
    let data
    try { data = rawBody ? JSON.parse(rawBody) : {} }
    catch {
      // Non-JSON reply (usually index.html) means the /api proxy isn't serving this route.
      const name = PROVIDER_LABEL[provider] || provider
      if (r.status === 404 || /<!doctype html|<html/i.test(rawBody)) {
        throw new Error(`${name}: the /api proxy isn't reachable, so the request never hit ${name}. Run "npm run dev", or deploy to Vercel — a plain static server won't proxy /api.`)
      }
      throw new Error(`${name}: unexpected non-JSON response (HTTP ${r.status}).`)
    }
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
  if (!hasAnyKey(s)) throw new Error('NO_API_KEY')
  const order = providerOrder(s)
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

export const chatAI = async (systemPrompt, history, maxTokens = 1500, opts = {}) => {
  const s = getSettings()
  if (!hasAnyKey(s)) throw new Error('NO_API_KEY')
  const order = opts.vision ? visionProviderOrder(s) : providerOrder(s)
  if (opts.vision && order.length === 0) {
    throw new Error('Reading an image needs a Groq or NVIDIA API key — their Llama-4 vision models can see images. Add one in Settings, or remove the image and describe the question in text.')
  }
  const errors = []
  for (const [p, k] of order) {
    if (!k) continue
    try { return await callProvider(p, k, [{ role: 'system', content: systemPrompt }, ...history], maxTokens, { vision: opts.vision }) }
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

export const testGroqConnection = async (k) => { await callProvider('groq', k, [{ role: 'user', content: 'Say OK' }], 64); return true }
export const testDeepseekConnection = async (k) => { await callProvider('deepseek', k, [{ role: 'user', content: 'Say OK' }], 10); return true }
export const testNvidiaConnection = async (k) => { await callProvider('nvidia', k, [{ role: 'user', content: 'Say OK' }], 16); return true }
