// Spaced repetition for vocabulary (Leitner system). Words you save go into a deck
// and resurface only when they are "due" — the proven way to move words into
// long-term memory instead of forgetting them the next day.

const KEY = 'cat_srs'

// Days until a card in each box becomes due again (box 1 = new/just-lapsed).
const BOX_INTERVALS = [0, 1, 2, 4, 8, 16]
const MAX_BOX = 5

const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
const save = (d) => localStorage.setItem(KEY, JSON.stringify(d))

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d }
const key = (w) => String(w || '').trim().toLowerCase()

export const hasCard = (word) => !!load()[key(word)]

// wordObj is the full daily-word object (word, meaning, synonyms, ...). Stored so the
// deck can render a full flashcard without another AI call.
export const addCard = (wordObj) => {
  const d = load()
  const k = key(wordObj.word)
  if (!k || d[k]) return false
  d[k] = {
    ...wordObj,
    box: 1,
    reps: 0,
    lapses: 0,
    due: startOfToday().toISOString(),
    addedAt: new Date().toISOString(),
  }
  save(d)
  return true
}

export const removeCard = (word) => { const d = load(); delete d[key(word)]; save(d) }

// remembered = true -> promote a box; false -> reset to box 1.
export const reviewCard = (word, remembered) => {
  const d = load()
  const c = d[key(word)]
  if (!c) return
  c.reps++
  if (remembered) {
    c.box = Math.min(MAX_BOX, c.box + 1)
  } else {
    c.box = 1
    c.lapses++
  }
  c.due = addDays(startOfToday(), BOX_INTERVALS[c.box]).toISOString()
  c.lastReviewed = new Date().toISOString()
  save(d)
}

export const getDueCards = () => {
  const now = startOfToday().getTime()
  return Object.values(load())
    .filter(c => new Date(c.due).getTime() <= now)
    .sort((a, b) => new Date(a.due) - new Date(b.due))
}

export const getAllCards = () => Object.values(load()).sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))

export const getDeckStats = () => {
  const cards = Object.values(load())
  const now = startOfToday().getTime()
  return {
    total: cards.length,
    due: cards.filter(c => new Date(c.due).getTime() <= now).length,
    mastered: cards.filter(c => c.box >= MAX_BOX).length,
    learning: cards.filter(c => c.box < MAX_BOX).length,
  }
}

export const MAX_SRS_BOX = MAX_BOX
