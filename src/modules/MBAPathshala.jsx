import React, { useState, useEffect } from 'react'
import { Card, Badge, SectionHeader, CardSkeleton, showToast, ScoreRing, BookmarkButton } from '../components/ui/index.jsx'
import { callAI } from '../utils/ai.js'
import { recordAttempt } from '../utils/performance.js'
import { logResult } from '../utils/bookmarks.js'
import LearnPanel from '../components/LearnPanel.jsx'
import { MBA_TOPICS, MBA_TAG_ORDER } from '../data/mbaPathshala.js'
import { GraduationCap, ChevronLeft, ChevronRight, RotateCcw, CheckCircle, XCircle, Images, Sparkles, X, ZoomIn } from 'lucide-react'

const SYSTEM = `You are a CAT Quantitative Aptitude question setter for MBA Pathshala-style practice. Every question must be original, solvable with the data given, mathematically correct, and at genuine CAT difficulty. Solutions must be concise but complete with correct arithmetic. Return ONLY a valid JSON array, no preamble.`

const buildMBAPrompt = (topic, count, batch, dateStr) => `Create ${count} original, high-quality CAT-level Quantitative Aptitude MCQs on: "${topic.name}".

Ground every question in these MBA Pathshala sub-types for this topic (choose varied ones; do not repeat a sub-type inside this set):
${topic.profile}

Rules:
- Difficulty spread: roughly one-third Easy, one-third Medium, one-third Hard.
- Each question is fully self-contained with all required data.
- Exactly four options; exactly one correct.
- Keep solutions concise but complete (key steps + arithmetic).
- This is set ${batch} generated for ${dateStr}: make it fresh and clearly different from any other set.

Return ONLY a JSON array (no prose):
[{
  "question": "full question text with all data",
  "options": ["A) ...","B) ...","C) ...","D) ..."],
  "correct": "A|B|C|D",
  "solution": "concise step-by-step solution",
  "concept": "the specific formula/idea used",
  "difficulty": "Easy|Medium|Hard"
}]`

const isoDay = () => new Date().toISOString().slice(0, 10)
const dayKey = (slug) => `cat_cache_mba_${slug}_${isoDay()}`

// Generate today's 10 questions in two batches of 5 (avoids reasoning-model truncation),
// then cache for the rest of the day. On-demand per topic.
async function loadDailySet(topic) {
  const cKey = dayKey(topic.slug)
  const cached = localStorage.getItem(cKey)
  if (cached) { try { const a = JSON.parse(cached); if (Array.isArray(a) && a.length) return a } catch { localStorage.removeItem(cKey) } }
  const dateStr = isoDay()
  const gen = async (batch) => {
    const raw = await callAI(SYSTEM, buildMBAPrompt(topic, 5, batch, dateStr), 3500)
    return Array.isArray(raw) ? raw : (Array.isArray(raw?.questions) ? raw.questions : [])
  }
  const first = await gen('A')            // let a hard failure surface to the user
  let all = [...first]
  try { all = all.concat(await gen('B')) } catch { /* keep whatever batch A returned */ }
  all = all.filter(q => q && q.question && Array.isArray(q.options) && q.options.length >= 2).slice(0, 10)
  if (all.length >= 6) localStorage.setItem(cKey, JSON.stringify(all))
  return all
}

const tabCls = (active) => `px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? 'bg-cat-green text-white border-cat-green' : 'border-border text-text-secondary hover:border-border-light'}`
const diffVariant = (d) => d === 'Hard' ? 'red' : d === 'Easy' ? 'green' : 'orange'

function QuestionCard({ q, idx, topic, selected, onSelect, submitted }) {
  const options = Array.isArray(q.options) ? q.options : []
  const isCorrect = submitted && selected === q.correct
  return (
    <Card className="mb-4">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xs font-mono text-cat-green font-bold flex-shrink-0">Q{idx + 1}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {q.concept && <Badge variant="gray">{q.concept}</Badge>}
            {q.difficulty && <Badge variant={diffVariant(q.difficulty)}>{q.difficulty}</Badge>}
          </div>
          <p className="text-sm font-medium text-text-primary leading-relaxed whitespace-pre-line">{q.question}</p>
        </div>
        <BookmarkButton item={{ section: 'QA', topic: topic.qaTopic, source: 'mba_pathshala', stem: q.question, options: q.options, answer: q.correct, explanation: q.solution }} />
        {submitted && (isCorrect ? <CheckCircle size={16} className="text-cat-green flex-shrink-0" /> : <XCircle size={16} className="text-cat-red flex-shrink-0" />)}
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {options.map((opt, oi) => {
          const letter = ['A', 'B', 'C', 'D'][oi]
          const isSel = selected === letter
          const ok = submitted && letter === q.correct
          const bad = submitted && isSel && !ok
          return (
            <button key={oi} onClick={() => !submitted && onSelect(letter)} disabled={submitted}
              className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${ok ? 'border-cat-green bg-cat-green/10 text-cat-green' : bad ? 'border-cat-red bg-cat-red/10 text-cat-red' : isSel ? 'border-cat-green bg-cat-green/10 text-cat-green' : 'border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>
              {opt}
            </button>
          )
        })}
      </div>
      {submitted && (
        <div className="bg-bg-secondary rounded-lg p-3 text-xs text-text-secondary leading-relaxed">
          <p className="font-semibold text-cat-green mb-1">Answer: {q.correct} — Solution:</p>
          <p className="whitespace-pre-line">{q.solution}</p>
        </div>
      )}
    </Card>
  )
}

function DailyPractice({ topic, hasApiKey, onNavigate }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setAnswers({}); setSubmitted(false)
    const cached = localStorage.getItem(dayKey(topic.slug))
    if (cached) { try { const a = JSON.parse(cached); setQuestions(Array.isArray(a) ? a : []) } catch { setQuestions([]) } }
    else setQuestions([])
  }, [topic.slug])

  const load = async (force = false) => {
    if (!hasApiKey) { onNavigate('settings'); return }
    if (force) localStorage.removeItem(dayKey(topic.slug))
    setLoading(true); setSubmitted(false); setAnswers({})
    try {
      const qs = await loadDailySet(topic)
      setQuestions(qs)
      if (!qs.length) showToast('No questions returned — try again', 'info')
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const submit = () => {
    setSubmitted(true)
    questions.forEach((q, i) => {
      const correct = answers[i] === q.correct
      recordAttempt('QA', topic.qaTopic, correct)
      logResult({ section: 'QA', topic: topic.qaTopic, source: 'mba_pathshala', stem: q.question, options: q.options, answer: q.correct, explanation: q.solution, isCorrect: correct })
    })
    const score = questions.filter((q, i) => answers[i] === q.correct).length
    showToast(`Score: ${score}/${questions.length}`, score >= questions.length * 0.75 ? 'success' : 'info')
  }

  const score = submitted ? questions.filter((q, i) => answers[i] === q.correct).length : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 bg-bg-card border border-border rounded-xl px-3 py-2">
        <p className="text-xs text-text-secondary"><span className="font-semibold text-text-primary">Today · {isoDay()}</span> — 10 fresh {topic.name} questions</p>
        {questions.length > 0 && !loading && <button onClick={() => load(true)} className="text-[11px] text-cat-green hover:underline flex items-center gap-1 flex-shrink-0"><RotateCcw size={12} /> Regenerate</button>}
      </div>

      {questions.length === 0 && !loading && (
        <button onClick={() => load(false)} className="w-full py-3 bg-cat-green text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2">
          <Sparkles size={15} /> Generate today's 10 questions
        </button>
      )}

      {loading && <>{[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}</>}

      {questions.length > 0 && !loading && (
        <>
          {submitted && (
            <div className="flex items-center gap-4 p-4 bg-bg-card border border-border rounded-xl">
              <ScoreRing score={score} total={questions.length} size={72} color="#10B981" />
              <div>
                <p className="font-semibold text-text-primary">Session Complete</p>
                <p className="text-xs text-text-secondary">{topic.name} · Daily set</p>
                <p className="text-xs text-text-muted mt-1">CAT Score: +{score * 3} / −{(questions.length - score)} = <span className={score > questions.length / 2 ? 'text-cat-green' : 'text-cat-red'}>{score * 3 - (questions.length - score)}</span></p>
              </div>
            </div>
          )}

          {questions.map((q, i) => (
            <QuestionCard key={i} q={q} idx={i} topic={topic} selected={answers[i]} onSelect={v => setAnswers(a => ({ ...a, [i]: v }))} submitted={submitted} />
          ))}

          {!submitted ? (
            <button onClick={submit} disabled={Object.keys(answers).length === 0}
              className="w-full py-3 bg-cat-green text-white rounded-xl font-semibold disabled:opacity-40 transition-all">
              Submit ({Object.keys(answers).length}/{questions.length})
            </button>
          ) : (
            <button onClick={() => load(true)} className="w-full py-3 bg-cat-green text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2">
              <RotateCcw size={14} /> New Set (regenerate)
            </button>
          )}
        </>
      )}
    </div>
  )
}

function Lightbox({ images, srcOf, idx, setIdx }) {
  useEffect(() => {
    if (idx < 0) return
    const onKey = (e) => {
      if (e.key === 'Escape') setIdx(-1)
      else if (e.key === 'ArrowRight') setIdx(i => Math.min(images.length - 1, i + 1))
      else if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, images.length, setIdx])
  if (idx < 0) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setIdx(-1)}>
      <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setIdx(-1)}><X size={26} /></button>
      <button className="absolute left-2 md:left-6 text-white/60 hover:text-white p-2 disabled:opacity-20" onClick={(e) => { e.stopPropagation(); setIdx(i => Math.max(0, i - 1)) }} disabled={idx === 0}><ChevronLeft size={30} /></button>
      <img src={srcOf(images[idx])} alt={`Frame ${idx + 1}`} className="max-h-[86vh] max-w-[92vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      <button className="absolute right-2 md:right-6 text-white/60 hover:text-white p-2 disabled:opacity-20" onClick={(e) => { e.stopPropagation(); setIdx(i => Math.min(images.length - 1, i + 1)) }} disabled={idx === images.length - 1}><ChevronRight size={30} /></button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs font-mono bg-black/50 px-3 py-1 rounded-full">{idx + 1} / {images.length}</div>
    </div>
  )
}

function BoardGallery({ topic, manifest }) {
  const [idx, setIdx] = useState(-1)
  const srcOf = (f) => `/mba-pathshala/${topic.slug}/${f}`
  if (!manifest) return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{[...Array(6)].map((_, i) => <div key={i} className="skeleton rounded-lg" style={{ aspectRatio: '16/9' }} />)}</div>
  const entry = manifest[topic.slug]
  if (!entry || !entry.count) return <Card><p className="text-sm text-text-secondary">No board frames found for this topic.</p></Card>
  return (
    <div>
      <p className="text-xs text-text-muted mb-3">{entry.count} lecture-board frames from MBA Pathshala for {topic.name}. Tap any to zoom · use ← → to navigate.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {entry.images.map((f, i) => (
          <button key={f} onClick={() => setIdx(i)} className="group relative rounded-lg overflow-hidden border border-border hover:border-cat-green transition-all" style={{ aspectRatio: '16/9' }}>
            <img src={srcOf(f)} alt={`${topic.name} frame ${i + 1}`} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
            <span className="absolute top-1 left-1 text-[10px] font-mono bg-black/60 text-white px-1.5 py-0.5 rounded">{i + 1}</span>
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity"><ZoomIn size={20} className="text-white" /></span>
          </button>
        ))}
      </div>
      <Lightbox images={entry.images} srcOf={srcOf} idx={idx} setIdx={setIdx} />
    </div>
  )
}

function TopicDetail({ topic, manifest, hasApiKey, onNavigate, onBack }) {
  const [tab, setTab] = useState('practice')
  const boardCount = manifest?.[topic.slug]?.count || 0
  return (
    <div className="animate-fade-in max-w-3xl">
      <button onClick={onBack} className="text-xs text-cat-green hover:underline mb-4 flex items-center gap-1">← Back to Topics</button>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <GraduationCap size={16} className="text-cat-green" />
        <h3 className="font-semibold text-text-primary">{topic.name}</h3>
        <Badge variant={topic.priority === 1 ? 'red' : topic.priority === 2 ? 'orange' : 'green'}>
          {topic.priority === 1 ? 'Must Do' : topic.priority === 2 ? 'Important' : 'Good to Have'}
        </Badge>
        <Badge variant="gray">{topic.tag}</Badge>
      </div>

      <LearnPanel topic={topic.name} section="Quantitative Aptitude" hasApiKey={hasApiKey} onNavigate={onNavigate} />

      <div className="flex gap-2 my-4">
        <button onClick={() => setTab('practice')} className={tabCls(tab === 'practice')}><Sparkles size={13} className="inline mr-1" />Daily Practice</button>
        <button onClick={() => setTab('board')} className={tabCls(tab === 'board')}><Images size={13} className="inline mr-1" />MBA Pathshala Board{boardCount ? ` (${boardCount})` : ''}</button>
      </div>

      {tab === 'practice'
        ? <DailyPractice topic={topic} hasApiKey={hasApiKey} onNavigate={onNavigate} />
        : <BoardGallery topic={topic} manifest={manifest} />}
    </div>
  )
}

export default function MBAPathshala({ hasApiKey, onNavigate }) {
  const [manifest, setManifest] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch('/mba-pathshala/manifest.json').then(r => r.ok ? r.json() : {}).then(setManifest).catch(() => setManifest({}))
  }, [])

  if (selected) return <TopicDetail topic={selected} manifest={manifest} hasApiKey={hasApiKey} onNavigate={onNavigate} onBack={() => setSelected(null)} />

  const grouped = {}
  MBA_TOPICS.forEach(t => { (grouped[t.tag] ||= []).push(t) })

  return (
    <div className="animate-fade-in max-w-3xl space-y-5">
      <SectionHeader title="MBA Pathshala Questions" subtitle="Daily fresh CAT practice per topic + the original MBA Pathshala board frames" />

      <div className="bg-bg-card border border-border rounded-xl p-3 text-xs text-text-secondary">
        <p className="font-semibold text-text-primary mb-1">🎓 10 fresh questions daily, for every topic</p>
        <p>Open a topic to generate today's 10 CAT-level questions (cached for the day so they stay put), and browse the original MBA Pathshala lecture-board frames for that topic.</p>
      </div>

      {MBA_TAG_ORDER.filter(tag => grouped[tag]).map(tag => (
        <div key={tag}>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{tag}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {grouped[tag].map(t => {
              const count = manifest?.[t.slug]?.count || 0
              return (
                <Card key={t.slug} hover onClick={() => setSelected(t)} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{count ? `${count} board frames` : 'board frames'} · 10 daily Qs</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={t.priority === 1 ? 'red' : t.priority === 2 ? 'orange' : 'green'}>{t.priority === 1 ? 'P1' : t.priority === 2 ? 'P2' : 'P3'}</Badge>
                    <ChevronRight size={16} className="text-text-muted" />
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
