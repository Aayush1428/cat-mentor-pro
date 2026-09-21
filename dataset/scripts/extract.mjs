// Extract structured questions from IMAGES / screenshots / PDFs / DOCX using a vision LLM.
//
// Reads image files (.png .jpg .jpeg .webp), .pdf files, AND .docx files under a folder. PDFs are
// rasterized page-by-page (pdfjs-dist + @napi-rs/canvas, no system deps like poppler
// needed) before being sent to the vision model. DOCX practice docs are read as text (mammoth)
// with any embedded data images (jszip) sent alongside — so a Word doc of typed questions, or one
// with a pasted table image, both work. Writes a sibling `<name>.extracted.jsonl` that
// `npm run dataset:build` then picks up. Section/topic are taken from the folder path
// (see dataset/scripts/lib/resolve.mjs); for --mba they come from the slug map in
// src/data/mbaPathshala.js.
//
// Usage:
//   GROQ_API_KEY=...  node dataset/scripts/extract.mjs            # scan dataset/sources
//   NVIDIA_API_KEY=... node dataset/scripts/extract.mjs --mba     # extract MBA Pathshala images
//   node dataset/scripts/extract.mjs --dry-run                    # preview, no API calls
//
// Flags: --dir <path>  --mba  --force  --dry-run  --limit <n>
//        --provider groq|nvidia  --model <id>  --section QA|VARC|DILR  --topic <name>
//        --max-pages <n>   (per PDF, default 25)   --scale <n>  (PDF render scale, default 1.6)
//
// The API key is read from the environment only — it is never written to disk.
// These transcriptions are for your own local practice dataset; when GENERATING new
// questions later, the prompt in prompts/generate-similar.md avoids copying source text.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve, relative, sep, basename } from 'node:path'
import { buildResolvers, slugify } from './lib/resolve.mjs'
import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import mammoth from 'mammoth'
import JSZip from 'jszip'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const DATASET_DIR = resolve(scriptDir, '..')
const ROOT = resolve(DATASET_DIR, '..')
const SOURCES_DIR = join(DATASET_DIR, 'sources')

// ── args ───────────────────────────────────────────────────────────────────────
const parseArgs = (argv) => {
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (!t.startsWith('--')) continue
    const key = t.slice(2)
    if (key.includes('=')) { const [k, v] = key.split(/=(.*)/s); a[k] = v; continue }
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) { a[key] = next; i++ } else a[key] = true
  }
  return a
}
const args = parseArgs(process.argv.slice(2))
const DRY = !!(args['dry-run'] || args.dryRun)
const FORCE = !!args.force
const MBA = !!args.mba
const LIMIT = args.limit ? Number(args.limit) : Infinity
const targetDir = resolve(ROOT, args.dir || (MBA ? 'public/mba-pathshala' : 'dataset/sources'))
const MAX_PAGES = args['max-pages'] ? Number(args['max-pages']) : 25
const PDF_SCALE = args.scale ? Number(args.scale) : 1.6

const IMAGE_RE = /\.(png|jpe?g|webp)$/i
const PDF_RE = /\.pdf$/i
const DOCX_RE = /\.docx$/i
const SOURCE_RE = /\.(png|jpe?g|webp|pdf|docx)$/i
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
const NVIDIA_MAX_B64 = 180000 // integrate.api.nvidia.com inline-image cap (~180KB)
const DOCX_CHUNK = 6000 // split large docs into ~6k-char chunks so each call fits the token budget
const STANDARD_FONTS_URL = pathToFileURL(join(ROOT, 'node_modules/pdfjs-dist/standard_fonts') + sep).href

// ── PDF → page images (no poppler/ghostscript needed) ────────────────────────────
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height)
    return { canvas, context: canvas.getContext('2d') }
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0
    canvasAndContext.canvas.height = 0
    canvasAndContext.canvas = null
    canvasAndContext.context = null
  }
}

const pdfPageCount = async (pdfPath) => {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(pdfPath)), disableFontFace: true, isEvalSupported: false, standardFontDataUrl: STANDARD_FONTS_URL }).promise
  const n = doc.numPages
  if (doc.cleanup) await doc.cleanup()
  return n
}

// Renders up to MAX_PAGES pages of a PDF to PNG buffers at PDF_SCALE.
const renderPdfPages = async (pdfPath) => {
  const canvasFactory = new NodeCanvasFactory()
  const doc = await getDocument({ data: new Uint8Array(readFileSync(pdfPath)), disableFontFace: true, isEvalSupported: false, canvasFactory, standardFontDataUrl: STANDARD_FONTS_URL }).promise
  const n = Math.min(doc.numPages, MAX_PAGES)
  const totalPages = doc.numPages
  const buffers = []
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: PDF_SCALE })
    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height)
    await page.render({ canvasContext: context, viewport, canvasFactory }).promise
    buffers.push(canvas.toBuffer('image/png'))
    canvasFactory.destroy({ canvas, context })
  }
  if (doc.cleanup) await doc.cleanup()
  return { buffers, totalPages }
}

// ── DOCX → text + embedded images ────────────────────────────────────────────────
const readDocx = async (docxPath) => {
  const buf = readFileSync(docxPath)
  let text = ''
  try { text = (await mammoth.extractRawText({ buffer: buf })).value.trim() } catch { text = '' }
  const images = []
  try {
    const zip = await JSZip.loadAsync(buf)
    for (const name of Object.keys(zip.files)) {
      if (/word\/media\/.*\.(png|jpe?g|webp)$/i.test(name)) images.push(await zip.files[name].async('nodebuffer'))
    }
  } catch { /* no media */ }
  return { text, images }
}

// Split long doc text into ~DOCX_CHUNK-char chunks on line boundaries so each call fits the budget.
const chunkText = (text) => {
  if (text.length <= DOCX_CHUNK) return [text]
  const chunks = []
  let rest = text
  while (rest.length > DOCX_CHUNK) {
    let cut = rest.lastIndexOf('\n', DOCX_CHUNK)
    if (cut < DOCX_CHUNK * 0.5) cut = DOCX_CHUNK
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest.trim()) chunks.push(rest)
  return chunks
}

// ── provider / key ───────────────────────────────────────────────────────────────
const PROVIDERS = {
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'],
    env: 'GROQ_API_KEY',
  },
  nvidia: {
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    models: ['meta/llama-3.2-90b-vision-instruct', 'meta/llama-3.2-11b-vision-instruct'],
    env: 'NVIDIA_API_KEY',
  },
}

const pickProvider = () => {
  if (args.provider) return String(args.provider)
  if (process.env.GROQ_API_KEY) return 'groq'
  if (process.env.NVIDIA_API_KEY) return 'nvidia'
  if (process.env.VISION_API_KEY && process.env.VISION_PROVIDER) return String(process.env.VISION_PROVIDER)
  return null
}
const providerName = pickProvider()
const provider = providerName && PROVIDERS[providerName]
const apiKey = provider && (process.env[provider.env] || process.env.VISION_API_KEY)
const models = args.model ? [String(args.model)] : provider ? provider.models : []

// ── topic resolution ─────────────────────────────────────────────────────────────
const { getAllTopics } = await import(pathToFileURL(join(ROOT, 'src/data/curriculum.js')).href)
const topics = getAllTopics()
const { resolveSection, resolveTopic, topicById } = buildResolvers(topics)
const topicByName = Object.fromEntries(topics.map((t) => [t.name, t]))

let mbaSlugMap = {}
if (MBA) {
  try {
    const { MBA_TOPICS } = await import(pathToFileURL(join(ROOT, 'src/data/mbaPathshala.js')).href)
    mbaSlugMap = Object.fromEntries(
      MBA_TOPICS.map((m) => {
        const t = topicByName[m.qaTopic] || {}
        return [m.slug, { sectionId: 'QA', topicId: t.id || `qa_${slugify(m.qaTopic)}`, topic: t.name || m.qaTopic }]
      }),
    )
  } catch (e) {
    console.warn('  ! could not load MBA topic map: ' + e.message)
  }
}

// ── gather images + resolve destination/topic per file ───────────────────────────
const walkImages = (dir) => {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkImages(full))
    else if (entry.name.startsWith('~$')) continue // Word lock/owner file, not a real doc
    else if (SOURCE_RE.test(entry.name)) out.push(full)
  }
  return out
}

const planFor = (imgPath) => {
  const dir = dirname(imgPath)
  const isPdf = PDF_RE.test(imgPath)
  const isDocx = DOCX_RE.test(imgPath)
  const base = basename(imgPath).replace(SOURCE_RE, '')
  const underSources = imgPath.startsWith(SOURCES_DIR + sep)

  let sectionId, topicId, topic, source, outPath
  if (MBA) {
    const slug = basename(dir)
    const m = mbaSlugMap[slug] || {}
    sectionId = m.sectionId || 'QA'
    topicId = m.topicId || `qa_${slugify(slug)}`
    topic = m.topic || slug
    source = 'mba'
    outPath = join(SOURCES_DIR, 'mba-pathshala', relative(targetDir, imgPath)).replace(SOURCE_RE, '.extracted.jsonl')
  } else {
    const parts = (underSources ? relative(SOURCES_DIR, dir) : relative(targetDir, dir)).split(sep).filter(Boolean)
    sectionId = args.section || resolveSection(parts)
    const r = sectionId ? resolveTopic(sectionId, parts) : {}
    topicId = args.topic ? `${(sectionId || 'x').toLowerCase()}_${slugify(args.topic)}` : r.topicId
    topic = args.topic || r.topic
    source = underSources ? { 'previous-year': 'pyq', practice: 'practice', 'mba-pathshala': 'mba' }[parts[0]] || parts[0] : slugify(basename(targetDir))
    outPath = underSources
      ? join(dir, base + '.extracted.jsonl')
      : join(SOURCES_DIR, '_extracted', slugify(basename(targetDir)), relative(targetDir, imgPath)).replace(SOURCE_RE, '.extracted.jsonl')
  }
  return { imgPath, outPath, sectionId, topicId, topic, source, base, isPdf, isDocx }
}

// ── vision call ──────────────────────────────────────────────────────────────────
const SYSTEM = 'You are a CAT exam expert who transcribes question images into structured JSON. Return ONLY a JSON array — no markdown, no preamble.'

// Prompt for a DOCX text chunk (typed practice questions; images, if any, are attached too).
const docxPromptFor = (p, text, hasImage) =>
  `The following is text from a practice document of CAT ${p.sectionId || ''} question(s)${p.topic ? ` on "${p.topic}"` : ''}. ` +
  `${hasImage ? 'An accompanying image contains a data table/figure the questions refer to — read it and fold that data into the questions. ' : ''}` +
  `Transcribe EACH complete question into an object with keys: ` +
  `"question" (full self-contained text; for RC/DILR embed the passage/data set — including any table shown in the image — INSIDE the question), ` +
  `"options" (array ["A) ...","B) ...","C) ...","D) ..."]; [] if not multiple-choice), ` +
  `"correct" ("A"|"B"|"C"|"D", or the exact answer for non-MCQ; if the document gives an answer key use it, else solve it), ` +
  `"difficulty" ("Easy"|"Medium"|"Hard"), "concept" (idea tested), "solution" (concise worked solution), ` +
  `"topicLabel" (topic name if the document states one for the question, else ""), ` +
  `"questionNumber" (the question's printed number as an integer, e.g. 2 for "Question 2" — 0 if not shown), ` +
  `"reference" (any set/test id printed, e.g. "RC #130" or "LR SET #176", else ""). ` +
  `Ignore headers/instructions that are not themselves questions. Preserve math as plain text. Return ONLY a JSON array of these objects.\n\nDOCUMENT TEXT:\n"""${text}"""`

const promptFor = (p) =>
  `This image contains one or more CAT-style ${p.sectionId || ''} practice questions${p.topic ? ` on "${p.topic}"` : ''}. ` +
  `Transcribe EACH question into an object with keys: ` +
  `"question" (full self-contained text; include any passage/data table shown), ` +
  `"options" (array like ["A) ...","B) ...","C) ...","D) ..."]; use [] if it is not multiple-choice), ` +
  `"correct" ("A"|"B"|"C"|"D" for MCQ, or the exact answer for non-MCQ; if not shown, solve it yourself), ` +
  `"difficulty" ("Easy"|"Medium"|"Hard"), "concept" (the idea tested), "solution" (concise worked solution), ` +
  `"topicLabel" (the topic name EXACTLY as printed on the page/header for this question, e.g. "Percentages" or "Time, Speed & Distance" — empty string if no topic label is shown), ` +
  `"questionNumber" (the question's printed number on the page as an integer, e.g. 2 for "Q2"/"Question 2" — 0 if not shown), ` +
  `"reference" (any paper/slot/year citation printed near the question, e.g. "CAT 2025 Slot 2" — empty string if nothing is shown). ` +
  `Preserve math as plain text. Return ONLY a JSON array of these objects.`

const parseJSON = (text) => {
  let s = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const a = s.indexOf('['), b = s.lastIndexOf(']')
  if (a !== -1 && b > a) s = s.slice(a, b + 1)
  return JSON.parse(s)
}

// Runs one OpenAI-style `content` array (text and/or image_url parts) through the model,
// falling through candidate models on a model-unavailable error. Returns the parsed JSON array.
const callModel = async (content, maxTokens = 3000) => {
  let lastErr
  for (const model of models) {
    try {
      const res = await fetch(provider.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content },
          ],
          temperature: 0.2,
          max_tokens: maxTokens,
          stream: false,
        }),
      })
      const raw = await res.text()
      let data
      try { data = JSON.parse(raw) } catch { throw new Error(`non-JSON response (HTTP ${res.status}): ${raw.slice(0, 200)}`) }
      if (!res.ok) {
        const msg = data?.error?.message || data?.detail || data?.title || `HTTP ${res.status}`
        if (/model|access|exist|not found|decommission|gone|retired/i.test(msg)) { lastErr = new Error(msg); continue }
        throw new Error(msg)
      }
      const out = data?.choices?.[0]?.message?.content
      return parseJSON(out)
    } catch (e) {
      lastErr = e
      if (!/model|access|exist|not found/i.test(e.message)) break
    }
  }
  throw lastErr || new Error('model call failed')
}

const callVision = (dataUrl, text) => callModel([{ type: 'text', text }, { type: 'image_url', image_url: { url: dataUrl } }], 2000)

// Some PYQ sources print a broad, catch-all label (e.g. plain "Geometry" covering triangles,
// circles, mensuration, coordinate geometry...) that happens to substring-match ONE specific
// curriculum topic by coincidence — that's a false positive, not a real classification, so
// these are excluded from the per-question label override (falls back to the folder topic).
const AMBIGUOUS_LABELS = new Set(['geometry', 'algebra', 'arithmetic', 'numbers', 'number-system', 'modern-math', 'modern-maths'])

// Turn a source filename into a human citation, e.g. "CAT_2025_Slot_1_Quant_with_Topics" →
// "CAT 2025 Slot 1" (drops filler words + long numeric/hex id tokens). Used to build a
// per-question reference like "CAT 2025 Slot 1 Q2" when the file itself doesn't print one.
const FILLER_TOKENS = /^(quant|quantitative|aptitude|maths?|with|topics?|section|paper|papers|questions?|varc|dilr|lrdi|di|lr|va)$/i
const cleanFileRef = (base) => String(base || '')
  .split(/[\s_\-]+/)
  .filter((t) => t && !FILLER_TOKENS.test(t) && !/^[0-9a-f]{8,}$/i.test(t) && !/^\d{6,}$/.test(t))
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim()

const toRecord = (raw, p, i, pageNum) => {
  const options = Array.isArray(raw.options) ? raw.options.filter(Boolean).map(String).slice(0, 4) : []
  const correct = String(raw.correct ?? '').trim()
  const suffix = pageNum ? `_p${pageNum}_${i}` : `_${i}`
  // A per-question topic label printed in the PDF (common in "...with Topics" PYQ exports)
  // overrides the folder-inferred topic, since one PDF/page often mixes several topics. Only
  // trust it when it resolves to a REAL curriculum topic id and isn't one of the too-generic
  // catch-all labels above — a vague label like "Geometry" falls through to the folder topic.
  const label = String(raw.topicLabel || '').trim()
  const labelSlug = slugify(label)
  const labelMatch = label && p.sectionId && !AMBIGUOUS_LABELS.has(labelSlug) ? resolveTopic(p.sectionId, [label]) : null
  const confident = labelMatch && topicById[labelMatch.topicId]
  const topicId = (confident && labelMatch.topicId) || p.topicId
  const topic = (confident && labelMatch.topic) || p.topic
  // Reference: use whatever the doc prints (e.g. "RC #130", "LR SET #176"); otherwise build one
  // from the file name + question number, e.g. "CAT 2025 Slot 1 Q2".
  const printedRef = String(raw.reference || '').trim()
  const qNum = Number(raw.questionNumber) > 0 ? Number(raw.questionNumber) : i + 1
  const fileRef = cleanFileRef(p.base)
  const reference = printedRef || (fileRef ? `${fileRef} Q${qNum}` : '')
  return {
    id: `${p.source}_${slugify(topicId || p.sectionId || 'x')}_${slugify(p.base)}${suffix}`,
    sectionId: p.sectionId,
    topicId,
    topic,
    difficulty: /^(easy|medium|hard)$/i.test(raw.difficulty) ? raw.difficulty[0].toUpperCase() + raw.difficulty.slice(1).toLowerCase() : 'Medium',
    type: options.length ? 'MCQ' : 'TITA',
    question: String(raw.question || '').trim(),
    options,
    correct: options.length ? (/^[A-D]$/.test(correct.toUpperCase().charAt(0)) ? correct.toUpperCase().charAt(0) : '') : correct,
    concept: String(raw.concept || '').trim(),
    solution: String(raw.solution || '').trim(),
    source: p.source,
    reference,
  }
}

// ── run ──────────────────────────────────────────────────────────────────────────
const images = walkImages(targetDir)
if (!images.length) { console.log(`No images, PDFs or DOCX files found under ${relative(ROOT, targetDir) || targetDir}`); process.exit(0) }

const plans = images.map(planFor).filter((p) => FORCE || !existsSync(p.outPath))
const skippedExisting = images.length - plans.length
const pdfCount = plans.filter((p) => p.isPdf).length
const docxCount = plans.filter((p) => p.isDocx).length

console.log(`${DRY ? '[dry-run] ' : ''}${images.length} file(s) under ${relative(ROOT, targetDir) || targetDir}` +
  `${pdfCount || docxCount ? ` (${[pdfCount && `${pdfCount} PDF`, docxCount && `${docxCount} DOCX`].filter(Boolean).join(', ')})` : ''}` +
  `${skippedExisting ? `, ${skippedExisting} already extracted` : ''}` +
  `${DRY || !provider ? '' : `, using ${providerName} (${models[0]})`}`)

const unresolved = plans.filter((p) => !p.sectionId)
if (unresolved.length) {
  console.warn(`  ! ${unresolved.length} file(s) have no resolvable section — put them under a qa/varc/lrdi folder, or pass --section`)
}

if (DRY) {
  for (const p of plans.slice(0, 40)) {
    console.log(`  ${relative(ROOT, p.imgPath)}`)
    if (p.isPdf) {
      try {
        const n = await pdfPageCount(p.imgPath)
        console.log(`      (PDF, ${n} page${n === 1 ? '' : 's'}${n > MAX_PAGES ? `, only first ${MAX_PAGES} will be rendered — use --max-pages` : ''})`)
      } catch (e) { console.log(`      ! could not read PDF page count: ${e.message}`) }
    }
    if (p.isDocx) {
      try {
        const { text, images: imgs } = await readDocx(p.imgPath)
        const ch = chunkText(text || '')
        console.log(`      (DOCX, ${text.length} chars${ch.length > 1 ? ` → ${ch.length} chunks` : ''}${imgs.length ? `, ${imgs.length} embedded image(s)` : ''})`)
      } catch (e) { console.log(`      ! could not read docx: ${e.message}`) }
    }
    console.log(`      → ${relative(ROOT, p.outPath)}  [${p.sectionId || '??'} · ${p.topic || '??'} · ${p.source}]`)
  }
  if (plans.length > 40) console.log(`  … and ${plans.length - 40} more`)
  console.log('\nDry run only — no API calls, no files written. Re-run without --dry-run and with an API key to extract.')
  process.exit(0)
}

if (!provider || !apiKey) {
  console.error('\nNo API key found. Set one and re-run, e.g.:')
  console.error('  GROQ_API_KEY=...  npm run dataset:extract')
  console.error('  NVIDIA_API_KEY=... npm run dataset:extract -- --mba')
  console.error('(deepseek has no vision model.) Use --dry-run to preview without a key.')
  process.exit(1)
}

// Runs one page/image buffer through the vision model → dataset records.
const extractBuffer = async (buf, mime, p, i, pageNum) => {
  const b64 = buf.toString('base64')
  if (providerName === 'nvidia' && b64.length > NVIDIA_MAX_B64) {
    console.warn(`  ! ${relative(ROOT, p.imgPath)}${pageNum ? ` page ${pageNum}` : ''} is too large for NVIDIA inline (${(b64.length / 1024) | 0}KB > 176KB) — skipping; use --provider groq or --scale 1`)
    return []
  }
  const dataUrl = `data:${mime};base64,${b64}`
  const arr = await callVision(dataUrl, promptFor(p))
  return (Array.isArray(arr) ? arr : []).map((r, j) => toRecord(r, p, i + j, pageNum)).filter((r) => r.question)
}

// Reads a DOCX (typed text + embedded data images) → dataset records; long docs are chunked and
// any embedded images are attached to the first chunk so the model sees the data table/figure.
const extractDocx = async (p) => {
  const { text, images: imgs } = await readDocx(p.imgPath)
  if (!text && !imgs.length) return []
  const imageParts = []
  for (const img of imgs.slice(0, 3)) {
    const b64 = img.toString('base64')
    if (providerName === 'nvidia' && b64.length > NVIDIA_MAX_B64) {
      console.warn(`  ! ${relative(ROOT, p.imgPath)} embedded image too large for NVIDIA inline (${(b64.length / 1024) | 0}KB) — skipping that image; use --provider groq`)
      continue
    }
    imageParts.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } })
  }
  const chunks = text ? chunkText(text) : ['']
  let records = []
  for (let c = 0; c < chunks.length; c++) {
    const content = [{ type: 'text', text: docxPromptFor(p, chunks[c], c === 0 && imageParts.length > 0) }]
    if (c === 0) content.push(...imageParts)
    const arr = await callModel(content, 3500)
    const recs = (Array.isArray(arr) ? arr : []).map((r, j) => toRecord(r, p, records.length + j, chunks.length > 1 ? c + 1 : null)).filter((r) => r.question)
    if (!recs.length) console.warn(`  ! no questions parsed from ${relative(ROOT, p.imgPath)}${chunks.length > 1 ? ` chunk ${c + 1}/${chunks.length}` : ''}`)
    records = records.concat(recs)
  }
  return records
}

let done = 0, wrote = 0, failed = 0
for (const p of plans) {
  if (done >= LIMIT) break
  if (!p.sectionId) continue
  done++
  try {
    let records = []
    if (p.isPdf) {
      const { buffers, totalPages } = await renderPdfPages(p.imgPath)
      if (totalPages > MAX_PAGES) console.warn(`  ! ${relative(ROOT, p.imgPath)} has ${totalPages} pages — only rendering the first ${MAX_PAGES} (--max-pages to change)`)
      for (let pg = 0; pg < buffers.length; pg++) {
        const pageRecords = await extractBuffer(buffers[pg], 'image/png', p, records.length, pg + 1)
        if (!pageRecords.length) console.warn(`  ! no questions parsed from ${relative(ROOT, p.imgPath)} page ${pg + 1}`)
        records = records.concat(pageRecords)
      }
    } else if (p.isDocx) {
      records = await extractDocx(p)
    } else {
      const ext = p.imgPath.split('.').pop().toLowerCase()
      records = await extractBuffer(readFileSync(p.imgPath), MIME[ext] || 'image/jpeg', p, 0, null)
    }
    if (!records.length) { console.warn(`  ! no questions parsed from ${relative(ROOT, p.imgPath)}`); failed++; continue }
    mkdirSync(dirname(p.outPath), { recursive: true })
    writeFileSync(p.outPath, records.map((r) => JSON.stringify(r)).join('\n') + '\n')
    wrote += records.length
    console.log(`  ✓ ${relative(ROOT, p.imgPath)} → ${records.length} question(s)`)
  } catch (e) {
    console.warn(`  ! failed ${relative(ROOT, p.imgPath)}: ${e.message}`)
    failed++
  }
}

console.log(`\nExtracted ${wrote} question(s) from ${done} file(s)${failed ? `, ${failed} failed/skipped` : ''}.`)
console.log('Next: npm run dataset:build && npm run dataset:validate')
