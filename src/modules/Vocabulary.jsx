import React, { useState, useEffect } from 'react'
import { Card, Badge, SectionHeader, CardSkeleton, showToast } from '../components/ui/index.jsx'
import { getCachedContent, callAI } from '../utils/ai.js'
import { addCard, hasCard, getDueCards, reviewCard, getAllCards, getDeckStats, removeCard, MAX_SRS_BOX } from '../utils/srs.js'
import { VOCAB_SEED, seedToCard } from '../data/vocabSeed.js'
import { Lightbulb, RotateCcw, CheckCircle, XCircle, BookOpen, Layers, Plus, Trash2, Check } from 'lucide-react'

const SYSTEM = `You are a CAT vocabulary expert. Generate precise, exam-relevant vocabulary content. Return ONLY valid JSON, no preamble.`

const WORD_CATEGORIES = ['Academic & Abstract','Business & Economics','Science & Nature','Politics & Society','Literature & Arts','Philosophy & Logic','Psychology & Behavior','Commonly Confused Words']

const buildDailyWordsPrompt = (date, category) => `Generate 12 high-priority vocabulary words for CAT exam preparation.
Focus category: ${category}.
These should be words that have appeared in CAT passages or are highly likely to appear based on CAT history.
Date seed: ${date}.

Return ONLY this JSON:
{
  "words": [
    {
      "word": "the word",
      "pronunciation": "phonetic pronunciation e.g. (preh-KAHM-ee-us)",
      "part_of_speech": "noun|verb|adjective|adverb",
      "meaning": "precise definition",
      "synonyms": ["syn1","syn2","syn3"],
      "antonyms": ["ant1","ant2"],
      "sentence": "a sophisticated example sentence similar to CAT passage usage",
      "memory_trick": "a mnemonic or etymology-based trick to remember this word",
      "cat_context": "how/where this type of word typically appears in CAT",
      "difficulty": "Easy|Medium|Hard"
    }
  ]
}`

const buildWordQuizPrompt = (words) => `Create a 10-question vocabulary quiz using these words: ${words.join(', ')}.
Mix of question types: synonyms, antonyms, fill-in-the-blank, contextual usage.

Return ONLY a JSON array:
[{"question":"question text","options":["A) ","B) ","C) ","D) "],"correct":"A|B|C|D","word":"the word being tested","type":"Synonym|Antonym|Usage|Definition","explanation":"why this answer is correct"}]`

const buildPredictedWordsPrompt = () => `Based on CAT exam history (2014–2024), predict 10 vocabulary words most likely to appear in CAT 2025 passages.
These should be based on recurring themes in CAT RCs: philosophy, economics, science, social issues.

Return ONLY this JSON:
{"words":[{"word":"word","meaning":"definition","why_likely":"reason this word is likely based on CAT trends","passage_topic":"the type of passage where this could appear","sentence":"example sentence"}]}`

// ─── Word Card ─────────────────────────────────────────────────────────────────
function WordCard({ word, idx }) {
  const [expanded, setExpanded] = useState(false)
  const [inDeck, setInDeck] = useState(() => hasCard(word.word))
  const diffColor = word.difficulty==='Easy'?'green':word.difficulty==='Medium'?'orange':'red'
  const addToDeck = (e) => {
    e.stopPropagation()
    if (addCard(word)) { setInDeck(true); showToast(`"${word.word}" added to your deck`, 'success') }
  }
  return (
    <Card hover onClick={() => setExpanded(!expanded)} className="transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-display font-bold text-text-primary text-base">{word.word}</span>
            <span className="text-xs text-text-muted italic">{word.pronunciation}</span>
            <Badge variant="gray">{word.part_of_speech}</Badge>
            <Badge variant={diffColor}>{word.difficulty}</Badge>
          </div>
          <p className="text-xs text-text-secondary">{word.meaning}</p>
          {!expanded && word.sentence && <p className="text-xs text-text-muted mt-1 italic">"{word.sentence.substring(0,80)}..."</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={addToDeck} disabled={inDeck}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all flex items-center gap-1 ${inDeck ? 'border-cat-green/30 text-cat-green' : 'border-border text-text-secondary hover:border-cat-blue hover:text-cat-blue'}`}>
            {inDeck ? <><Check size={10}/> In deck</> : <><Plus size={10}/> Deck</>}
          </button>
          <span className="text-text-muted text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Example Sentence</p>
            <p className="text-xs text-text-secondary italic leading-relaxed">"{word.sentence}"</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {word.synonyms?.length > 0 && (
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Synonyms</p>
                <div className="flex flex-wrap gap-1">{word.synonyms.map((s,i) => <Badge key={i} variant="blue">{s}</Badge>)}</div>
              </div>
            )}
            {word.antonyms?.length > 0 && (
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Antonyms</p>
                <div className="flex flex-wrap gap-1">{word.antonyms.map((a,i) => <Badge key={i} variant="red">{a}</Badge>)}</div>
              </div>
            )}
          </div>
          {word.memory_trick && (
            <div className="bg-cat-orange/5 border border-cat-orange/20 rounded-lg p-3">
              <p className="text-[10px] text-cat-orange uppercase tracking-wider mb-1">💡 Memory Trick</p>
              <p className="text-xs text-text-secondary">{word.memory_trick}</p>
            </div>
          )}
          {word.cat_context && (
            <div className="bg-cat-blue/5 border border-cat-blue/20 rounded-lg p-3">
              <p className="text-[10px] text-cat-blue uppercase tracking-wider mb-1">🎯 CAT Context</p>
              <p className="text-xs text-text-secondary">{word.cat_context}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── Quiz ──────────────────────────────────────────────────────────────────────
function VocabQuiz({ words, hasApiKey, onNavigate }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const generate = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true); setQuestions([]); setAnswers({}); setSubmitted(false)
    try {
      const wordList = words.map(w => w.word)
      const d = await callAI(SYSTEM, buildWordQuizPrompt(wordList), 2000)
      setQuestions(Array.isArray(d) ? d : [])
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const submit = () => {
    setSubmitted(true)
    const score = questions.filter((q,i) => answers[i] === q.correct).length
    showToast(`Vocabulary Quiz: ${score}/${questions.length}`, score >= 8 ? 'success' : 'info')
  }

  const score = submitted ? questions.filter((q,i) => answers[i] === q.correct).length : 0

  return (
    <div className="space-y-4">
      {questions.length === 0 && (
        <button onClick={generate} disabled={loading || words.length === 0}
          className="w-full py-3 bg-cat-purple text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
          {loading ? 'Generating Quiz...' : '📝 Test Today\'s Words (10 Questions)'}
        </button>
      )}
      {loading && <CardSkeleton />}
      {questions.length > 0 && !loading && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Vocabulary Quiz</p>
            {submitted && <div className={`text-lg font-mono font-bold ${score >= 8 ? 'text-cat-green' : score >= 6 ? 'text-cat-orange' : 'text-cat-red'}`}>{score}/10</div>}
          </div>
          {questions.map((q,i) => {
            const sel = answers[i]
            return (
              <Card key={i}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="purple">{q.type}</Badge>
                  <span className="text-xs font-mono text-cat-purple font-bold">{q.word}</span>
                </div>
                <p className="text-sm font-medium text-text-primary mb-2">{q.question}</p>
                <div className="space-y-1.5">
                  {q.options.map((opt,oi) => {
                    const letter=['A','B','C','D'][oi]
                    const isSel=sel===letter, ok=submitted&&letter===q.correct, bad=submitted&&isSel&&!ok
                    return <button key={oi} onClick={()=>!submitted&&setAnswers(a=>({...a,[i]:letter}))} disabled={submitted}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${ok?'border-cat-green bg-cat-green/10 text-cat-green':bad?'border-cat-red bg-cat-red/10 text-cat-red':isSel?'border-cat-purple bg-cat-purple/10 text-cat-purple':'border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>{opt}</button>
                  })}
                </div>
                {submitted && <p className="mt-2 text-xs text-text-secondary bg-bg-secondary rounded-lg p-2"><span className="text-cat-green font-semibold">Answer {q.correct}: </span>{q.explanation}</p>}
              </Card>
            )
          })}
          {!submitted && <button onClick={submit} disabled={Object.keys(answers).length < questions.length} className="w-full py-3 bg-cat-purple text-white rounded-xl font-semibold disabled:opacity-40 transition-all">Submit Quiz</button>}
          {submitted && <button onClick={() => { setQuestions([]); setSubmitted(false) }} className="w-full py-2.5 bg-cat-purple text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"><RotateCcw size={13}/> Retry</button>}
        </>
      )}
    </div>
  )
}

// ─── Predicted Words ───────────────────────────────────────────────────────────
function PredictedWords({ hasApiKey, onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!hasApiKey) { onNavigate('settings'); return }
    setLoading(true)
    try {
      const d = await getCachedContent('predicted_vocab_2025', SYSTEM, buildPredictedWordsPrompt(), 2000)
      setData(d)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      {!data && !loading && (
        <button onClick={load} className="w-full py-3 bg-cat-orange text-white rounded-xl font-semibold hover:opacity-90 transition-all">
          🔮 Load AI-Predicted High-Probability Words
        </button>
      )}
      {loading && <CardSkeleton />}
      {data?.words?.map((w, i) => (
        <Card key={i}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-display font-bold text-text-primary">{w.word}</span>
            <Badge variant="orange">Predicted</Badge>
          </div>
          <p className="text-xs text-text-secondary mb-2">{w.meaning}</p>
          <p className="text-xs text-cat-blue mb-1"><span className="font-semibold">Likely passage: </span>{w.passage_topic}</p>
          <p className="text-xs text-cat-orange"><span className="font-semibold">Why likely: </span>{w.why_likely}</p>
          <p className="text-xs text-text-muted mt-2 italic">"{w.sentence}"</p>
        </Card>
      ))}
    </div>
  )
}

// ─── Spaced-Repetition Deck (Leitner) ─────────────────────────────────────────
function VocabDeck() {
  const [tick, setTick] = useState(0)
  const [session, setSession] = useState(null)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const refresh = () => setTick(t => t + 1)

  const stats = getDeckStats()
  const cards = getAllCards()

  const startReview = () => {
    const due = getDueCards()
    if (!due.length) { showToast('No cards due right now — come back later!', 'info'); return }
    setSession(due); setIdx(0); setRevealed(false)
  }

  const grade = (ok) => {
    const card = session[idx]
    reviewCard(card.word, ok)
    if (idx + 1 < session.length) { setIdx(idx + 1); setRevealed(false) }
    else { setSession(null); showToast('Review session complete!', 'success'); refresh() }
  }

  const seed = (n) => {
    const fresh = VOCAB_SEED.filter(w => !hasCard(w.word)).slice(0, n)
    if (!fresh.length) { showToast('All seed words are already in your deck', 'info'); return }
    fresh.forEach(w => addCard(seedToCard(w)))
    showToast(`Added ${fresh.length} high-frequency CAT words`, 'success'); refresh()
  }

  const drop = (word) => { removeCard(word); refresh() }

  // Active review flashcard
  if (session) {
    const card = session[idx]
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Card {idx + 1} / {session.length}</span>
          <button onClick={() => setSession(null)} className="hover:text-cat-red">End session</button>
        </div>
        <div className="w-full bg-bg-secondary rounded-full h-1.5">
          <div className="bg-cat-blue h-1.5 rounded-full transition-all" style={{ width: `${(idx / session.length) * 100}%` }} />
        </div>
        <Card className="min-h-[220px] flex flex-col items-center justify-center text-center py-8">
          <p className="font-display font-bold text-2xl text-text-primary mb-1">{card.word}</p>
          {card.pronunciation && <p className="text-xs text-text-muted italic mb-4">{card.pronunciation}</p>}
          {!revealed ? (
            <button onClick={() => setRevealed(true)} className="mt-4 px-5 py-2 bg-cat-blue text-white rounded-xl text-xs font-semibold hover:opacity-90">Show meaning</button>
          ) : (
            <div className="mt-2 space-y-2 w-full max-w-md">
              <p className="text-sm text-text-primary">{card.meaning}</p>
              {card.synonyms?.length > 0 && <p className="text-xs text-text-secondary"><span className="text-cat-green font-semibold">Syn:</span> {card.synonyms.join(', ')}</p>}
              {card.antonyms?.length > 0 && <p className="text-xs text-text-secondary"><span className="text-cat-red font-semibold">Ant:</span> {card.antonyms.join(', ')}</p>}
              {card.sentence && <p className="text-xs text-text-muted italic mt-1">"{card.sentence}"</p>}
            </div>
          )}
        </Card>
        {revealed && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => grade(false)} className="py-3 bg-cat-red/10 text-cat-red border border-cat-red/30 rounded-xl text-sm font-semibold hover:bg-cat-red/20 transition-all flex items-center justify-center gap-2"><XCircle size={15}/> Forgot</button>
            <button onClick={() => grade(true)} className="py-3 bg-cat-green/10 text-cat-green border border-cat-green/30 rounded-xl text-sm font-semibold hover:bg-cat-green/20 transition-all flex items-center justify-center gap-2"><CheckCircle size={15}/> Remembered</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center py-3"><p className="text-xl font-bold text-text-primary">{stats.total}</p><p className="text-[10px] text-text-muted uppercase tracking-wider">In Deck</p></Card>
        <Card className="text-center py-3"><p className="text-xl font-bold text-cat-orange">{stats.due}</p><p className="text-[10px] text-text-muted uppercase tracking-wider">Due Now</p></Card>
        <Card className="text-center py-3"><p className="text-xl font-bold text-cat-green">{stats.mastered}</p><p className="text-[10px] text-text-muted uppercase tracking-wider">Mastered</p></Card>
        <Card className="text-center py-3"><p className="text-xl font-bold text-cat-blue">{stats.learning}</p><p className="text-[10px] text-text-muted uppercase tracking-wider">Learning</p></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={startReview} disabled={stats.due === 0} className="px-4 py-2.5 bg-cat-blue text-white rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-1.5">
          <Layers size={14}/> Review Due ({stats.due})
        </button>
        <button onClick={() => seed(20)} className="px-4 py-2.5 border border-border text-text-secondary rounded-xl text-xs font-semibold hover:border-cat-blue hover:text-cat-blue transition-all flex items-center gap-1.5">
          <Plus size={14}/> Add 20 CAT words
        </button>
      </div>

      {cards.length === 0 ? (
        <Card className="text-center py-10">
          <Layers size={28} className="text-text-muted mx-auto mb-3" />
          <p className="text-sm font-semibold text-text-primary mb-1">Your deck is empty</p>
          <p className="text-xs text-text-muted">Add words from Daily Words / AI Predictions with the "+ Deck" button, or seed high-frequency CAT words above. Cards resurface on a spaced schedule so you remember them long-term.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">All cards ({cards.length})</p>
          {cards.slice().sort((a,b) => new Date(a.due) - new Date(b.due)).map((c) => {
            const due = new Date(c.due).getTime() <= Date.now()
            return (
              <div key={c.word} className="flex items-center gap-3 bg-bg-card border border-border rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{c.word}</p>
                  <p className="text-xs text-text-muted truncate">{c.meaning}</p>
                </div>
                <Badge variant={c.box >= MAX_SRS_BOX ? 'green' : due ? 'orange' : 'blue'}>Box {c.box}/{MAX_SRS_BOX}</Badge>
                <button onClick={() => drop(c.word)} className="text-text-muted hover:text-cat-red"><Trash2 size={14}/></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Vocabulary Module ────────────────────────────────────────────────────
const TABS = [
  { id: 'daily', label: '📅 Daily Words' },
  { id: 'deck', label: '🗂️ My Deck (SRS)' },
  { id: 'quiz', label: '📝 Vocab Quiz' },
  { id: 'predicted', label: '🔮 AI Predictions' },
]

export default function Vocabulary({ hasApiKey, onNavigate }) {
  const [tab, setTab] = useState('daily')
  const [category, setCategory] = useState(WORD_CATEGORIES[0])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const today = new Date().toDateString()

  useEffect(() => { if (hasApiKey) load() }, [hasApiKey])

  const load = async () => {
    setLoading(true)
    try {
      const d = await getCachedContent(`vocab_${today}_${category}`, SYSTEM, buildDailyWordsPrompt(today, category), 3000)
      setData(d)
    } catch { setData(null) }
    finally { setLoading(false) }
  }

  const learned = data?.words?.length || 0

  return (
    <div className="animate-fade-in max-w-3xl space-y-4">
      <SectionHeader title="Vocabulary Builder" subtitle="12 high-priority words daily with memory tricks, plus AI-predicted CAT vocab" />

      <div className="flex gap-2">
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${tab===t.id?'bg-cat-blue text-white border-cat-blue':'border-border text-text-secondary hover:border-border-light'}`}>{t.label}</button>)}
      </div>

      {tab === 'daily' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs text-text-muted">{today}</div>
            {data && <Badge variant="green">{learned} words loaded</Badge>}
          </div>
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              {WORD_CATEGORIES.map(c => <button key={c} onClick={() => setCategory(c)} className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-all ${category===c?'bg-cat-blue text-white border-cat-blue':'border-border text-text-secondary hover:border-cat-blue/50'}`}>{c}</button>)}
            </div>
          </div>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-cat-blue text-white rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5">
            <RotateCcw size={12}/>{loading ? 'Loading...' : 'Load Words'}
          </button>

          {loading && <>{[...Array(4)].map((_,i) => <CardSkeleton key={i} />)}</>}
          {data?.words?.map((word, i) => <WordCard key={i} word={word} idx={i} />)}
        </div>
      )}

      {tab === 'deck' && <VocabDeck />}
      {tab === 'quiz' && <VocabQuiz words={data?.words || []} hasApiKey={hasApiKey} onNavigate={onNavigate} />}
      {tab === 'predicted' && <PredictedWords hasApiKey={hasApiKey} onNavigate={onNavigate} />}
    </div>
  )
}
