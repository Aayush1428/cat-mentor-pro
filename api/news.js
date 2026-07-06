const json = (res, status, payload) => res.status(status).json(payload)

const normalizeNewsApi = (a) => ({
  id: a.url,
  title: a.title,
  summary: a.description || a.content || '',
  source: a.source?.name || 'NewsAPI',
  url: a.url,
  image: a.urlToImage || '',
  publishedAt: a.publishedAt || '',
})

const normalizeNewsCatcher = (a) => ({
  id: a.link || a.id || a._id,
  title: a.title,
  summary: a.summary || a.excerpt || '',
  source: a.clean_url || a.rights || 'NewsCatcher',
  url: a.link,
  image: a.media || '',
  publishedAt: a.published_date || a.publishedAt || '',
})

const normalizeNewsData = (a) => ({
  id: a.article_id || a.link,
  title: a.title,
  summary: a.description || a.content || '',
  source: a.source_id || 'NewsData',
  url: a.link,
  image: a.image_url || '',
  publishedAt: a.pubDate || '',
})

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const auth = req.headers['authorization'] || ''
  const apiKey = auth.replace(/^Bearer\s+/i, '').trim()
  if (!apiKey) return json(res, 401, { error: 'Missing Authorization key' })

  const {
    provider,
    query = '',
    pageSize = 20,
    domains,
    category,
    country = 'in',
    language = 'en',
  } = req.body || {}

  try {
    if (provider === 'newsapi') {
      const url = new URL('https://newsapi.org/v2/everything')
      url.searchParams.set('q', query || 'India')
      url.searchParams.set('language', language)
      url.searchParams.set('sortBy', 'publishedAt')
      url.searchParams.set('pageSize', String(Math.min(50, Math.max(5, pageSize))))
      if (domains) url.searchParams.set('domains', domains)
      if (country) url.searchParams.set('country', country)
      if (category) url.searchParams.set('category', category)

      const r = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'X-Api-Key': apiKey },
      })
      const data = await r.json()
      if (!r.ok) return json(res, r.status, { error: data?.message || 'NewsAPI request failed' })
      return json(res, 200, { articles: (data.articles || []).map(normalizeNewsApi) })
    }

    if (provider === 'newscatcher') {
      const url = new URL('https://api.newscatcherapi.com/v2/search')
      url.searchParams.set('q', query || 'India')
      url.searchParams.set('lang', language)
      url.searchParams.set('page_size', String(Math.min(100, Math.max(5, pageSize))))
      url.searchParams.set('sort_by', 'date')
      if (domains) url.searchParams.set('sources', domains)
      if (country) url.searchParams.set('countries', country)
      if (category) url.searchParams.set('topic', category)

      const r = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'x-api-key': apiKey },
      })
      const data = await r.json()
      if (!r.ok) return json(res, r.status, { error: data?.message || 'NewsCatcher request failed' })
      return json(res, 200, { articles: (data.articles || []).map(normalizeNewsCatcher) })
    }

    if (provider === 'newsdata') {
      const url = new URL('https://newsdata.io/api/1/news')
      url.searchParams.set('apikey', apiKey)
      url.searchParams.set('q', query || 'India')
      url.searchParams.set('language', language)
      url.searchParams.set('country', String(country || 'in').toLowerCase())
      if (domains) url.searchParams.set('domainurl', domains)
      if (category) url.searchParams.set('category', category)

      const r = await fetch(url.toString(), { method: 'GET' })
      const data = await r.json()
      if (!r.ok || data?.status === 'error') {
        return json(res, r.ok ? 400 : r.status, { error: data?.results?.message || data?.message || 'NewsData request failed' })
      }
      return json(res, 200, { articles: (data.results || []).map(normalizeNewsData) })
    }

    return json(res, 400, { error: 'Unsupported provider' })
  } catch (e) {
    return json(res, 500, { error: e.message || 'Unexpected server error' })
  }
}
