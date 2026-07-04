import React, { useState } from 'react'
import { Card, Badge, SectionHeader, CardSkeleton, showToast, ScoreRing, BookmarkButton } from '../components/ui/index.jsx'
import { callAI } from '../utils/ai.js'
import { recordAttempt } from '../utils/performance.js'
import { logResult } from '../utils/bookmarks.js'
import LearnPanel from '../components/LearnPanel.jsx'
import { SECTIONS } from '../data/curriculum.js'
import { Calculator, ChevronRight, RotateCcw, CheckCircle, XCircle } from 'lucide-react'

const SYSTEM = `You are a CAT Quantitative Aptitude expert. All questions must be solvable with the given data, mathematically correct, and at the appropriate CAT difficulty. Solutions must be step-by-step with correct arithmetic. Return ONLY valid JSON, no preamble.`

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
          <Badge variant={TAG_COLORS[q.concept?.split(' ')[0]] || 'gray'} className="mb-2">{q.concept}</Badge>
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
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const generate = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true); setQuestions([]); setAnswers({}); setSubmitted(false)
    try {
      const d = await callAI(SYSTEM, buildQAPrompt(topic.name, difficulty, count), 2500)
      setQuestions(Array.isArray(d) ? d : [])
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const submit = () => {
    setSubmitted(true)
    questions.forEach((q,i) => {
      const correct = answers[i] === q.correct
      recordAttempt('QA', topic.name, correct)
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
        <button onClick={generate} disabled={loading} className="w-full py-3 bg-cat-green text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          <Calculator size={15}/>{loading?'Generating...':'Generate Questions'}
        </button>
      </Card>

      {loading && <>{[...Array(3)].map((_,i)=><CardSkeleton key={i}/>)}</>}

      {questions.length > 0 && !loading && (
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

export default function Quant({ hasApiKey, onNavigate }) {
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [filterTag, setFilterTag] = useState('All')

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
    </div>
  )
}

