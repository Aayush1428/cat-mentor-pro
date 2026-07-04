import React, { useState, useEffect, useRef } from 'react'
import { Card, Badge, SectionHeader, CardSkeleton, showToast, ScoreRing } from '../components/ui/index.jsx'
import { callAI } from '../utils/ai.js'
import { recordAttempt, saveMockResult } from '../utils/performance.js'
import { logResult } from '../utils/bookmarks.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'

const SYSTEM = `You are a CAT exam setter generating an authentic mock test. Questions must be CAT-level: precise, unambiguous, solvable. Return ONLY valid JSON, no preamble.`

const buildMockPrompt = (section, count) => {
  const prompts = {
    VARC: `Generate ${count} CAT-style VARC questions. Mix: 8 RC questions (based on 2 short passages), 3 Para Jumbles, 3 Para Summary.`,
    DILR: `Generate ${count} CAT-style DILR questions. Provide 2 complete sets (one LR, one DI), each with a setup and questions.`,
    QA: `Generate ${count} CAT-style Quantitative Aptitude questions. Mix of Arithmetic, Algebra, Geometry. Include TITA-style (numerical answer) marked with "TITA": true.`,
  }
  return `${prompts[section]}

Return ONLY a JSON array:
[{
  "section": "${section}",
  "question": "complete question text (include passage context inline for RC)",
  "options": ["A) ","B) ","C) ","D) "] or null for TITA,
  "correct": "A|B|C|D or numerical answer for TITA",
  "tita": false,
  "topic": "specific topic name",
  "explanation": "step-by-step solution",
  "difficulty": "Easy|Medium|Hard"
}]`
}

const MOCK_CONFIGS = [
  { id: 'full', label: 'Full Mock (120 min)', varc: 24, dilr: 20, qa: 22, time: 7200 },
  { id: 'sectional', label: 'Sectional (40 min each)', varc: 24, dilr: 20, qa: 22, time: 2400 },
  { id: 'mini', label: 'Mini Mock (30 min)', varc: 8, dilr: 6, qa: 8, time: 1800 },
]

function QuestionNav({ questions, answers, current, onJump }) {
  return (
    <div className="flex flex-wrap gap-1 mb-4">
      {questions.map((q, i) => (
        <button key={i} onClick={() => onJump(i)}
          className={`w-7 h-7 rounded text-xs font-mono font-bold transition-all ${i === current ? 'bg-cat-blue text-white' : answers[i] ? 'bg-cat-green/20 text-cat-green border border-cat-green/30' : 'bg-bg-secondary text-text-muted border border-border'}`}>
          {i + 1}
        </button>
      ))}
    </div>
  )
}

function ResultsView({ results, timeTaken, config, onRetry }) {
  const sectionData = ['VARC','DILR','QA'].map(sec => {
    const qs = results.filter(r => r.section === sec)
    const correct = qs.filter(r => r.isCorrect).length
    const wrong = qs.filter(r => r.answered && !r.isCorrect).length
    const skipped = qs.filter(r => !r.answered).length
    const netScore = correct * 3 - wrong * 1
    return { section: sec, correct, wrong, skipped, netScore, total: qs.length }
  })

  const totalCorrect = results.filter(r => r.isCorrect).length
  const totalWrong = results.filter(r => r.answered && !r.isCorrect).length
  const totalSkipped = results.filter(r => !r.answered).length
  const netScore = totalCorrect * 3 - totalWrong
  const maxScore = results.length * 3
  const accuracy = totalCorrect + totalWrong > 0 ? Math.round(totalCorrect / (totalCorrect + totalWrong) * 100) : 0

  const timeMin = Math.floor(timeTaken / 60)

  const getPercentile = (score) => {
    if (score >= 115) return '99+'
    if (score >= 100) return '98–99'
    if (score >= 85) return '95–98'
    if (score >= 70) return '90–95'
    if (score >= 55) return '85–90'
    return 'Below 85'
  }

  const savedRef = useRef(false)
  useEffect(() => {
    if (savedRef.current) return
    savedRef.current = true
    saveMockResult({ label: config.label, netScore, maxScore, accuracy, percentile: getPercentile(netScore), attempted: totalCorrect + totalWrong, total: results.length })
  }, [])

  return (
    <div className="animate-fade-in max-w-3xl space-y-5">
      <SectionHeader title="Mock Test Results" subtitle={`Time taken: ${timeMin} min · ${config.label}`} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center"><p className="text-xs text-text-muted mb-1">Net Score</p><p className="font-mono text-2xl font-bold text-cat-blue">{netScore}</p><p className="text-[10px] text-text-muted">/{maxScore}</p></Card>
        <Card className="text-center"><p className="text-xs text-text-muted mb-1">Accuracy</p><p className="font-mono text-2xl font-bold text-cat-green">{accuracy}%</p></Card>
        <Card className="text-center"><p className="text-xs text-text-muted mb-1">Attempted</p><p className="font-mono text-2xl font-bold text-cat-orange">{totalCorrect + totalWrong}/{results.length}</p></Card>
        <Card className="text-center"><p className="text-xs text-text-muted mb-1">Est. Percentile</p><p className="font-mono text-lg font-bold text-cat-purple">{getPercentile(netScore)}%ile</p></Card>
      </div>

      <Card>
        <p className="text-sm font-semibold text-text-primary mb-3">Section-wise Breakdown</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={sectionData}>
            <XAxis dataKey="section" tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
            <Tooltip contentStyle={{ background: '#1A2235', border: '1px solid #2D3748', borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="correct" name="Correct" fill="#10B981" radius={3} />
            <Bar dataKey="wrong" name="Wrong" fill="#EF4444" radius={3} />
            <Bar dataKey="skipped" name="Skipped" fill="#4A5568" radius={3} />
          </BarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {sectionData.map(s => (
            <div key={s.section} className="text-center p-2 bg-bg-secondary rounded-lg">
              <p className="text-xs font-bold text-text-primary">{s.section}</p>
              <p className="font-mono text-lg font-bold text-cat-blue">{s.netScore}</p>
              <p className="text-[10px] text-text-muted">{s.correct}C / {s.wrong}W / {s.skipped}S</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-text-primary mb-3">📊 Analysis & Next Steps</p>
        {sectionData.map(s => {
          const acc = s.correct + s.wrong > 0 ? Math.round(s.correct / (s.correct + s.wrong) * 100) : null
          const isWeak = acc !== null && acc < 60
          return (
            <div key={s.section} className={`mb-3 p-3 rounded-xl border ${isWeak ? 'border-cat-red/30 bg-cat-red/5' : 'border-border bg-bg-secondary'}`}>
              <div className="flex justify-between">
                <p className="text-xs font-semibold text-text-primary">{s.section}</p>
                {acc !== null && <span className={`text-xs font-mono font-bold ${isWeak ? 'text-cat-red' : 'text-cat-green'}`}>{acc}% accuracy</span>}
              </div>
              {isWeak && <p className="text-[10px] text-cat-red mt-1">⚠ Focus area — practice {s.section} topic-wise this week</p>}
            </div>
          )
        })}
      </Card>

      <button onClick={onRetry} className="w-full py-3 bg-cat-blue text-white rounded-xl font-semibold hover:opacity-90 transition-all">
        Take Another Mock
      </button>
    </div>
  )
}

function MockSession({ config, questions, onComplete }) {
  const [currentSection, setCurrentSection] = useState('VARC')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(config.time)
  const [sectionTimeLeft, setSectionTimeLeft] = useState(2400)
  const timerRef = useRef(null)

  const sections = ['VARC','DILR','QA']
  const sectionQs = sections.reduce((acc, s) => { acc[s] = questions.filter(q => q.section === s); return acc }, {})

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current); handleSubmit(); return 0 } return t - 1 })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  const currentQs = sectionQs[currentSection] || []
  const currentQ = currentQs[currentIdx]

  const handleAnswer = (val) => {
    const key = `${currentSection}_${currentIdx}`
    setAnswers(a => ({ ...a, [key]: val }))
  }

  const handleSubmit = () => {
    clearInterval(timerRef.current)
    const results = questions.map((q, i) => {
      const sec = q.section
      const sIdx = sectionQs[sec].indexOf(q)
      const key = `${sec}_${sIdx}`
      const userAns = answers[key]
      const answered = userAns !== undefined
      const isCorrect = answered && userAns === q.correct
      recordAttempt(sec, q.topic, isCorrect)
      logResult({ section: sec, topic: q.topic, source: 'mock', stem: q.question, options: q.options || [], answer: q.correct, explanation: q.explanation, isCorrect })
      return { ...q, userAns, answered, isCorrect }
    })
    onComplete(results, config.time - timeLeft)
  }

  const sel = answers[`${currentSection}_${currentIdx}`]
  const timePct = (timeLeft / config.time) * 100
  const isUrgent = timePct < 20

  return (
    <div className="animate-fade-in max-w-3xl space-y-4">
      <div className="flex items-center justify-between sticky top-14 bg-bg-primary pb-2 pt-1 z-10">
        <div className="flex gap-2">
          {sections.map(s => (
            <button key={s} onClick={() => { setCurrentSection(s); setCurrentIdx(0) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentSection===s?'bg-cat-blue text-white':'bg-bg-secondary text-text-secondary border border-border'}`}>
              {s} ({Object.keys(answers).filter(k => k.startsWith(s)).length}/{sectionQs[s]?.length})
            </button>
          ))}
        </div>
        <div className={`font-mono font-bold text-sm ${isUrgent ? 'text-cat-red animate-pulse' : 'text-text-primary'}`}>
          ⏱ {formatTime(timeLeft)}
        </div>
      </div>

      <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${timePct}%`, background: isUrgent ? '#EF4444' : '#3B82F6' }} />
      </div>

      <QuestionNav questions={currentQs} answers={Object.fromEntries(Object.entries(answers).filter(([k]) => k.startsWith(currentSection)).map(([k,v]) => [parseInt(k.split('_')[1]), v]))} current={currentIdx} onJump={setCurrentIdx} />

      {currentQ && (
        <Card>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-mono font-bold text-cat-blue">Q{currentIdx+1}/{currentQs.length}</span>
            <Badge variant={currentSection==='VARC'?'blue':currentSection==='DILR'?'purple':'green'}>{currentSection}</Badge>
            <Badge variant="gray">{currentQ.topic}</Badge>
            <Badge variant={currentQ.difficulty==='Easy'?'green':currentQ.difficulty==='Medium'?'orange':'red'}>{currentQ.difficulty}</Badge>
            {currentQ.tita && <Badge variant="orange">TITA</Badge>}
          </div>
          <p className="text-sm font-medium text-text-primary leading-relaxed mb-4 whitespace-pre-line">{currentQ.question}</p>
          {currentQ.options ? (
            <div className="space-y-1.5">
              {currentQ.options.map((opt,i) => {
                const letter=['A','B','C','D'][i]
                return <button key={i} onClick={() => handleAnswer(letter)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${sel===letter?'border-cat-blue bg-cat-blue/10 text-cat-blue':'border-border text-text-secondary hover:border-border-light'}`}>{opt}</button>
              })}
            </div>
          ) : (
            <input type="number" placeholder="Enter numerical answer" value={sel||''} onChange={e=>handleAnswer(e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cat-blue transition-colors" />
          )}
        </Card>
      )}

      <div className="flex gap-3">
        <button onClick={() => currentIdx > 0 && setCurrentIdx(i=>i-1)} disabled={currentIdx===0} className="flex-1 py-2.5 border border-border rounded-xl text-xs font-semibold text-text-secondary hover:border-border-light disabled:opacity-30 transition-all">← Prev</button>
        <button onClick={() => { if (currentIdx<currentQs.length-1) setCurrentIdx(i=>i+1); else { const next=sections[sections.indexOf(currentSection)+1]; if(next){setCurrentSection(next);setCurrentIdx(0)} } }}
          className="flex-1 py-2.5 bg-cat-blue text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all">
          {currentIdx < currentQs.length-1 ? 'Next →' : sections.indexOf(currentSection)<2 ? `Next Section (${sections[sections.indexOf(currentSection)+1]}) →` : 'Last Question'}
        </button>
        <button onClick={handleSubmit} className="px-4 py-2.5 bg-cat-red text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all">End Test</button>
      </div>
    </div>
  )
}

export default function MockTest({ hasApiKey, onNavigate }) {
  const [phase, setPhase] = useState('setup')
  const [config, setConfig] = useState(MOCK_CONFIGS[2])
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [timeTaken, setTimeTaken] = useState(0)

  const generateMock = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true)
    try {
      const [varc, dilr, qa] = await Promise.all([
        callAI(SYSTEM, buildMockPrompt('VARC', config.varc), 3000),
        callAI(SYSTEM, buildMockPrompt('DILR', config.dilr), 3000),
        callAI(SYSTEM, buildMockPrompt('QA', config.qa), 3000),
      ])
      const all = [
        ...(Array.isArray(varc) ? varc : []).map(q => ({ ...q, section: 'VARC' })),
        ...(Array.isArray(dilr) ? dilr : []).map(q => ({ ...q, section: 'DILR' })),
        ...(Array.isArray(qa) ? qa : []).map(q => ({ ...q, section: 'QA' })),
      ]
      setQuestions(all)
      setPhase('test')
    } catch (e) { showToast('Error generating mock: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const handleComplete = (res, time) => { setResults(res); setTimeTaken(time); setPhase('results') }

  if (phase === 'test') return <MockSession config={config} questions={questions} onComplete={handleComplete} />
  if (phase === 'results') return <ResultsView results={results} timeTaken={timeTaken} config={config} onRetry={() => setPhase('setup')} />

  return (
    <div className="animate-fade-in max-w-2xl space-y-5">
      <SectionHeader title="Mock Tests" subtitle="AI-generated full CAT mocks with section-wise timer and detailed analysis" />

      <Card className="bg-cat-orange/5 border-cat-orange/30 text-xs text-text-secondary space-y-1">
        <p className="font-semibold text-cat-orange mb-1">📌 CAT Exam Pattern</p>
        <p>• 3 Sections: VARC (40 min), DILR (40 min), QA (40 min)</p>
        <p>• Marking: +3 correct, −1 wrong MCQ, 0 TITA wrong/skipped</p>
        <p>• Switch between sections at any time within the section window</p>
      </Card>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Select Mock Type</p>
        {MOCK_CONFIGS.map(cfg => (
          <Card key={cfg.id} hover onClick={() => setConfig(cfg)} className={config.id===cfg.id ? 'border-cat-blue' : ''}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-text-primary">{cfg.label}</p>
                <p className="text-xs text-text-secondary mt-0.5">VARC: {cfg.varc}Q · DILR: {cfg.dilr}Q · QA: {cfg.qa}Q</p>
              </div>
              {config.id===cfg.id && <div className="w-4 h-4 rounded-full bg-cat-blue flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>}
            </div>
          </Card>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-cat-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-secondary">Generating your mock test...</p>
          <p className="text-xs text-text-muted mt-1">Building VARC + DILR + QA questions</p>
        </div>
      )}

      {!loading && (
        <button onClick={generateMock} className="w-full py-3.5 bg-cat-blue text-white rounded-xl font-bold hover:opacity-90 transition-all text-sm">
          🎯 Start {config.label}
        </button>
      )}
    </div>
  )
}
