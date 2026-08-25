import React, { useState, useEffect, useRef } from 'react'
import { Card, Badge, SectionHeader, CardSkeleton, showToast, ScoreRing, TimerDisplay, BookmarkButton } from '../components/ui/index.jsx'
import { callAI, getCachedContent } from '../utils/ai.js'
import { recordAttempt, getTopicStats } from '../utils/performance.js'
import { logResult, makeId } from '../utils/bookmarks.js'
import { addCard } from '../utils/srs.js'
import { Languages, Sparkles, RotateCcw, Target, Lightbulb, ChevronRight, Plus, Eye, BookOpen, Wand2, Clock } from 'lucide-react'

// ─── Prompts ──────────────────────────────────────────────────────────────────
const SYSTEM = `You are a CAT VARC expert and a bilingual reading coach who trains Hindi-speaking aspirants to top Reading Comprehension. Whenever you explain in "Hindi", use natural conversational HINGLISH — Hindi written in Roman/English script and freely mixed with common English words, exactly the way friends talk while explaining (e.g. "Author yahan basically ye keh raha hai ki economy slow ho rahi hai"). Do NOT use formal or pure Devanagari Hindi and do NOT translate technical/common English words unnecessarily. You explain English passages line by line in this casual Hinglish, teach passage-cracking techniques, and design authentic CAT-level questions. Return ONLY valid JSON, no markdown, no preamble.`

const WORD_SYSTEM = `You are a bilingual English–Hindi vocabulary coach for CAT aspirants. Return ONLY valid JSON, no markdown.`

const buildWordPrompt = (word) => `For the English word "${word}" as used in academic reading, return ONLY this JSON:
{"word":"${word}","pos":"part of speech","meaning":"clear simple English meaning","hindi":"matlab casual Hinglish mein, Roman script (e.g. 'iska matlab hota hai...')","synonyms":["syn1","syn2"],"example":"one short example sentence using the word"}`

const buildDecodePrompt = (passage, questions) => `A CAT aspirant wants to FULLY understand this Reading Comprehension passage in casual Hinglish, then master its questions.

PASSAGE:
"""${passage}"""

${questions?.trim()
    ? `The aspirant has provided their OWN questions — solve EXACTLY these:\n"""${questions}"""`
    : 'The aspirant did NOT provide questions. Generate EXACTLY 4 authentic CAT-level questions (Main Idea, Inference, Tone, Vocabulary in Context).'}

Return ONLY this JSON:
{
  "title": "short title for the passage",
  "passage_type": "genre + style, e.g. 'Abstract – Philosophy' or 'Argumentative – Economics'",
  "difficulty": "Easy|Medium|Hard",
  "theme": "one-sentence central idea (English)",
  "theme_hindi": "central idea casual Hinglish mein samjhaya (Roman script, jaise dost samjhata hai)",
  "tone": "author's tone in 1-3 words (e.g. critical, analytical, optimistic)",
  "purpose": "why the author wrote this, one line (English)",
  "structure": "how the passage is organised, paragraph by paragraph, short (English)",
  "hard_words": [{"word": "difficult word from passage", "meaning": "English meaning", "hindi": "matlab casual Hinglish mein (Roman script)"}],
  "tips": ["technique to crack THIS type of passage", "another technique"],
  "elimination": ["how to spot and reject trap options in this passage type", "another elimination cue"],
  "questions": [
    {"q": "question", "options": ["A) ..","B) ..","C) ..","D) .."], "correct": "A|B|C|D", "type": "Main Idea|Inference|Tone|Vocabulary in Context|Detail", "explanation": "why the correct option is right (English)", "option_analysis": {"A": "why A is right or wrong", "B": "why B is right or wrong", "C": "why C is right or wrong", "D": "why D is right or wrong"}}
  ]
}`

const buildSlotPrompt = (difficulty, genre, focus) => `Generate ONE authentic CAT Reading Comprehension passage with questions for daily practice.
Genre: ${genre}. Difficulty: ${difficulty}.${focus ? ` Emphasise ${focus}-type questions — the aspirant is weak there.` : ''}
Passage length: ${difficulty === 'Hard' ? '550-650' : difficulty === 'Medium' ? '450-550' : '350-450'} words, dense academic CAT style.
Return ONLY this JSON:
{
  "title": "short title",
  "passage_type": "genre + style",
  "difficulty": "${difficulty}",
  "theme": "one-sentence central idea (English)",
  "theme_hindi": "central idea casual Hinglish mein (Roman script)",
  "tone": "author's tone in 1-3 words",
  "purpose": "author's purpose, one line",
  "structure": "how the passage is organised, short",
  "passage": "the passage text",
  "tips": ["technique for cracking this passage type"],
  "elimination": ["how to eliminate trap options here"],
  "questions": [
    {"q": "question", "options": ["A) ..","B) ..","C) ..","D) .."], "correct": "A|B|C|D", "type": "Main Idea|Inference|Tone|Vocabulary in Context|Detail", "explanation": "why correct", "option_analysis": {"A": "..","B": "..","C": "..","D": ".."}}
  ]
}
Provide EXACTLY 4 questions.`

const buildLinesPrompt = (passage) => `Explain this passage to a Hindi-speaking CAT aspirant, sentence by sentence, in casual conversational HINGLISH (Hindi in Roman/English script mixed with English words — jaise ek dost line-by-line samjhata hai, e.g. "Yahan author ye point bana raha hai ki..."). Do NOT use pure Devanagari Hindi. Return ONLY this JSON:
{"lines":[{"text":"the exact sentence","hindi":"what it conveys in casual Hinglish (Roman script)","gist":"short English gist"}]}
Cover EVERY sentence in order.
PASSAGE:
"""${passage}"""`

// ─── Analytics mapping (mirrors VARC) ─────────────────────────────────────────
const RC_TYPE_MAP = {
  'Main Idea': 'RC — Main Idea & Title',
  'Inference': 'RC — Inference Questions',
  'Tone': 'RC — Author Tone & Attitude',
  'Vocabulary in Context': 'RC — Vocabulary in Context',
  'Detail': 'RC — Inference Questions',
}
const rcTopic = (type) => RC_TYPE_MAP[type] || 'RC — Inference Questions'
const RC_TYPES = ['Main Idea', 'Inference', 'Tone', 'Vocabulary in Context']

const GENRES = ['Philosophy & Abstract', 'Economics & Business', 'Science & Technology', 'History & Culture', 'Psychology & Behaviour', 'Literature & Art', 'Politics & Society', 'Environment & Ecology']

// Find the RC question type the user is weakest at, to target daily practice.
const weakestRCType = () => {
  let worst = null, worstAcc = 101
  RC_TYPES.forEach(t => {
    const s = getTopicStats('VARC', rcTopic(t))
    if (s.attempts >= 2) {
      const acc = (s.correct / s.attempts) * 100
      if (acc < worstAcc) { worstAcc = acc; worst = t }
    }
  })
  return worst
}

const dayIndex = () => { const n = new Date(); return Math.floor((n - new Date(n.getFullYear(), 0, 0)) / 86400000) }

// Deterministic-per-day plan: 5 passages of escalating difficulty and varied genres,
// with the two middle-to-hard slots targeting the user's weakest question type.
const buildDailyPlan = () => {
  const di = dayIndex()
  const g = (o) => GENRES[(di * 5 + o) % GENRES.length]
  const focus = weakestRCType()
  return [
    { difficulty: 'Easy', genre: g(0), focus: null },
    { difficulty: 'Medium', genre: g(1), focus: null },
    { difficulty: 'Medium', genre: g(2), focus },
    { difficulty: 'Hard', genre: g(3), focus },
    { difficulty: 'Hard', genre: g(4), focus },
  ]
}

const DIFF_VARIANT = { Easy: 'green', Medium: 'orange', Hard: 'red' }

// ─── Word lookup popover ──────────────────────────────────────────────────────
function useWordLookup(hasApiKey) {
  const [pop, setPop] = useState(null) // { word, x, y, loading, data, error }

  const showWord = async (word, e) => {
    if (!hasApiKey) { showToast('Add an API key in Settings to look up words', 'info'); return }
    const x = e.clientX, y = e.clientY
    setPop({ word, x, y, loading: true, data: null })
    try {
      const d = await getCachedContent(`wordhi_${word.toLowerCase()}`, WORD_SYSTEM, buildWordPrompt(word), 300)
      setPop(p => (p && p.word === word ? { ...p, loading: false, data: d } : p))
    } catch (err) {
      setPop(p => (p && p.word === word ? { ...p, loading: false, error: err.message } : p))
    }
  }
  const close = () => setPop(null)
  return { pop, showWord, close }
}

function WordPopover({ pop, onClose }) {
  if (!pop) return null
  const left = Math.max(12, Math.min(pop.x - 130, window.innerWidth - 272))
  const top = Math.min(pop.y + 16, window.innerHeight - 220)
  const d = pop.data
  const addToDeck = () => {
    if (!d) return
    const ok = addCard({ word: d.word, meaning: d.meaning, hindi: d.hindi, synonyms: d.synonyms, example: d.example, pos: d.pos, source: 'rc' })
    showToast(ok ? `"${d.word}" added to your deck` : `"${d.word}" is already in your deck`, ok ? 'success' : 'info')
  }
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 w-60 bg-bg-card border border-border-light rounded-xl p-3 shadow-2xl animate-fade-in" style={{ left, top }}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-display font-bold text-sm text-cat-pink capitalize">{pop.word}</p>
          {d?.pos && <span className="text-[10px] text-text-muted italic">{d.pos}</span>}
        </div>
        {pop.loading && <p className="text-xs text-text-muted">Looking up…</p>}
        {pop.error && <p className="text-xs text-cat-red">Could not fetch meaning.</p>}
        {d && (
          <div className="space-y-1.5">
            <p className="text-xs text-text-secondary leading-relaxed">{d.meaning}</p>
            {d.hindi && <p className="text-xs text-cat-purple leading-relaxed">{d.hindi}</p>}
            {Array.isArray(d.synonyms) && d.synonyms.length > 0 && (
              <p className="text-[11px] text-text-muted">≈ {d.synonyms.join(', ')}</p>
            )}
            {d.example && <p className="text-[11px] text-text-muted italic leading-relaxed">“{d.example}”</p>}
            <button onClick={addToDeck} className="mt-1 w-full flex items-center justify-center gap-1 py-1.5 bg-cat-pink/10 text-cat-pink border border-cat-pink/30 rounded-lg text-[11px] font-semibold hover:bg-cat-pink/20 transition-all">
              <Plus size={11} /> Add to Vocab Deck
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// Renders a passage where every word can be clicked to fetch its meaning.
function ClickablePassage({ text, onWord }) {
  return (
    <div className="passage-text text-sm text-text-secondary leading-relaxed bg-bg-secondary rounded-xl p-4 max-h-[26rem] overflow-y-auto">
      {String(text).split('\n').map((para, pi) => para.trim() && (
        <p key={pi} className="mb-3">
          {para.split(/(\s+)/).map((tok, ti) => {
            const clean = tok.replace(/[^A-Za-z-]/g, '')
            if (clean.length > 1) {
              return (
                <span key={ti} onClick={(e) => onWord(clean, e)} className="cursor-pointer rounded hover:bg-cat-blue/20 hover:text-cat-blue transition-colors">{tok}</span>
              )
            }
            return <span key={ti}>{tok}</span>
          })}
        </p>
      ))}
    </div>
  )
}

// ─── Understand aids (theme / tone / tips / line-by-line) ─────────────────────
function Overview({ data }) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {data.passage_type && <Badge variant="blue">{data.passage_type}</Badge>}
        {data.difficulty && <Badge variant={DIFF_VARIANT[data.difficulty] || 'gray'}>{data.difficulty}</Badge>}
        {data.tone && <Badge variant="purple">Tone: {data.tone}</Badge>}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-cat-orange uppercase tracking-wider mb-0.5">Central Idea</p>
        <p className="text-sm text-text-primary leading-relaxed">{data.theme}</p>
        {data.theme_hindi && <p className="text-sm text-cat-purple leading-relaxed mt-1">{data.theme_hindi}</p>}
      </div>
      {data.purpose && (
        <div><p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-0.5">Author's Purpose</p><p className="text-xs text-text-secondary leading-relaxed">{data.purpose}</p></div>
      )}
      {data.structure && (
        <div><p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-0.5">Structure</p><p className="text-xs text-text-secondary leading-relaxed">{data.structure}</p></div>
      )}
    </Card>
  )
}

function TipsBlock({ tips, elimination }) {
  if (!tips?.length && !elimination?.length) return null
  return (
    <Card className="space-y-3">
      {tips?.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-cat-orange uppercase tracking-wider mb-1.5 flex items-center gap-1"><Lightbulb size={12} /> How to Crack This Passage</p>
          <ul className="space-y-1">{tips.map((t, i) => <li key={i} className="text-xs text-text-secondary leading-relaxed flex gap-1.5"><span className="text-cat-orange">•</span>{t}</li>)}</ul>
        </div>
      )}
      {elimination?.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-cat-red uppercase tracking-wider mb-1.5 flex items-center gap-1"><Target size={12} /> Eliminating Trap Options</p>
          <ul className="space-y-1">{elimination.map((t, i) => <li key={i} className="text-xs text-text-secondary leading-relaxed flex gap-1.5"><span className="text-cat-red">•</span>{t}</li>)}</ul>
        </div>
      )}
    </Card>
  )
}

function LineByLine({ lines }) {
  if (!lines?.length) return null
  return (
    <Card>
      <p className="text-[11px] font-semibold text-cat-purple uppercase tracking-wider mb-2 flex items-center gap-1"><Languages size={12} /> Line-by-Line — हिंदी में समझें</p>
      <div className="space-y-2.5">
        {lines.map((ln, i) => (
          <div key={i} className="border-l-2 border-cat-purple/40 pl-3">
            <p className="text-xs text-text-primary leading-relaxed">{ln.text}</p>
            <p className="text-xs text-cat-purple leading-relaxed mt-0.5">{ln.hindi}</p>
            {ln.gist && <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">{ln.gist}</p>}
          </div>
        ))}
      </div>
    </Card>
  )
}

function HardWords({ words, onWord }) {
  if (!words?.length) return null
  return (
    <Card>
      <p className="text-[11px] font-semibold text-cat-pink uppercase tracking-wider mb-2">Key Words</p>
      <div className="space-y-1.5">
        {words.map((w, i) => (
          <p key={i} className="text-xs leading-relaxed">
            <span className="font-semibold text-text-primary capitalize">{w.word}</span>
            <span className="text-text-secondary"> — {w.meaning}</span>
            {w.hindi && <span className="text-cat-purple"> · {w.hindi}</span>}
          </p>
        ))}
      </div>
    </Card>
  )
}

// ─── Question card with option-elimination review ─────────────────────────────
function QuestionCard({ q, idx, selected, submitted, onSelect, source, theme }) {
  const letters = ['A', 'B', 'C', 'D']
  return (
    <Card>
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xs font-mono text-cat-blue font-bold flex-shrink-0">Q{idx + 1}</span>
        <div className="flex-1 min-w-0">
          {q.type && <Badge variant="gray" className="mb-2">{q.type}</Badge>}
          <p className="text-sm font-medium text-text-primary leading-relaxed">{q.q}</p>
        </div>
        <BookmarkButton item={{ section: 'VARC', topic: rcTopic(q.type), source, stem: `[RC · ${theme}]\n\n${q.q}`, options: q.options, answer: q.correct, explanation: q.explanation }} />
      </div>
      <div className="space-y-1.5">
        {q.options.map((opt, oi) => {
          const letter = letters[oi]
          const isSel = selected === letter
          const ok = submitted && letter === q.correct
          const bad = submitted && isSel && !ok
          return (
            <button key={oi} disabled={submitted} onClick={() => onSelect(letter)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${ok ? 'border-cat-green bg-cat-green/10 text-cat-green' : bad ? 'border-cat-red bg-cat-red/10 text-cat-red' : isSel ? 'border-cat-blue bg-cat-blue/10 text-cat-blue' : 'border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>
              {opt} {ok && '✓'} {bad && '✗'}
            </button>
          )
        })}
      </div>
      {submitted && (
        <div className="mt-3 space-y-2">
          <div className="bg-bg-secondary rounded-lg p-3 text-xs text-text-secondary leading-relaxed">
            <span className="text-cat-green font-semibold">Answer {q.correct}: </span>{q.explanation}
          </div>
          {q.option_analysis && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] font-semibold text-cat-orange uppercase tracking-wider mb-1.5 flex items-center gap-1"><Target size={11} /> Option-by-Option</p>
              <div className="space-y-1">
                {letters.map(L => q.option_analysis[L] && (
                  <p key={L} className={`text-xs leading-relaxed ${L === q.correct ? 'text-cat-green' : 'text-text-muted'}`}>
                    <span className="font-bold font-mono">{L})</span> {q.option_analysis[L]}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── Passage studio: understand → solve → review (shared) ─────────────────────
function PassageStudio({ data, hasApiKey, source, onFinish }) {
  const { pop, showWord, close } = useWordLookup(hasApiKey)
  const [lines, setLines] = useState(data.lines || null)
  const [linesLoading, setLinesLoading] = useState(false)
  const [showLines, setShowLines] = useState(!!data.lines)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [sec, setSec] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    setLines(data.lines || null); setShowLines(!!data.lines); setRevealed(false)
    setAnswers({}); setSubmitted(false); setSec(0)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setSec(s => s + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [data])

  const questions = data.questions || []
  const theme = data.theme || data.title || 'RC'

  const explainHindi = async () => {
    if (lines?.length) { setShowLines(true); return }
    if (!hasApiKey) { showToast('Add an API key in Settings to unlock Hinglish explanations', 'info'); return }
    setLinesLoading(true)
    try {
      const d = await getCachedContent(`rclineshi_${makeId(data.passage)}`, SYSTEM, buildLinesPrompt(data.passage), 4000)
      setLines(d.lines || []); setShowLines(true)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLinesLoading(false) }
  }

  const submit = () => {
    clearInterval(timerRef.current)
    setSubmitted(true)
    questions.forEach((q, i) => {
      const correct = answers[i] === q.correct
      const topic = rcTopic(q.type)
      recordAttempt('VARC', topic, correct, Math.round(sec / Math.max(1, questions.length)))
      logResult({ section: 'VARC', topic, source, stem: `[RC · ${theme}]\n\n${q.q}`, options: q.options, answer: q.correct, explanation: q.explanation, isCorrect: correct })
    })
    const score = questions.filter((q, i) => answers[i] === q.correct).length
    onFinish?.(score, questions.length)
    showToast(`Score: ${score}/${questions.length}`, score >= questions.length * 0.7 ? 'success' : 'info')
  }

  const score = submitted ? questions.filter((q, i) => answers[i] === q.correct).length : 0
  const answered = Object.keys(answers).length

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="blue">Passage</Badge>
            {data.title && <span className="text-xs text-text-muted">{data.title}</span>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-text-muted"><Clock size={11} /><TimerDisplay seconds={sec} /></div>
            <button onClick={explainHindi} disabled={linesLoading} className="flex items-center gap-1 px-2.5 py-1.5 bg-cat-purple/10 text-cat-purple border border-cat-purple/30 rounded-lg text-[11px] font-semibold hover:bg-cat-purple/20 transition-all disabled:opacity-50">
              <Languages size={12} />{linesLoading ? 'Explaining…' : showLines ? 'Hinglish ✓' : 'Explain in Hinglish'}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-text-muted mb-2 flex items-center gap-1"><Eye size={11} /> Tip: click any word to see its meaning</p>
        <ClickablePassage text={data.passage} onWord={showWord} />
      </Card>

      <Overview data={data} />
      {showLines && <LineByLine lines={lines} />}
      <HardWords words={data.hard_words} onWord={showWord} />
      <TipsBlock tips={data.tips} elimination={data.elimination} />

      {!revealed && !submitted && (
        <button onClick={() => setRevealed(true)} className="w-full py-3 bg-cat-blue text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2">
          I've understood it — Show Questions <ChevronRight size={15} />
        </button>
      )}

      {(revealed || submitted) && questions.length > 0 && (
        <div className="space-y-3">
          {submitted && (
            <Card className="flex items-center gap-4 bg-cat-green/5 border-cat-green/30">
              <ScoreRing score={score} total={questions.length} size={60} color="#10B981" />
              <p className="text-sm text-text-secondary">You scored <span className="font-semibold text-text-primary">{score}/{questions.length}</span>. Read the option-by-option breakdown to sharpen your elimination.</p>
            </Card>
          )}
          {questions.map((q, i) => (
            <QuestionCard key={i} q={q} idx={i} selected={answers[i]} submitted={submitted} source={source} theme={theme}
              onSelect={(letter) => setAnswers(a => ({ ...a, [i]: letter }))} />
          ))}
          {!submitted && (
            <button onClick={submit} disabled={answered < questions.length} className="w-full py-3 bg-cat-green text-white rounded-xl font-semibold disabled:opacity-40 transition-all">
              Submit Answers ({answered}/{questions.length})
            </button>
          )}
        </div>
      )}

      <WordPopover pop={pop} onClose={close} />
    </div>
  )
}

// ─── Decode tab (paste your own passage) ──────────────────────────────────────
function DecodeTab({ hasApiKey, onNavigate }) {
  const [passage, setPassage] = useState('')
  const [questions, setQuestions] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const decode = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    if (passage.trim().length < 80) { showToast('Paste a longer passage (at least a paragraph)', 'info'); return }
    setLoading(true); setData(null)
    try {
      const d = await callAI(SYSTEM, buildDecodePrompt(passage, questions), 3000)
      setData({ ...d, passage })
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Your Passage</p>
          <textarea value={passage} onChange={e => setPassage(e.target.value)} rows={7} placeholder="Paste any Reading Comprehension passage here…"
            className="w-full bg-bg-secondary border border-border rounded-xl p-3 text-sm text-text-primary placeholder:text-text-muted focus:border-cat-blue focus:outline-none resize-y leading-relaxed" />
        </div>
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Questions <span className="text-text-muted normal-case font-normal">(optional — leave blank and I'll create CAT-level ones)</span></p>
          <textarea value={questions} onChange={e => setQuestions(e.target.value)} rows={3} placeholder="Paste the questions (with options) if you have them…"
            className="w-full bg-bg-secondary border border-border rounded-xl p-3 text-sm text-text-primary placeholder:text-text-muted focus:border-cat-blue focus:outline-none resize-y leading-relaxed" />
        </div>
        <button onClick={decode} disabled={loading} className="w-full py-3 bg-cat-blue text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          <Wand2 size={15} />{loading ? 'Decoding passage…' : 'Decode & Explain'}
        </button>
      </Card>

      {loading && <><CardSkeleton /><CardSkeleton /></>}
      {data && !loading && <PassageStudio data={data} hasApiKey={hasApiKey} source="rc_decode" />}
    </div>
  )
}

// ─── Daily 5 tab ──────────────────────────────────────────────────────────────
const today = () => new Date().toDateString()
const loadResults = () => { try { return JSON.parse(localStorage.getItem(`cat_rc5_${today()}`) || '{}') } catch { return {} } }
const saveResults = (r) => localStorage.setItem(`cat_rc5_${today()}`, JSON.stringify(r))

function Daily5Tab({ hasApiKey, onNavigate }) {
  const [plan] = useState(buildDailyPlan)
  const [selected, setSelected] = useState(null)
  const [slot, setSlot] = useState(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(loadResults)

  const open = async (i) => {
    setSelected(i); setSlot(null)
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true)
    try {
      const p = plan[i]
      const d = await getCachedContent(`rc5_${today()}_${i}`, SYSTEM, buildSlotPrompt(p.difficulty, p.genre, p.focus), 4000)
      setSlot(d)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const onFinish = (score, total) => {
    const r = { ...results, [selected]: { score, total } }
    setResults(r); saveResults(r)
  }

  const done = Object.keys(results).length
  const focus = plan[0].focus

  return (
    <div className="space-y-4">
      <Card className="bg-cat-blue/5 border-cat-blue/20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-semibold text-text-primary">Today's 5 Passages · {today()}</p>
            <p className="text-xs text-text-muted mt-0.5">Escalating difficulty · varied genres · CAT-level questions{focus ? ` · targeting your weak spot: ${focus}` : ''}</p>
          </div>
          <Badge variant={done >= 5 ? 'green' : 'blue'}>{done}/5 done</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {plan.map((p, i) => {
          const res = results[i]
          const active = selected === i
          return (
            <button key={i} onClick={() => open(i)}
              className={`p-3 rounded-xl border text-left transition-all ${active ? 'border-cat-blue bg-cat-blue/10' : 'border-border bg-bg-card hover:border-border-light'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-text-primary">#{i + 1}</span>
                <Badge variant={DIFF_VARIANT[p.difficulty]}>{p.difficulty}</Badge>
              </div>
              <p className="text-[11px] text-text-muted leading-tight">{p.genre}</p>
              {res && <p className="text-[11px] font-semibold text-cat-green mt-1">✓ {res.score}/{res.total}</p>}
            </button>
          )
        })}
      </div>

      {loading && <><CardSkeleton /><CardSkeleton /></>}
      {selected !== null && slot && !loading && (
        <PassageStudio key={selected} data={slot} hasApiKey={hasApiKey} source="rc_daily5" onFinish={onFinish} />
      )}
      {selected === null && !loading && (
        <Card className="text-center py-8">
          <BookOpen size={28} className="mx-auto text-text-muted mb-2" />
          <p className="text-sm text-text-secondary">Pick a passage above to start. Read it, understand it in Hinglish, then solve.</p>
        </Card>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'daily5', label: '🎯 Daily 5' },
  { id: 'decode', label: '📝 Decode a Passage' },
]

export default function RCTrainer({ hasApiKey, onNavigate }) {
  const [tab, setTab] = useState('daily5')
  return (
    <div className="animate-fade-in max-w-3xl">
      <SectionHeader title="RC Comprehension Trainer" subtitle="Understand every passage in easy Hinglish, learn cracking techniques, then master CAT-level questions" />
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${tab === t.id ? 'bg-cat-blue text-white border-cat-blue' : 'border-border text-text-secondary hover:border-border-light'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'daily5' && <Daily5Tab hasApiKey={hasApiKey} onNavigate={onNavigate} />}
      {tab === 'decode' && <DecodeTab hasApiKey={hasApiKey} onNavigate={onNavigate} />}
    </div>
  )
}
