// Error log + bookmarks: every wrong answer is auto-saved, and any question can be
// flagged for revision. Powers the Revision module (re-serve wrong/flagged questions).

import { getAllTopics } from '../data/curriculum.js'

const KEY = 'cat_review'

const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
const save = (d) => localStorage.setItem(KEY, JSON.stringify(d))

// Stable id from the question text so the same question maps to the same record.
export const makeId = (stem = '') => {
  let h = 0
  const s = String(stem).trim()
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 }
  return 'q' + (h >>> 0).toString(36)
}

// item = { id, section, topic, source, stem, options, answer, explanation,
//          flagged, wrong, attempts, correctStreak, mastered, createdAt, updatedAt }
const upsert = (d, base) => {
  const id = makeId(base.stem)
  const now = new Date().toISOString()
  if (!d[id]) {
    d[id] = {
      id, section: base.section, topic: base.topic, source: base.source || '',
      stem: base.stem, options: base.options || null, answer: base.answer ?? '',
      explanation: base.explanation || '',
      flagged: false, wrong: false, attempts: 0, correctStreak: 0, mastered: false,
      createdAt: now, updatedAt: now,
    }
  }
  const it = d[id]
  it.updatedAt = now
  // keep richest content if a later call has more detail
  if (base.explanation && !it.explanation) it.explanation = base.explanation
  if (base.options && !it.options) it.options = base.options
  if (base.answer && !it.answer) it.answer = base.answer
  return it
}

// Called automatically on every graded submission.
export const logResult = ({ section, topic, source, stem, options, answer, explanation, isCorrect }) => {
  if (!stem) return
  const d = load()
  const it = upsert(d, { section, topic, source, stem, options, answer, explanation })
  it.attempts++
  if (isCorrect) {
    it.correctStreak++
    if (it.correctStreak >= 2) it.mastered = true
  } else {
    it.wrong = true
    it.correctStreak = 0
    it.mastered = false
  }
  save(d)
}

export const toggleFlag = ({ section, topic, source, stem, options, answer, explanation }) => {
  const d = load()
  const it = upsert(d, { section, topic, source, stem, options, answer, explanation })
  it.flagged = !it.flagged
  save(d)
  return it.flagged
}

export const isFlagged = (stem) => { const it = load()[makeId(stem)]; return !!(it && it.flagged) }

export const markMastered = (id) => {
  const d = load()
  if (d[id]) { d[id].mastered = true; d[id].correctStreak = Math.max(2, d[id].correctStreak); d[id].updatedAt = new Date().toISOString(); save(d) }
}

export const removeItem = (id) => { const d = load(); delete d[id]; save(d) }

export const clearReview = () => localStorage.removeItem(KEY)

// filter: 'all' | 'wrong' | 'flagged' | 'due' (wrong or flagged and not mastered)
export const getReviewItems = ({ filter = 'due', section = 'All' } = {}) => {
  let items = Object.values(load())
  if (section !== 'All') items = items.filter(i => i.section === section)
  if (filter === 'wrong') items = items.filter(i => i.wrong)
  else if (filter === 'flagged') items = items.filter(i => i.flagged)
  else if (filter === 'due') items = items.filter(i => (i.wrong || i.flagged) && !i.mastered)
  return items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export const getReviewStats = () => {
  const items = Object.values(load())
  return {
    total: items.length,
    wrong: items.filter(i => i.wrong).length,
    flagged: items.filter(i => i.flagged).length,
    due: items.filter(i => (i.wrong || i.flagged) && !i.mastered).length,
    mastered: items.filter(i => i.mastered).length,
  }
}

// ── Export to the dataset (dataset/sources/needs_practice/) ──────────────────
// Turns your wrong/flagged questions into records matching dataset/schema.json so they can
// be dropped into dataset/sources/needs_practice/ and picked up by `npm run dataset:build` —
// giving you a real, versioned "questions I need to practice" folder, not just localStorage.
const topicIdByName = () => {
  const m = {}
  for (const t of getAllTopics()) m[`${t.sectionId}::${t.name}`] = t.id
  return m
}
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

// filter: same as getReviewItems ('due' = not-yet-mastered wrong/flagged items, by default)
export const exportReviewAsDataset = ({ filter = 'due', section = 'All' } = {}) => {
  const nameToId = topicIdByName()
  const items = getReviewItems({ filter, section })
  return items.map((it, i) => ({
    id: `needs_practice_${slug(it.section)}_${slug(it.topic)}_${i}`,
    sectionId: it.section,
    topicId: nameToId[`${it.section}::${it.topic}`] || `${String(it.section || 'x').toLowerCase()}_${slug(it.topic)}`,
    topic: it.topic || 'Miscellaneous',
    difficulty: 'Medium',
    type: Array.isArray(it.options) && it.options.length ? 'MCQ' : 'TITA',
    question: it.stem,
    options: Array.isArray(it.options) ? it.options : [],
    correct: it.answer || '',
    concept: '',
    solution: it.explanation || '',
    source: 'needs_practice',
  })).filter(r => r.question)
}

// Downloads a .jsonl file ready to drop into dataset/sources/needs_practice/.
export const downloadReviewExport = ({ filter = 'due', section = 'All' } = {}) => {
  const rows = exportReviewAsDataset({ filter, section })
  if (!rows.length) return 0
  const blob = new Blob([rows.map(r => JSON.stringify(r)).join('\n') + '\n'], { type: 'application/x-ndjson' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `needs_practice_${new Date().toISOString().slice(0, 10)}.jsonl`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return rows.length
}
