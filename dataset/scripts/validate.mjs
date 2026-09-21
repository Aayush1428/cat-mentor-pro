// Validate every question in dataset/questions/*.jsonl against dataset/schema.json.
// Dependency-free (no ajv): checks required fields, enums, and MCQ/TITA shape.
//
// Run:  node dataset/scripts/validate.mjs      (or: npm run dataset:validate)
// Exits with code 1 if any record is invalid.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const DATASET_DIR = resolve(scriptDir, '..')
const QUESTIONS_DIR = join(DATASET_DIR, 'questions')

const SECTIONS = ['QA', 'VARC', 'DILR']
const DIFFICULTIES = ['Easy', 'Medium', 'Hard']
const REQUIRED = ['id', 'sectionId', 'topicId', 'topic', 'difficulty', 'type', 'question', 'correct']

const errors = []
const seenIds = new Set()

const check = (r, where) => {
  const fail = (msg) => errors.push(`${where}: ${msg}`)
  for (const k of REQUIRED) {
    if (r[k] === undefined || r[k] === null || r[k] === '') fail(`missing "${k}"`)
  }
  if (r.sectionId && !SECTIONS.includes(r.sectionId)) fail(`bad sectionId "${r.sectionId}"`)
  if (r.difficulty && !DIFFICULTIES.includes(r.difficulty)) fail(`bad difficulty "${r.difficulty}"`)
  if (r.id) {
    if (seenIds.has(r.id)) fail(`duplicate id "${r.id}"`)
    seenIds.add(r.id)
  }
  const opts = Array.isArray(r.options) ? r.options : []
  if (r.type === 'MCQ') {
    if (opts.length !== 4) fail(`MCQ "${r.id}" must have exactly 4 options (has ${opts.length})`)
    if (!/^[A-D]$/.test(String(r.correct))) fail(`MCQ "${r.id}" correct must be A|B|C|D (got "${r.correct}")`)
  } else if (r.type === 'TITA') {
    if (opts.length !== 0) fail(`TITA "${r.id}" must have no options`)
    if (!String(r.correct).trim()) fail(`TITA "${r.id}" needs a non-empty answer`)
  } else if (r.type) {
    fail(`bad type "${r.type}" (expected MCQ|TITA)`)
  }
}

if (!existsSync(QUESTIONS_DIR)) {
  console.error('No dataset/questions/ folder — run: npm run dataset:build')
  process.exit(1)
}

let count = 0
for (const name of readdirSync(QUESTIONS_DIR)) {
  if (!name.endsWith('.jsonl') || name === 'all.jsonl') continue
  const lines = readFileSync(join(QUESTIONS_DIR, name), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  lines.forEach((line, i) => {
    count++
    try {
      check(JSON.parse(line), `${name}:${i + 1}`)
    } catch (e) {
      errors.push(`${name}:${i + 1}: invalid JSON — ${e.message}`)
    }
  })
}

if (errors.length) {
  console.error(`Validation FAILED — ${errors.length} problem(s):`)
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}
console.log(`Validation passed: ${count} questions OK`)
