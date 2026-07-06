// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTIC CAT PREVIOUS-YEAR QUESTIONS  (single source of truth for "real PYQs")
// ─────────────────────────────────────────────────────────────────────────────
//
// EVERY entry in OFFICIAL_PYQ must be a REAL question from an official CAT paper,
// transcribed from a verified public answer key such as:
//   • 2IIM        — https://online.2iim.com/CAT-question-paper/
//   • Cracku      — https://cracku.in/cat-previous-papers
//   • Bodhee Prep — https://bodheeprep.com/cat-question-paper-previous-years-pdf
//
// DO NOT add AI-generated, approximate, or "CAT-style" questions here. This file
// is what the app trusts as authentic. Keep it 100% real and year-accurate.
//
// You do NOT have to edit this file by hand — you can paste a JSON pack of verified
// questions in  Settings → Official PYQ Bank → Import.  Imported questions are
// stored in localStorage ('cat_official_pyq') and merged with anything below.
//
// ── Required schema ──────────────────────────────────────────────────────────
// {
//   id:        unique string        e.g. 'cat2023_qa_s2_q14'
//   year:      number 2017–2025
//   slot:      'Slot 1' | 'Slot 2' | 'Slot 3'
//   sectionId: 'QA' | 'DILR' | 'VARC'
//   topicId:   MUST match a topic id in curriculum.js  (e.g. 'qa_tsd')
//   topic:     human-readable topic name
//   type:      'MCQ' | 'TITA'       (TITA = type-in-the-answer, no options)
//   question:  full question text
//   options:   ['A) …','B) …','C) …','D) …']   (empty [] for TITA)
//   correct:   'A'|'B'|'C'|'D'  for MCQ   ·   the exact answer string for TITA
//   solution:  worked solution / explanation
//   source:    'Cracku' | '2IIM' | 'Bodhee Prep' | …
//   sourceUrl: (optional) link to the solved question
//   qNo:       (optional) original question number in the paper
//   verified:  true
// }
// ─────────────────────────────────────────────────────────────────────────────

export const OFFICIAL_PYQ = [
  // (Empty by design — no fabricated questions. Populate from verified sources
  //  using the schema above, or import a JSON pack in Settings.)
]

const STORAGE_KEY = 'cat_official_pyq'
const REQUIRED = ['id', 'year', 'sectionId', 'topicId', 'question', 'correct']

const readImported = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// Built-in authentic questions + any the user imported, de-duplicated by id.
export const loadOfficialPYQ = () => {
  const byId = {}
  ;[...OFFICIAL_PYQ, ...readImported()].forEach((q) => { if (q && q.id) byId[q.id] = q })
  return Object.values(byId)
}

export const getOfficialByTopic = (topicId) =>
  loadOfficialPYQ().filter((q) => q.topicId === topicId)

export const getOfficialYears = (topicId) => {
  const years = new Set(
    loadOfficialPYQ()
      .filter((q) => !topicId || q.topicId === topicId)
      .map((q) => q.year)
      .filter(Boolean),
  )
  return [...years].sort((a, b) => Number(b) - Number(a))
}

export const getOfficialCount = () => loadOfficialPYQ().length

// Validate + merge a user-supplied JSON pack of verified questions.
// Accepts either a raw array or an object with a `questions` array.
export const importOfficialPYQ = (jsonText, { merge = true } = {}) => {
  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('Invalid JSON — check for missing commas or brackets')
  }
  const incoming = Array.isArray(parsed) ? parsed : parsed?.questions
  if (!Array.isArray(incoming)) throw new Error('Expected a JSON array of questions')

  const valid = incoming.filter(
    (q) => q && typeof q === 'object' && REQUIRED.every((k) => q[k] !== undefined && q[k] !== null && q[k] !== ''),
  )
  if (valid.length === 0) {
    throw new Error(`No valid questions found — each needs: ${REQUIRED.join(', ')}`)
  }

  const existing = merge ? readImported() : []
  const byId = {}
  ;[...existing, ...valid].forEach((q) => { byId[q.id] = q })
  const finalArr = Object.values(byId)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalArr))
  } catch (e) {
    throw new Error('Could not save — storage may be full: ' + e.message)
  }
  return { added: valid.length, skipped: incoming.length - valid.length, total: finalArr.length }
}

export const clearOfficialPYQ = () => {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}
