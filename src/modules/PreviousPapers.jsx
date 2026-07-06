import React, { useState } from 'react'
import { Card, Badge, SectionHeader, CardSkeleton, showToast, BookmarkButton } from '../components/ui/index.jsx'
import { callAI, getCachedContent } from '../utils/ai.js'
import { recordAttempt } from '../utils/performance.js'
import { logResult } from '../utils/bookmarks.js'
import { PREVIOUS_PAPERS, PAPER_SOURCES, SECTIONS, getAllTopics } from '../data/curriculum.js'
import { getPYQByTopic } from '../data/pyqBank.js'
import { FileText, ExternalLink, BookMarked, RotateCcw, ShieldCheck } from 'lucide-react'

const SYSTEM = `You are a CAT exam expert with deep knowledge of CAT papers from 2014–2024. Generate accurate CAT-style questions. Return ONLY valid JSON, no preamble.`

// ─── Previous Papers Module ───────────────────────────────────────────────────
export function PreviousPapers() {
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)

  const handleOpen = (url) => window.open(url, '_blank')

  if (selectedYear && selectedSlot) return (
    <div className="animate-fade-in max-w-3xl">
      <button onClick={() => { setSelectedYear(null); setSelectedSlot(null) }} className="text-xs text-cat-blue hover:underline mb-4 flex items-center gap-1">← Back to Papers List</button>
      <SectionHeader title={`CAT ${selectedYear} — ${selectedSlot}`} subtitle="Access paper from official sources below" />
      <div className="space-y-3 mb-5">
        {PAPER_SOURCES.map(src => (
          <Card key={src.name} hover onClick={() => handleOpen(src.url)} className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-text-primary text-sm">{src.name}</p>
              <p className="text-xs text-text-secondary">CAT {selectedYear} {selectedSlot} Paper with Solutions</p>
            </div>
            <ExternalLink size={14} className="text-cat-blue flex-shrink-0" />
          </Card>
        ))}
      </div>
      <Card className="bg-cat-orange/5 border-cat-orange/30">
        <p className="text-xs font-semibold text-cat-orange mb-2">📌 How to Practice Previous Papers Effectively</p>
        <ol className="space-y-1 text-xs text-text-secondary">
          <li>1. Set a 2-hour timer and attempt in exam conditions (no phone, no breaks)</li>
          <li>2. Allocate exactly 40 min per section — VARC first, then DILR, then QA</li>
          <li>3. After the test, spend 2× the time analysing: why you got wrong, what you skipped</li>
          <li>4. Record each topic's performance in your error log</li>
          <li>5. Focus next week's practice on topics where you scored below 60%</li>
        </ol>
      </Card>
    </div>
  )

  return (
    <div className="animate-fade-in max-w-3xl space-y-5">
      <SectionHeader title="Previous Year Papers" subtitle="CAT papers 2014–2024, all slots — with links to solve and analyse" />

      <Card className="bg-bg-secondary">
        <p className="text-xs font-semibold text-text-primary mb-3">📚 Paper Sources</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PAPER_SOURCES.map(src => (
            <button key={src.name} onClick={() => handleOpen(src.url)} className="flex items-center gap-2 px-3 py-2 bg-bg-card border border-border rounded-lg hover:border-cat-blue transition-all text-xs font-medium text-text-secondary hover:text-cat-blue">
              <ExternalLink size={12}/>{src.name}
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        {PREVIOUS_PAPERS.map(paper => (
          <div key={paper.year} className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="font-display font-bold text-text-primary">CAT {paper.year}</span>
              <Badge variant={paper.year >= 2021 ? 'blue' : 'gray'}>{paper.year >= 2021 ? '3 Slots' : '2 Slots'}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {paper.slots.map(slot => (
                <Card key={slot} hover onClick={() => { setSelectedYear(paper.year); setSelectedSlot(slot) }} className="group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-text-primary group-hover:text-cat-blue">{paper.year} — {slot}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">66 Questions · 2 Hours</p>
                    </div>
                    <FileText size={13} className="text-text-muted group-hover:text-cat-blue" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Topic-wise PYQs Module ───────────────────────────────────────────────────
const buildPYQPrompt = (topic, section, count) => `Generate ${count} Previous Year CAT questions (or CAT-style questions based on past patterns) on: "${topic}" from ${section} section.

IMPORTANT: Organise the questions YEAR-WISE. Attribute each question to a specific CAT exam year (between 2015 and 2024) based on when this concept/pattern actually appeared. Spread them across multiple years where possible, and sort the array from the MOST RECENT year to the oldest.

Return ONLY a JSON array (already sorted newest year first):
[{
  "question": "complete question text",
  "options": ["A) ","B) ","C) ","D) "],
  "correct": "A|B|C|D",
  "solution": "complete step-by-step solution",
  "year": "2024",
  "slot": "Slot 2",
  "difficulty": "Easy|Medium|Hard",
  "key_concept": "the specific concept this question tests"
}]

The "year" field MUST be a 4-digit year only (e.g. "2024"). Put the slot in the separate "slot" field.`

// Extract a 4-digit year from any label the AI or bank returns.
const extractYear = (raw) => {
  const m = String(raw || '').match(/(19|20)\d{2}/)
  return m ? m[0] : null
}

// Group questions under their CAT year, keeping each question's original index
// so answer tracking and scoring stay correct. Real years sort newest-first;
// verified/undated questions fall to the bottom.
const groupByYear = (questions) => {
  const groups = {}
  questions.forEach((q, idx) => {
    const yr = extractYear(q.year)
    const key = yr ? `CAT ${yr}` : (q.year || 'CAT-style')
    if (!groups[key]) groups[key] = { key, year: yr, items: [] }
    groups[key].items.push({ q, idx })
  })
  return Object.values(groups).sort((a, b) => {
    if (a.year && b.year) return Number(b.year) - Number(a.year)
    if (a.year) return -1
    if (b.year) return 1
    return a.key.localeCompare(b.key)
  })
}


function PYQSession({ topic, section, hasApiKey, onBack, onNavigate }) {
  const [count, setCount] = useState(5)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const bank = getPYQByTopic(topic.id)

  const loadVerified = () => {
    const mapped = bank.map(q => ({
      question: q.question,
      options: q.options,
      correct: q.correct,
      solution: q.solution,
      year: 'CAT-level · Verified',
      difficulty: q.difficulty,
      key_concept: q.concept,
    }))
    setQuestions(mapped); setAnswers({}); setSubmitted(false)
    showToast(`Loaded ${mapped.length} verified questions`, 'success')
  }

  const generate = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true); setQuestions([]); setAnswers({}); setSubmitted(false)
    try {
      const d = await callAI(SYSTEM, buildPYQPrompt(topic.name, section.label, count), 2500)
      setQuestions(Array.isArray(d) ? d : [])
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const submit = () => {
    setSubmitted(true)
    questions.forEach((q,i) => {
      const correct = answers[i] === q.correct
      recordAttempt(section.id, topic.name, correct)
      logResult({ section: section.id, topic: topic.name, source: 'pyq', stem: q.question, options: q.options, answer: q.correct, explanation: q.solution, isCorrect: correct })
    })
    const score = questions.filter((q,i) => answers[i]===q.correct).length
    showToast(`Score: ${score}/${questions.length}`, score >= questions.length * 0.75 ? 'success' : 'info')
  }

  const score = submitted ? questions.filter((q,i) => answers[i]===q.correct).length : 0

  return (
    <div className="animate-fade-in max-w-3xl space-y-4">
      <button onClick={onBack} className="text-xs text-cat-blue hover:underline flex items-center gap-1">← Back</button>
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold text-text-primary">{topic.name}</h3>
        <Badge variant="blue">{section.label}</Badge>
        <Badge variant="orange">PYQ Style</Badge>
      </div>

      <Card className="space-y-3">
        {bank.length > 0 && (
          <div className="bg-cat-green/5 border border-cat-green/25 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck size={14} className="text-cat-green" />
              <p className="text-xs font-semibold text-cat-green">{bank.length} verified questions available — no API key needed</p>
            </div>
            <button onClick={loadVerified} className="w-full py-2.5 bg-cat-green text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2">
              <BookMarked size={14}/> Load Verified PYQ Bank
            </button>
          </div>
        )}
        <div><p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">AI-Generated Questions</p>
          <div className="flex gap-2">{[3,5,10].map(n=><button key={n} onClick={()=>setCount(n)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${count===n?'bg-cat-blue text-white border-cat-blue':'border-border text-text-secondary'}`}>{n}</button>)}</div>
        </div>
        <button onClick={generate} disabled={loading} className="w-full py-3 bg-cat-blue text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          <BookMarked size={15}/>{loading?'Generating...':'Generate PYQ-Style Questions'}
        </button>
      </Card>

      {loading && <>{[...Array(3)].map((_,i) => <CardSkeleton key={i}/>)}</>}

      {questions.length > 0 && !loading && (
        <>
          {submitted && (
            <Card className="flex items-center gap-4 bg-cat-blue/5 border-cat-blue/30">
              <div className="text-center">
                <p className="font-mono text-3xl font-bold text-cat-blue">{score}/{questions.length}</p>
                <p className="text-xs text-text-muted">Score</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">CAT Net Score: <span className={score*3-(questions.length-score)>0?'text-cat-green':'text-cat-red'}>{score*3-(questions.length-score)*1}</span></p>
                <p className="text-xs text-text-muted">(+3 per correct, -1 per wrong)</p>
              </div>
            </Card>
          )}

          {groupByYear(questions).map(group => (
            <div key={group.key} className="space-y-3">
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cat-blue/10 border border-cat-blue/30">
                  <FileText size={13} className="text-cat-blue" />
                  <span className="text-xs font-bold text-cat-blue tracking-wide">{group.key}</span>
                </div>
                <span className="text-[10px] text-text-muted">{group.items.length} question{group.items.length > 1 ? 's' : ''}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {group.items.map(({ q, idx: i }) => {
                const sel = answers[i]
                return (
                  <Card key={i}>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-mono text-cat-blue font-bold">Q{i+1}</span>
                      {q.slot && <Badge variant="gray">{q.slot}</Badge>}
                      <Badge variant={q.difficulty==='Easy'?'green':q.difficulty==='Medium'?'orange':'red'}>{q.difficulty}</Badge>
                      <div className="ml-auto"><BookmarkButton item={{ section: section.id, topic: topic.name, source: 'pyq', stem: q.question, options: q.options, answer: q.correct, explanation: q.solution }} /></div>
                    </div>
                    <p className="text-sm font-medium text-text-primary mb-3 leading-relaxed whitespace-pre-line">{q.question}</p>
                    <div className="space-y-1.5 mb-3">
                      {q.options.map((opt,oi) => {
                        const letter=['A','B','C','D'][oi]
                        const isSel=sel===letter, ok=submitted&&letter===q.correct, bad=submitted&&isSel&&!ok
                        return <button key={oi} onClick={()=>!submitted&&setAnswers(a=>({...a,[i]:letter}))} disabled={submitted}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${ok?'border-cat-green bg-cat-green/10 text-cat-green':bad?'border-cat-red bg-cat-red/10 text-cat-red':isSel?'border-cat-blue bg-cat-blue/10 text-cat-blue':'border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>{opt}</button>
                      })}
                    </div>
                    {submitted && (
                      <div className="bg-bg-secondary rounded-lg p-3 text-xs text-text-secondary">
                        <p className="font-semibold text-cat-green mb-1">Concept: {q.key_concept}</p>
                        <p className="leading-relaxed whitespace-pre-line">{q.solution}</p>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          ))}

          {!submitted && <button onClick={submit} disabled={Object.keys(answers).length===0} className="w-full py-3 bg-cat-blue text-white rounded-xl font-semibold disabled:opacity-40 transition-all">Submit</button>}
          {submitted && <button onClick={generate} className="w-full py-3 bg-cat-blue text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"><RotateCcw size={14}/> More Questions</button>}
        </>
      )}
    </div>
  )
}

export function PYQTopics({ hasApiKey, onNavigate }) {
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [selectedSection, setSelectedSection] = useState(null)
  const [filterSection, setFilterSection] = useState('All')

  const allTopics = getAllTopics()
  const filtered = filterSection === 'All' ? allTopics : allTopics.filter(t => t.sectionId === filterSection)

  if (selectedTopic && selectedSection) return (
    <PYQSession topic={selectedTopic} section={selectedSection} hasApiKey={hasApiKey} onBack={() => { setSelectedTopic(null); setSelectedSection(null) }} onNavigate={onNavigate} />
  )

  return (
    <div className="animate-fade-in max-w-3xl space-y-5">
      <SectionHeader title="Topic-wise PYQs" subtitle="Practice previous year questions filtered by topic — see which year each concept appeared" />

      <div className="flex gap-2 flex-wrap">
        {['All', ...Object.keys(SECTIONS)].map(s => (
          <button key={s} onClick={() => setFilterSection(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filterSection===s?'bg-cat-blue text-white border-cat-blue':'border-border text-text-secondary hover:border-border-light'}`}>
            {s === 'All' ? 'All Sections' : SECTIONS[s]?.label || s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(topic => {
          const sec = SECTIONS[topic.sectionId]
          return (
            <Card key={topic.id} hover onClick={() => { setSelectedTopic(topic); setSelectedSection(sec) }} className="group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary group-hover:text-cat-blue transition-colors truncate">{topic.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] font-medium" style={{ color: sec.color }}>{sec.icon} {sec.id}</span>
                    <Badge variant={topic.priority===1?'red':topic.priority===2?'orange':'green'} className="text-[9px]">
                      {topic.priority===1?'P1':topic.priority===2?'P2':'P3'}
                    </Badge>
                    {getPYQByTopic(topic.id).length > 0 && <Badge variant="blue" className="text-[9px]">✓ {getPYQByTopic(topic.id).length} PYQ</Badge>}
                  </div>
                </div>
                <BookMarked size={13} className="text-text-muted group-hover:text-cat-blue flex-shrink-0" />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
