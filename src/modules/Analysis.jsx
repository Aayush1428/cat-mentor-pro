import React, { useState } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, CartesianGrid } from 'recharts'
import { Card, SectionHeader, Badge, ProgressBar } from '../components/ui/index.jsx'
import { SECTIONS } from '../data/curriculum.js'
import { getTopicStats, getAccuracy, getStrengthLabel, getStrengthColor, getDailyHistory, getMockHistory } from '../utils/performance.js'

function SectionBreakdown({ sectionId }) {
  const sec = SECTIONS[sectionId]
  const topicData = sec.topics.map(t => {
    const stats = getTopicStats(sectionId, t.name)
    const acc = getAccuracy(stats)
    return { ...t, stats, acc, label: getStrengthLabel(acc), color: getStrengthColor(acc) }
  })

  const attempted = topicData.filter(t => t.stats.attempts > 0)
  const notAttempted = topicData.filter(t => t.stats.attempts === 0)
  const weak = attempted.filter(t => t.acc < 60).sort((a,b) => a.acc - b.acc)
  const strong = attempted.filter(t => t.acc >= 80).sort((a,b) => b.acc - a.acc)

  const barData = attempted.map(t => ({ name: t.name.replace(/^(DI|LR|RC|QA) — /, '').substring(0,18), accuracy: t.acc, fill: t.color }))

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center"><p className="text-xs text-text-muted mb-1">Topics Attempted</p><p className="font-mono text-2xl font-bold" style={{ color: sec.color }}>{attempted.length}/{sec.topics.length}</p></Card>
        <Card className="text-center"><p className="text-xs text-text-muted mb-1">Weak (below 60%)</p><p className="font-mono text-2xl font-bold text-cat-red">{weak.length}</p></Card>
        <Card className="text-center"><p className="text-xs text-text-muted mb-1">Strong (above 80%)</p><p className="font-mono text-2xl font-bold text-cat-green">{strong.length}</p></Card>
      </div>

      {barData.length > 0 && (
        <Card>
          <p className="text-sm font-semibold text-text-primary mb-3">Accuracy by Topic</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748B' }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} domain={[0,100]} />
              <Tooltip contentStyle={{ background: '#1A2235', border: '1px solid #2D3748', borderRadius: 8, fontSize: 11 }} formatter={(v) => [`${v}%`, 'Accuracy']} />
              <Bar dataKey="accuracy" radius={4}>{barData.map((d,i) => <Cell key={i} fill={d.fill} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {weak.length > 0 && (
          <Card className="border-cat-red/20">
            <p className="text-sm font-semibold text-cat-red mb-3">🔴 Focus Here (Weak Topics)</p>
            <div className="space-y-3">
              {weak.map((t, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-text-secondary">{t.name}</span>
                    <span className="text-xs font-mono text-cat-red">{t.acc}%</span>
                  </div>
                  <ProgressBar value={t.acc} color={t.color} showPct={false} />
                  <p className="text-[10px] text-text-muted mt-0.5">{t.stats.attempts} attempts · {t.stats.correct} correct</p>
                </div>
              ))}
            </div>
          </Card>
        )}
        {strong.length > 0 && (
          <Card className="border-cat-green/20">
            <p className="text-sm font-semibold text-cat-green mb-3">✅ Your Strengths</p>
            <div className="space-y-3">
              {strong.map((t, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-text-secondary">{t.name}</span>
                    <span className="text-xs font-mono text-cat-green">{t.acc}%</span>
                  </div>
                  <ProgressBar value={t.acc} color={t.color} showPct={false} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Card>
        <p className="text-sm font-semibold text-text-primary mb-3">All Topics Overview</p>
        <div className="space-y-2">
          {topicData.map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-0.5">
                  <span className="text-xs text-text-secondary truncate">{t.name}</span>
                  <span className="text-xs font-mono ml-2" style={{ color: t.color }}>
                    {t.acc !== null ? `${t.acc}%` : '—'}
                  </span>
                </div>
                {t.acc !== null && <ProgressBar value={t.acc} color={t.color} showPct={false} />}
                {t.acc === null && <div className="h-1.5 bg-bg-secondary rounded-full" />}
              </div>
              <Badge variant={t.acc === null ? 'gray' : t.acc >= 80 ? 'green' : t.acc >= 60 ? 'orange' : 'red'}>
                {t.label}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {notAttempted.length > 0 && (
        <Card className="border-border/50">
          <p className="text-xs text-text-muted font-semibold mb-2">Not Yet Attempted ({notAttempted.length} topics)</p>
          <div className="flex flex-wrap gap-1.5">
            {notAttempted.map((t, i) => <Badge key={i} variant="gray">{t.name}</Badge>)}
          </div>
        </Card>
      )}
    </div>
  )
}

function ProgressTrends() {
  const daily = getDailyHistory().slice(-21).map(d => ({ ...d, label: d.date.slice(5) }))
  const mocks = getMockHistory().map((m, i) => ({ ...m, label: `#${i + 1}`, dateStr: new Date(m.date).toLocaleDateString() }))
  if (daily.length < 2 && mocks.length < 1) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {daily.length >= 2 && (
        <Card>
          <p className="text-sm font-semibold text-text-primary mb-1">Daily Accuracy Trend</p>
          <p className="text-[10px] text-text-muted mb-3">Last {daily.length} active days · % correct per day</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={daily} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748B' }} />
              <YAxis domain={[0,100]} tick={{ fontSize: 10, fill: '#64748B' }} />
              <Tooltip contentStyle={{ background: '#1A2235', border: '1px solid #2D3748', borderRadius: 8, fontSize: 11 }} formatter={(v)=>[`${v}%`,'Accuracy']} />
              <Line type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
      {mocks.length >= 1 && (
        <Card>
          <p className="text-sm font-semibold text-text-primary mb-1">Mock Score Trend</p>
          <p className="text-[10px] text-text-muted mb-3">Net score across your {mocks.length} mock{mocks.length>1?'s':''}</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={mocks} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
              <Tooltip contentStyle={{ background: '#1A2235', border: '1px solid #2D3748', borderRadius: 8, fontSize: 11 }} formatter={(v)=>[v,'Net score']} labelFormatter={(l,p)=> p&&p[0]? p[0].payload.dateStr : l} />
              <Line type="monotone" dataKey="netScore" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

export default function Analysis() {
  const [activeSection, setActiveSection] = useState('VARC')

  const radarData = Object.values(SECTIONS).map(sec => {
    const stats = sec.topics.map(t => getTopicStats(sec.id, t.name))
    const totalAttempts = stats.reduce((s, x) => s + x.attempts, 0)
    const totalCorrect = stats.reduce((s, x) => s + x.correct, 0)
    const acc = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0
    return { section: sec.label, accuracy: acc }
  })

  return (
    <div className="animate-fade-in max-w-4xl space-y-5">
      <SectionHeader title="My Analysis" subtitle="Performance breakdown by section and topic — focus on red areas to improve fastest" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <p className="text-sm font-semibold text-text-primary mb-3">Overall Accuracy by Section</p>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#2D3748" />
                <PolarAngleAxis dataKey="section" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <Radar name="Accuracy" dataKey="accuracy" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </div>
        <Card>
          <p className="text-sm font-semibold text-text-primary mb-3">Section Summary</p>
          <div className="space-y-4">
            {Object.values(SECTIONS).map(sec => {
              const stats = sec.topics.map(t => getTopicStats(sec.id, t.name))
              const total = stats.reduce((s, x) => s + x.attempts, 0)
              const correct = stats.reduce((s, x) => s + x.correct, 0)
              const acc = total > 0 ? Math.round((correct / total) * 100) : null
              return (
                <div key={sec.id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-text-primary">{sec.icon} {sec.id}</span>
                    <span className="text-xs font-mono" style={{ color: sec.color }}>{acc !== null ? `${acc}%` : 'N/A'}</span>
                  </div>
                  <ProgressBar value={acc || 0} color={sec.color} showPct={false} />
                  <p className="text-[10px] text-text-muted mt-0.5">{total} questions attempted</p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <ProgressTrends />

      <div className="flex gap-2 flex-wrap">
        {Object.values(SECTIONS).map(sec => (
          <button key={sec.id} onClick={() => setActiveSection(sec.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${activeSection === sec.id ? 'text-white border-transparent' : 'border-border text-text-secondary hover:border-border-light'}`}
            style={activeSection === sec.id ? { background: sec.color } : {}}>
            {sec.icon} {sec.label}
          </button>
        ))}
      </div>

      <SectionBreakdown sectionId={activeSection} />
    </div>
  )
}
