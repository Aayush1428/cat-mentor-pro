import React, { useEffect, useMemo, useState } from 'react'
import { Card, SectionHeader, Badge, CardSkeleton, showToast, ProgressBar } from '../components/ui/index.jsx'
import { fetchIndianReadingFeed, fetchFinanceReadingFeed, fetchAiTrendsFeed, explainWordSimple, recordNewsRead, getTodayNewsRead, getNewsProviderStatus, generateDailyBrief } from '../utils/news.js'
import { logResult } from '../utils/bookmarks.js'
import { recordAttempt } from '../utils/performance.js'
import { Newspaper, RefreshCw, ExternalLink, TrendingUp, Bot, Languages, Zap, CheckCircle, XCircle } from 'lucide-react'

const TABS = [
  { id: 'brief', label: "Today's Brief", icon: Zap },
  { id: 'india', label: 'India Newspaper Reads', icon: Newspaper },
  { id: 'finance', label: 'Market & IPO Watch', icon: TrendingUp },
  { id: 'ai', label: 'AI/ML Trends', icon: Bot },
  { id: 'vocab', label: 'Word Simplifier', icon: Languages },
]

const sourceColor = (name = '') => {
  const s = name.toLowerCase()
  if (s.includes('economic') || s.includes('finance') || s.includes('market')) return 'orange'
  if (s.includes('hacker') || s.includes('dev.to')) return 'purple'
  if (s.includes('times') || s.includes('hindustan')) return 'blue'
  return 'gray'
}

const fmtDate = (iso) => {
  try {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function EmptyState({ title, hint }) {
  return (
    <Card className="text-center py-8">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="text-xs text-text-muted mt-1">{hint}</p>
    </Card>
  )
}

function ArticleList({ items, section }) {
  if (!items.length) {
    return <EmptyState title="No articles yet" hint="Add API keys in Settings and hit refresh. AI Trends works even without paid keys." />
  }

  const openItem = (item) => {
    recordNewsRead(section)
    window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-2">
      {items.map((a, i) => (
        <Card key={a.id || `${a.url}-${i}`} hover onClick={() => openItem(a)} className="group">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary group-hover:text-cat-blue transition-colors leading-snug">{a.title}</p>
              {a.summary && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{a.summary}</p>}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Badge variant={sourceColor(a.source)}>{a.source || 'Source'}</Badge>
                {a.publishedAt && <span className="text-[10px] text-text-muted">{fmtDate(a.publishedAt)}</span>}
              </div>
            </div>
            <ExternalLink size={14} className="text-text-muted group-hover:text-cat-blue flex-shrink-0" />
          </div>
        </Card>
      ))}
    </div>
  )
}

function DailyBrief({ articles, hasApiKey, onNavigate }) {
  const today = new Date().toISOString().slice(0, 10)
  const [loading, setLoading] = useState(false)
  const [brief, setBrief] = useState(() => {
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(`cat_brief_${today}`)) {
          const v = JSON.parse(localStorage.getItem(k))
          if (v?.brief) return v
        }
      }
    } catch {}
    return null
  })
  const [pickedIdx, setPickedIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [showKeys, setShowKeys] = useState({})

  const pickableArticles = articles.filter(a => a.title && a.url)
  const picked = pickableArticles[pickedIdx]

  const generate = async () => {
    if (!hasApiKey) {
      showToast('Add an AI key in Settings to generate briefs', 'info')
      onNavigate('settings')
      return
    }
    if (!picked) {
      showToast('Load India or AI feeds first so there are articles to brief', 'info')
      return
    }
    setLoading(true); setBrief(null); setAnswers({}); setSubmitted(false); setShowKeys({})
    try {
      const result = await generateDailyBrief(picked)
      setBrief(result)
    } catch (e) {
      showToast('Could not generate brief: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const submit = () => {
    if (!brief?.questions?.length) return
    setSubmitted(true)
    const qs = brief.questions
    qs.forEach((q, i) => {
      const correct = answers[i] === q.correct
      recordAttempt('VARC', `RC — ${q.type || 'RC'}`, correct)
      logResult({
        section: 'VARC',
        topic: `RC — ${q.type || 'RC'}`,
        source: 'news_brief',
        stem: q.q,
        options: q.options,
        answer: q.correct,
        explanation: q.explanation,
        isCorrect: correct,
      })
    })
    const score = qs.filter((q, i) => answers[i] === q.correct).length
    showToast(`Score: ${score}/${qs.length} — logged to Revision`, score >= 3 ? 'success' : 'info')
  }

  const score = submitted ? (brief?.questions || []).filter((q, i) => answers[i] === q.correct).length : 0

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={14} className="text-cat-blue" />
          <p className="text-sm font-semibold text-text-primary">Pick an article to brief</p>
        </div>
        <p className="text-xs text-text-secondary">AI reads the article, writes a 60-second editorial summary, spotlights vocab, and generates 5 CAT RC questions — which are logged to your Revision hub.</p>
        {pickableArticles.length === 0 ? (
          <p className="text-xs text-text-muted italic">No articles loaded yet — open India Reads or AI Trends tab first.</p>
        ) : (
          <div className="space-y-1">
            {pickableArticles.slice(0, 8).map((a, i) => (
              <button key={a.url || i} onClick={() => { setPickedIdx(i); setBrief(null); setAnswers({}); setSubmitted(false) }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                  pickedIdx === i ? 'border-cat-blue bg-cat-blue/10 text-cat-blue' : 'border-border text-text-secondary hover:border-border-light'
                }`}>
                <span className="font-semibold">{i + 1}. </span>{a.title.slice(0, 90)}{a.title.length > 90 ? '…' : ''}
                <span className="ml-2 text-[10px] opacity-60">{a.source}</span>
              </button>
            ))}
          </div>
        )}
        <button onClick={generate} disabled={loading || !picked}
          className="w-full py-2.5 bg-cat-blue text-white rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          <Zap size={13}/>{loading ? 'Generating Brief…' : 'Generate 60-Second Brief + 5 RC Questions'}
        </button>
      </Card>

      {loading && <><CardSkeleton /><CardSkeleton /></>}

      {brief && !loading && (
        <>
          <Card>
            <div className="flex items-start gap-2 mb-3">
              <Badge variant="blue">60-sec Brief</Badge>
              {picked?.url && (
                <a href={picked.url} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-text-muted hover:text-cat-blue flex items-center gap-0.5 ml-auto flex-shrink-0">
                  {brief.source} <ExternalLink size={10} />
                </a>
              )}
            </div>
            <p className="text-sm font-semibold text-text-primary mb-2 leading-snug">{brief.article_title}</p>
            <p className="text-xs text-text-secondary leading-relaxed">{brief.brief}</p>
            {brief.key_points?.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Key Points</p>
                {brief.key_points.map((kp, i) => (
                  <p key={i} className="text-xs text-text-secondary">• {kp}</p>
                ))}
              </div>
            )}
            {brief.vocab_spotlight?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {brief.vocab_spotlight.map((v, i) => (
                  <span key={i} className="bg-cat-purple/10 border border-cat-purple/20 text-cat-purple text-[10px] font-medium rounded-lg px-2 py-1">
                    <span className="font-bold">{v.word}</span> — {v.meaning}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {brief.questions?.length > 0 && (
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">RC Practice ({brief.questions.length} Questions)</p>
                {submitted && <Badge variant={score >= 4 ? 'green' : score >= 3 ? 'orange' : 'red'}>{score}/{brief.questions.length}</Badge>}
              </div>

              {brief.questions.map((q, i) => (
                <div key={i} className="border-t border-border pt-3">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-cat-blue flex-shrink-0">Q{i + 1}</span>
                    <div className="flex-1">
                      <Badge variant="gray" className="mb-1">{q.type || 'RC'}</Badge>
                      <p className="text-xs font-medium text-text-primary leading-relaxed">{q.q}</p>
                    </div>
                    {submitted && (answers[i] === q.correct
                      ? <CheckCircle size={14} className="text-cat-green flex-shrink-0" />
                      : <XCircle size={14} className="text-cat-red flex-shrink-0" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {q.options?.map((opt, oi) => {
                      const letter = ['A', 'B', 'C', 'D'][oi]
                      const sel = answers[i] === letter
                      const ok = submitted && letter === q.correct
                      const bad = submitted && sel && !ok
                      return (
                        <button key={oi} onClick={() => !submitted && setAnswers(a => ({ ...a, [i]: letter }))}
                          disabled={submitted}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                            ok  ? 'border-cat-green bg-cat-green/10 text-cat-green' :
                            bad ? 'border-cat-red bg-cat-red/10 text-cat-red' :
                            sel ? 'border-cat-blue bg-cat-blue/10 text-cat-blue' :
                            'border-border text-text-secondary hover:border-border-light disabled:opacity-60'
                          }`}>{opt}
                        </button>
                      )
                    })}
                  </div>
                  {submitted && (
                    <button onClick={() => setShowKeys(k => ({ ...k, [i]: !k[i] }))}
                      className="text-[10px] text-cat-blue hover:underline mt-1">
                      {showKeys[i] ? 'Hide explanation' : 'Show explanation'}
                    </button>
                  )}
                  {submitted && showKeys[i] && (
                    <div className="mt-1 bg-bg-secondary rounded-lg p-2 text-xs text-text-secondary">{q.explanation}</div>
                  )}
                </div>
              ))}

              {!submitted && (
                <button onClick={submit} disabled={Object.keys(answers).length === 0}
                  className="w-full py-2.5 bg-cat-blue text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-all">
                  Submit ({Object.keys(answers).length}/{brief.questions.length} answered)
                </button>
              )}
              {submitted && (
                <button onClick={generate}
                  className="w-full py-2.5 border border-cat-blue text-cat-blue rounded-xl text-xs font-semibold hover:bg-cat-blue/10 transition-all flex items-center justify-center gap-2">
                  <Zap size={13}/> Pick Another Article
                </button>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function WordSimplifier({ hasApiKey, onNavigate }) {
  const [word, setWord] = useState('')
  const [sentence, setSentence] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const run = async () => {
    if (!word.trim()) return showToast('Enter a word first', 'error')
    if (!hasApiKey) {
      showToast('Add Groq/DeepSeek key in Settings to use simplifier', 'info')
      onNavigate('settings')
      return
    }
    setLoading(true)
    try {
      const r = await explainWordSimple(word.trim(), sentence.trim())
      setResult(r)
    } catch (e) {
      showToast('Could not simplify word: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="text-xs text-text-secondary">Paste a difficult word from any article and get easy English + Hindi meaning with a CAT usage tip.</p>
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Word (example: pragmatic)"
          className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cat-blue" />
        <textarea value={sentence} onChange={(e) => setSentence(e.target.value)} rows={3} placeholder="Optional sentence context"
          className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cat-blue" />
        <button onClick={run} disabled={loading} className="w-full py-2.5 bg-cat-blue text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
          {loading ? 'Simplifying...' : 'Simplify Word'}
        </button>
      </Card>

      {result && (
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-text-primary">{result.word || word}</p>
          <p className="text-xs text-text-secondary"><span className="font-semibold text-cat-blue">Simple English:</span> {result.simple_english}</p>
          <p className="text-xs text-text-secondary"><span className="font-semibold text-cat-green">Simple Hindi:</span> {result.simple_hindi}</p>
          <p className="text-xs text-text-secondary"><span className="font-semibold text-cat-purple">CAT Tip:</span> {result.cat_usage_tip}</p>
          <p className="text-xs text-text-muted italic">Memory Hook: {result.memory_hook}</p>
        </Card>
      )}
    </div>
  )
}

export default function NewsHub({ hasApiKey, onNavigate }) {
  const [tab, setTab] = useState('brief')
  const [loading, setLoading] = useState(false)
  const [india, setIndia] = useState([])
  const [finance, setFinance] = useState([])
  const [ai, setAi] = useState([])

  const provider = useMemo(() => getNewsProviderStatus(), [])
  const today = getTodayNewsRead()
  const readPct = Math.min(100, Math.round((today.total / 8) * 100))

  // All articles pooled for the DailyBrief picker
  const allArticles = useMemo(() => {
    const seen = new Set()
    return [...india, ...ai, ...finance].filter(a => {
      const k = a.url || a.title
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [india, ai, finance])

  const load = async (target = tab, force = false) => {
    setLoading(true)
    try {
      if (force) {
        const keys = ['cat_news_india', 'cat_news_finance', 'cat_news_hn', 'cat_news_devto']
        keys.forEach((k) => localStorage.removeItem(k))
      }

      if (target === 'india') {
        const items = await fetchIndianReadingFeed()
        setIndia(items)
        if (!items.length && !provider.hasAnyIndianNewsKey) showToast('Add NewsCatcher or NewsAPI key in Settings for Indian newspapers', 'info')
      }
      if (target === 'finance') {
        const items = await fetchFinanceReadingFeed()
        setFinance(items)
        if (!items.length && !provider.hasAnyIndianNewsKey) showToast('Add NewsCatcher or NewsAPI key for finance and IPO feed', 'info')
      }
      if (target === 'ai') {
        const items = await fetchAiTrendsFeed()
        setAi(items)
      }
    } catch (e) {
      showToast('Failed to load feed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load('india')
    load('ai')
  }, [])

  return (
    <div className="animate-fade-in max-w-4xl space-y-4">
      <SectionHeader title="Daily News Intelligence" subtitle="Build reading stamina + AI awareness + market context daily for CAT RC and interview readiness" />

      <Card className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-semibold text-text-primary">Daily Reading Target</p>
            <p className="text-xs text-text-secondary">Read 8 articles/day across newspapers, finance and AI. You opened {today.total} today.</p>
          </div>
          <Badge variant={today.total >= 8 ? 'green' : 'orange'}>{today.total}/8</Badge>
        </div>
        <ProgressBar value={readPct} color={readPct >= 100 ? '#10B981' : '#F59E0B'} />
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-text-muted">
          <span>India: {today.india}</span>
          <span>Finance: {today.finance}</span>
          <span>AI/ML: {today.ai}</span>
        </div>
      </Card>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== 'vocab' && t.id !== 'brief') load(t.id) }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${tab===t.id ? 'bg-cat-blue text-white border-cat-blue' : 'border-border text-text-secondary hover:border-border-light'}`}>
              <Icon size={13} /> {t.label}
            </button>
          )
        })}
        {tab !== 'vocab' && tab !== 'brief' && (
          <button onClick={() => load(tab, true)} disabled={loading}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-border text-text-secondary hover:border-cat-blue hover:text-cat-blue transition-all flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        )}
      </div>

      {!provider.hasAnyIndianNewsKey && tab !== 'ai' && tab !== 'vocab' && tab !== 'brief' && (
        <Card className="bg-cat-orange/5 border-cat-orange/30">
          <p className="text-xs text-cat-orange">Add NewsCatcher or NewsAPI key in Settings to unlock Times of India / Economic Times / Hindustan Times / Lokmat style aggregation and finance tracking.</p>
          <button onClick={() => onNavigate('settings')} className="mt-2 text-xs font-semibold text-cat-orange hover:underline">Open Settings →</button>
        </Card>
      )}

      {loading && tab !== 'vocab' && tab !== 'brief' && (
        <>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </>
      )}

      {tab === 'brief' && <DailyBrief articles={allArticles} hasApiKey={hasApiKey} onNavigate={onNavigate} />}
      {!loading && tab === 'india' && <ArticleList items={india} section="india" />}
      {!loading && tab === 'finance' && <ArticleList items={finance} section="finance" />}
      {!loading && tab === 'ai' && <ArticleList items={ai} section="ai" />}
      {tab === 'vocab' && <WordSimplifier hasApiKey={hasApiKey} onNavigate={onNavigate} />}

      <Card className="bg-bg-secondary">
        <p className="text-xs font-semibold text-text-primary mb-2">How to use this to improve CAT RC + GK + interviews</p>
        <ol className="space-y-1 text-xs text-text-secondary">
          <li>1. Open Today's Brief, pick an article, generate a brief + 5 RC questions — takes 5 minutes.</li>
          <li>2. Read 2 India editorial pieces daily for comprehension depth.</li>
          <li>3. Read 3 finance pieces (IPO, Sensex, Nifty, NSE/BSE) for business vocabulary.</li>
          <li>4. Read 3 AI/ML trend posts to stay current for MBA interviews and GDs.</li>
          <li>5. Use Word Simplifier for difficult words and add them to your vocab deck.</li>
        </ol>
      </Card>
    </div>
  )
}
