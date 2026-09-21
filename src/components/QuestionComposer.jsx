import React, { useRef, useState } from 'react'
import { Card, Badge, showToast } from './ui/index.jsx'
import { classifyAndGenerateFromInput } from '../utils/captured.js'
import { downscaleImage } from '../utils/image.js'
import { recordAttempt } from '../utils/performance.js'
import { logResult } from '../utils/bookmarks.js'
import { visionAvailable } from '../utils/ai.js'
import { Camera, X, Sparkles, CheckCircle, XCircle } from 'lucide-react'

const SECTION_BADGE = { QA: 'green', VARC: 'blue', DILR: 'purple' }

function GeneratedQuestion({ q, idx, meta, selected, onSelect, submitted }) {
  const isCorrect = submitted && selected === q.correct
  const isWrong = submitted && selected && selected !== q.correct
  return (
    <Card className="mb-3">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xs font-mono text-cat-green font-bold flex-shrink-0">Q{idx + 1}</span>
        <p className="flex-1 text-sm font-medium text-text-primary leading-relaxed whitespace-pre-line">{q.question}</p>
        {submitted && (isCorrect ? <CheckCircle size={16} className="text-cat-green flex-shrink-0" /> : <XCircle size={16} className="text-cat-red flex-shrink-0" />)}
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {q.options.map((opt, oi) => {
          const letter = ['A', 'B', 'C', 'D'][oi]
          const isSel = selected === letter
          const ok = submitted && letter === q.correct
          const bad = submitted && isSel && !ok
          return (
            <button key={oi} onClick={() => !submitted && onSelect(letter)} disabled={submitted}
              className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${ok ? 'border-cat-green bg-cat-green/10 text-cat-green' : bad ? 'border-cat-red bg-cat-red/10 text-cat-red' : isSel ? 'border-cat-green bg-cat-green/10 text-cat-green' : 'border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>
              {opt}
            </button>
          )
        })}
      </div>
      {submitted && (
        <div className="bg-bg-secondary rounded-lg p-3 text-xs text-text-secondary leading-relaxed">
          <p className="font-semibold text-cat-green mb-1">Answer: {q.correct}</p>
          <p className="whitespace-pre-line">{q.solution}</p>
          {isWrong && <p className="mt-1 text-cat-orange">Saved to your review queue — practice it again from Revision.</p>}
        </div>
      )}
    </Card>
  )
}

// Paste a question as text, or attach/paste a photo of one, and get 3 fresh practice
// questions of the same topic/pattern. Section + topic are auto-detected.
export default function QuestionComposer({ hasApiKey, onNavigate }) {
  const [text, setText] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState(null)
  const [imageName, setImageName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { items, sectionId, topicId, topic }
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef(null)

  const canImage = visionAvailable()

  const onFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (!canImage) { showToast('Add a Groq or NVIDIA key with image support in Settings to attach photos', 'error'); return }
    try {
      const dataUrl = await downscaleImage(file)
      setImageDataUrl(dataUrl)
      setImageName(file.name || 'photo')
    } catch { showToast('Could not read that image', 'error') }
  }

  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
    if (item) onFile(item.getAsFile())
  }

  const generate = async () => {
    if (!hasApiKey) { onNavigate?.('settings'); return }
    setLoading(true); setResult(null); setAnswers({}); setSubmitted(false)
    try {
      const res = await classifyAndGenerateFromInput({ text, imageDataUrl, count: 3 })
      setResult(res)
      showToast(`Generated 3 questions — ${res.topic}`, 'success')
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const submit = () => {
    setSubmitted(true)
    result.items.forEach((q, i) => {
      const correct = answers[i] === q.correct
      recordAttempt(result.sectionId, result.topic, correct)
      logResult({ section: result.sectionId, topic: result.topic, source: 'composer', stem: q.question, options: q.options, answer: q.correct, explanation: q.solution, isCorrect: correct })
    })
  }

  const reset = () => { setText(''); setImageDataUrl(null); setImageName(''); setResult(null); setAnswers({}); setSubmitted(false) }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-cat-orange" />
        <p className="text-sm font-semibold text-text-primary">Practice From Your Own Question</p>
      </div>
      <p className="text-xs text-text-secondary">Paste a question you struggled with (text and/or a photo) — the section and topic are detected automatically, and you get 3 fresh similar questions to practice. Wrong answers are saved to your review queue.</p>

      {!result && (
        <>
          <textarea value={text} onChange={e => setText(e.target.value)} onPaste={onPaste}
            placeholder="Paste or type the question here (you can also paste a screenshot)..."
            rows={4}
            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-cat-green" />

          {imageDataUrl ? (
            <div className="relative inline-block">
              <img src={imageDataUrl} alt={imageName} className="max-h-32 rounded-lg border border-border" />
              <button onClick={() => { setImageDataUrl(null); setImageName('') }} className="absolute -top-2 -right-2 bg-cat-red text-white rounded-full p-0.5"><X size={12} /></button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} disabled={!canImage}
              className="flex items-center gap-1.5 text-xs text-text-secondary border border-dashed border-border rounded-lg px-3 py-2 hover:border-cat-green disabled:opacity-40 disabled:cursor-not-allowed">
              <Camera size={13} /> {canImage ? 'Attach or paste a photo' : 'Photo needs a Groq/NVIDIA key with image support'}
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0])} />

          <button onClick={generate} disabled={loading || (!text.trim() && !imageDataUrl)}
            className="w-full py-2.5 bg-cat-orange text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 text-sm">
            <Sparkles size={14} />{loading ? 'Generating...' : 'Generate 3 Similar Questions'}
          </button>
        </>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={SECTION_BADGE[result.sectionId] || 'gray'}>{result.sectionId}</Badge>
            <span className="text-xs text-text-secondary">{result.topic}</span>
            <button onClick={reset} className="ml-auto text-xs text-cat-green hover:underline">Start over</button>
          </div>
          {result.items.map((q, i) => (
            <GeneratedQuestion key={i} q={q} idx={i} meta={result} selected={answers[i]} submitted={submitted}
              onSelect={v => setAnswers(a => ({ ...a, [i]: v }))} />
          ))}
          {!submitted && (
            <button onClick={submit} disabled={Object.keys(answers).length === 0}
              className="w-full py-2.5 bg-cat-green text-white rounded-xl font-semibold disabled:opacity-40 transition-all text-sm">
              Submit ({Object.keys(answers).length}/{result.items.length})
            </button>
          )}
          {submitted && (
            <button onClick={reset} className="w-full py-2.5 border border-border rounded-xl font-semibold text-text-secondary hover:border-border-light transition-all text-sm">
              Practice Another Question
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
