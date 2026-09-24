// Planner integration tests. Run with: npm run test:planner  (Node's built-in test runner).
//
// dailyPlan.js reads localStorage lazily via performance.js / bookmarks.js, so we install a
// minimal in-memory localStorage shim BEFORE importing the module under test.

import { test } from 'node:test'
import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

const { SECTIONS } = await import('../src/data/curriculum.js')
const { buildDailyComposition, classifyTopics, getNeedsPractice, rankByNeed } = await import('../src/utils/dailyPlan.js')

const qa = SECTIONS.QA.topics.map((t) => t.name)
const [weakName, strongName, freshName] = qa

const seed = () => {
  store.clear()
  const perf = {}
  perf[`QA__${weakName}`] = { section: 'QA', topic: weakName, attempts: 10, correct: 2, totalTime: 2000, lastAttempt: new Date().toISOString() }
  perf[`QA__${strongName}`] = { section: 'QA', topic: strongName, attempts: 10, correct: 9, totalTime: 300, lastAttempt: new Date().toISOString() }
  // freshName intentionally left unattempted
  store.set('cat_performance', JSON.stringify(perf))
}

test('classifyTopics flags weak / strong / fresh correctly', () => {
  seed()
  const c = classifyTopics('QA')
  assert.equal(c.find((t) => t.topic === weakName).weak, true)
  assert.equal(c.find((t) => t.topic === strongName).weak, false)
  assert.equal(c.find((t) => t.topic === freshName).attempts, 0)
})

test('getNeedsPractice surfaces the weak topic first', () => {
  seed()
  const needs = getNeedsPractice('QA')
  assert.ok(needs.length >= 1)
  assert.equal(needs[0].topic, weakName)
})

test('QA daily composition is exactly 5 distinct slots with the weighted role mix', () => {
  seed()
  const plan = buildDailyComposition('QA', 5)
  assert.equal(plan.length, 5)
  assert.equal(new Set(plan.map((p) => p.topicId)).size, 5)
  const roles = plan.reduce((m, p) => ((m[p.role] = (m[p.role] || 0) + 1), m), {})
  assert.deepEqual(roles, { weak: 2, revision: 1, new: 1, mixed: 1 })
})

test('QA daily composition is deterministic within a day', () => {
  seed()
  const a = buildDailyComposition('QA', 5).map((p) => p.topicId)
  const b = buildDailyComposition('QA', 5).map((p) => p.topicId)
  assert.deepEqual(a, b)
})

test('rankByNeed preserves DILR membership and floats weak set-types up', () => {
  seed()
  const perf = JSON.parse(store.get('cat_performance'))
  const weakDilr = SECTIONS.DILR.topics[3]
  perf[`DILR__${weakDilr.name}`] = { section: 'DILR', topic: weakDilr.name, attempts: 8, correct: 1, totalTime: 4000, lastAttempt: new Date().toISOString() }
  store.set('cat_performance', JSON.stringify(perf))

  const items = SECTIONS.DILR.topics.map((t) => ({ topicId: t.id }))
  const ranked = rankByNeed('DILR', items, { saltStr: 'test' })
  assert.equal(ranked.length, items.length) // same membership, only reordered
  assert.deepEqual(new Set(ranked.map((x) => x.topicId)), new Set(items.map((x) => x.topicId)))
  const pos = ranked.findIndex((x) => x.topicId === weakDilr.id)
  assert.ok(pos <= 2, `weak DILR type should rank near the front, got position ${pos}`)
})
