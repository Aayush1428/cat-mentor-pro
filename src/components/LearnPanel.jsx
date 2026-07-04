import React, { useState } from 'react'
import { Card, Badge, CardSkeleton, showToast } from './ui/index.jsx'
import { getCachedContent } from '../utils/ai.js'
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react'

const SYSTEM = `You are a CAT exam mentor. Explain concepts crisply for a serious aspirant. Return ONLY valid JSON, no preamble.`

const buildPrompt = (topic, section) => `Create a concise "learn the concept" note for the CAT topic "${topic}" (${section} section).
Return ONLY this JSON:
{
  "overview": "2-3 sentence plain-English explanation of what this topic is and why it matters in CAT",
  "key_points": ["core idea 1","core idea 2","core idea 3","core idea 4"],
  "formulas": ["formula or rule 1","formula or rule 2","formula or rule 3"],
  "common_traps": ["a common mistake CAT aspirants make","another trap"],
  "solved_example": {"problem":"one representative CAT-level worked example","solution":"clear step-by-step solution"},
  "strategy": "one-paragraph exam strategy: how to attempt, time to spend, when to skip"
}`

// A collapsible, cached concept primer that can be dropped above any practice screen.
export default function LearnPanel({ topic, section, hasApiKey, onNavigate }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && !data) {
      if (!hasApiKey) { onNavigate?.('settings'); return }
      setLoading(true)
      try {
        const d = await getCachedContent(`learn_${section}_${topic}`, SYSTEM, buildPrompt(topic, section), 2000)
        setData(d)
      } catch (e) { showToast('Error loading concept: ' + e.message, 'error') }
      finally { setLoading(false) }
    }
  }

  return (
    <Card className="border-cat-blue/20 bg-cat-blue/5">
      <button onClick={toggle} className="w-full flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <BookOpen size={14} className="text-cat-blue" /> Learn the concept
        </span>
        {open ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading && <CardSkeleton />}
          {data && (
            <>
              <p className="text-xs text-text-secondary leading-relaxed">{data.overview}</p>

              {data.key_points?.length > 0 && (
                <div>
                  <p className="text-[10px] text-cat-blue uppercase tracking-wider mb-1 font-semibold">Key Ideas</p>
                  <ul className="space-y-1">{data.key_points.map((k, i) => <li key={i} className="text-xs text-text-secondary flex gap-2"><span className="text-cat-blue">•</span>{k}</li>)}</ul>
                </div>
              )}

              {data.formulas?.length > 0 && (
                <div>
                  <p className="text-[10px] text-cat-green uppercase tracking-wider mb-1 font-semibold">Formulas / Rules</p>
                  <div className="space-y-1">{data.formulas.map((f, i) => <p key={i} className="text-xs text-text-secondary font-mono bg-bg-secondary rounded px-2 py-1">{f}</p>)}</div>
                </div>
              )}

              {data.common_traps?.length > 0 && (
                <div>
                  <p className="text-[10px] text-cat-red uppercase tracking-wider mb-1 font-semibold">Common Traps</p>
                  <ul className="space-y-1">{data.common_traps.map((t, i) => <li key={i} className="text-xs text-text-secondary flex gap-2"><span className="text-cat-red">⚠</span>{t}</li>)}</ul>
                </div>
              )}

              {data.solved_example && (
                <div className="bg-bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-cat-orange uppercase tracking-wider mb-1 font-semibold">Solved Example</p>
                  <p className="text-xs text-text-primary mb-1 whitespace-pre-line">{data.solved_example.problem}</p>
                  <p className="text-xs text-text-secondary whitespace-pre-line leading-relaxed"><span className="text-cat-green font-semibold">Solution: </span>{data.solved_example.solution}</p>
                </div>
              )}

              {data.strategy && (
                <div>
                  <p className="text-[10px] text-cat-purple uppercase tracking-wider mb-1 font-semibold">Exam Strategy</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{data.strategy}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  )
}
