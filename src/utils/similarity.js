// Anti-repeat for generated questions: similarity-based near-duplicate detection.
//
// NOTE: this is NOT embedding-based de-dup in the ML sense (no neural embedding model / API). It
// is a lightweight LOCAL lexical similarity filter: a bag-of-n-grams term-frequency vector plus
// cosine similarity. Cheap, dependency-free and good enough to stop the generator repeating
// itself; swap in a real embeddings model later if it proves insufficient.
//
// Key trick: number runs are masked to "#" before vectorising, so "increased by 25%" and
// "increased by 30%" collapse to the same fingerprint. That directly enforces the rule
// "a question is not new just because its numbers changed".
//
// A rolling fingerprint history is kept in localStorage so novelty holds across sessions/days.

const KEY = 'cat_gen_history'
const CAP = 500 // fingerprints retained (newest first)
const DEFAULT_THRESHOLD = 0.86

const load = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : [] } catch { return [] } }
const save = (a) => localStorage.setItem(KEY, JSON.stringify(a.slice(0, CAP)))

// Normalise: lowercase, mask digit runs, collapse whitespace, drop most punctuation.
const normalise = (text) => String(text || '')
  .toLowerCase()
  .replace(/\d+(?:[.,]\d+)?/g, '#')       // mask numbers so number-swaps count as duplicates
  .replace(/[^a-z#\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

// Sparse lexical vector = term-frequency map over word unigrams + bigrams of the normalised text.
export const lexVector = (text) => {
  const words = normalise(text).split(' ').filter(Boolean)
  const vec = new Map()
  const bump = (t) => vec.set(t, (vec.get(t) || 0) + 1)
  for (let i = 0; i < words.length; i++) {
    bump(words[i])
    if (i + 1 < words.length) bump(words[i] + ' ' + words[i + 1])
  }
  return vec
}

// Cosine similarity of two term-frequency maps (0..1).
export const cosine = (a, b) => {
  if (!a.size || !b.size) return 0
  const [small, large] = a.size < b.size ? [a, b] : [b, a]
  let dot = 0
  for (const [t, w] of small) { const w2 = large.get(t); if (w2) dot += w * w2 }
  let na = 0, nb = 0
  for (const w of a.values()) na += w * w
  for (const w of b.values()) nb += w * w
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

// Highest similarity of `text` against a list of {vec} or {question} records.
const maxSim = (vec, records) => {
  let best = 0
  for (const r of records) {
    const v = r.vec instanceof Map ? r.vec : lexVector(r.question || r.text || '')
    const s = cosine(vec, v)
    if (s > best) best = s
    if (best >= 0.999) break
  }
  return best
}

// True if `text` is too close to a previously generated question (optionally scoped to a topic).
export const isDuplicate = (text, { topicId = null, threshold = DEFAULT_THRESHOLD } = {}) => {
  const vec = lexVector(text)
  if (vec.size === 0) return false
  const hist = load().filter((h) => !topicId || h.topicId === topicId)
  return maxSim(vec, hist) >= threshold
}

// Record generated questions so future generations avoid repeating them.
export const rememberGenerated = (items, meta = {}) => {
  if (!items || !items.length) return
  const hist = load()
  const stamped = items
    .map((it) => (typeof it === 'string' ? it : it.question || it.q || it.passage || ''))
    .filter(Boolean)
    .map((q) => ({ q: q.slice(0, 400), topicId: meta.topicId || null, ts: Date.now() }))
  save([...stamped, ...hist])
}

// Filter a freshly generated batch down to the questions that are novel — both against history
// and against each other — then remember the survivors. Returns the novel items.
export const filterNovel = (items, meta = {}, threshold = DEFAULT_THRESHOLD) => {
  if (!Array.isArray(items) || items.length === 0) return items || []
  const topicId = meta.topicId || null
  const hist = load().filter((h) => !topicId || h.topicId === topicId).map((h) => ({ vec: lexVector(h.q) }))
  const keptVecs = []
  const kept = []
  for (const it of items) {
    const text = typeof it === 'string' ? it : it.question || it.q || it.passage || ''
    if (!text) { kept.push(it); continue }
    const vec = lexVector(text)
    if (maxSim(vec, hist) >= threshold) continue      // too close to a past question
    if (maxSim(vec, keptVecs) >= threshold) continue   // duplicate within this batch
    keptVecs.push({ vec })
    kept.push(it)
  }
  rememberGenerated(kept.length ? kept : items, meta)
  // Never return an empty set just because everything looked similar — keep the original batch
  // if de-dup would wipe it out (better to show questions than nothing).
  return kept.length ? kept : items
}

export const clearGenHistory = () => localStorage.removeItem(KEY)
