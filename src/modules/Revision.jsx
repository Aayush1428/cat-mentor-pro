import React, { useState } from 'react'
import { Card, Badge, SectionHeader } from '../components/ui/index.jsx'
import { getReviewItems, getReviewStats, markMastered, removeItem } from '../utils/bookmarks.js'
import { SECTIONS } from '../data/curriculum.js'
import { RotateCcw, CheckCircle, Trash2, Bookmark, Eye } from 'lucide-react'

const FILTERS = [
  { id: 'due', label: 'To Revise' },
  { id: 'wrong', label: 'Wrong Log' },
  { id: 'flagged', label: 'Bookmarked' },
  { id: 'all', label: 'All' },
]

const OPT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function RevisionCard({ item, onChange }) {
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const answerLetter = String(item.answer || '').trim().charAt(0).toUpperCase()

  return (
    <Card>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge variant={item.section === 'VARC' ? 'blue' : item.section === 'DILR' ? 'purple' : item.section === 'QA' ? 'green' : 'orange'}>{item.section}</Badge>
        <span className="text-xs text-text-muted truncate">{item.topic}</span>
        {item.flagged && <Bookmark size={12} className="text-cat-orange fill-cat-orange" />}
        {item.wrong && <Badge variant="red">Got wrong</Badge>}
        {item.mastered && <Badge variant="green">Mastered</Badge>}
      </div>

      <p className="text-sm font-medium text-text-primary mb-3 leading-relaxed whitespace-pre-line">{item.stem}</p>

      {Array.isArray(item.options) && item.options.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {item.options.map((opt, oi) => {
            const letter = OPT_LETTERS[oi]
            const isSel = selected === letter
            const ok = revealed && letter === answerLetter
            const bad = revealed && isSel && !ok
            return (
              <button key={oi} onClick={() => !revealed && setSelected(letter)} disabled={revealed}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${ok ? 'border-cat-green bg-cat-green/10 text-cat-green' : bad ? 'border-cat-red bg-cat-red/10 text-cat-red' : isSel ? 'border-cat-blue bg-cat-blue/10 text-cat-blue' : 'border-border text-text-secondary hover:border-border-light disabled:opacity-60'}`}>
                {opt} {ok && '✓'} {bad && '✗'}
              </button>
            )
          })}
        </div>
      )}

      {!revealed && (
        <button onClick={() => setRevealed(true)} className="text-xs text-cat-blue hover:underline flex items-center gap-1">
          <Eye size={12} /> Reveal answer & explanation
        </button>
      )}

      {revealed && (
        <div className="bg-bg-secondary rounded-lg p-3 text-xs text-text-secondary leading-relaxed">
          {item.answer && <p className="font-semibold text-cat-green mb-1">Answer: {item.answer}</p>}
          {item.explanation && <p className="whitespace-pre-line">{item.explanation}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => { markMastered(item.id); onChange() }} className="px-3 py-1.5 rounded-lg bg-cat-green/10 border border-cat-green/30 text-cat-green text-xs font-semibold hover:bg-cat-green/20 transition-all flex items-center gap-1.5">
              <CheckCircle size={12} /> Mark mastered
            </button>
            <button onClick={() => { setSelected(null); setRevealed(false) }} className="px-3 py-1.5 rounded-lg border border-border text-text-secondary text-xs hover:border-border-light transition-all flex items-center gap-1.5">
              <RotateCcw size={12} /> Try again
            </button>
            <button onClick={() => { removeItem(item.id); onChange() }} className="px-3 py-1.5 rounded-lg border border-cat-red/30 text-cat-red text-xs hover:bg-cat-red/10 transition-all flex items-center gap-1.5">
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function Revision() {
  const [filter, setFilter] = useState('due')
  const [section, setSection] = useState('All')
  const [tick, setTick] = useState(0)
  const refresh = () => setTick(t => t + 1)

  const stats = getReviewStats()
  const items = getReviewItems({ filter, section })

  return (
    <div className="animate-fade-in max-w-3xl space-y-5">
      <SectionHeader title="Revision & Error Log" subtitle="Every question you got wrong is saved here automatically. Re-solve them until they stick — this is where percentiles are won." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center"><p className="text-xs text-text-muted mb-1">To Revise</p><p className="font-mono text-2xl font-bold text-cat-orange">{stats.due}</p></Card>
        <Card className="text-center"><p className="text-xs text-text-muted mb-1">Wrong Log</p><p className="font-mono text-2xl font-bold text-cat-red">{stats.wrong}</p></Card>
        <Card className="text-center"><p className="text-xs text-text-muted mb-1">Bookmarked</p><p className="font-mono text-2xl font-bold text-cat-blue">{stats.flagged}</p></Card>
        <Card className="text-center"><p className="text-xs text-text-muted mb-1">Mastered</p><p className="font-mono text-2xl font-bold text-cat-green">{stats.mastered}</p></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filter === f.id ? 'bg-cat-blue text-white border-cat-blue' : 'border-border text-text-secondary hover:border-border-light'}`}>
            {f.label}
          </button>
        ))}
        <div className="w-px bg-border mx-1" />
        {['All', ...Object.keys(SECTIONS)].map(s => (
          <button key={s} onClick={() => setSection(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${section === s ? 'bg-bg-hover text-text-primary border-border-light' : 'border-border text-text-muted hover:border-border-light'}`}>
            {s}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <Card className="text-center py-10">
          <p className="text-sm text-text-secondary">Nothing here yet.</p>
          <p className="text-xs text-text-muted mt-1">Practice questions across VARC, DILR and Quant — anything you get wrong or bookmark will land here for focused revision.</p>
        </Card>
      ) : (
        <div className="space-y-3" key={tick}>
          {items.map(item => <RevisionCard key={item.id} item={item} onChange={refresh} />)}
        </div>
      )}
    </div>
  )
}
