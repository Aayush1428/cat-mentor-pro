import React, { useState, useEffect, useRef } from 'react'
import { Card, Badge, SectionHeader, CardSkeleton, showToast, ScoreRing, TimerDisplay, BookmarkButton } from '../components/ui/index.jsx'
import { callAI, getCachedContent } from '../utils/ai.js'
import { recordAttempt } from '../utils/performance.js'
import { logResult } from '../utils/bookmarks.js'
import { SECTIONS } from '../data/curriculum.js'
import { BookOpen, ChevronRight, RotateCcw, Clock, CheckCircle, XCircle } from 'lucide-react'

const SYSTEM = `You are a CAT exam VARC expert with 10+ years of experience. Generate authentic CAT-style questions. Return ONLY valid JSON, no markdown, no preamble.`

// Map an RC question's type to the exact curriculum topic so analytics are accurate.
const RC_TYPE_MAP = {
  'Main Idea': 'RC — Main Idea & Title',
  'Inference': 'RC — Inference Questions',
  'Tone': 'RC — Author Tone & Attitude',
  'Vocabulary in Context': 'RC — Vocabulary in Context',
  'Detail': 'RC — Inference Questions',
}
const rcTopic = (type) => RC_TYPE_MAP[type] || 'RC — Inference Questions'

// ─── RC Practice ──────────────────────────────────────────────────────────────
const buildRCPrompt = (difficulty, topic) => `Generate a CAT-style Reading Comprehension passage with questions.
Topic area: ${topic}. Difficulty: ${difficulty}.
Return ONLY this JSON:
{
  "passage": "a ${difficulty === 'Hard' ? '600-700' : difficulty === 'Medium' ? '450-550' : '300-400'}-word passage on ${topic} — academic/intellectual writing style similar to CAT RC",
  "questions": [
    {"q": "question text","options":["A) ..","B) ..","C) ..","D) .."],"correct":"A|B|C|D","explanation":"why this answer is correct and others are wrong","type":"Main Idea|Inference|Tone|Vocabulary in Context|Detail"},
    {"q": "question text","options":["A) ..","B) ..","C) ..","D) .."],"correct":"A|B|C|D","explanation":"...","type":"..."},
    {"q": "question text","options":["A) ..","B) ..","C) ..","D) .."],"correct":"A|B|C|D","explanation":"...","type":"..."},
    {"q": "question text","options":["A) ..","B) ..","C) ..","D) .."],"correct":"A|B|C|D","explanation":"...","type":"..."}
  ],
  "theme": "one sentence describing the central argument of the passage"
}`

// ─── Para Jumble ─────────────────────────────────────────────────────────────
const buildPJPrompt = (difficulty) => `Generate a CAT-style Para Jumble question.
Difficulty: ${difficulty}. Return ONLY this JSON:
{
  "sentences": {"A":"sentence text","B":"sentence text","C":"sentence text","D":"sentence text","E":"sentence text"},
  "correct_order": "e.g. DACBE",
  "explanation": "step-by-step logical reasoning for the correct order — explain connectors, pronoun references, and flow",
  "topic": "the topic/theme of the paragraph",
  "tip": "the key signal word or connector that unlocks the order"
}`

// ─── Para Summary ────────────────────────────────────────────────────────────
const buildPSPrompt = () => `Generate a CAT-style Para Summary question.
Return ONLY this JSON:
{
  "paragraph": "a 150-200 word paragraph (complex, academic, similar to CAT)",
  "options": ["A) one-sentence summary option","B) one-sentence summary option","C) one-sentence summary option","D) one-sentence summary option"],
  "correct": "A|B|C|D",
  "explanation": "why the correct option best captures the central idea, and why others are wrong",
  "wrong_traps": ["trap in wrong option 1","trap in wrong option 2"]
}`

// ─── Grammar / Sentence Correction ───────────────────────────────────────────
const buildGrammarPrompt = () => `Generate 5 CAT/MBA-style grammar and verbal ability questions (mix of error spotting, fill-in-the-blank, and sentence improvement).
Return ONLY a JSON array:
[{"question":"question text","options":["A) ..","B) ..","C) ..","D) .."],"correct":"A|B|C|D","explanation":"grammatical rule being tested and why the answer is correct","rule":"e.g. Subject-Verb Agreement, Tense, Pronoun Reference"}]`

const RC_TOPICS = ['Philosophy & Ethics','Technology & Society','History & Culture','Economics & Business','Science & Environment','Literature & Art','Psychology & Behavior','Politics & Democracy']
const DIFFICULTIES = ['Easy','Medium','Hard']

function Timer({ running, onTick }) {
  const [sec, setSec] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (running) { ref.current = setInterval(() => setSec(s => { onTick?.(s+1); return s+1 }), 1000) }
    else clearInterval(ref.current)
    return () => clearInterval(ref.current)
  }, [running])
  return <div className="flex items-center gap-1 text-xs text-text-muted"><Clock size={11}/><TimerDisplay seconds={sec}/></div>
}

// ─── RC Component ─────────────────────────────────────────────────────────────
function RCPractice({ hasApiKey, onNavigate }) {
  const [difficulty, setDifficulty] = useState('Medium')
  const [topic, setTopic] = useState(RC_TOPICS[0])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timeTaken, setTimeTaken] = useState(0)

  const generate = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true); setData(null); setAnswers({}); setSubmitted(false)
    try {
      const d = await callAI(SYSTEM, buildRCPrompt(difficulty, topic), 2500)
      setData(d); setTimerRunning(true)
    } catch (e) { showToast('Error generating passage: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const submit = () => {
    setTimerRunning(false); setSubmitted(true)
    data.questions.forEach((q, i) => {
      const correct = answers[i] === q.correct
      const topicName = rcTopic(q.type)
      recordAttempt('VARC', topicName, correct, Math.round(timeTaken / data.questions.length))
      logResult({ section: 'VARC', topic: topicName, source: 'rc', stem: `[RC · ${data.theme}]\n\n${q.q}`, options: q.options, answer: q.correct, explanation: q.explanation, isCorrect: correct })
    })
    const score = data.questions.filter((q, i) => answers[i] === q.correct).length
    showToast(`Score: ${score}/${data.questions.length}`, score >= data.questions.length * 0.75 ? 'success' : 'info')
  }

  const score = submitted ? data.questions.filter((q, i) => answers[i] === q.correct).length : 0

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Passage Topic</p>
          <div className="flex flex-wrap gap-2">
            {RC_TOPICS.map(t => <button key={t} onClick={() => setTopic(t)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${topic===t?'bg-cat-blue text-white border-cat-blue':'border-border text-text-secondary hover:border-cat-blue/50'}`}>{t}</button>)}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Difficulty</p>
          <div className="flex gap-2">{DIFFICULTIES.map(d => <button key={d} onClick={() => setDifficulty(d)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${difficulty===d?'bg-cat-blue text-white border-cat-blue':'border-border text-text-secondary hover:border-cat-blue/50'}`}>{d}</button>)}</div>
        </div>
        <button onClick={generate} disabled={loading} className="w-full py-3 bg-cat-blue text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          <BookOpen size={15}/>{loading ? 'Generating Passage...' : 'Generate RC Passage'}
        </button>
      </Card>

      {loading && <CardSkeleton />}

      {data && !loading && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Badge variant="blue">Reading Comprehension</Badge><Badge variant="gray">{difficulty}</Badge></div>
              <div className="flex items-center gap-3">
                <Timer running={timerRunning} onTick={setTimeTaken} />
                {submitted && <ScoreRing score={score} total={data.questions.length} size={52} color="#3B82F6" />}
              </div>
            </div>
            <p className="text-xs text-cat-orange font-semibold uppercase tracking-wider mb-2">Theme: {data.theme}</p>
            <div className="passage-text text-sm text-text-secondary leading-relaxed bg-bg-secondary rounded-xl p-4 max-h-72 overflow-y-auto">
              {data.passage.split('\n').map((p, i) => p.trim() && <p key={i} className="mb-3">{p}</p>)}
            </div>
          </Card>

          <div className="space-y-3">
            {data.questions.map((q, i) => {
              const sel = answers[i]
              return (
                <Card key={i}>
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-xs font-mono text-cat-blue font-bold flex-shrink-0">Q{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <Badge variant="gray" className="mb-2">{q.type}</Badge>
                      <p className="text-sm font-medium text-text-primary leading-relaxed">{q.q}</p>
                    </div>
                    <BookmarkButton item={{ section: 'VARC', topic: rcTopic(q.type), source: 'rc', stem: `[RC · ${data.theme}]\n\n${q.q}`, options: q.options, answer: q.correct, explanation: q.explanation }} />
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {q.options.map((opt, oi) => {
                      const letter = ['A','B','C','D'][oi]
                      const isSelected = sel === letter
                      const isCorrect = submitted && letter === q.correct
                      const isWrong = submitted && isSelected && letter !== q.correct
                      return (
                        <button key={oi} onClick={() => !submitted && setAnswers(a => ({...a, [i]: letter}))} disabled={submitted}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${isCorrect?'bg-cat-green/10 border border-cat-green text-cat-green':isWrong?'bg-cat-red/10 border border-cat-red text-cat-red':isSelected?'bg-cat-blue/10 border border-cat-blue text-cat-blue':'border border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>
                          {opt} {isCorrect && '✓'} {isWrong && '✗'}
                        </button>
                      )
                    })}
                  </div>
                  {submitted && <div className="bg-bg-secondary rounded-lg p-3 text-xs text-text-secondary leading-relaxed"><span className="text-cat-green font-semibold">Explanation: </span>{q.explanation}</div>}
                </Card>
              )
            })}
          </div>

          {!submitted && (
            <button onClick={submit} disabled={Object.keys(answers).length < data.questions.length}
              className="w-full py-3 bg-cat-green text-white rounded-xl font-semibold disabled:opacity-40 transition-all">
              Submit Answers ({Object.keys(answers).length}/{data.questions.length} answered)
            </button>
          )}
          {submitted && (
            <button onClick={generate} className="w-full py-3 bg-cat-blue text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2">
              <RotateCcw size={14}/> New Passage
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Para Jumble Component ─────────────────────────────────────────────────────
function ParaJumble({ hasApiKey, onNavigate }) {
  const [difficulty, setDifficulty] = useState('Medium')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [userOrder, setUserOrder] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [dragging, setDragging] = useState(null)

  const generate = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true); setData(null); setSubmitted(false)
    try {
      const d = await callAI(SYSTEM, buildPJPrompt(difficulty), 1200)
      setData(d)
      setUserOrder(Object.keys(d.sentences).sort(() => Math.random() - 0.5))
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const moveUp = (idx) => { if (idx === 0) return; const o = [...userOrder]; [o[idx-1],o[idx]]=[o[idx],o[idx-1]]; setUserOrder(o) }
  const moveDown = (idx) => { if (idx===userOrder.length-1) return; const o=[...userOrder];[o[idx],o[idx+1]]=[o[idx+1],o[idx]];setUserOrder(o) }

  const submit = () => {
    setSubmitted(true)
    const correct = userOrder.join('') === data.correct_order
    recordAttempt('VARC', 'Para Jumbles (PJ)', correct)
    showToast(correct ? '✓ Correct order!' : 'Incorrect — check explanation', correct ? 'success' : 'error')
  }

  const isCorrect = submitted && userOrder.join('') === data?.correct_order

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div><p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Difficulty</p>
          <div className="flex gap-2">{DIFFICULTIES.map(d=><button key={d} onClick={()=>setDifficulty(d)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${difficulty===d?'bg-cat-purple text-white border-cat-purple':'border-border text-text-secondary hover:border-cat-purple/50'}`}>{d}</button>)}</div>
        </div>
        <button onClick={generate} disabled={loading} className="w-full py-3 bg-cat-purple text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
          {loading ? 'Generating...' : 'Generate Para Jumble'}
        </button>
      </Card>

      {loading && <CardSkeleton />}

      {data && !loading && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-text-primary">Arrange the sentences in correct order</p>
              {submitted && <Badge variant={isCorrect?'green':'red'}>{isCorrect?'✓ Correct':'✗ Wrong'}</Badge>}
            </div>
            <p className="text-xs text-text-muted mb-3">Topic: {data.topic} · Use ↑↓ buttons to reorder</p>
            <div className="space-y-2">
              {userOrder.map((letter, idx) => (
                <div key={letter} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${submitted?(letter===data.correct_order[idx]?'border-cat-green/50 bg-cat-green/5':'border-cat-red/50 bg-cat-red/5'):'border-border bg-bg-secondary'}`}>
                  <span className="w-6 h-6 rounded-full bg-cat-purple text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{letter}</span>
                  <p className="text-xs text-text-secondary leading-relaxed flex-1">{data.sentences[letter]}</p>
                  {!submitted && (
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveUp(idx)} className="text-text-muted hover:text-text-primary text-xs px-1">▲</button>
                      <button onClick={() => moveDown(idx)} className="text-text-muted hover:text-text-primary text-xs px-1">▼</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {!submitted && (
            <button onClick={submit} className="w-full py-3 bg-cat-purple text-white rounded-xl font-semibold hover:opacity-90 transition-all">Submit Order</button>
          )}

          {submitted && (
            <Card className={isCorrect ? 'border-cat-green/30 bg-cat-green/5' : 'border-cat-red/30 bg-cat-red/5'}>
              <p className="text-xs font-semibold mb-1" style={{color: isCorrect ? '#10B981' : '#EF4444'}}>Correct Order: {data.correct_order}</p>
              <p className="text-xs text-text-secondary leading-relaxed mb-2">{data.explanation}</p>
              <p className="text-xs text-cat-orange"><span className="font-semibold">Key Signal: </span>{data.tip}</p>
              <button onClick={generate} className="mt-3 w-full py-2.5 bg-cat-purple text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2">
                <RotateCcw size={13}/> Next Question
              </button>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Para Summary Component ───────────────────────────────────────────────────
function ParaSummary({ hasApiKey, onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const generate = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true); setData(null); setSelected(null); setSubmitted(false)
    try { const d = await callAI(SYSTEM, buildPSPrompt(), 1200); setData(d) }
    catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const submit = () => {
    setSubmitted(true)
    recordAttempt('VARC', 'Para Summary', selected === data.correct)
  }

  return (
    <div className="space-y-4">
      <button onClick={generate} disabled={loading} className="w-full py-3 bg-cat-blue text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
        {loading ? 'Generating...' : 'Generate Para Summary Question'}
      </button>

      {loading && <CardSkeleton />}

      {data && !loading && (
        <div className="space-y-4">
          <Card>
            <p className="text-xs font-semibold text-cat-blue uppercase tracking-wider mb-2">Paragraph</p>
            <p className="text-sm text-text-secondary leading-relaxed bg-bg-secondary rounded-lg p-4">{data.paragraph}</p>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-text-primary mb-3">Choose the best summary:</p>
            <div className="space-y-2">
              {data.options.map((opt, i) => {
                const letter = ['A','B','C','D'][i]
                const isSel = selected === letter
                const isCorrect = submitted && letter === data.correct
                const isWrong = submitted && isSel && !isCorrect
                return (
                  <button key={i} onClick={() => !submitted && setSelected(letter)} disabled={submitted}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs border transition-all ${isCorrect?'border-cat-green bg-cat-green/10 text-cat-green':isWrong?'border-cat-red bg-cat-red/10 text-cat-red':isSel?'border-cat-blue bg-cat-blue/10 text-cat-blue':'border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>
                    {opt}
                  </button>
                )
              })}
            </div>
            {!submitted && <button onClick={submit} disabled={!selected} className="mt-3 w-full py-2.5 bg-cat-blue text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-all">Submit</button>}
            {submitted && (
              <div className="mt-3 bg-bg-secondary rounded-lg p-3 text-xs text-text-secondary leading-relaxed">
                <p className="font-semibold text-cat-green mb-1">Answer: {data.correct} — {data.explanation}</p>
                {data.wrong_traps?.map((t, i) => <p key={i} className="text-cat-orange mt-1">⚠ Trap: {t}</p>)}
                <button onClick={generate} className="mt-3 w-full py-2.5 bg-cat-blue text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"><RotateCcw size={13}/> Next</button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── Grammar Component ────────────────────────────────────────────────────────
function Grammar({ hasApiKey, onNavigate }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const generate = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true); setQuestions([]); setAnswers({}); setSubmitted(false)
    try { const d = await callAI(SYSTEM, buildGrammarPrompt(), 2000); setQuestions(Array.isArray(d)?d:[]) }
    catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const submit = () => {
    setSubmitted(true)
    questions.forEach((q,i) => recordAttempt('VARC', 'Grammar — Error Correction', answers[i] === q.correct))
    const score = questions.filter((q,i) => answers[i]===q.correct).length
    showToast(`Score: ${score}/${questions.length}`, score >= 4 ? 'success' : 'info')
  }

  const score = submitted ? questions.filter((q,i) => answers[i]===q.correct).length : 0

  return (
    <div className="space-y-4">
      <button onClick={generate} disabled={loading} className="w-full py-3 bg-cat-orange text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
        {loading ? 'Generating...' : 'Generate Grammar Questions (5 Qs)'}
      </button>
      {loading && <CardSkeleton />}
      {questions.length > 0 && !loading && (
        <>
          {questions.map((q,i) => {
            const sel = answers[i]
            return (
              <Card key={i}>
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-xs font-mono text-cat-orange font-bold flex-shrink-0">Q{i+1}</span>
                  <div><Badge variant="orange" className="mb-2">{q.rule}</Badge><p className="text-sm font-medium text-text-primary">{q.question}</p></div>
                </div>
                <div className="space-y-1.5">
                  {q.options.map((opt,oi) => {
                    const letter=['A','B','C','D'][oi]
                    const isSel=sel===letter, isCorrect=submitted&&letter===q.correct, isWrong=submitted&&isSel&&!isCorrect
                    return <button key={oi} onClick={()=>!submitted&&setAnswers(a=>({...a,[i]:letter}))} disabled={submitted} className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${isCorrect?'border-cat-green bg-cat-green/10 text-cat-green':isWrong?'border-cat-red bg-cat-red/10 text-cat-red':isSel?'border-cat-orange bg-cat-orange/10 text-cat-orange':'border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>{opt}</button>
                  })}
                </div>
                {submitted && <div className="mt-2 bg-bg-secondary rounded-lg p-3 text-xs text-text-secondary"><span className="text-cat-green font-semibold">Answer {q.correct}: </span>{q.explanation}</div>}
              </Card>
            )
          })}
          {!submitted && <button onClick={submit} disabled={Object.keys(answers).length<questions.length} className="w-full py-3 bg-cat-orange text-white rounded-xl font-semibold disabled:opacity-40 transition-all">Submit ({Object.keys(answers).length}/{questions.length})</button>}
          {submitted && (
            <div className="flex flex-col items-center gap-3">
              <ScoreRing score={score} total={questions.length} size={80} color="#F59E0B" />
              <button onClick={generate} className="px-6 py-2.5 bg-cat-orange text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center gap-2"><RotateCcw size={13}/> Next Set</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Daily RC ─────────────────────────────────────────────────────────────────
const buildDailyRCPrompt = (today) => `Generate today's CAT Reading Comprehension practice set: EXACTLY 2 passages, each from a DIFFERENT genre chosen from [philosophy/abstract, economics/business, science/technology, history/culture, psychology/behaviour, literature/art]. Each passage 500-650 words in dense, academic CAT style. Each passage has EXACTLY 4 questions covering Main Idea, Inference, Tone, and Vocabulary in Context.
Date seed: ${today}.
Return ONLY this JSON:
{"sets":[{"genre":"the genre","theme":"one-sentence central argument","passage":"the 500-650 word passage","questions":[{"q":"question","options":["A) ..","B) ..","C) ..","D) .."],"correct":"A|B|C|D","explanation":"why correct and others wrong","type":"Main Idea|Inference|Tone|Vocabulary in Context"}]}]}`

function DailyRC({ hasApiKey, onNavigate }) {
  const today = new Date().toDateString()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [sec, setSec] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => { if (hasApiKey) load() /* eslint-disable-next-line */ }, [hasApiKey])
  useEffect(() => () => clearInterval(timerRef.current), [])

  const load = async () => {
    setLoading(true); setData(null); setAnswers({}); setSubmitted(false); setSec(0)
    try {
      const d = await getCachedContent(`daily_rc_${today}`, SYSTEM, buildDailyRCPrompt(today), 4000)
      if (!d?.sets?.length) throw new Error('No passages returned')
      setData(d)
      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => setSec(s => s + 1), 1000)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const totalQs = data ? data.sets.reduce((n, s) => n + s.questions.length, 0) : 0
  const answeredCount = Object.keys(answers).length
  const totalWords = data ? data.sets.reduce((n, s) => n + (s.passage?.trim().split(/\s+/).length || 0), 0) : 0
  const wpm = submitted && sec > 0 ? Math.round(totalWords / (sec / 60)) : null
  const score = submitted ? data.sets.reduce((n, s, si) => n + s.questions.filter((q, qi) => answers[`${si}-${qi}`] === q.correct).length, 0) : 0

  const typeBreakdown = () => {
    const m = {}
    data.sets.forEach((s, si) => s.questions.forEach((q, qi) => {
      const t = q.type || 'Other'
      if (!m[t]) m[t] = { correct: 0, total: 0 }
      m[t].total++
      if (answers[`${si}-${qi}`] === q.correct) m[t].correct++
    }))
    return Object.entries(m)
  }

  const submit = () => {
    clearInterval(timerRef.current)
    setSubmitted(true)
    data.sets.forEach((set, si) => set.questions.forEach((q, qi) => {
      const key = `${si}-${qi}`
      const correct = answers[key] === q.correct
      const topicName = rcTopic(q.type)
      recordAttempt('VARC', topicName, correct, Math.round(sec / Math.max(1, totalQs)))
      logResult({ section: 'VARC', topic: topicName, source: 'daily_rc', stem: `[RC · ${set.theme}]\n\n${q.q}`, options: q.options, answer: q.correct, explanation: q.explanation, isCorrect: correct })
    }))
    const c = data.sets.reduce((n, s, si) => n + s.questions.filter((q, qi) => answers[`${si}-${qi}`] === q.correct).length, 0)
    showToast(`Daily RC: ${c}/${totalQs}`, c >= totalQs * 0.7 ? 'success' : 'info')
  }

  return (
    <div className="space-y-4">
      <Card className="bg-cat-blue/5 border-cat-blue/20 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">Today's RC Block</p>
          <p className="text-xs text-text-muted">{today} · 2 passages · {totalQs || 8} questions · simulate a real CAT RC block</p>
        </div>
        <div className="flex items-center gap-3">
          {data && !submitted && <div className="flex items-center gap-1 text-xs text-text-muted"><Clock size={12} /><TimerDisplay seconds={sec} /></div>}
          <button onClick={load} disabled={loading} className="px-3 py-2 bg-cat-blue text-white rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5">
            <RotateCcw size={12} />{loading ? 'Loading...' : data ? 'Reload' : "Load Today's RC"}
          </button>
        </div>
      </Card>

      {loading && <><CardSkeleton /><CardSkeleton /></>}

      {submitted && (
        <Card className="flex items-center gap-4 flex-wrap bg-cat-green/5 border-cat-green/30">
          <ScoreRing score={score} total={totalQs} size={64} color="#10B981" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary mb-1">Reading speed: <span className="font-mono text-cat-blue">{wpm} wpm</span> <span className="text-text-muted font-normal">(CAT target ≈ 250–300)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {typeBreakdown().map(([t, v]) => (
                <Badge key={t} variant={v.correct === v.total ? 'green' : v.correct === 0 ? 'red' : 'orange'}>{t}: {v.correct}/{v.total}</Badge>
              ))}
            </div>
          </div>
        </Card>
      )}

      {data?.sets?.map((set, si) => (
        <div key={si} className="space-y-3">
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="blue">Passage {si + 1}</Badge>
              <Badge variant="gray">{set.genre}</Badge>
            </div>
            <p className="text-xs text-cat-orange font-semibold uppercase tracking-wider mb-2">Theme: {set.theme}</p>
            <div className="passage-text text-sm text-text-secondary leading-relaxed bg-bg-secondary rounded-xl p-4 max-h-80 overflow-y-auto">
              {set.passage.split('\n').map((p, i) => p.trim() && <p key={i} className="mb-3">{p}</p>)}
            </div>
          </Card>
          {set.questions.map((q, qi) => {
            const key = `${si}-${qi}`
            const sel = answers[key]
            return (
              <Card key={qi}>
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-xs font-mono text-cat-blue font-bold flex-shrink-0">Q{qi + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Badge variant="gray" className="mb-2">{q.type}</Badge>
                    <p className="text-sm font-medium text-text-primary leading-relaxed">{q.q}</p>
                  </div>
                  <BookmarkButton item={{ section: 'VARC', topic: rcTopic(q.type), source: 'daily_rc', stem: `[RC · ${set.theme}]\n\n${q.q}`, options: q.options, answer: q.correct, explanation: q.explanation }} />
                </div>
                <div className="space-y-1.5">
                  {q.options.map((opt, oi) => {
                    const letter = ['A', 'B', 'C', 'D'][oi]
                    const isSel = sel === letter
                    const ok = submitted && letter === q.correct
                    const bad = submitted && isSel && !ok
                    return (
                      <button key={oi} onClick={() => !submitted && setAnswers(a => ({ ...a, [key]: letter }))} disabled={submitted}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${ok ? 'border-cat-green bg-cat-green/10 text-cat-green' : bad ? 'border-cat-red bg-cat-red/10 text-cat-red' : isSel ? 'border-cat-blue bg-cat-blue/10 text-cat-blue' : 'border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>
                        {opt} {ok && '✓'} {bad && '✗'}
                      </button>
                    )
                  })}
                </div>
                {submitted && <div className="mt-2 bg-bg-secondary rounded-lg p-3 text-xs text-text-secondary leading-relaxed"><span className="text-cat-green font-semibold">Answer {q.correct}: </span>{q.explanation}</div>}
              </Card>
            )
          })}
        </div>
      ))}

      {data && !submitted && (
        <button onClick={submit} disabled={answeredCount < totalQs}
          className="w-full py-3 bg-cat-green text-white rounded-xl font-semibold disabled:opacity-40 transition-all">
          Submit Daily RC ({answeredCount}/{totalQs} answered)
        </button>
      )}
    </div>
  )
}

// ─── VARC Main ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'daily',    label: '🗞️ Daily RC' },
  { id: 'rc',       label: '📖 Reading Comprehension' },
  { id: 'pj',       label: '🔀 Para Jumbles' },
  { id: 'ps',       label: '📝 Para Summary' },
  { id: 'grammar',  label: '✍️ Grammar' },
]

export default function VARC({ hasApiKey, onNavigate }) {
  const [tab, setTab] = useState('rc')
  return (
    <div className="animate-fade-in max-w-3xl">
      <SectionHeader title="VARC Practice" subtitle="Daily RC · Reading Comprehension · Para Jumbles · Para Summary · Grammar" />
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${tab===t.id?'bg-cat-blue text-white border-cat-blue':'border-border text-text-secondary hover:border-border-light'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'daily'   && <DailyRC hasApiKey={hasApiKey} onNavigate={onNavigate} />}
      {tab === 'rc'      && <RCPractice hasApiKey={hasApiKey} onNavigate={onNavigate} />}
      {tab === 'pj'      && <ParaJumble hasApiKey={hasApiKey} onNavigate={onNavigate} />}
      {tab === 'ps'      && <ParaSummary hasApiKey={hasApiKey} onNavigate={onNavigate} />}
      {tab === 'grammar' && <Grammar hasApiKey={hasApiKey} onNavigate={onNavigate} />}
    </div>
  )
}
