import React, { useEffect, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { toggleFlag, isFlagged } from '../../utils/bookmarks.js'

export const Card = ({ children, className = '', hover = false, onClick }) => (
  <div onClick={onClick} className={`bg-bg-card border border-border rounded-xl p-4 transition-all ${hover ? 'cursor-pointer hover:border-border-light hover:bg-bg-hover' : ''} ${className}`}>
    {children}
  </div>
)

export const Badge = ({ children, variant = 'gray', className = '' }) => {
  const v = {
    gray:   'bg-bg-hover text-text-secondary border-border',
    blue:   'bg-cat-blue/10 text-cat-blue border-cat-blue/30',
    green:  'bg-cat-green/10 text-cat-green border-cat-green/30',
    red:    'bg-cat-red/10 text-cat-red border-cat-red/30',
    orange: 'bg-cat-orange/10 text-cat-orange border-cat-orange/30',
    purple: 'bg-cat-purple/10 text-cat-purple border-cat-purple/30',
    pink:   'bg-cat-pink/10 text-cat-pink border-cat-pink/30',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${v[variant] || v.gray} ${className}`}>{children}</span>
}

export const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-5">
    <h2 className="font-display font-bold text-xl text-text-primary">{title}</h2>
    {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
  </div>
)

export const Skeleton = ({ className = '' }) => <div className={`skeleton ${className}`} style={{ minHeight: 16 }} />
export const CardSkeleton = () => (
  <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
    <Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-2/3" />
  </div>
)

export const ProgressBar = ({ value, color = '#3B82F6', label, showPct = true }) => (
  <div className="w-full">
    {label && <div className="flex justify-between mb-1"><span className="text-xs text-text-secondary">{label}</span>{showPct && <span className="text-xs font-mono" style={{ color }}>{value}%</span>}</div>}
    <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
    </div>
  </div>
)

// Toast
let toastFn = null
export const showToast = (msg, type = 'success') => toastFn?.(msg, type)

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([])
  useEffect(() => { toastFn = (msg, type) => { const id = Date.now(); setToasts(p => [...p, { id, msg, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000) } }, [])
  const colors = { success: 'bg-cat-green/10 border-cat-green/30 text-cat-green', error: 'bg-cat-red/10 border-cat-red/30 text-cat-red', info: 'bg-cat-blue/10 border-cat-blue/30 text-cat-blue' }
  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2">
      {toasts.map(t => <div key={t.id} className={`px-4 py-2.5 rounded-xl border text-sm font-medium shadow-lg animate-fade-in ${colors[t.type] || colors.info}`}>{t.msg}</div>)}
    </div>
  )
}

export const ScoreRing = ({ score, total, size = 80, color = '#3B82F6' }) => {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="score-ring">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1A2235" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        <p className="font-mono font-bold text-sm text-text-primary leading-none">{score}/{total}</p>
        <p className="text-[10px] text-text-muted font-mono">{pct}%</p>
      </div>
    </div>
  )
}

export const TimerDisplay = ({ seconds }) => {
  const m = Math.floor(seconds / 60), s = seconds % 60
  return <span className="font-mono text-text-primary">{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>
}

// Flag any question for later revision. `item` = { section, topic, source, stem, options, answer, explanation }.
export const BookmarkButton = ({ item, size = 14, className = '' }) => {
  const [on, setOn] = useState(() => isFlagged(item?.stem))
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setOn(toggleFlag(item)) }}
      title={on ? 'Bookmarked — click to remove' : 'Bookmark for revision'}
      className={`flex-shrink-0 transition-colors ${on ? 'text-cat-orange' : 'text-text-muted hover:text-cat-orange'} ${className}`}>
      <Bookmark size={size} className={on ? 'fill-cat-orange' : ''} />
    </button>
  )
}
