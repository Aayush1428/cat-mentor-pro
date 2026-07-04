import React, { useState, useRef, useEffect } from 'react'
import { chatAI } from '../utils/ai.js'
import { Send, Copy, Check } from 'lucide-react'

const SYSTEM_PROMPT = `You are an expert CAT exam mentor with deep knowledge of VARC, DILR, and Quantitative Aptitude, and full knowledge of CAT papers from 2014–2024. You teach with:
- Precise, step-by-step solutions to any CAT question
- Correct formulas and shortcuts, clearly explained
- Realistic exam strategy advice (time management, attempt strategy, topic prioritization)
- Adaptive depth based on the student's level

When solving a question: show every step of the calculation. When explaining a concept: start plain, then go deep with examples. When asked about exam strategy: be specific and actionable, not generic. Never fabricate CAT trivia — if unsure about exact historical details, say so.`

const SUGGESTIONS = {
  VARC: [
    'How do I solve Para Jumbles faster?',
    'What are the most common RC question traps?',
    'Explain the "author tone" question type with an example',
    'How to identify the correct para summary option?',
  ],
  DILR: [
    'How to approach a seating arrangement puzzle systematically?',
    'What is the fastest way to solve Games & Tournaments sets?',
    'Explain how to use Venn diagrams for 3-set problems',
    'How much time should I spend on one DILR set?',
  ],
  QA: [
    'Explain the shortcut for percentage change calculations',
    'How to solve Time Speed Distance problems quickly?',
    'What is the fastest method for Permutation & Combination?',
    'Explain how to identify when to use AP vs GP',
  ],
  Strategy: [
    'What is a good attempt strategy for CAT VARC section?',
    'How many questions should I attempt to get 99 percentile?',
    'How do I improve my mock test scores?',
    'What is the ideal CAT preparation timeline for 6 months?',
  ],
}

function Message({ msg }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'
  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isUser ? 'bg-cat-orange text-white' : 'bg-cat-blue text-white'}`}>{isUser ? 'You' : 'AI'}</div>
      <div className="max-w-[80%] flex flex-col gap-1">
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'bg-cat-orange text-white rounded-tr-sm' : 'bg-bg-card border border-border text-text-secondary rounded-tl-sm'}`}>{msg.content}</div>
        {!isUser && <button onClick={copy} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary px-1">{copied ? <Check size={11} className="text-cat-green"/> : <Copy size={11}/>}{copied?'Copied':'Copy'}</button>}
      </div>
    </div>
  )
}

function Typing() {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-cat-blue flex items-center justify-center text-xs font-bold text-white flex-shrink-0">AI</div>
      <div className="bg-bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1">
        {[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
      </div>
    </div>
  )
}

export default function AITutor({ hasApiKey, onNavigate }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Hi — I'm your CAT prep mentor. Ask me anything: how to solve a specific question, exam strategy, time management, or a concept you're stuck on.\n\nWhat would you like help with?" }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('Strategy')
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const send = async (text) => {
    const t = (text || input).trim()
    if (!t || loading) return
    if (!hasApiKey) { onNavigate('settings'); return }
    setInput('')
    setMessages(p => [...p, { role: 'user', content: t }])
    setLoading(true)
    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      history.push({ role: 'user', content: t })
      const reply = await chatAI(SYSTEM_PROMPT, history, 1500)
      setMessages(p => [...p, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(p => [...p, { role: 'assistant', content: `Error: ${e.message}. Check your API key in Settings.` }])
    } finally { setLoading(false) }
  }

  const showSuggestions = messages.length === 1

  return (
    <div className="flex flex-col animate-fade-in" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex-1 bg-bg-secondary border border-border rounded-2xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.map((m,i) => <Message key={i} msg={m} />)}
          {loading && <Typing />}
          <div ref={endRef} />
        </div>

        {showSuggestions && (
          <div className="px-5 pb-3 border-t border-border pt-3">
            <div className="flex gap-1 mb-2">
              {Object.keys(SUGGESTIONS).map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-2 py-0.5 rounded text-xs transition-all ${activeCategory===cat?'bg-cat-blue text-white':'text-text-muted hover:text-text-secondary'}`}>{cat}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS[activeCategory].map(p => (
                <button key={p} onClick={() => send(p)} className="px-3 py-1.5 bg-bg-card border border-border rounded-full text-xs text-text-secondary hover:border-cat-blue hover:text-cat-blue transition-all">{p}</button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t border-border">
          {!hasApiKey && (
            <div className="mb-3 flex items-center justify-between bg-cat-orange/10 border border-cat-orange/30 rounded-lg px-3 py-2">
              <p className="text-xs text-cat-orange">Add an API key to enable the tutor</p>
              <button onClick={() => onNavigate('settings')} className="text-xs text-cat-orange font-semibold hover:underline">Settings →</button>
            </div>
          )}
          <div className="flex gap-3 items-end">
            <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}
              placeholder={hasApiKey ? 'Ask any CAT question or doubt...' : 'Add API key in Settings first'} disabled={!hasApiKey||loading} rows={2}
              className="flex-1 bg-bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cat-blue transition-colors resize-none disabled:opacity-50" style={{ maxHeight: 120 }} />
            <button onClick={()=>send()} disabled={!input.trim()||loading||!hasApiKey} className="p-3 bg-cat-blue text-white rounded-xl hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"><Send size={16}/></button>
          </div>
        </div>
      </div>
    </div>
  )
}
