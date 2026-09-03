// Captured questions bank — the AI Tutor "learns" from what you ask.
//
// Whenever you ask the tutor a real practice question, classifyAndCapture() analyses it,
// figures out which CAT section + topic it belongs to, and stores BOTH the question you
// asked and 2–3 fresh AI-written questions of the same pattern into localStorage. The
// Previous Papers screen then surfaces these per topic (a "From AI Tutor" tier), so the
// questions you struggle with keep coming back for practice in the right section.
//
// Shape mirrors pyqBank so the existing PYQ solver UI can render captured items as-is:
//   { id, sectionId, topicId, topic, difficulty, question, options[], correct, concept, solution, origin, ts }

import { callAI } from './ai.js'
import { getAllTopics, SECTIONS } from '../data/curriculum.js'
import { MBA_TOPICS } from '../data/mbaPathshala.js'

const KEY = 'cat_captured'
const DYN_KEY = 'cat_dyn_topics' // AI-Tutor-created topics (esp. brand-new LRDI question types)
const CAP = 300 // keep at most this many captured questions
const DYN_CAP = 60

const safeParse = (raw, fallback) => { try { return JSON.parse(raw) } catch { return fallback } }
const normQ = (q) => String(q || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 240)

export const getCaptured = () => {
  const arr = safeParse(localStorage.getItem(KEY), [])
  return Array.isArray(arr) ? arr : []
}
export const getCapturedCount = () => getCaptured().length
export const getCapturedBySection = (sectionId) => getCaptured().filter(q => q.sectionId === sectionId)
export const getCapturedByTopic = (topicId) => getCaptured().filter(q => q.topicId === topicId)

export const getCapturedTopics = (sectionId = 'All') => {
  const seen = {}
  getCaptured()
    .filter(q => sectionId === 'All' || q.sectionId === sectionId)
    .forEach(q => {
      if (!seen[q.topicId]) seen[q.topicId] = { topicId: q.topicId, topic: q.topic, sectionId: q.sectionId, count: 0 }
      seen[q.topicId].count++
    })
  return Object.values(seen).sort((a, b) => b.count - a.count)
}

export const clearCaptured = () => localStorage.removeItem(KEY)
export const removeCaptured = (id) => {
  const next = getCaptured().filter(q => q.id !== id)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

// ── Dynamic topics ────────────────────────────────────────────────────────────
// When the tutor sees a question type that no curriculum topic covers (common for novel
// DILR/LRDI sets), it mints a topic here so the new type gets its own practice section.
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

export const getDynTopics = () => {
  const a = safeParse(localStorage.getItem(DYN_KEY), [])
  return Array.isArray(a) ? a : []
}
export const getDynTopicsBySection = (sectionId) => getDynTopics().filter(t => t.sectionId === sectionId)
export const getDynTopicById = (id) => getDynTopics().find(t => t.id === id) || null

// Create-or-reuse a dynamic topic for (name, section). Returns the topic object or null.
export const ensureDynTopic = ({ name, sectionId }) => {
  const nm = String(name || '').trim()
  if (!nm || !SECTIONS[sectionId]) return null
  const list = getDynTopics()
  const existing = list.find(t => t.sectionId === sectionId && normQ(t.name) === normQ(nm))
  if (existing) return existing
  const t = { id: `dyn_${sectionId.toLowerCase()}_${slugify(nm)}_${Math.random().toString(36).slice(2, 5)}`, name: nm, sectionId, dynamic: true, ts: Date.now() }
  localStorage.setItem(DYN_KEY, JSON.stringify([t, ...list].slice(0, DYN_CAP)))
  return t
}
export const removeDynTopic = (id) => {
  localStorage.setItem(DYN_KEY, JSON.stringify(getDynTopics().filter(t => t.id !== id)))
  localStorage.setItem(KEY, JSON.stringify(getCaptured().filter(q => q.topicId !== id)))
}

// Persist new items, de-duplicating by (topicId + normalized question) and keeping newest first.
export const saveCaptured = (items) => {
  const existing = getCaptured()
  const seen = new Set(existing.map(q => `${q.topicId}::${normQ(q.question)}`))
  const fresh = []
  for (const it of items) {
    if (!it || !it.question) continue
    const sig = `${it.topicId}::${normQ(it.question)}`
    if (seen.has(sig)) continue
    seen.add(sig)
    fresh.push(it)
  }
  if (fresh.length === 0) return { added: 0, items: existing }
  const next = [...fresh, ...existing].slice(0, CAP)
  localStorage.setItem(KEY, JSON.stringify(next))
  return { added: fresh.length, items: next }
}

// Catalog of taggable topics (curriculum + AI-Tutor topics already created), rebuilt on each
// call so newly minted dynamic topics get reused instead of duplicated.
const CURRICULUM_IDS = new Set(getAllTopics().map(t => t.id))
const buildCatalog = () => [
  ...getAllTopics().map(t => `${t.sectionId} | ${t.id} | ${t.name}`),
  ...getDynTopics().map(t => `${t.sectionId} | ${t.id} | ${t.name} (AI-Tutor topic)`),
].join('\n')
const topicMetaById = (id) => {
  const c = getAllTopics().find(t => t.id === id)
  if (c) return { topic: c.name, sectionId: c.sectionId, dynamic: false }
  const d = getDynTopicById(id)
  if (d) return { topic: d.name, sectionId: d.sectionId, dynamic: true }
  return null
}
// MBA Pathshala sub-type profile for a QA topic name — used to ground generation on the
// same question types shown in the MBA Pathshala board.
const profileForTopicName = (name) => MBA_TOPICS.find(t => t.qaTopic === name || t.name === name)?.profile || ''

const CLASSIFY_SYSTEM = `You are a CAT exam question analyst and question writer. You read a student's doubt (and the tutor's worked answer) and do two jobs:
1) Decide whether the student's message contains an actual solvable PRACTICE QUESTION (a Quant/DILR/VARC problem), as opposed to a strategy/concept/greeting question.
2) If yes: classify it to the correct CAT section + topic, then WRITE 2-3 brand-new ORIGINAL practice questions of the SAME topic and difficulty pattern (never copy the student's wording verbatim; never claim any question is from a real exam year).

Rules:
- Prefer an EXISTING topic: set topicId to the best-fitting id copied EXACTLY from the catalog.
- Only if the question is a genuinely DISTINCT type that no catalog topic reasonably covers (most common for novel DILR/LRDI set types — e.g. truth-teller/liar logic, cube cutting/painting, network routing, binary logic), set "topicId": "NEW" and give "newTopic": { "name": "<short 2-4 word type name>", "sectionId": "DILR|QA|VARC" }.
- Every question you write needs exactly 4 options prefixed "A) ", "B) ", "C) ", "D) ", a single correct letter, a one-line concept, and a concise worked solution.
- For VARC (RC) or DILR questions that need a passage/data set, embed the passage or data INSIDE the question text so it is fully self-contained.
- Return ONLY valid JSON. No preamble, no markdown fences.`

const buildClassifyPrompt = (userText, answerText) => `Valid section | topicId | topic catalog:
${buildCatalog()}

STUDENT MESSAGE:
"""${(userText || '').slice(0, 3000)}"""

TUTOR ANSWER (use it to understand the problem, especially if the student attached an image):
"""${(answerText || '').slice(0, 3500)}"""

Return JSON of exactly this shape:
{
  "isPracticeQuestion": true,
  "sectionId": "QA" | "VARC" | "DILR",
  "topicId": "<an id copied from the catalog, or the literal NEW>",
  "newTopic": { "name": "<only when topicId is NEW>", "sectionId": "DILR" },
  "topic": "<the matching topic name>",
  "difficulty": "Easy" | "Medium" | "Hard",
  "asked": { "question": "<the student's question, cleaned up and self-contained>", "options": ["A) ...","B) ...","C) ...","D) ..."], "correct": "A", "concept": "<one line>", "solution": "<concise steps>" },
  "similar": [
    { "question": "...", "options": ["A) ...","B) ...","C) ...","D) ..."], "correct": "B", "concept": "...", "solution": "..." },
    { "question": "...", "options": ["A) ...","B) ...","C) ...","D) ..."], "correct": "C", "concept": "...", "solution": "..." }
  ]
}
Omit "newTopic" unless topicId is NEW. If the message is NOT a practice question (strategy, a concept explanation, small talk, etc.), return exactly: { "isPracticeQuestion": false }`

// Cheap gate so we don't spend a call on greetings / pure strategy questions.
const looksLikeQuestion = (text) => {
  const t = String(text || '')
  if (t.length < 25) return false
  return /\?/.test(t) || /\d/.test(t) || /\b(find|solve|calculate|how many|what is|value of|ratio|probability|remainder|average|speed|percent)\b/i.test(t)
}

const toItem = (raw, meta, origin) => {
  if (!raw || !raw.question) return null
  const options = Array.isArray(raw.options) ? raw.options.filter(Boolean).map(String) : []
  const correct = String(raw.correct || '').trim().toUpperCase().charAt(0)
  return {
    id: `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    sectionId: meta.sectionId,
    topicId: meta.topicId,
    topic: meta.topic,
    difficulty: meta.difficulty || 'Medium',
    question: String(raw.question).trim(),
    options,
    correct: /^[A-D]$/.test(correct) ? correct : 'A',
    concept: String(raw.concept || meta.topic || '').trim(),
    solution: String(raw.solution || '').trim(),
    origin, // 'asked' | 'similar' | 'generated'
    dynamic: !!meta.dynamic,
    ts: Date.now(),
  }
}

// Analyse one Q&A exchange and, if it was a practice question, store the asked + similar questions.
// Returns { added, sectionId, topicId, topic } on success, or { added: 0 } otherwise. Never throws.
export const classifyAndCapture = async ({ userText, answerText }) => {
  try {
    if (!looksLikeQuestion(userText) && !looksLikeQuestion(answerText)) return { added: 0 }
    const d = await callAI(CLASSIFY_SYSTEM, buildClassifyPrompt(userText, answerText), 2600)
    if (!d || d.isPracticeQuestion !== true) return { added: 0 }

    // Map to an existing topic, or mint a new AI-Tutor topic when the model flags a NEW type.
    const rawId = String(d.topicId || '').trim()
    let meta, mintedNew = false
    if (rawId === 'NEW' && d.newTopic && SECTIONS[d.newTopic.sectionId]) {
      const created = ensureDynTopic(d.newTopic)
      if (!created) return { added: 0 }
      mintedNew = getCapturedByTopic(created.id).length === 0
      meta = { sectionId: created.sectionId, topicId: created.id, topic: created.name, difficulty: d.difficulty, dynamic: true }
    } else {
      const m = topicMetaById(rawId)
      if (!m) return { added: 0 }
      meta = { sectionId: m.sectionId, topicId: rawId, topic: m.topic || d.topic, difficulty: d.difficulty, dynamic: m.dynamic }
    }

    const items = []
    const asked = toItem(d.asked, meta, 'asked')
    if (asked && asked.options.length === 4) items.push(asked)
    if (Array.isArray(d.similar)) {
      d.similar.slice(0, 3).forEach(s => {
        const it = toItem(s, meta, 'similar')
        if (it && it.options.length === 4) items.push(it)
      })
    }
    if (items.length === 0) return { added: 0 }
    const { added } = saveCaptured(items)
    return { added, sectionId: meta.sectionId, topicId: meta.topicId, topic: meta.topic, newTopic: mintedNew }
  } catch {
    return { added: 0 }
  }
}

// ── Generate-from-learned ──────────────────────────────────────────────────────
// On demand, write NEW original CAT-style questions of a topic, anchored on the
// questions the tutor already captured for it (and, for QA, the MBA Pathshala
// sub-type profile). Saves them (origin 'generated') and returns them.
const SIMILAR_SYSTEM = `You are a CAT question writer. Given a topic and example questions of that topic, you write NEW original CAT-level multiple-choice questions of the SAME type, difficulty and pattern. Never copy an example verbatim; never attribute a question to a real exam year. Return ONLY a valid JSON array, no preamble or markdown fences.`

const buildSimilarPrompt = (topicName, sectionLabel, examples, count, profile) =>
  `Topic: ${topicName} (${sectionLabel}).
${profile ? `Sub-types to cover (rotate across them): ${profile}\n` : ''}${examples.length ? `Example questions of this EXACT type — match their style, structure and difficulty:\n${examples.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}\n` : ''}
Write ${count} NEW original questions of the SAME type. For any question needing a passage or data set, embed it inside the question text. Return ONLY a JSON array:
[{"question":"...","options":["A) ","B) ","C) ","D) "],"correct":"A","concept":"one line","solution":"concise steps"}]`

export const generateSimilarQuestions = async ({ topicId, topicName, sectionId, sectionLabel, count = 4, profile }) => {
  const examples = getCapturedByTopic(topicId).filter(q => q.origin !== 'generated').slice(0, 5)
  const prof = profile != null ? profile : profileForTopicName(topicName)
  const arr = await callAI(SIMILAR_SYSTEM, buildSimilarPrompt(topicName, sectionLabel || sectionId, examples, count, prof), 2600)
  const list = Array.isArray(arr) ? arr : []
  const meta = { sectionId, topicId, topic: topicName, difficulty: 'Medium', dynamic: !CURRICULUM_IDS.has(topicId) }
  const items = list.map(s => toItem(s, meta, 'generated')).filter(it => it && it.options.length === 4)
  if (items.length) saveCaptured(items)
  return items
}
