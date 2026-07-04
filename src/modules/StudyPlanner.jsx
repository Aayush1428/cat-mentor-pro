import React, { useState } from 'react'
import { Card, Badge, SectionHeader, ProgressBar } from '../components/ui/index.jsx'
import { SECTIONS, PRIORITY_LABELS, getAllTopics } from '../data/curriculum.js'
import { getTopicStats, getAccuracy } from '../utils/performance.js'
import { Target, ArrowRight, BookOpen, Repeat } from 'lucide-react'

const SECTION_NAV = { VARC: 'varc', DILR: 'dilr', QA: 'quant' }
const PRIORITY_WEIGHT = { 1: 3, 2: 2, 3: 1 }

const actionFor = (acc, attempts) => {
  if (attempts === 0) return { label: 'Learn + practice', variant: 'blue', icon: BookOpen }
  if (acc < 60) return { label: 'Drill weak area', variant: 'red', icon: Target }
  if (acc < 80) return { label: 'Reinforce', variant: 'orange', icon: Repeat }
  return { label: 'Maintain', variant: 'green', icon: Repeat }
}

const buildModel = () => {
  const topics = getAllTopics().map(t => {
    const stats = getTopicStats(t.sectionId, t.name)
    const acc = getAccuracy(stats)
    const masteryFrac = stats.attempts > 0 ? (acc / 100) : 0
    const score = PRIORITY_WEIGHT[t.priority] * (1 - masteryFrac)
    return { ...t, stats, acc, masteryFrac, score }
  })

  // Weighted readiness across all topics (higher-priority topics count more).
  let wSum = 0, wMastery = 0
  topics.forEach(t => { const w = PRIORITY_WEIGHT[t.priority]; wSum += w; wMastery += w * t.masteryFrac })
  const readiness = wSum ? Math.round((wMastery / wSum) * 100) : 0

  const sectionReadiness = Object.values(SECTIONS).map(sec => {
    const ts = topics.filter(t => t.sectionId === sec.id)
    let s = 0, m = 0
    ts.forEach(t => { const w = PRIORITY_WEIGHT[t.priority]; s += w; m += w * t.masteryFrac })
    return { id: sec.id, label: sec.label, icon: sec.icon, color: sec.color, readiness: s ? Math.round((m / s) * 100) : 0 }
  })

  const plan = [...topics].sort((a, b) => b.score - a.score).slice(0, 6)
  return { topics, readiness, sectionReadiness, plan }
}

export default function StudyPlanner({ onNavigate }) {
  const [sort, setSort] = useState('priority')
  const { topics, readiness, sectionReadiness, plan } = buildModel()

  const sortedTopics = [...topics].sort((a, b) => {
    if (sort === 'focus') return b.score - a.score
    if (sort === 'weakest') return (a.acc ?? -1) - (b.acc ?? -1)
    return a.priority - b.priority || b.score - a.score
  })

  return (
    <div className="animate-fade-in max-w-4xl space-y-5">
      <SectionHeader title="Study Planner" subtitle="A priority × weakness roadmap. Do the highest-impact topics first — marks-weighted, personalised to your accuracy." />

      {/* Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <Card className="text-center lg:col-span-1 flex flex-col justify-center">
          <p className="text-xs text-text-muted mb-1">Overall Readiness</p>
          <p className="font-mono text-4xl font-bold text-cat-green">{readiness}%</p>
          <p className="text-[10px] text-text-muted mt-1">priority-weighted mastery</p>
        </Card>
        <Card className="lg:col-span-3">
          <p className="text-sm font-semibold text-text-primary mb-3">Section Readiness</p>
          <div className="space-y-3">
            {sectionReadiness.map(s => (
              <div key={s.id}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-text-primary">{s.icon} {s.label}</span>
                  <span className="text-xs font-mono" style={{ color: s.color }}>{s.readiness}%</span>
                </div>
                <ProgressBar value={s.readiness} color={s.color} showPct={false} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Today's plan */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Target size={15} className="text-cat-orange" />
          <p className="text-sm font-semibold text-text-primary">Your Focus List (do these next)</p>
        </div>
        <div className="space-y-2">
          {plan.map((t, i) => {
            const sec = SECTIONS[t.sectionId]
            const act = actionFor(t.acc ?? 0, t.stats.attempts)
            const Icon = act.icon
            return (
              <button key={t.id} onClick={() => onNavigate(SECTION_NAV[t.sectionId])}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-border-light hover:bg-bg-hover transition-all text-left group">
                <span className="font-mono text-xs text-text-muted w-4 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">{t.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] font-medium" style={{ color: sec.color }}>{sec.icon} {sec.id}</span>
                    <Badge variant={t.priority === 1 ? 'red' : t.priority === 2 ? 'orange' : 'green'}>{PRIORITY_LABELS[t.priority]}</Badge>
                    <Badge variant={act.variant}><Icon size={10} className="inline mr-0.5" />{act.label}</Badge>
                    <span className="text-[10px] text-text-muted">{t.acc !== null ? `${t.acc}% acc` : 'new'}</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-text-muted group-hover:text-cat-blue flex-shrink-0" />
              </button>
            )
          })}
        </div>
        <button onClick={() => onNavigate('revision')} className="text-xs text-cat-blue hover:underline mt-3 flex items-center gap-1">
          <Repeat size={12} /> Revise your error log →
        </button>
      </Card>

      {/* Full prioritized syllabus */}
      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm font-semibold text-text-primary">Full Syllabus (marks-priority order)</p>
          <div className="flex gap-1.5">
            {[['priority', 'Priority'], ['focus', 'Focus score'], ['weakest', 'Weakest first']].map(([id, label]) => (
              <button key={id} onClick={() => setSort(id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${sort === id ? 'bg-cat-blue text-white border-cat-blue' : 'border-border text-text-secondary hover:border-border-light'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          {sortedTopics.map(t => {
            const sec = SECTIONS[t.sectionId]
            return (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.priority === 1 ? '#EF4444' : t.priority === 2 ? '#F59E0B' : '#10B981' }} />
                <span className="text-[10px] font-medium w-9 flex-shrink-0" style={{ color: sec.color }}>{sec.id}</span>
                <span className="text-xs text-text-secondary flex-1 min-w-0 truncate">{t.name}</span>
                <div className="w-24 flex-shrink-0"><ProgressBar value={t.acc ?? 0} color={sec.color} showPct={false} /></div>
                <span className="text-[10px] font-mono w-9 text-right flex-shrink-0" style={{ color: t.acc === null ? '#64748B' : sec.color }}>{t.acc !== null ? `${t.acc}%` : '—'}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
