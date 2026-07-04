import React, { useState } from 'react'
import { LayoutDashboard, BookOpen, Brain, Calculator, FileText, BarChart3, Lightbulb, MessageSquare, Settings, ChevronLeft, ChevronRight, BookMarked, Trophy, CalendarCheck, Repeat } from 'lucide-react'

const NAV = [
  { id: 'dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'planner',     icon: CalendarCheck,    label: 'Study Planner' },
  { id: 'analysis',    icon: BarChart3,        label: 'My Analysis' },
  { id: 'varc',        icon: BookOpen,         label: 'VARC' },
  { id: 'dilr',        icon: Brain,            label: 'DILR' },
  { id: 'quant',       icon: Calculator,       label: 'Quantitative' },
  { id: 'vocabulary',  icon: Lightbulb,        label: 'Vocabulary' },
  { id: 'pyq',         icon: FileText,         label: 'Previous Papers' },
  { id: 'pyq_topics',  icon: BookMarked,       label: 'Topic-wise PYQs' },
  { id: 'mock',        icon: Trophy,           label: 'Mock Tests' },
  { id: 'revision',    icon: Repeat,           label: 'Revision' },
  { id: 'tutor',       icon: MessageSquare,    label: 'AI Tutor' },
]

export default function Sidebar({ active, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <aside className="fixed left-0 top-0 h-full bg-bg-secondary border-r border-border flex flex-col z-30 transition-all duration-300" style={{ width: collapsed ? 60 : 210 }}>
      <div className="h-14 flex items-center px-3 border-b border-border flex-shrink-0 gap-2">
        <div className="w-7 h-7 rounded-lg bg-cat-blue flex items-center justify-center flex-shrink-0 text-white font-display font-bold text-xs">C</div>
        {!collapsed && <div><p className="font-display font-bold text-xs text-text-primary leading-tight">CAT Mentor</p><p className="font-display font-bold text-[10px] text-cat-blue leading-tight">PRO</p></div>}
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all group relative ${active === id ? 'bg-cat-blue/10 text-cat-blue border-r-2 border-cat-blue' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}>
            <Icon size={15} className="flex-shrink-0" />
            {!collapsed && <span className="text-xs font-medium">{label}</span>}
            {collapsed && <div className="absolute left-full ml-2 px-2 py-1 bg-bg-card border border-border rounded text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50">{label}</div>}
          </button>
        ))}
      </nav>
      <div className="border-t border-border">
        <button onClick={() => onNavigate('settings')} className={`w-full flex items-center gap-2.5 px-3 py-2.5 ${active === 'settings' ? 'text-cat-blue' : 'text-text-secondary hover:text-text-primary'}`}>
          <Settings size={15} className="flex-shrink-0" />{!collapsed && <span className="text-xs font-medium">Settings</span>}
        </button>
        <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-center py-2 text-text-muted hover:text-text-secondary">
          {collapsed ? <ChevronRight size={14}/> : <div className="flex items-center gap-1 text-xs"><ChevronLeft size={13}/><span>Collapse</span></div>}
        </button>
      </div>
    </aside>
  )
}
