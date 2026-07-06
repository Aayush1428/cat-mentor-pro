import { callAI } from './ai.js'

const getSettings = () => { try { return JSON.parse(localStorage.getItem('cat_settings') || '{}') } catch { return {} } }

// NewsData-supported Indian sources (lokmattimes.com is not in their database).
const INDIA_DOMAINS = [
  'timesofindia.indiatimes.com',
  'hindustantimes.com',
  'thehindu.com',
  'ndtv.com',
].join(',')

const FINANCE_DOMAINS = [
  'economictimes.indiatimes.com',
  'livemint.com',
  'business-standard.com',
].join(',')

const MARKET_QUERY = 'IPO OR stock market OR shares OR Sensex OR Nifty OR NSE OR BSE'
const INDIA_QUERY = 'India OR policy OR education OR economy OR editorial'
const AI_QUERY = 'AI OR LLM OR machine learning OR data science OR MLOps'

const safeDate = (v) => {
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString()
  } catch {
    return ''
  }
}

const dedupe = (items) => {
  const seen = new Set()
  return items.filter((x) => {
    const k = (x.url || x.title || '').toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const sortByDateDesc = (items) =>
  items.slice().sort((a, b) => (safeDate(b.publishedAt) || '').localeCompare(safeDate(a.publishedAt) || ''))

const sanitizeHeader = (val) => {
  if (!val) return ''
  return String(val).replace(/[^\x00-\x7F]/g, '').trim()
}

const postProxy = async (provider, key, payload) => {
  if (!key) throw new Error(`No API key for ${provider}`)
  try {
    const r = await fetch('/api/news', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sanitizeHeader(key)}`,
      },
      body: JSON.stringify({ provider, ...payload }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data?.error || `${provider} request failed (HTTP ${r.status})`)
    return data.articles || []
  } catch (e) {
    if (e.message.includes('ISO-8859-1')) throw new Error(`${provider}: Invalid API key format (contains special characters)`)
    throw e
  }
}

const readFreeHN = async () => {
  const url = 'https://hn.algolia.com/api/v1/search_by_date?query=AI%20OR%20LLM%20OR%20machine%20learning&tags=story&hitsPerPage=25'
  const r = await fetch(url)
  if (!r.ok) return []
  const data = await r.json()
  return (data.hits || [])
    .filter((h) => h.url && h.title)
    .map((h) => ({
      id: h.objectID,
      title: h.title,
      summary: h.story_text || '',
      source: 'Hacker News',
      url: h.url,
      image: '',
      publishedAt: h.created_at,
    }))
}

const readFreeDevto = async () => {
  const r = await fetch('https://dev.to/api/articles?per_page=25&tag=ai')
  if (!r.ok) return []
  const data = await r.json()
  return (Array.isArray(data) ? data : []).map((a) => ({
    id: String(a.id),
    title: a.title,
    summary: a.description || '',
    source: 'Dev.to',
    url: a.url,
    image: a.cover_image || '',
    publishedAt: a.published_at,
  }))
}

const cacheGet = (key) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.savedAt || !Array.isArray(parsed.items)) return null
    const ageMin = (Date.now() - parsed.savedAt) / (1000 * 60)
    if (ageMin > 30) return null
    return parsed.items
  } catch {
    return null
  }
}

const cacheSet = (key, items) => {
  try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items })) } catch {}
}

const withCache = async (key, loader) => {
  const cached = cacheGet(key)
  if (cached) return cached
  const items = await loader()
  cacheSet(key, items)
  return items
}

export const getNewsProviderStatus = () => {
  const s = getSettings()
  return {
    hasNewsData: !!s.newsDataKey,
    hasNewsCatcher: !!s.newsCatcherKey,
    hasNewsApi: !!s.newsApiKey,
    hasAnyIndianNewsKey: !!(s.newsDataKey || s.newsCatcherKey || s.newsApiKey),
  }
}

const readIndianFromPaidApis = async () => {
  const s = getSettings()
  if (s.newsDataKey) {
    return postProxy('newsdata', s.newsDataKey, {
      query: INDIA_QUERY,
      pageSize: 25,
      domains: INDIA_DOMAINS,
      country: 'in',
      language: 'en',
    })
  }
  if (s.newsCatcherKey) {
    return postProxy('newscatcher', s.newsCatcherKey, {
      query: INDIA_QUERY,
      pageSize: 25,
      domains: INDIA_DOMAINS,
      country: 'IN',
      language: 'en',
    })
  }
  if (s.newsApiKey) {
    return postProxy('newsapi', s.newsApiKey, {
      query: INDIA_QUERY,
      pageSize: 25,
      domains: INDIA_DOMAINS,
      language: 'en',
    })
  }
  return []
}

const readFinanceFromPaidApis = async () => {
  const s = getSettings()
  if (s.newsDataKey) {
    return postProxy('newsdata', s.newsDataKey, {
      query: MARKET_QUERY,
      pageSize: 25,
      domains: FINANCE_DOMAINS,
      country: 'in',
      language: 'en',
      category: 'business',
    })
  }
  if (s.newsCatcherKey) {
    return postProxy('newscatcher', s.newsCatcherKey, {
      query: MARKET_QUERY,
      pageSize: 25,
      domains: FINANCE_DOMAINS,
      country: 'IN',
      language: 'en',
      category: 'business',
    })
  }
  if (s.newsApiKey) {
    return postProxy('newsapi', s.newsApiKey, {
      query: MARKET_QUERY,
      pageSize: 25,
      domains: FINANCE_DOMAINS,
      language: 'en',
    })
  }
  return []
}

export const fetchIndianReadingFeed = async () => {
  const paid = await withCache('cat_news_india', readIndianFromPaidApis)
  return sortByDateDesc(dedupe(paid)).slice(0, 20)
}

export const fetchFinanceReadingFeed = async () => {
  const paid = await withCache('cat_news_finance', readFinanceFromPaidApis)
  return sortByDateDesc(dedupe(paid)).slice(0, 20)
}

export const fetchAiTrendsFeed = async () => {
  const [hn, devto] = await Promise.all([
    withCache('cat_news_hn', readFreeHN),
    withCache('cat_news_devto', readFreeDevto),
  ])
  return sortByDateDesc(dedupe([...hn, ...devto])).slice(0, 30)
}

const WORD_SYSTEM = `You are a bilingual CAT vocabulary coach.
Return ONLY valid JSON.`

export const explainWordSimple = async (word, sentence = '') => {
  const prompt = `Explain this word for a CAT aspirant in easy language.
Word: ${word}
Sentence context: ${sentence || 'N/A'}

Return JSON:
{
  "word": "...",
  "simple_english": "...",
  "simple_hindi": "...",
  "cat_usage_tip": "...",
  "memory_hook": "..."
}`
  return callAI(WORD_SYSTEM, prompt, 500)
}

export const recordNewsRead = (section) => {
  const day = new Date().toISOString().slice(0, 10)
  const key = 'cat_news_read'
  let data = {}
  try { data = JSON.parse(localStorage.getItem(key) || '{}') } catch { data = {} }
  if (!data[day]) data[day] = { total: 0, india: 0, finance: 0, ai: 0 }
  data[day].total += 1
  if (section === 'india') data[day].india += 1
  if (section === 'finance') data[day].finance += 1
  if (section === 'ai') data[day].ai += 1
  localStorage.setItem(key, JSON.stringify(data))
}

export const getTodayNewsRead = () => {
  const day = new Date().toISOString().slice(0, 10)
  let data = {}
  try { data = JSON.parse(localStorage.getItem('cat_news_read') || '{}') } catch { data = {} }
  return data[day] || { total: 0, india: 0, finance: 0, ai: 0 }
}

const BRIEF_SYSTEM = `You are a CAT exam coach and editorial journalist.
Your task: read the article title + summary below and return ONLY valid JSON.`

const buildBriefPrompt = (title, summary, source) => `Article: "${title}" (Source: ${source})
Summary context: ${summary || 'Not available — infer from title.'}

Return JSON:
{
  "article_title": "${title.replace(/"/g, "'")}",
  "source": "${source}",
  "brief": "A 150-200 word summary of the article's core argument, written in clear editorial English. Readable in under 60 seconds.",
  "key_points": ["point 1", "point 2", "point 3"],
  "vocab_spotlight": [
    { "word": "advanced word from or related to topic", "meaning": "one-line English meaning" }
  ],
  "questions": [
    {
      "q": "CAT-style RC question based on the article",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": "A",
      "explanation": "why this is the correct answer",
      "type": "Main Idea"
    }
  ]
}

Include 5 varied questions with types: Main Idea, Inference, Author Tone, Vocabulary in Context, Detail.
Make correct answers varied — do NOT make every answer A.`

export const generateDailyBrief = async (article) => {
  if (!article?.title) throw new Error('No article provided')
  const today = new Date().toISOString().slice(0, 10)
  const cacheKey = `cat_brief_${today}_${(article.url || article.title).slice(0, 40).replace(/\W/g, '_')}`
  const cached = cacheGet(cacheKey)
  if (cached && typeof cached === 'object' && cached.brief) return cached

  const result = await callAI(
    BRIEF_SYSTEM,
    buildBriefPrompt(article.title, article.summary, article.source),
    1200,
  )
  cacheSet(cacheKey, result)
  return result
}

export const NEWS_QUERIES = { MARKET_QUERY, INDIA_QUERY, AI_QUERY }
