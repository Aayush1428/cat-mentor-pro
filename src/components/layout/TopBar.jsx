import React from 'react'
import { Wifi, WifiOff, Clock } from 'lucide-react'

const TITLES = { dashboard:'Dashboard', planner:'Study Planner', analysis:'My Analysis', varc:'VARC Practice', dilr:'DILR Practice', quant:'Quantitative Aptitude', news:'Daily News Intelligence', vocabulary:'Vocabulary Builder', pyq:'Previous Year Papers', pyq_topics:'Topic-wise PYQs', mock:'Mock Tests', revision:'Revision & Error Log', tutor:'AI Tutor', settings:'Settings' }

const fmt = (s) => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m` }

export default function TopBar({ active, hasApiKey, providerLabel, studyTime, sidebarWidth = 210 }) {
  return (
    <header className="fixed top-0 right-0 h-14 bg-bg-secondary border-b border-border flex items-center justify-between px-5 z-20" style={{ left: sidebarWidth }}>
      <h1 className="font-display font-bold text-sm text-text-primary">{TITLES[active] || active}</h1>
      <div className="flex items-center gap-4">
        {studyTime > 0 && <div className="flex items-center gap-1 text-text-muted text-xs"><Clock size={12}/><span className="font-mono">{fmt(studyTime)}</span></div>}
        <div className={`flex items-center gap-1.5 text-xs ${hasApiKey ? 'text-cat-green' : 'text-text-muted'}`}>
          {hasApiKey ? <Wifi size={13}/> : <WifiOff size={13}/>}
          <span className="hidden sm:inline">{hasApiKey ? `AI: ${providerLabel}` : 'No API Key'}</span>
        </div>
      </div>
    </header>
  )
}
