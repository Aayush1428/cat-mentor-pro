import React, { useState, useRef, useEffect } from 'react'
import { chatAI, visionAvailable } from '../utils/ai.js'
import { classifyAndCapture, getCapturedCount } from '../utils/captured.js'
import { showToast } from '../components/ui/index.jsx'
import Markdown from '../components/Markdown.jsx'
import { Send, Copy, Check, Paperclip, X, FileText, Sparkles, BookOpen } from 'lucide-react'

const SYSTEM_PROMPT = `You are an expert CAT exam mentor (VARC, DILR, Quantitative Aptitude) with full knowledge of CAT papers 2014–2024.

FORMAT EVERY ANSWER IN CLEAN MARKDOWN so it renders beautifully:
- Lead with the FINAL ANSWER first. If the question has multiple parts, put them in a Markdown table with columns | Question | Answer | and bold the answers. If it is a single question, state the answer on one bold line (plus the option letter if it is MCQ).
- Then a "### How the answer was obtained" section with a clear, numbered, step-by-step derivation. Reference the given data/clues explicitly and never skip or hand-wave a step.
- Use GitHub-style Markdown pipe tables whenever a table makes things clearer:
  • Arrangement / distribution / Einstein-grid / DILR reasoning sets: DRAW the grid as a table and progressively FILL it, re-showing the table after each major deduction. Also add a | Statement | Deduction | table that turns each clue into what it forces.
  • Quant: show the formula, then the substitution, then the result.
- Use **bold** for key terms and results, and Markdown headings (##, ###) to structure longer solutions.
- Do NOT use LaTeX/KaTeX. Write math in plain text with Unicode symbols (×, ÷, √, ≤, ≥, ², ₂, π, ∴). Write fractions as a/b.
- End with a one-line **Final answer:** (include the option letter for MCQs).

When an image is attached, read every detail in it (the full question, all options, any table/figure) and solve it. Show every calculation step, give the correct formula and the fastest exam shortcut, and add a short "Exam tip" when a time-saving trick exists. For strategy or concept questions, be specific and actionable. Never fabricate exact CAT trivia — if unsure of a historical detail, say so.`

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

const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const MAX_TEXT_CHARS = 12000
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|log|rtf|py|js|jsx|ts|tsx|java|c|cpp|cs|rb|go|php|html|css|xml|yaml|yml)$/i
const ACCEPT = 'image/*,.txt,.md,.csv,.tsv,.json,.log,.py,.js,.ts,.jsx,.tsx,.java,.c,.cpp,.cs,.rb,.go,.php,.html,.css,.xml,.yml,.yaml'

const uid = () => Math.random().toString(36).slice(2, 9)
const readAsDataURL = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f) })
const readAsText = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = rej; r.readAsText(f) })

function Message({ msg }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'
  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isUser ? 'bg-cat-orange text-white' : 'bg-cat-blue text-white'}`}>{isUser ? 'You' : 'AI'}</div>
      <div className="max-w-[85%] flex flex-col gap-1">
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser ? 'bg-cat-orange text-white rounded-tr-sm whitespace-pre-wrap' : 'bg-bg-card border border-border text-text-secondary rounded-tl-sm'}`}>
          {msg.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {msg.attachments.map((a, ai) => a.kind === 'image'
                ? <img key={ai} src={a.dataUrl} alt={a.name} className="w-16 h-16 object-cover rounded-lg border border-white/30" />
                : <span key={ai} className="inline-flex items-center gap-1 text-[11px] bg-white/15 rounded px-1.5 py-0.5"><FileText size={11} />{a.name}</span>
              )}
            </div>
          )}
          {isUser ? (msg.content || null) : <Markdown text={msg.content} />}
        </div>
        {!isUser && <button onClick={copy} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary px-1">{copied ? <Check size={11} className="text-cat-green" /> : <Copy size={11} />}{copied ? 'Copied' : 'Copy'}</button>}
      </div>
    </div>
  )
}

function Typing() {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-cat-blue flex items-center justify-center text-xs font-bold text-white flex-shrink-0">AI</div>
      <div className="bg-bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1">
        {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
      </div>
    </div>
  )
}

export default function AITutor({ hasApiKey, onNavigate }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Hi — I'm your CAT prep mentor. Ask me anything, **paste or attach a screenshot** of a question, or upload a text passage.\n\nI answer in a clean, table-based, step-by-step format — and I quietly turn every real question you ask into extra practice inside **Previous Papers → Topic-wise**.\n\nWhat would you like help with?" }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('Strategy')
  const [attachments, setAttachments] = useState([])
  const [learned, setLearned] = useState(() => getCapturedCount())
  const [capturing, setCapturing] = useState(false)
  const endRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const onFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    let imgCount = attachments.filter(a => a.kind === 'image').length
    const additions = []
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        if (imgCount >= MAX_IMAGES) { showToast(`Up to ${MAX_IMAGES} images per message`, 'info'); continue }
        if (f.size > MAX_IMAGE_BYTES) { showToast(`"${f.name}" is too large (max 4 MB)`, 'error'); continue }
        try { const dataUrl = await readAsDataURL(f); additions.push({ id: uid(), kind: 'image', name: f.name || 'image.png', dataUrl, size: f.size }); imgCount++ }
        catch { showToast(`Couldn't read "${f.name}"`, 'error') }
      } else if (TEXT_EXT.test(f.name) || f.type.startsWith('text/')) {
        try { let text = await readAsText(f); if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS) + '\n…(truncated)'; additions.push({ id: uid(), kind: 'text', name: f.name, text, size: f.size }) }
        catch { showToast(`Couldn't read "${f.name}"`, 'error') }
      } else {
        showToast(`"${f.name}": unsupported. Attach an image or a text/code file.`, 'info')
      }
    }
    if (additions.length) setAttachments(p => [...p, ...additions])
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imgs = []
    for (const it of items) { if (it.type && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) imgs.push(f) } }
    if (imgs.length) { e.preventDefault(); onFiles(imgs) }
  }

  const handleDrop = (e) => { e.preventDefault(); if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files) }
  const removeAttachment = (id) => setAttachments(p => p.filter(a => a.id !== id))

  const send = async (text) => {
    const t = (text || input).trim()
    const imgs = attachments.filter(a => a.kind === 'image')
    const files = attachments.filter(a => a.kind === 'text')
    if ((!t && attachments.length === 0) || loading) return
    if (!hasApiKey) { onNavigate('settings'); return }

    const fileBlock = files.map(f => `\n\n[Attached file: ${f.name}]\n\`\`\`\n${f.text}\n\`\`\``).join('')
    const promptText = (t || (imgs.length ? 'Read the attached image and solve it, showing all steps.' : 'Use the attached file.')) + fileBlock
    const apiContent = imgs.length
      ? [{ type: 'text', text: promptText }, ...imgs.map(a => ({ type: 'image_url', image_url: { url: a.dataUrl } }))]
      : promptText
    const shownAttachments = attachments.map(a => ({ kind: a.kind, name: a.name, dataUrl: a.dataUrl }))

    setInput('')
    setAttachments([])
    setMessages(p => [...p, { role: 'user', content: t, attachments: shownAttachments }])
    setLoading(true)

    let reply = ''
    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }))
      history.push({ role: 'user', content: apiContent })
      reply = await chatAI(SYSTEM_PROMPT, history, 2600, { vision: imgs.length > 0 })
      setMessages(p => [...p, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(p => [...p, { role: 'assistant', content: `Error: ${e.message}. Check your API key in Settings.` }])
      setLoading(false)
      return
    }
    setLoading(false)

    // Best-effort background learning: turn real questions into topic-wise practice.
    setCapturing(true)
    classifyAndCapture({ userText: promptText, answerText: reply })
      .then(res => {
        if (res.added > 0) {
          setLearned(getCapturedCount())
          if (res.newTopic) showToast(`New ${res.sectionId} type added: ${res.topic} — practice it in ${res.sectionId === 'DILR' ? 'DILR' : 'Previous Papers'}`, 'success')
          else showToast(`Learned ${res.added} practice question${res.added > 1 ? 's' : ''} → ${res.topic}`, 'success')
        }
      })
      .catch(() => {})
      .finally(() => setCapturing(false))
  }

  const showSuggestions = messages.length === 1
  const imgAttached = attachments.some(a => a.kind === 'image')
  const visionWarn = imgAttached && !visionAvailable()

  return (
    <div className="flex flex-col animate-fade-in" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex-1 bg-bg-secondary border border-border rounded-2xl flex flex-col overflow-hidden" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-card/40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cat-blue/15 flex items-center justify-center"><Sparkles size={13} className="text-cat-blue" /></div>
            <div>
              <p className="text-xs font-semibold text-text-primary leading-none">AI Tutor</p>
              <p className="text-[10px] text-text-muted leading-none mt-0.5">{capturing ? 'Analysing to add practice…' : 'Solves images, files & doubts step-by-step'}</p>
            </div>
          </div>
          <button onClick={() => onNavigate('pyq_topics')} title="Practice the questions the tutor learned"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-bg-card text-[11px] font-medium text-text-secondary hover:border-cat-blue hover:text-cat-blue transition-all">
            <BookOpen size={12} />{learned > 0 ? `${learned} learned → Practice` : 'Learns as you ask'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.map((m, i) => <Message key={i} msg={m} />)}
          {loading && <Typing />}
          <div ref={endRef} />
        </div>

        {showSuggestions && (
          <div className="px-5 pb-3 border-t border-border pt-3">
            <div className="flex gap-1 mb-2">
              {Object.keys(SUGGESTIONS).map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-2 py-0.5 rounded text-xs transition-all ${activeCategory === cat ? 'bg-cat-blue text-white' : 'text-text-muted hover:text-text-secondary'}`}>{cat}</button>
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
          {visionWarn && (
            <div className="mb-3 bg-cat-orange/10 border border-cat-orange/30 rounded-lg px-3 py-2">
              <p className="text-xs text-cat-orange">Reading an image needs a <b>Groq</b> or <b>NVIDIA</b> key (Llama-4 vision). Add one in Settings, or describe the question in text.</p>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map(a => (
                <div key={a.id} className="relative">
                  {a.kind === 'image'
                    ? <img src={a.dataUrl} alt={a.name} className="w-12 h-12 object-cover rounded-lg border border-border" />
                    : <span className="inline-flex items-center gap-1 h-12 px-2 bg-bg-card border border-border rounded-lg text-[11px] text-text-secondary max-w-[140px]"><FileText size={12} className="flex-shrink-0" /><span className="truncate">{a.name}</span></span>}
                  <button onClick={() => removeAttachment(a.id)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-cat-red text-white flex items-center justify-center hover:opacity-90"><X size={10} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={e => { onFiles(e.target.files); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} disabled={!hasApiKey || loading} title="Attach image or file"
              className="p-3 bg-bg-card border border-border text-text-secondary rounded-xl hover:border-cat-blue hover:text-cat-blue disabled:opacity-40 transition-all flex-shrink-0"><Paperclip size={16} /></button>
            <textarea value={input} onChange={e => setInput(e.target.value)} onPaste={handlePaste} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={hasApiKey ? 'Ask a doubt, or paste/attach a question screenshot…' : 'Add API key in Settings first'} disabled={!hasApiKey || loading} rows={2}
              className="flex-1 bg-bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cat-blue transition-colors resize-none disabled:opacity-50" style={{ maxHeight: 120 }} />
            <button onClick={() => send()} disabled={(!input.trim() && attachments.length === 0) || loading || !hasApiKey} className="p-3 bg-cat-blue text-white rounded-xl hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"><Send size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
