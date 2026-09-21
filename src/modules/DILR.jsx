import React, { useState } from 'react'
import { Card, Badge, SectionHeader, CardSkeleton, showToast, ScoreRing, BookmarkButton } from '../components/ui/index.jsx'
import { callAI, getCachedContent } from '../utils/ai.js'
import { pyqAnchorsTopicThenSection, formatAnchors, anchorRefs } from '../utils/pyq.js'
import { recordAttempt } from '../utils/performance.js'
import { logResult } from '../utils/bookmarks.js'
import LearnPanel from '../components/LearnPanel.jsx'
import { SECTIONS } from '../data/curriculum.js'
import { getDynTopicsBySection, getCapturedByTopic } from '../utils/captured.js'
import { Brain, RotateCcw, Lightbulb, ChevronRight, Sparkles, Calendar, Newspaper, BookOpen } from 'lucide-react'

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

// ─── Daily 5 sets (one per LRDI type, grounded on previous-year data) ──────────
const daySeed = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) }
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const isoDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// Distinct LRDI set types (name must match a TOPIC_PROMPTS key or fall back to GENERIC_PROMPT;
// topicId matches the curriculum so PYQ anchors and analytics line up).
const DILR_DAILY_POOL = [
  { name: 'LR — Games & Tournaments', topicId: 'lr_games', kind: 'LR' },
  { name: 'DI — Pie Charts', topicId: 'di_pie', kind: 'DI' },
  { name: 'LR — Puzzles', topicId: 'lr_puzzles', kind: 'LR' },
  { name: 'DI — Tables', topicId: 'di_tables', kind: 'DI' },
  { name: 'LR — Seating Arrangements', topicId: 'lr_seating', kind: 'LR' },
  { name: 'LR — Scheduling & Ordering', topicId: 'lr_scheduling', kind: 'LR' },
  { name: 'LR — Grouping & Selection', topicId: 'lr_grouping', kind: 'LR' },
  { name: 'DI — Bar Charts', topicId: 'di_bar', kind: 'DI' },
  { name: 'DI — Caselets (Text-based DI)', topicId: 'di_caselet', kind: 'DI' },
  { name: 'DI — Line Graphs', topicId: 'di_line', kind: 'DI' },
  { name: 'LR — Venn Diagrams', topicId: 'lr_venn', kind: 'LR' },
]

// Deterministic-per-day plan of 5 slots: a rotating, LR/DI-balanced mix at escalating difficulty.
const buildDILRDailyPlan = () => {
  const rng = mulberry32(daySeed() * 7 + 3) // offset so it differs from the RC daily shuffle
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
  const lr = shuffle(DILR_DAILY_POOL.filter(p => p.kind === 'LR'))
  const di = shuffle(DILR_DAILY_POOL.filter(p => p.kind === 'DI'))
  const mixed = []
  let i = 0, j = 0, turnLR = true
  while (mixed.length < 5 && (i < lr.length || j < di.length)) {
    if (turnLR && i < lr.length) mixed.push(lr[i++])
    else if (!turnLR && j < di.length) mixed.push(di[j++])
    else if (i < lr.length) mixed.push(lr[i++])
    else if (j < di.length) mixed.push(di[j++])
    turnLR = !turnLR
  }
  const diffs = ['Easy', 'Medium', 'Medium', 'Hard', 'Hard']
  return mixed.map((p, k) => ({ ...p, difficulty: diffs[k] || 'Medium' }))
}

// Base type prompt + (when the corpus has them) real anchors of that type — from previous-year
// papers AND the user's own practice material — so the daily set is modeled on genuine CAT sets.
// Falls back to ungrounded generation when none exist.
const buildDailyDILRPrompt = async (slot) => {
  const base = TOPIC_PROMPTS[slot.name] ? TOPIC_PROMPTS[slot.name](slot.difficulty) : GENERIC_PROMPT(slot.name, slot.difficulty)
  const anchors = await pyqAnchorsTopicThenSection('DILR', slot.topicId, 3)
  if (!anchors.length) return base
  const ref = anchorRefs(anchors)[0] || 'CAT practice'
  return base +
    `\n\nGROUND THIS SET on these real CAT "${slot.name}" (or related DILR) question(s) — from previous-year papers and/or the student's own practice material. Match their structure, data style, twist and difficulty, but produce an ENTIRELY ORIGINAL set (never copy their wording or exact numbers). Also add a top-level "reference" field set to "Modeled on ${ref}":\n${formatAnchors(anchors)}`
}

const dilr5Key = () => `cat_dilr5_${isoDay()}`
const loadDILR5Results = () => { try { return JSON.parse(localStorage.getItem(dilr5Key()) || '{}') } catch { return {} } }
const saveDILR5Results = (r) => localStorage.setItem(dilr5Key(), JSON.stringify(r))
const DIFF_VARIANT = { Easy: 'green', Medium: 'orange', Hard: 'red' }

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

// Renders one generated DILR set (scenario/conditions/data/approach + questions), handles
// answering, grading, analytics + review logging, and a caller-supplied post-submit footer.
// Reused by topic practice and the Daily 5. Reset by giving it a new React key per set.
function DILRSetView({ data, topic, source = 'dilr', onScored, footer }) {
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [showApproach, setShowApproach] = useState(false)
  const [startedAt] = useState(() => Date.now())

  const qs = data.questions || []
  const total = qs.length
  const context = data.setup || data.caselet || data.context || ''

  const submit = () => {
    setSubmitted(true)
    const timeSec = Math.round((Date.now() - startedAt) / 1000 / Math.max(1, total))
    qs.forEach((q, i) => {
      const correct = answers[i] === q.correct
      recordAttempt('DILR', topic, correct, timeSec)
      logResult({ section: 'DILR', topic, source, stem: context ? `${context}\n\nQ: ${q.q}` : q.q, options: q.options, answer: q.correct, explanation: q.explanation, isCorrect: correct })
    })
    const score = qs.filter((q, i) => answers[i] === q.correct).length
    showToast(`Score: ${score}/${total}`, score >= total * 0.75 ? 'success' : 'info')
    onScored?.(score, total)
  }

  const score = submitted ? qs.filter((q, i) => answers[i] === q.correct).length : 0

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="purple">{topic}</Badge>
            {data.reference && <Badge variant="orange">📎 {data.reference}</Badge>}
          </div>
          {submitted && <ScoreRing score={score} total={total} size={56} color="#8B5CF6" />}
        </div>

        {(data.setup || data.caselet) && (
          <div className="bg-bg-secondary rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-cat-purple uppercase tracking-wider mb-2">Scenario / Data</p>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{data.setup || data.caselet}</p>
          </div>
        )}

        {data.conditions?.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-text-muted mb-2">Conditions:</p>
            <ol className="space-y-1">{data.conditions.map((c, i) => <li key={i} className="text-xs text-text-secondary flex gap-2"><span className="text-cat-purple font-semibold flex-shrink-0">{i + 1}.</span>{c}</li>)}</ol>
          </div>
        )}

        {(data.table || data.data || data.venn_values) && (
          <div className="bg-bg-secondary rounded-xl p-4 mb-4 overflow-x-auto">
            <p className="text-xs font-semibold text-cat-purple uppercase tracking-wider mb-2">Data</p>
            <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap">{data.table || data.data || data.venn_values}</pre>
          </div>
        )}

        {data.approach && (
          <button onClick={() => setShowApproach(!showApproach)} className="text-xs text-cat-blue hover:underline mb-3 flex items-center gap-1">
            <Lightbulb size={12} />{showApproach ? 'Hide Approach' : 'Show Approach / Strategy'}
          </button>
        )}
        {showApproach && data.approach && (
          <div className="bg-cat-blue/5 border border-cat-blue/20 rounded-lg p-3 mb-3 text-xs text-text-secondary">{data.approach}</div>
        )}

        <div className="border-t border-border pt-4">
          {qs.map((q, i) => (
            <DILRQuestion key={i} q={q} idx={i} topic={topic} context={context} selected={answers[i]} onSelect={v => setAnswers(a => ({ ...a, [i]: v }))} submitted={submitted} />
          ))}
        </div>

        {!submitted && (
          <button onClick={submit} disabled={Object.keys(answers).length < total}
            className="w-full py-3 bg-cat-purple text-white rounded-xl font-semibold disabled:opacity-40 transition-all">
            Submit ({Object.keys(answers).length}/{total} answered)
          </button>
        )}
        {submitted && footer}
      </Card>

      {submitted && data.key_deductions?.length > 0 && (
        <Card className="border-cat-purple/20">
          <p className="text-xs font-semibold text-cat-purple mb-2">Key Deductions</p>
          {data.key_deductions.map((d, i) => <p key={i} className="text-xs text-text-secondary">• {d}</p>)}
        </Card>
      )}
    </div>
  )
}

function SetPractice({ topic, topicId, dynamic, hasApiKey, onNavigate }) {
  const [difficulty, setDifficulty] = useState('Medium')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [gen, setGen] = useState(0) // bumps to reset DILRSetView on a new set

  const generate = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true); setData(null)
    try {
      const promptFn = TOPIC_PROMPTS[topic] || GENERIC_PROMPT
      let prompt = TOPIC_PROMPTS[topic] ? promptFn(difficulty) : GENERIC_PROMPT(topic, difficulty)
      // Brand-new LRDI type the student asked the AI Tutor about: anchor the set on the
      // captured example(s) so the generated set matches that novel logic/pattern.
      if (dynamic && topicId) {
        const ex = getCapturedByTopic(topicId).slice(0, 3).map(q => q.question).filter(Boolean)
        if (ex.length) prompt += `\n\nThis is a NEW question type the student asked about in the AI Tutor. Match the exact logic, style and difficulty of these example question(s):\n${ex.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      }
      const d = await callAI(SYSTEM, prompt, 2200)
      setData(d); setGen(g => g + 1)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <LearnPanel topic={topic} section="Data Interpretation & LR" hasApiKey={hasApiKey} onNavigate={onNavigate} />
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-text-primary">{topic}</p>
        <div className="flex gap-2">{['Easy', 'Medium', 'Hard'].map(d => <button key={d} onClick={() => setDifficulty(d)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${difficulty === d ? 'bg-cat-purple text-white border-cat-purple' : 'border-border text-text-secondary'}`}>{d}</button>)}</div>
        <button onClick={generate} disabled={loading} className="w-full py-3 bg-cat-purple text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          <Brain size={15} />{loading ? 'Generating Set...' : 'Generate DILR Set'}
        </button>
      </Card>

      {loading && <><CardSkeleton /><CardSkeleton /></>}

      {data && !loading && (
        <DILRSetView key={gen} data={data} topic={topic} footer={
          <button onClick={generate} className="w-full py-3 bg-cat-purple text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2">
            <RotateCcw size={14} /> New Set
          </button>
        } />
      )}
    </div>
  )
}

// ─── Daily 5: one grounded set per LRDI type, rotating daily ───────────────────
function Daily5DILR({ hasApiKey, onNavigate }) {
  const [plan] = useState(buildDILRDailyPlan)
  const [selected, setSelected] = useState(null)
  const [set, setSet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(loadDILR5Results)

  const open = async (i) => {
    setSelected(i); setSet(null)
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true)
    try {
      const prompt = await buildDailyDILRPrompt(plan[i])
      const d = await getCachedContent(`dilr5_${isoDay()}_${i}`, SYSTEM, prompt, 2400)
      setSet(d)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const onScored = (score, total) => {
    const r = { ...results, [selected]: { score, total } }
    setResults(r); saveDILR5Results(r)
  }

  const done = Object.keys(results).length

  return (
    <div className="space-y-4">
      <Card className="bg-cat-purple/5 border-cat-purple/20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-semibold text-text-primary">Today's 5 DILR Sets · {isoDay()}</p>
            <p className="text-xs text-text-muted mt-0.5">One set each of a different LRDI type, modeled on real CAT papers & your own practice when available · escalating difficulty</p>
          </div>
          <Badge variant={done >= 5 ? 'green' : 'purple'}>{done}/5 done</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {plan.map((p, i) => {
          const res = results[i]
          const active = selected === i
          return (
            <button key={i} onClick={() => open(i)}
              className={`p-3 rounded-xl border text-left transition-all ${active ? 'border-cat-purple bg-cat-purple/10' : 'border-border bg-bg-card hover:border-border-light'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-text-primary">#{i + 1}</span>
                <Badge variant={DIFF_VARIANT[p.difficulty]}>{p.difficulty}</Badge>
              </div>
              <p className="text-[11px] text-text-muted leading-tight">{p.name.replace(/^(DI|LR) — /, '')}</p>
              {res && <p className="text-[11px] font-semibold text-cat-green mt-1">✓ {res.score}/{res.total}</p>}
            </button>
          )
        })}
      </div>

      {loading && <><CardSkeleton /><CardSkeleton /></>}
      {selected !== null && set && !loading && (
        <DILRSetView key={selected} data={set} topic={plan[selected].name} source="dilr_daily5" onScored={onScored} footer={
          <p className="text-center text-xs text-text-muted">Set complete — pick another type above.</p>
        } />
      )}
      {selected === null && !loading && (
        <Card className="text-center py-8">
          <BookOpen size={28} className="mx-auto text-text-muted mb-2" />
          <p className="text-sm text-text-secondary">Pick a set above to start. Each is a different LRDI type, generated fresh for today.</p>
        </Card>
      )}
    </div>
  )
}

export default function DILR({ hasApiKey, onNavigate }) {
  const [tab, setTab] = useState('daily')
  const [selectedTopic, setSelectedTopic] = useState(null)
  const topics = SECTIONS.DILR.topics

  const lrTopics = topics.filter(t => t.tags.includes('LR'))
  const diTopics = topics.filter(t => t.tags.includes('DI'))
  const dynTopics = getDynTopicsBySection('DILR')

  const priorityColor = (p) => p===1?'red':p===2?'orange':'green'
  const priorityLabel = (p) => p===1?'🔴 Must Do':p===2?'🟡 Important':'🟢 Optional'

  if (selectedTopic) return (
    <div className="animate-fade-in max-w-3xl">
      <button onClick={() => setSelectedTopic(null)} className="text-xs text-cat-purple hover:underline mb-4 flex items-center gap-1">← Back to Topics</button>
      <SetPractice topic={selectedTopic.name} topicId={selectedTopic.id} dynamic={!!selectedTopic.dynamic} hasApiKey={hasApiKey} onNavigate={onNavigate} />
    </div>
  )

  return (
    <div className="animate-fade-in max-w-3xl space-y-5">
      <SectionHeader title="DILR Practice" subtitle="Data Interpretation + Logical Reasoning — daily mixed sets, or drill any topic with step-by-step solutions" />

      <div className="flex gap-2">
        <button onClick={() => setTab('daily')} className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${tab==='daily'?'bg-cat-purple text-white border-cat-purple':'border-border text-text-secondary hover:border-border-light'}`}>
          <Calendar size={13} /> Daily 5
        </button>
        <button onClick={() => setTab('topics')} className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${tab==='topics'?'bg-cat-purple text-white border-cat-purple':'border-border text-text-secondary hover:border-border-light'}`}>
          <Brain size={13} /> Topics
        </button>
      </div>

      {tab === 'daily' && <Daily5DILR hasApiKey={hasApiKey} onNavigate={onNavigate} />}

      {tab === 'topics' && (
        <>
          {dynTopics.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Sparkles size={15} className="text-cat-purple" />
                <p className="text-sm font-semibold text-text-primary">New from AI Tutor</p>
              </div>
              <p className="text-xs text-text-muted -mt-1">Fresh LRDI types created from questions you asked the tutor — practice sets are generated to match them.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dynTopics.map(t => (
                  <Card key={t.id} hover onClick={() => setSelectedTopic({ ...t, dynamic: true })} className="group border-cat-purple/30">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-text-primary group-hover:text-cat-purple transition-colors">{t.name}</p>
                      <ChevronRight size={14} className="text-text-muted group-hover:text-cat-purple" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="purple" className="text-[10px]">✦ New type</Badge>
                      <Badge variant="blue" className="text-[10px]">{getCapturedByTopic(t.id).length} from tutor</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

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
        </>
      )}
    </div>
  )
}

