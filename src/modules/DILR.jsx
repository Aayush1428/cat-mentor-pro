import React, { useState } from 'react'
import { Card, Badge, SectionHeader, CardSkeleton, showToast, ScoreRing, BookmarkButton } from '../components/ui/index.jsx'
import { callAI } from '../utils/ai.js'
import { recordAttempt } from '../utils/performance.js'
import { logResult } from '../utils/bookmarks.js'
import LearnPanel from '../components/LearnPanel.jsx'
import { SECTIONS } from '../data/curriculum.js'
import { Brain, RotateCcw, Lightbulb, ChevronRight } from 'lucide-react'

const SYSTEM = `You are a CAT DILR expert. Generate authentic CAT-style DILR sets. The sets must be solvable with the given information — no ambiguity or missing data. Return ONLY valid JSON, no preamble.`

const TOPIC_PROMPTS = {
  'LR — Seating Arrangements': (d) => `Generate a CAT-style Linear or Circular Seating Arrangement puzzle. Difficulty: ${d}.
Return ONLY this JSON:
{"setup":"the setup/scenario description","conditions":["condition 1","condition 2","condition 3","condition 4","condition 5"],"questions":[{"q":"question","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","explanation":"step-by-step solution"}],"solution_grid":"the final arrangement as a simple text table or list","approach":"how to start solving this type of puzzle"}`,

  'LR — Games & Tournaments': (d) => `Generate a CAT-style Games and Tournaments DILR set. Type: ${Math.random()>0.5?'Round Robin':'Knockout'}. Difficulty: ${d}.
Return ONLY this JSON:
{"setup":"tournament description with participants and format","data":"scores/results table as plain text","questions":[{"q":"question","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","explanation":"step-by-step reasoning"}],"key_deductions":["deduction 1","deduction 2"],"approach":"how to crack this type of set"}`,

  'LR — Scheduling & Ordering': (d) => `Generate a CAT-style Scheduling/Ordering puzzle. Difficulty: ${d}.
Return ONLY this JSON:
{"setup":"scheduling scenario description","conditions":["condition 1","condition 2","condition 3","condition 4"],"questions":[{"q":"question","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","explanation":"step-by-step solution"}],"solution":"the final schedule/order","approach":"key strategy to solve scheduling questions"}`,

  'LR — Grouping & Selection': (d) => `Generate a CAT-style Grouping and Selection puzzle. Difficulty: ${d}.
Return ONLY this JSON:
{"setup":"grouping scenario description","conditions":["condition 1","condition 2","condition 3","condition 4","condition 5"],"questions":[{"q":"question","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","explanation":"step-by-step solution"}],"solution":"final groups","approach":"how to approach grouping questions"}`,

  'LR — Venn Diagrams': (d) => `Generate a CAT-style Venn Diagram set (2 or 3 overlapping sets). Difficulty: ${d}.
Return ONLY this JSON:
{"setup":"context and category descriptions","data":"the given numerical data (total, overlaps, etc.) as plain text","questions":[{"q":"question","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","explanation":"calculation with Venn diagram logic"}],"venn_values":"list of values for each region","approach":"the inclusion-exclusion formula and how to apply it"}`,

  'LR — Coins & Weights': (d) => `Generate a CAT-style Coins/Weights puzzle. Difficulty: ${d}.
Return ONLY this JSON:
{"setup":"coins or balance scale puzzle description","conditions":["condition 1","condition 2","condition 3"],"questions":[{"q":"question","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","explanation":"logical deduction steps"}],"solution":"final answer with reasoning","approach":"strategy to eliminate possibilities"}`,

  'DI — Tables': (d) => `Generate a CAT-style Data Interpretation set with a table. Difficulty: ${d}.
Return ONLY this JSON:
{"context":"what the table represents","table":"the data table formatted as plain text with rows and columns","questions":[{"q":"question","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","explanation":"step-by-step calculation"}],"tip":"key shortcut or observation for this table"}`,

  'DI — Bar Charts': (d) => `Generate a CAT-style Data Interpretation set based on a bar chart. Difficulty: ${d}.
Return ONLY this JSON:
{"context":"what the bar chart shows","data":"the bar chart data as a plain text representation (categories and values)","questions":[{"q":"question","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","explanation":"calculation steps"}],"tip":"key pattern or shortcut to observe"}`,

  'DI — Pie Charts': (d) => `Generate a CAT-style Pie Chart DI set. Difficulty: ${d}.
Return ONLY this JSON:
{"context":"what the pie chart represents (total = 100% or given total)","data":"percentage distribution as plain text for each segment","questions":[{"q":"question","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","explanation":"percentage calculation steps"}],"tip":"key shortcut for pie chart calculations"}`,

  'DI — Caselets (Text-based DI)': (d) => `Generate a CAT-style Caselet (paragraph-based DI) set. Difficulty: ${d}.
Return ONLY this JSON:
{"caselet":"a 100-150 word paragraph containing embedded numerical data (like a business scenario or report)","questions":[{"q":"question","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","explanation":"calculation from the caselet data"}],"key_data":"list of key numbers extracted from the caselet","tip":"how to extract and organize caselet data quickly"}`,
}

const GENERIC_PROMPT = (topic, d) => `Generate a CAT-style DILR set on: ${topic}. Difficulty: ${d}.
Return ONLY this JSON:
{"setup":"the scenario/data description","conditions":["condition 1","condition 2","condition 3"],"questions":[{"q":"question text","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","explanation":"step-by-step solution"}],"approach":"strategy to solve this type of question"}`

function DILRQuestion({ q, idx, topic, context, selected, onSelect, submitted }) {
  const isCorrect = submitted && selected === q.correct
  const isWrong = submitted && selected && selected !== q.correct
  return (
    <div className="mb-4">
      <div className="flex items-start gap-2 mb-2">
        <p className="text-sm font-medium text-text-primary leading-relaxed flex-1">
          <span className="text-cat-purple font-bold mr-2">Q{idx+1}.</span>{q.q}
        </p>
        <BookmarkButton item={{ section: 'DILR', topic, source: 'dilr', stem: context ? `${context}\n\nQ: ${q.q}` : q.q, options: q.options, answer: q.correct, explanation: q.explanation }} />
      </div>
      <div className="space-y-1.5">
        {q.options.map((opt, oi) => {
          const letter = ['A','B','C','D'][oi]
          const isSel = selected === letter
          const ok = submitted && letter === q.correct
          const bad = submitted && isSel && !ok
          return (
            <button key={oi} onClick={() => !submitted && onSelect(letter)} disabled={submitted}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${ok?'border-cat-green bg-cat-green/10 text-cat-green':bad?'border-cat-red bg-cat-red/10 text-cat-red':isSel?'border-cat-purple bg-cat-purple/10 text-cat-purple':'border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>
              {opt}
            </button>
          )
        })}
      </div>
      {submitted && <div className="mt-2 bg-bg-secondary rounded-lg p-3 text-xs text-text-secondary leading-relaxed whitespace-pre-line"><span className="text-cat-green font-semibold">Solution: </span>{q.explanation}</div>}
    </div>
  )
}

function SetPractice({ topic, hasApiKey, onNavigate }) {
  const [difficulty, setDifficulty] = useState('Medium')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [showApproach, setShowApproach] = useState(false)

  const generate = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true); setData(null); setAnswers({}); setSubmitted(false); setShowApproach(false)
    try {
      const promptFn = TOPIC_PROMPTS[topic] || GENERIC_PROMPT
      const prompt = TOPIC_PROMPTS[topic] ? promptFn(difficulty) : GENERIC_PROMPT(topic, difficulty)
      const d = await callAI(SYSTEM, prompt, 2200)
      setData(d)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const submit = () => {
    setSubmitted(true)
    const qs = data.questions || []
    const context = data.setup || data.caselet || data.context || ''
    qs.forEach((q,i) => {
      const correct = answers[i] === q.correct
      recordAttempt('DILR', topic, correct)
      logResult({ section: 'DILR', topic, source: 'dilr', stem: context ? `${context}\n\nQ: ${q.q}` : q.q, options: q.options, answer: q.correct, explanation: q.explanation, isCorrect: correct })
    })
    const score = qs.filter((q,i) => answers[i] === q.correct).length
    showToast(`Score: ${score}/${qs.length}`, score >= qs.length * 0.75 ? 'success' : 'info')
  }

  const score = submitted ? (data?.questions||[]).filter((q,i) => answers[i] === q.correct).length : 0
  const total = data?.questions?.length || 0

  return (
    <div className="space-y-4">
      <LearnPanel topic={topic} section="Data Interpretation & LR" hasApiKey={hasApiKey} onNavigate={onNavigate} />
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-text-primary">{topic}</p>
        <div className="flex gap-2">{['Easy','Medium','Hard'].map(d=><button key={d} onClick={()=>setDifficulty(d)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${difficulty===d?'bg-cat-purple text-white border-cat-purple':'border-border text-text-secondary'}`}>{d}</button>)}</div>
        <button onClick={generate} disabled={loading} className="w-full py-3 bg-cat-purple text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          <Brain size={15}/>{loading ? 'Generating Set...' : 'Generate DILR Set'}
        </button>
      </Card>

      {loading && <><CardSkeleton /><CardSkeleton /></>}

      {data && !loading && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <Badge variant="purple">{topic}</Badge>
              {submitted && <ScoreRing score={score} total={total} size={56} color="#8B5CF6" />}
            </div>

            {/* Setup / Scenario */}
            {(data.setup || data.caselet) && (
              <div className="bg-bg-secondary rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-cat-purple uppercase tracking-wider mb-2">Scenario / Data</p>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{data.setup || data.caselet}</p>
              </div>
            )}

            {/* Conditions */}
            {data.conditions?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-text-muted mb-2">Conditions:</p>
                <ol className="space-y-1">{data.conditions.map((c,i)=><li key={i} className="text-xs text-text-secondary flex gap-2"><span className="text-cat-purple font-semibold flex-shrink-0">{i+1}.</span>{c}</li>)}</ol>
              </div>
            )}

            {/* DI Data/Table */}
            {(data.table || data.data || data.venn_values) && (
              <div className="bg-bg-secondary rounded-xl p-4 mb-4 overflow-x-auto">
                <p className="text-xs font-semibold text-cat-purple uppercase tracking-wider mb-2">Data</p>
                <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap">{data.table || data.data || data.venn_values}</pre>
              </div>
            )}

            {data.approach && (
              <button onClick={() => setShowApproach(!showApproach)} className="text-xs text-cat-blue hover:underline mb-3 flex items-center gap-1">
                <Lightbulb size={12}/>{showApproach ? 'Hide Approach' : 'Show Approach / Strategy'}
              </button>
            )}
            {showApproach && data.approach && (
              <div className="bg-cat-blue/5 border border-cat-blue/20 rounded-lg p-3 mb-3 text-xs text-text-secondary">{data.approach}</div>
            )}

            {/* Questions */}
            <div className="border-t border-border pt-4">
              {data.questions?.map((q,i) => (
                <DILRQuestion key={i} q={q} idx={i} topic={topic} context={data.setup || data.caselet || data.context || ''} selected={answers[i]} onSelect={v => setAnswers(a=>({...a,[i]:v}))} submitted={submitted} />
              ))}
            </div>

            {!submitted && (
              <button onClick={submit} disabled={Object.keys(answers).length < total}
                className="w-full py-3 bg-cat-purple text-white rounded-xl font-semibold disabled:opacity-40 transition-all">
                Submit ({Object.keys(answers).length}/{total} answered)
              </button>
            )}
            {submitted && (
              <button onClick={generate} className="w-full py-3 bg-cat-purple text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2">
                <RotateCcw size={14}/> New Set
              </button>
            )}
          </Card>

          {submitted && data.key_deductions?.length > 0 && (
            <Card className="border-cat-purple/20">
              <p className="text-xs font-semibold text-cat-purple mb-2">Key Deductions</p>
              {data.key_deductions.map((d,i) => <p key={i} className="text-xs text-text-secondary">• {d}</p>)}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export default function DILR({ hasApiKey, onNavigate }) {
  const [selectedTopic, setSelectedTopic] = useState(null)
  const topics = SECTIONS.DILR.topics

  const lrTopics = topics.filter(t => t.tags.includes('LR'))
  const diTopics = topics.filter(t => t.tags.includes('DI'))

  const priorityColor = (p) => p===1?'red':p===2?'orange':'green'
  const priorityLabel = (p) => p===1?'🔴 Must Do':p===2?'🟡 Important':'🟢 Optional'

  if (selectedTopic) return (
    <div className="animate-fade-in max-w-3xl">
      <button onClick={() => setSelectedTopic(null)} className="text-xs text-cat-purple hover:underline mb-4 flex items-center gap-1">← Back to Topics</button>
      <SetPractice topic={selectedTopic.name} hasApiKey={hasApiKey} onNavigate={onNavigate} />
    </div>
  )

  return (
    <div className="animate-fade-in max-w-3xl space-y-5">
      <SectionHeader title="DILR Practice" subtitle="Data Interpretation + Logical Reasoning — topic-wise sets with step-by-step solutions" />

      <div className="space-y-3">
        <p className="text-sm font-semibold text-text-primary">🧠 Logical Reasoning</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lrTopics.map(t => (
            <Card key={t.id} hover onClick={() => setSelectedTopic(t)} className="group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-text-primary group-hover:text-cat-purple transition-colors">{t.name}</p>
                <ChevronRight size={14} className="text-text-muted group-hover:text-cat-purple" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={priorityColor(t.priority)}>{priorityLabel(t.priority)}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-text-primary">📊 Data Interpretation</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {diTopics.map(t => (
            <Card key={t.id} hover onClick={() => setSelectedTopic(t)} className="group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-text-primary group-hover:text-cat-purple transition-colors">{t.name}</p>
                <ChevronRight size={14} className="text-text-muted group-hover:text-cat-purple" />
              </div>
              <Badge variant={priorityColor(t.priority)}>{priorityLabel(t.priority)}</Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

