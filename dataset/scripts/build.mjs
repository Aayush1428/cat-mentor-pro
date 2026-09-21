// Build the CAT question dataset.
//
// Aggregates the app's verified questions (src/data/pyqBank.js) plus any extra
// questions under dataset/sources/**/ and dataset/seed/**/ (.jsonl or .json),
// inferring section/topic from folder names, and normalises them to the schema
// in dataset/schema.json, and writes:
//   dataset/questions/qa.jsonl
//   dataset/questions/varc.jsonl
//   dataset/questions/dilr.jsonl
//   dataset/questions/all.jsonl      (everything, one JSON object per line)
//   dataset/manifest.json            (counts by section / topic / difficulty)
//
// Run:  node dataset/scripts/build.mjs      (or: npm run dataset:build)

import { writeFileSync, mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve, relative, sep } from 'node:path'
import { buildResolvers, slugify } from './lib/resolve.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const DATASET_DIR = resolve(scriptDir, '..')
const ROOT = resolve(DATASET_DIR, '..')
const OUT_DIR = join(DATASET_DIR, 'questions')
const SEED_DIR = join(DATASET_DIR, 'seed')
const SOURCES_DIR = join(DATASET_DIR, 'sources')
const PUBLIC_DIR = join(ROOT, 'public', 'dataset')

const SECTION_LABEL = {
  QA: 'Quantitative Aptitude',
  VARC: 'Verbal Ability & RC',
  DILR: 'Data Interpretation & LR',
}

// Top-level folder under sources/ → provenance tag.
const SOURCE_TAG = { 'previous-year': 'pyq', practice: 'practice', 'mba-pathshala': 'mba' }

// ── Load the app's data (pure ESM data modules, safe to import in Node) ────────
const { PYQ_BANK } = await import(pathToFileURL(join(ROOT, 'src/data/pyqBank.js')).href)
const { getAllTopics } = await import(pathToFileURL(join(ROOT, 'src/data/curriculum.js')).href)

const { resolveSection, resolveTopic, topicById } = buildResolvers(getAllTopics())

// ── Normalisation ──────────────────────────────────────────────────────────────
// ctx = { parts, source, fileBase, index } — parts are folder names used to infer
// section/topic when a record doesn't carry them explicitly.
const normalise = (q, ctx = {}) => {
  const options = Array.isArray(q.options) ? q.options.filter(Boolean).map(String) : []
  const parts = ctx.parts || []
  const sectionId = q.sectionId || resolveSection(parts)
  if (!sectionId) return null

  let { topicId, topic, tags } = q
  if (!topicId || !topic) {
    const r = resolveTopic(sectionId, parts)
    topicId = topicId || r.topicId
    topic = topic || r.topic
    tags = tags || r.tags
  }
  const t = topicById[topicId] || {}
  const id = q.id || `${ctx.source || 'q'}_${slugify(topicId || sectionId)}_${slugify(ctx.fileBase || 'x')}_${ctx.index ?? 0}`

  return {
    id: String(id),
    sectionId,
    section: SECTION_LABEL[sectionId] || sectionId,
    topicId: topicId || `${sectionId.toLowerCase()}_misc`,
    topic: topic || t.name || 'Miscellaneous',
    tags: Array.isArray(tags) && tags.length ? tags : t.tags || [],
    difficulty: q.difficulty || 'Medium',
    type: options.length ? 'MCQ' : 'TITA',
    question: String(q.question || '').trim(),
    options,
    correct: String(q.correct ?? '').trim(),
    concept: String(q.concept || '').trim(),
    solution: String(q.solution || '').trim(),
    source: q.source || ctx.source || 'sources',
    reference: String(q.reference || '').trim(),
  }
}

// ── Read structured question files (.jsonl one-per-line, or .json array) ───────
const readStructured = (rootDir, rootName) => {
  if (!existsSync(rootDir)) return []
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      const lower = entry.name.toLowerCase()
      if (!lower.endsWith('.jsonl') && !lower.endsWith('.json')) continue

      const parts = relative(rootDir, dir).split(sep).filter(Boolean)
      const source = rootName === 'seed' ? 'seed' : SOURCE_TAG[parts[0]] || parts[0] || 'sources'
      const fileBase = entry.name.replace(/\.(jsonl|json)$/i, '')
      const text = readFileSync(full, 'utf8')

      let records = []
      if (lower.endsWith('.jsonl')) {
        records = text.split('\n').map((l) => l.trim()).filter(Boolean).map((line, i) => {
          try { return JSON.parse(line) } catch (e) { console.warn(`  ! bad JSON ${relative(ROOT, full)}:${i + 1} — ${e.message}`); return null }
        })
      } else {
        try {
          const parsed = JSON.parse(text)
          records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : []
        } catch (e) { console.warn(`  ! bad JSON ${relative(ROOT, full)} — ${e.message}`) }
      }
      records.forEach((raw, index) => { if (raw) out.push({ raw, parts, source, fileBase, index }) })
    }
  }
  walk(rootDir)
  return out
}

// ── Merge (verified pyqBank wins id collisions) ────────────────────────────────
const byId = new Map()
let skipped = 0
for (const { raw, parts, source, fileBase, index } of [
  ...readStructured(SEED_DIR, 'seed'),
  ...readStructured(SOURCES_DIR, 'sources'),
]) {
  const rec = normalise(raw, { parts, source, fileBase, index })
  if (!rec) { skipped++; continue }
  byId.set(rec.id, rec)
}
PYQ_BANK.forEach((q) => { const rec = normalise(q, { source: 'pyqBank' }); if (rec) byId.set(rec.id, rec) })

const all = [...byId.values()].sort((a, b) => a.sectionId.localeCompare(b.sectionId) || a.id.localeCompare(b.id))
if (skipped) console.warn(`  ! skipped ${skipped} record(s) with no resolvable section — name a folder qa/varc/dilr or add "sectionId"`)

// ── Write per-section + combined JSONL ─────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
const toJsonl = (arr) => arr.map((r) => JSON.stringify(r)).join('\n') + '\n'

const sections = ['QA', 'VARC', 'DILR']
const files = []
for (const sec of sections) {
  const rows = all.filter((r) => r.sectionId === sec)
  const file = `questions/${sec.toLowerCase()}.jsonl`
  writeFileSync(join(DATASET_DIR, file), toJsonl(rows))
  files.push({ file, section: sec, count: rows.length })
}
writeFileSync(join(OUT_DIR, 'all.jsonl'), toJsonl(all))
files.push({ file: 'questions/all.jsonl', section: 'ALL', count: all.length })

// ── Manifest ───────────────────────────────────────────────────────────────────
const tally = (key) =>
  all.reduce((m, r) => ((m[r[key]] = (m[r[key]] || 0) + 1), m), {})

const byTopic = all.reduce((m, r) => {
  const k = `${r.sectionId}:${r.topicId}`
  m[k] = m[k] || { sectionId: r.sectionId, topicId: r.topicId, topic: r.topic, count: 0 }
  m[k].count++
  return m
}, {})

const manifest = {
  generatedAt: new Date().toISOString(),
  schema: 'schema.json',
  total: all.length,
  bySection: tally('sectionId'),
  byDifficulty: tally('difficulty'),
  byType: tally('type'),
  bySource: tally('source'),
  topics: Object.values(byTopic).sort((a, b) => b.count - a.count),
  files,
}
writeFileSync(join(DATASET_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(`Built dataset: ${all.length} questions`)
for (const f of files) console.log(`  ${f.file.padEnd(24)} ${f.count}`)
console.log('Wrote dataset/manifest.json')

// ── Publish a curated generation corpus for the app to fetch at runtime ────────
// Real questions the app grounds generation on: genuine previous-year (source 'pyq', from
// dataset/sources/previous-year/) AND the user's own practice material (source 'practice' /
// 'needs_practice', from dataset/sources/practice|needs_practice/). NOT pyqBank/seed (those are
// original CAT-*level* questions we author, not real source material to emulate). Each anchor
// carries sourceKind so callers can keep "previous-year only" flows honest while daily
// generators use everything. Grouped by "<sectionId>:<topicId>".
const SOURCE_KIND = { pyq: 'previous-year', practice: 'practice', needs_practice: 'needs-practice' }
const MAX_PER_TOPIC = 8
const genByTopic = {}
for (const r of all) {
  const kind = SOURCE_KIND[r.source]
  if (!kind || !r.topicId) continue
  const k = `${r.sectionId}:${r.topicId}`
  ;(genByTopic[k] ||= []).push({
    question: r.question.slice(0, 700),
    options: r.options,
    correct: r.correct,
    concept: r.concept,
    difficulty: r.difficulty,
    reference: r.reference || (kind === 'previous-year' ? 'CAT previous year' : 'my practice set'),
    sourceKind: kind,
    topic: r.topic,
    topicId: r.topicId,
    sectionId: r.sectionId,
  })
}
// Prefer previous-year first, then practice, then needs-practice, capped per topic.
const KIND_ORDER = { 'previous-year': 0, practice: 1, 'needs-practice': 2 }
for (const k of Object.keys(genByTopic)) {
  genByTopic[k] = genByTopic[k]
    .sort((a, b) => KIND_ORDER[a.sourceKind] - KIND_ORDER[b.sourceKind])
    .slice(0, MAX_PER_TOPIC)
}

mkdirSync(PUBLIC_DIR, { recursive: true })
const genCorpusCount = Object.values(genByTopic).reduce((s, a) => s + a.length, 0)
const kindTally = Object.values(genByTopic).flat().reduce((m, a) => ((m[a.sourceKind] = (m[a.sourceKind] || 0) + 1), m), {})
writeFileSync(join(PUBLIC_DIR, 'pyq_corpus.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  count: genCorpusCount,
  byKind: kindTally,
  byTopic: genByTopic,
}, null, 2) + '\n')
console.log(`Wrote public/dataset/pyq_corpus.json (${genCorpusCount} anchor question(s) across ${Object.keys(genByTopic).length} topic(s); ${JSON.stringify(kindTally)})`)
if (genCorpusCount === 0) console.log('  (empty — extract sources under dataset/sources/previous-year/ or /practice first: npm run dataset:extract)')
