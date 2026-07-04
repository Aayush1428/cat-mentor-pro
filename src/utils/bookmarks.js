// Error log + bookmarks: every wrong answer is auto-saved, and any question can be
// flagged for revision. Powers the Revision module (re-serve wrong/flagged questions).

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
