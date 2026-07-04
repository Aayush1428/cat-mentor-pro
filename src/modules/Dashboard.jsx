import React, { useState, useEffect } from 'react'
import { Card, SectionHeader, Badge, CardSkeleton, ProgressBar } from '../components/ui/index.jsx'
import { SECTIONS } from '../data/curriculum.js'
import { getSectionStats, getAccuracy, getStrengthLabel, getStrengthColor, getTodayStudyTime } from '../utils/performance.js'
import { getCachedContent } from '../utils/ai.js'
import { Target, BookOpen, Brain, Calculator, TrendingUp, Calendar, Zap } from 'lucide-react'

const fmt = (s) => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m` }
const get = () => { try { return JSON.parse(localStorage.getItem('cat_settings')||'{}') } catch { return {} } }

function QuestionOfDay({ hasApiKey, onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAns, setShowAns] = useState(false)

  useEffect(() => { if (hasApiKey) load() }, [hasApiKey])

  const load = async () => {
    setLoading(true)
    try {
      const d = await getCachedContent(`qod_${new Date().toDateString()}`,
        'You are a CAT exam expert. Return only valid JSON, no preamble.',
        `Generate one CAT-level practice question (randomly pick from VARC, DILR, or QA section).
Return ONLY this JSON:
{"section":"VARC|DILR|QA","topic":"specific topic","question":"full question text","options":["A) ..","B) ..","C) ..","D) .."],"correct":"A|B|C|D","explanation":"step-by-step solution","difficulty":"Easy|Medium|Hard","year_hint":"if this appeared in a real CAT year, mention it, else empty string"}`)
      setData(d)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  if (!hasApiKey) return (
    <Card className="border-cat-blue/30 bg-cat-blue/5">
      <p className="text-sm font-semibold text-text-primary mb-1">🔑 Add an API Key to start</p>
      <p className="text-xs text-text-secondary mb-2">Add a Groq or DeepSeek API key in Settings to unlock all AI-powered features.</p>
      <button onClick={() => onNavigate('settings')} className="text-xs text-cat-blue hover:underline">Open Settings →</button>
    </Card>
  )

  if (loading) return <CardSkeleton />
  if (!data) return null

  const sColor = data.section === 'VARC' ? 'blue' : data.section === 'DILR' ? 'purple' : 'green'
  return (
    <Card className="border-cat-orange/30 bg-cat-orange/5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-cat-orange font-mono font-semibold uppercase tracking-wider">Question of the Day</span>
        <Badge variant={sColor}>{data.section}</Badge>
        <Badge variant="gray">{data.difficulty}</Badge>
      </div>
      <p className="text-sm font-medium text-text-primary mb-3 leading-relaxed">{data.question}</p>
      <div className="space-y-1.5 mb-3">
        {data.options?.map((o, i) => (
          <div key={i} className="text-xs text-text-secondary px-3 py-1.5 bg-bg-secondary rounded-lg">{o}</div>
        ))}
      </div>
      <button onClick={() => setShowAns(!showAns)} className="text-xs text-cat-blue hover:underline">
        {showAns ? 'Hide Answer ▲' : 'Show Answer & Solution ▼'}
      </button>
      {showAns && (
        <div className="mt-2 bg-cat-green/5 border border-cat-green/20 rounded-lg p-3">
          <p className="text-xs font-semibold text-cat-green mb-1">Answer: {data.correct}</p>
          <p className="text-xs text-text-secondary leading-relaxed">{data.explanation}</p>
          {data.year_hint && <p className="text-xs text-text-muted mt-1 italic">{data.year_hint}</p>}
        </div>
      )}
    </Card>
  )
}

function SectionCard({ section, stats, onClick }) {
  const total = stats.reduce((s, x) => s + x.attempts, 0)
  const correct = stats.reduce((s, x) => s + x.correct, 0)
  const acc = total > 0 ? Math.round((correct / total) * 100) : null
  const color = section.color

  return (
    <Card hover onClick={onClick} className="group">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{section.icon}</span>
        <p className="font-semibold text-sm text-text-primary">{section.label}</p>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div className="text-center">
          <p className="font-mono text-xl font-bold" style={{ color }}>{total}</p>
          <p className="text-[10px] text-text-muted">Attempted</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-xl font-bold text-cat-green">{correct}</p>
          <p className="text-[10px] text-text-muted">Correct</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-xl font-bold text-text-primary">{acc !== null ? `${acc}%` : '—'}</p>
          <p className="text-[10px] text-text-muted">Accuracy</p>
        </div>
      </div>
      {acc !== null && <ProgressBar value={acc} color={color} showPct={false} />}
      {acc === null && <p className="text-xs text-text-muted">Start practicing to see stats</p>}
    </Card>
  )
}

function WeakTopics({ onNavigate }) {
  const allStats = []
  Object.values(SECTIONS).forEach(sec => {
    getSectionStats(sec.id).forEach(s => {
      const acc = getAccuracy(s)
      if (s.attempts > 0) allStats.push({ ...s, acc })
    })
  })
  const weak = allStats.filter(s => s.acc !== null && s.acc < 60).sort((a, b) => a.acc - b.acc).slice(0, 5)
  if (weak.length === 0) return null

  return (
    <Card>
      <p className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-cat-red"/> Focus Areas (Weak Topics)</p>
      <div className="space-y-2">
        {weak.map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getStrengthColor(w.acc) }} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-0.5">
                <span className="text-xs text-text-secondary truncate">{w.topic}</span>
                <span className="text-xs font-mono text-cat-red ml-2">{w.acc}%</span>
              </div>
              <ProgressBar value={w.acc} color={getStrengthColor(w.acc)} showPct={false} />
            </div>
            <Badge variant="red">{getStrengthLabel(w.acc)}</Badge>
          </div>
        ))}
      </div>
      <button onClick={() => onNavigate('analysis')} className="text-xs text-cat-blue hover:underline mt-3 block">Full Analysis →</button>
    </Card>
  )
}

export default function Dashboard({ onNavigate, hasApiKey }) {
  const settings = get()
  const streak = parseInt(localStorage.getItem('cat_streak') || '0')
  const todayTime = getTodayStudyTime()

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader title="CAT Mentor Pro" subtitle="Your personal CAT preparation dashboard — structured, AI-powered, data-driven" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><p className="text-xs text-text-muted mb-1">Study Streak</p><p className="font-mono text-2xl font-bold text-cat-orange">{streak}</p><p className="text-xs text-text-muted">days</p></Card>
        <Card><p className="text-xs text-text-muted mb-1">Today's Study</p><p className="font-mono text-2xl font-bold text-cat-blue">{fmt(todayTime)}</p></Card>
        <Card><p className="text-xs text-text-muted mb-1">Target Percentile</p><p className="font-mono text-2xl font-bold text-cat-green">{settings.targetPct || '—'}%</p></Card>
        <Card><p className="text-xs text-text-muted mb-1">Level</p><p className="font-mono text-lg font-bold text-cat-purple">{settings.level || 'Set in Settings'}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <QuestionOfDay hasApiKey={hasApiKey} onNavigate={onNavigate} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.values(SECTIONS).map(sec => (
              <SectionCard key={sec.id} section={sec} stats={getSectionStats(sec.id)} onClick={() => onNavigate(sec.id.toLowerCase())} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <WeakTopics onNavigate={onNavigate} />
          <Card>
            <p className="text-sm font-semibold text-text-primary mb-3">Quick Actions</p>
            <div className="space-y-2">
              {[
                { label: 'Practice VARC', id: 'varc', icon: BookOpen, color: 'text-cat-blue' },
                { label: 'Practice DILR', id: 'dilr', icon: Brain, color: 'text-cat-purple' },
                { label: 'Practice Quant', id: 'quant', icon: Calculator, color: 'text-cat-green' },
                { label: 'Daily Vocabulary', id: 'vocabulary', icon: Zap, color: 'text-cat-orange' },
                { label: 'Previous Papers', id: 'pyq', icon: Calendar, color: 'text-cat-pink' },
                { label: 'Take Mock Test', id: 'mock', icon: Target, color: 'text-cat-red' },
              ].map(({ label, id, icon: Icon, color }) => (
                <button key={id} onClick={() => onNavigate(id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bg-hover transition-all text-left">
                  <Icon size={13} className={color} />
                  <span className="text-xs font-medium text-text-secondary">{label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
