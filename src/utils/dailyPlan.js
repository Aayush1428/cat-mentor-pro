// Personalisation + needs-practice engine (blueprint §5 weighted daily mix + §10 auto rules).
//
// Reads the performance store and the wrong-answer log to classify a section's topics into
// buckets (weak / slow / stale / fresh / strong), then assembles a deterministic-per-day
// "daily plan" of slots following the recommended composition — weak-area first, but balanced
// with revision, new learning and mixed CAT-style practice so it never drills only weak topics.

import { SECTIONS } from '../data/curriculum.js'
import { getTopicStats, getAccuracy, getAvgTime, getOverallStats } from './performance.js'
import { getReviewItems } from './bookmarks.js'

export const ROLES = { WEAK: 'weak', REVISION: 'revision', NEW: 'new', MIXED: 'mixed' }
export const ROLE_COPY = {
  weak: { label: 'Weak area', color: 'red', blurb: 'a concept you get wrong or solve slowly' },
  revision: { label: 'Revision', color: 'orange', blurb: 'something you practiced before — keep it fresh' },
  new: { label: 'New / under-practiced', color: 'blue', blurb: "a topic you've barely touched" },
  mixed: { label: 'Mixed CAT-style', color: 'green', blurb: 'a priority topic for all-round practice' },
}

const STALE_DAYS = 7
const daySeed = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) }
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Classify every topic in a section with its performance signals.
export const classifyTopics = (sectionId) => {
  const { avgTimeSec: target } = getOverallStats()
  const now = Date.now()
  const wrongByTopic = {}
  getReviewItems({ filter: 'wrong', section: sectionId }).forEach((r) => {
    wrongByTopic[r.topic] = (wrongByTopic[r.topic] || 0) + 1
  })
  return (SECTIONS[sectionId]?.topics || []).map((t) => {
    const stats = getTopicStats(sectionId, t.name)
    const acc = getAccuracy(stats)
    const avg = getAvgTime(stats)
    const attempts = stats.attempts || 0
    const last = stats.lastAttempt ? Date.parse(stats.lastAttempt) : 0
    const stale = last ? (now - last) / 86400000 > STALE_DAYS : true
    const wrongs = wrongByTopic[t.name] || 0
    const slow = avg != null && target != null && avg > target * 1.15
    const weak = (acc != null && acc < 60) || wrongs >= 2
    return { topicId: t.id, topic: t.name, sectionId, priority: t.priority, tags: t.tags, attempts, acc, avg, stale, slow, weak, wrongs }
  })
}

// The topics that the needs-practice engine flags for targeted work (weak or slow), worst first.
export const getNeedsPractice = (sectionId, limit = 8) =>
  classifyTopics(sectionId)
    .filter((t) => (t.weak || t.slow) && t.attempts > 0)
    .sort((a, b) => (a.acc ?? 100) - (b.acc ?? 100) || b.wrongs - a.wrongs)
    .slice(0, limit)

// A single "needs practice" score for ranking (higher = more in need). Uses only stored signals:
// weakness, slowness, tagged mistakes, under-practice and staleness — no invented metadata.
export const needScore = (t) => {
  let s = 0
  if (t.weak) s += 3
  if (t.slow) s += 2
  if (t.wrongs) s += Math.min(t.wrongs, 3)
  if (t.attempts < 2) s += 1
  if (t.stale) s += 1
  return s
}

// Reorder caller-supplied candidates (each carrying a topicId) by how much that topic needs
// practice, with a deterministic per-day shuffle breaking ties so the plan still rotates daily.
// This is the orchestration hook: section generators keep their own structure and only ask the
// common planner which candidates to prioritise. `saltStr` offsets the daily shuffle per caller.
export const rankByNeed = (sectionId, items, { getId = (x) => x.topicId, saltStr = '' } = {}) => {
  const byId = {}
  classifyTopics(sectionId).forEach((t) => { byId[t.topicId] = t })
  const rng = mulberry32(daySeed() * 17 + saltStr.length + sectionId.length)
  return items
    .map((it) => ({ it, score: byId[getId(it)] ? needScore(byId[getId(it)]) : 0, r: rng() }))
    .sort((a, b) => b.score - a.score || a.r - b.r)
    .map((x) => x.it)
}

// Need info keyed by curriculum topic NAME, for selectors that key by name (e.g. RC types).
export const getTopicNeedByName = (sectionId) => {
  const map = {}
  classifyTopics(sectionId).forEach((t) => { map[t.topic] = { ...t, score: needScore(t) } })
  return map
}

// How many of each role to include for a given set size.
const composition = (count) => {
  if (count >= 10) return { weak: 3, revision: 3, new: 2, mixed: 2 }
  if (count >= 5) return { weak: 2, revision: 1, new: 1, mixed: 1 }
  return { weak: Math.max(1, Math.ceil(count * 0.4)), revision: 0, new: Math.max(0, Math.floor(count * 0.3)), mixed: 0 }
}

const DIFF_BY_ROLE = { weak: 'Medium', revision: 'Medium', new: 'Easy', mixed: 'Hard' }

// Deterministic-per-day plan of `count` slots, each tagged with a role + difficulty. Weak-area
// first, then revision / new / mixed, with graceful fallback when a bucket is empty so the plan
// is always filled even on a fresh install with no history.
export const buildDailyComposition = (sectionId, count = 5) => {
  const rng = mulberry32(daySeed() * 13 + count + sectionId.length)
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
  const all = classifyTopics(sectionId)

  const weakPool = shuffle(all.filter((t) => t.weak || t.slow))
  const freshPool = shuffle(all.filter((t) => t.attempts < 2))
  const revisionPool = shuffle(all.filter((t) => t.attempts >= 2 && !t.weak)).sort((a, b) => Number(b.stale) - Number(a.stale))
  const mixedPool = shuffle(all).sort((a, b) => a.priority - b.priority)

  const used = new Set()
  const plan = []
  const take = (pools, role) => {
    for (const pool of pools) for (const c of pool) if (!used.has(c.topicId)) { used.add(c.topicId); plan.push({ ...c, role }); return true }
    return false
  }
  const fallbacks = {
    weak: [weakPool, mixedPool, revisionPool, freshPool],
    revision: [revisionPool, mixedPool, weakPool, freshPool],
    new: [freshPool, mixedPool, revisionPool, weakPool],
    mixed: [mixedPool, freshPool, revisionPool, weakPool],
  }
  const spec = composition(count)
  for (const role of ['weak', 'revision', 'new', 'mixed']) {
    for (let k = 0; k < (spec[role] || 0); k++) if (!take(fallbacks[role], role)) break
  }
  while (plan.length < count) if (!take([mixedPool, freshPool, weakPool, revisionPool], 'mixed')) break

  return plan.slice(0, count).map((p) => ({ ...p, difficulty: DIFF_BY_ROLE[p.role] || 'Medium' }))
}
