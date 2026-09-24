import React, { useState } from 'react'
import { Card, Badge, SectionHeader, CardSkeleton, showToast, ScoreRing, BookmarkButton } from '../components/ui/index.jsx'
import { callAI, getCachedContent } from '../utils/ai.js'
import { pyqAnchorsForTopic, pyqAnchorsTopicThenSection, formatAnchors, resolveModeledRef } from '../utils/pyq.js'
import { recordAttempt } from '../utils/performance.js'
import { logResult } from '../utils/bookmarks.js'
import { filterNovel, rememberGenerated } from '../utils/similarity.js'
import { catSystem } from '../data/promptContract.js'
import { buildDailyComposition, getNeedsPractice, ROLE_COPY } from '../utils/dailyPlan.js'
import LearnPanel from '../components/LearnPanel.jsx'
import QuestionComposer from '../components/QuestionComposer.jsx'
import { SECTIONS } from '../data/curriculum.js'
import { Calculator, ChevronRight, RotateCcw, CheckCircle, XCircle, Newspaper, Calendar, Target } from 'lucide-react'

const SYSTEM = catSystem('QA')

const isoDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const buildQAPrompt = (topic, difficulty, count) => `Generate ${count} CAT-style Quantitative Aptitude questions on: "${topic}". Difficulty: ${difficulty}.

Return ONLY a JSON array:
[{
  "question": "full question text with all data",
  "options": ["A) value","B) value","C) value","D) value"],
  "correct": "A|B|C|D",
  "solution": "step-by-step solution with calculations — show every step, define variables, show working",
  "concept": "the specific formula or concept used",
  "shortcut": "a faster approach or shortcut if one exists, else empty string",
  "difficulty": "${difficulty}"
}]`

const PYQ_SYSTEM = catSystem('QA', `You write NEW questions closely modeled on the real CAT anchors shown (previous-year papers and/or the student's own practice material): keep each anchor's concept, structure and difficulty but change the numbers and context. Cite the anchor you modeled each question on.`)

const buildPYQPrompt = (topic, anchors, count) => `Topic: "${topic}". Here are ${anchors.length} real CAT question(s) on this topic (from previous-year papers and/or the student's practice sets) as style/difficulty anchors:
${formatAnchors(anchors)}

Write ${count} NEW original questions, each modeled on one of the anchors above (rotate through them). For each, set "reference" to the anchor number you modeled it on, written as "[N]" (e.g. "[1]").

Return ONLY a JSON array:
[{
  "question": "full question text with all data",
  "options": ["A) value","B) value","C) value","D) value"],
  "correct": "A|B|C|D",
  "solution": "step-by-step solution with calculations",
  "concept": "the specific formula or concept used",
  "reference": "[1]",
  "difficulty": "Easy|Medium|Hard"
}]`

const TAG_COLORS = { Arithmetic: 'orange', Numbers: 'blue', Algebra: 'purple', Geometry: 'green', Modern: 'pink' }

function QuestionCard({ q, idx, topic, selected, onSelect, submitted }) {
  const [showShortcut, setShowShortcut] = useState(false)
  const isCorrect = submitted && selected === q.correct
  const isWrong = submitted && selected && selected !== q.correct
  return (
    <Card className="mb-4">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xs font-mono text-cat-green font-bold flex-shrink-0">Q{idx+1}</span>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <Badge variant={TAG_COLORS[q.concept?.split(' ')[0]] || 'gray'}>{q.concept}</Badge>
            {q.reference && <Badge variant="orange">📎 {q.reference}</Badge>}
          </div>
          <p className="text-sm font-medium text-text-primary leading-relaxed whitespace-pre-line">{q.question}</p>
        </div>
        <BookmarkButton item={{ section: 'QA', topic, source: 'quant', stem: q.question, options: q.options, answer: q.correct, explanation: q.solution }} />
        {submitted && (isCorrect ? <CheckCircle size={16} className="text-cat-green flex-shrink-0" /> : <XCircle size={16} className="text-cat-red flex-shrink-0" />)}
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {q.options.map((opt, oi) => {
          const letter = ['A','B','C','D'][oi]
          const isSel = selected === letter
          const ok = submitted && letter === q.correct
          const bad = submitted && isSel && !ok
          return (
            <button key={oi} onClick={() => !submitted && onSelect(letter)} disabled={submitted}
              className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${ok?'border-cat-green bg-cat-green/10 text-cat-green':bad?'border-cat-red bg-cat-red/10 text-cat-red':isSel?'border-cat-green bg-cat-green/10 text-cat-green':'border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>
              {opt}
            </button>
          )
        })}
      </div>
      {submitted && (
        <div className="bg-bg-secondary rounded-lg p-3 text-xs text-text-secondary leading-relaxed">
          <p className="font-semibold text-cat-green mb-1">Answer: {q.correct} — Step-by-step:</p>
          <p className="whitespace-pre-line mb-2">{q.solution}</p>
          {q.shortcut && (
            <>
              <button onClick={() => setShowShortcut(!showShortcut)} className="text-cat-orange hover:underline text-xs">
                {showShortcut ? 'Hide Shortcut ▲' : '⚡ Show Shortcut ▼'}
              </button>
              {showShortcut && <p className="mt-1 text-cat-orange">{q.shortcut}</p>}
            </>
          )}
        </div>
      )}
    </Card>
  )
}

function TopicPractice({ topic, hasApiKey, onNavigate }) {
  const [difficulty, setDifficulty] = useState('Medium')
  const [count, setCount] = useState(5)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [pyqLoading, setPyqLoading] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [startedAt, setStartedAt] = useState(null)

  const generate = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true); setQuestions([]); setAnswers({}); setSubmitted(false)
    try {
      const d = await callAI(SYSTEM, buildQAPrompt(topic.name, difficulty, count), 2500)
      setQuestions(filterNovel(Array.isArray(d) ? d : [], { topicId: topic.id }))
      setStartedAt(Date.now())
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  // Grounds generation on real previous-year questions for this topic (extracted from PDFs
  // under dataset/sources/previous-year/ via `npm run dataset:extract`, published by
  // `npm run dataset:build` to public/dataset/pyq_corpus.json). Each question cites which
  // past question it was modeled on.
  const generateFromPYQ = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setPyqLoading(true); setQuestions([]); setAnswers({}); setSubmitted(false)
    try {
      const anchors = await pyqAnchorsForTopic('QA', topic.id, 6)
      if (!anchors.length) {
        showToast('No previous-year or practice questions ingested for this topic yet — extract them first (see dataset/README.md)', 'error')
        return
      }
      const d = await callAI(PYQ_SYSTEM, buildPYQPrompt(topic.name, anchors, 5), 3000)
      const list = (Array.isArray(d) ? d : []).map((q) => ({ ...q, reference: resolveModeledRef(q.reference, anchors) }))
      setQuestions(filterNovel(list, { topicId: topic.id }))
      setStartedAt(Date.now())
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setPyqLoading(false) }
  }

  const submit = () => {
    setSubmitted(true)
    const timeSec = startedAt ? Math.round((Date.now() - startedAt) / 1000 / Math.max(1, questions.length)) : 0
    questions.forEach((q,i) => {
      const correct = answers[i] === q.correct
      recordAttempt('QA', topic.name, correct, timeSec)
      logResult({ section: 'QA', topic: topic.name, source: 'quant', stem: q.question, options: q.options, answer: q.correct, explanation: q.solution, isCorrect: correct })
    })
    const score = questions.filter((q,i) => answers[i] === q.correct).length
    showToast(`Score: ${score}/${questions.length}`, score >= questions.length * 0.75 ? 'success' : 'info')
  }

  const score = submitted ? questions.filter((q,i) => answers[i] === q.correct).length : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Calculator size={14} className="text-cat-green" />
        <h3 className="font-semibold text-text-primary">{topic.name}</h3>
        <Badge variant={topic.priority===1?'red':topic.priority===2?'orange':'green'}>
          {topic.priority===1?'Must Do':topic.priority===2?'Important':'Good to Have'}
        </Badge>
      </div>

      <LearnPanel topic={topic.name} section="Quantitative Aptitude" hasApiKey={hasApiKey} onNavigate={onNavigate} />

      <Card className="space-y-3">
        <div><p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Difficulty</p>
          <div className="flex gap-2">{['Easy','Medium','Hard'].map(d=><button key={d} onClick={()=>setDifficulty(d)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${difficulty===d?'bg-cat-green text-white border-cat-green':'border-border text-text-secondary'}`}>{d}</button>)}</div>
        </div>
        <div><p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">No. of Questions</p>
          <div className="flex gap-2">{[3,5,10].map(n=><button key={n} onClick={()=>setCount(n)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${count===n?'bg-cat-green text-white border-cat-green':'border-border text-text-secondary'}`}>{n}</button>)}</div>
        </div>
        <button onClick={generate} disabled={loading || pyqLoading} className="w-full py-3 bg-cat-green text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          <Calculator size={15}/>{loading?'Generating...':'Generate Questions'}
        </button>
        <button onClick={generateFromPYQ} disabled={loading || pyqLoading} className="w-full py-3 bg-bg-secondary border border-cat-orange/40 text-cat-orange rounded-xl font-semibold hover:bg-cat-orange/10 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          <Newspaper size={15}/>{pyqLoading?'Generating...':'Generate 5 — From Papers & My Practice'}
        </button>
      </Card>

      {(loading || pyqLoading) && <>{[...Array(3)].map((_,i)=><CardSkeleton key={i}/>)}</>}

      {questions.length > 0 && !loading && !pyqLoading && (
        <>
          {submitted && (
            <div className="flex items-center gap-4 p-4 bg-bg-card border border-border rounded-xl">
              <ScoreRing score={score} total={questions.length} size={72} color="#10B981" />
              <div>
                <p className="font-semibold text-text-primary">Session Complete</p>
                <p className="text-xs text-text-secondary">{topic.name} · {difficulty}</p>
                <p className="text-xs text-text-muted mt-1">CAT Score: +{score*3} / −{(questions.length-score)} = <span className={score>questions.length/2?'text-cat-green':'text-cat-red'}>{score*3-(questions.length-score)*1}</span></p>
              </div>
            </div>
          )}

          {questions.map((q,i) => (
            <QuestionCard key={i} q={q} idx={i} topic={topic.name} selected={answers[i]} onSelect={v=>setAnswers(a=>({...a,[i]:v}))} submitted={submitted} />
          ))}

          {!submitted && (
            <button onClick={submit} disabled={Object.keys(answers).length===0}
              className="w-full py-3 bg-cat-green text-white rounded-xl font-semibold disabled:opacity-40 transition-all">
              Submit ({Object.keys(answers).length}/{questions.length})
            </button>
          )}
          {submitted && (
            <button onClick={generate} className="w-full py-3 bg-cat-green text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2">
              <RotateCcw size={14}/> New Set
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ─── Today's Practice (personalised daily 5) ─────────────────────────────────
const buildDailySlotPrompt = (slot, anchors) => `Generate ONE CAT-style Quantitative Aptitude question on "${slot.topic}". Difficulty: ${slot.difficulty}.
${anchors && anchors.length ? `Model it on these real CAT questions (previous-year papers and/or my own practice) — same concept and difficulty, but new numbers and context:\n${formatAnchors(anchors)}\n` : ''}Return ONLY this JSON object (NOT an array):
{"question":"full question with all data","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","solution":"step-by-step with calculations","concept":"the concept tested","shortcut":"a faster approach or empty string","difficulty":"${slot.difficulty}"${anchors && anchors.length ? ',"reference":"[1]"' : ''}}`

const qa5Key = () => `cat_qa5_${isoDay()}`
const loadQA5 = () => { try { return JSON.parse(localStorage.getItem(qa5Key()) || '{}') } catch { return {} } }
const saveQA5 = (r) => localStorage.setItem(qa5Key(), JSON.stringify(r))

function QADailySlot({ slot, index }) {
  const saved = loadQA5()[index] || {}
  const [q, setQ] = useState(null)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState(saved.answer ?? null)
  const [submitted, setSubmitted] = useState(!!saved.submitted)
  const [startedAt, setStartedAt] = useState(null)
  const role = ROLE_COPY[slot.role]

  const generate = async () => {
    setLoading(true)
    try {
      const anchors = await pyqAnchorsTopicThenSection('QA', slot.topicId, 3)
      const d = await getCachedContent(`qa5_${isoDay()}_${index}`, SYSTEM, buildDailySlotPrompt(slot, anchors), 1600)
      const item = Array.isArray(d) ? d[0] : d
      if (item && anchors.length) item.reference = resolveModeledRef(item.reference, anchors)
      if (item) rememberGenerated([item], { topicId: slot.topicId })
      setQ(item || null)
      setStartedAt(Date.now())
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const submit = () => {
    setSubmitted(true)
    const correct = answer === q.correct
    const timeSec = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0
    recordAttempt('QA', slot.topic, correct, timeSec)
    logResult({ section: 'QA', topic: slot.topic, source: 'quant_daily', stem: q.question, options: q.options, answer: q.correct, explanation: q.solution, isCorrect: correct })
    const all = loadQA5(); all[index] = { answer, submitted: true, correct }; saveQA5(all)
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-mono text-cat-green font-bold">#{index + 1}</span>
        <Badge variant={role.color}>{role.label}</Badge>
        <Badge variant="gray">{slot.difficulty}</Badge>
        <span className="text-sm font-semibold text-text-primary">{slot.topic}</span>
        {submitted && q && (answer === q.correct
          ? <CheckCircle size={15} className="text-cat-green ml-auto" />
          : <XCircle size={15} className="text-cat-red ml-auto" />)}
      </div>

      {!q && !loading && (
        <button onClick={generate} className="w-full py-2.5 bg-cat-green/10 border border-cat-green/40 text-cat-green rounded-xl text-sm font-semibold hover:bg-cat-green/20 transition-all">
          Start this question
        </button>
      )}
      {loading && <CardSkeleton />}
      {q && <QuestionCard q={q} idx={index} topic={slot.topic} selected={answer} onSelect={setAnswer} submitted={submitted} />}
      {q && !submitted && (
        <button onClick={submit} disabled={!answer} className="w-full py-2.5 bg-cat-green text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-all">
          Submit
        </button>
      )}
    </Card>
  )
}

function QADaily({ hasApiKey, onNavigate }) {
  const [plan] = useState(() => buildDailyComposition('QA', 5))
  const needs = getNeedsPractice('QA', 4)

  if (!hasApiKey) return (
    <Card className="text-center py-8">
      <p className="text-sm text-text-secondary mb-3">Add an API key to generate your personalised daily set.</p>
      <button onClick={() => onNavigate('settings')} className="px-4 py-2 bg-cat-green text-white rounded-xl text-sm font-semibold">Go to Settings</button>
    </Card>
  )

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={15} className="text-cat-green" />
          <p className="text-sm font-semibold text-text-primary">Today's 5 — built from your performance</p>
        </div>
        <p className="text-xs text-text-muted">A weak → revision → new → mixed blend, grounded on previous-year & your practice when available. Rotates daily.</p>
        {needs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[10px] text-text-muted flex items-center gap-1"><Target size={11} /> targeting:</span>
            {needs.map((t) => (
              <span key={t.topicId} className="px-2 py-0.5 rounded-lg text-[10px] bg-cat-red/10 text-cat-red border border-cat-red/30">
                {t.topic}{t.acc != null ? ` · ${t.acc}%` : ''}
              </span>
            ))}
          </div>
        )}
      </Card>
      {plan.map((slot, i) => <QADailySlot key={`${slot.topicId}_${i}`} slot={slot} index={i} />)}
    </div>
  )
}

export default function Quant({ hasApiKey, onNavigate }) {
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [filterTag, setFilterTag] = useState('All')
  const [view, setView] = useState('daily')

  const topics = SECTIONS.QA.topics
  const allTags = ['All', ...new Set(topics.flatMap(t => t.tags))]
  const filtered = filterTag === 'All' ? topics : topics.filter(t => t.tags.includes(filterTag))

  const grouped = {}
  filtered.forEach(t => { const tag = t.tags[0]; if (!grouped[tag]) grouped[tag] = []; grouped[tag].push(t) })

  if (selectedTopic) return (
    <div className="animate-fade-in max-w-3xl">
      <button onClick={() => setSelectedTopic(null)} className="text-xs text-cat-green hover:underline mb-4 flex items-center gap-1">← Back to Topics</button>
      <TopicPractice topic={selectedTopic} hasApiKey={hasApiKey} onNavigate={onNavigate} />
    </div>
  )

  return (
    <div className="animate-fade-in max-w-3xl space-y-5">
      <SectionHeader title="Quantitative Aptitude" subtitle="All QA topics — priority order from most to least important for CAT" />

      <div className="flex gap-2">
        {[{ id: 'daily', label: "Today's Practice" }, { id: 'topics', label: 'All Topics' }].map((t) => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${view === t.id ? 'bg-cat-green text-white border-cat-green' : 'border-border text-text-secondary hover:border-border-light'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'daily' && <QADaily hasApiKey={hasApiKey} onNavigate={onNavigate} />}

      {view === 'topics' && <>
      <QuestionComposer hasApiKey={hasApiKey} onNavigate={onNavigate} />

      <div className="flex gap-2 flex-wrap">
        {allTags.map(tag => (
          <button key={tag} onClick={() => setFilterTag(tag)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filterTag===tag?'bg-cat-green text-white border-cat-green':'border-border text-text-secondary hover:border-border-light'}`}>
            {tag}
          </button>
        ))}
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-3 text-xs text-text-secondary">
        <p className="font-semibold text-text-primary mb-1">📌 CAT Marking: +3 correct / −1 wrong / 0 skipped</p>
        <p>For 99 percentile: aim for ~18–20 correct with &gt;85% accuracy. Prioritize red topics first.</p>
      </div>

      {Object.entries(grouped).map(([tag, tagTopics]) => (
        <div key={tag} className="space-y-2">
          <p className="text-sm font-semibold text-text-primary">{tag}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tagTopics.sort((a,b) => a.priority - b.priority).map(topic => {
              const pColor = topic.priority===1?'text-cat-red':topic.priority===2?'text-cat-orange':'text-cat-green'
              const pLabel = topic.priority===1?'🔴 Must Do':topic.priority===2?'🟡 Important':'🟢 Optional'
              return (
                <Card key={topic.id} hover onClick={() => setSelectedTopic(topic)} className="group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-text-primary group-hover:text-cat-green transition-colors mb-1">{topic.name}</p>
                      <span className={`text-xs font-medium ${pColor}`}>{pLabel}</span>
                    </div>
                    <ChevronRight size={14} className="text-text-muted group-hover:text-cat-green" />
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
      </>}
    </div>
  )
}

