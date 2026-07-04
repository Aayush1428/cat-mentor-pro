import React, { useState, useEffect } from 'react'
import Sidebar from './components/layout/Sidebar.jsx'
import TopBar from './components/layout/TopBar.jsx'
import Layout from './components/layout/Layout.jsx'
import { ToastContainer } from './components/ui/index.jsx'
import Dashboard from './modules/Dashboard.jsx'
import Analysis from './modules/Analysis.jsx'
import VARC from './modules/VARC.jsx'
import DILR from './modules/DILR.jsx'
import Quant from './modules/Quant.jsx'
import Vocabulary from './modules/Vocabulary.jsx'
import { PreviousPapers, PYQTopics } from './modules/PreviousPapers.jsx'
import MockTest from './modules/MockTest.jsx'
import AITutor from './modules/AITutor.jsx'
import Settings from './modules/Settings.jsx'
import StudyPlanner from './modules/StudyPlanner.jsx'
import Revision from './modules/Revision.jsx'
import { addStudyTime, getTodayStudyTime } from './utils/performance.js'

const getSettings = () => { try { return JSON.parse(localStorage.getItem('cat_settings') || '{}') } catch { return {} } }

export default function App() {
  const [activeModule, setActiveModule] = useState('dashboard')
  const [hasApiKey, setHasApiKey] = useState(() => { const s = getSettings(); return !!s.groqKey || !!s.deepseekKey })
  const [providerLabel, setProviderLabel] = useState(() => {
    const s = getSettings()
    if (s.groqKey && s.deepseekKey) return 'Groq + DeepSeek'
    if (s.groqKey) return 'Groq'
    if (s.deepseekKey) return 'DeepSeek'
    return ''
  })
  const [studySeconds, setStudySeconds] = useState(getTodayStudyTime())

  useEffect(() => {
    const interval = setInterval(() => { setStudySeconds(s => { addStudyTime(1); return s + 1 }) }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const today = new Date().toDateString()
    const last = localStorage.getItem('cat_last_study')
    const streak = parseInt(localStorage.getItem('cat_streak') || '0')
    if (last !== today) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      localStorage.setItem('cat_streak', last === yesterday.toDateString() ? streak + 1 : 1)
      localStorage.setItem('cat_last_study', today)
    }
  }, [])

  useEffect(() => { document.documentElement.style.setProperty('--sidebar-width', '210px') }, [])

  const handleNavigate = (m) => setActiveModule(m)
  const handleSettingsChange = () => {
    const s = getSettings()
    setHasApiKey(!!s.groqKey || !!s.deepseekKey)
    setProviderLabel(s.groqKey && s.deepseekKey ? 'Groq + DeepSeek' : s.groqKey ? 'Groq' : s.deepseekKey ? 'DeepSeek' : '')
  }

  const props = { onNavigate: handleNavigate, hasApiKey }

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':  return <Dashboard {...props} />
      case 'planner':    return <StudyPlanner {...props} />
      case 'analysis':   return <Analysis />
      case 'varc':       return <VARC {...props} />
      case 'dilr':       return <DILR {...props} />
      case 'quant':      return <Quant {...props} />
      case 'vocabulary': return <Vocabulary {...props} />
      case 'pyq':        return <PreviousPapers />
      case 'pyq_topics': return <PYQTopics {...props} />
      case 'mock':       return <MockTest {...props} />
      case 'revision':   return <Revision {...props} />
      case 'tutor':      return <AITutor {...props} />
      case 'settings':   return <Settings onSave={handleSettingsChange} />
      default:            return <Dashboard {...props} />
    }
  }

  return (
    <>
      <Layout
        sidebar={<Sidebar active={activeModule} onNavigate={handleNavigate} />}
        topbar={<TopBar active={activeModule} hasApiKey={hasApiKey} providerLabel={providerLabel} studyTime={studySeconds} />}
      >
        {!hasApiKey && activeModule !== 'settings' && (
          <div className="mb-4 flex items-center justify-between bg-cat-orange/10 border border-cat-orange/30 rounded-xl px-4 py-2.5">
            <span className="text-sm text-text-secondary">🔑 Add a Groq or DeepSeek API key in Settings to unlock all AI-powered features</span>
            <button onClick={() => handleNavigate('settings')} className="text-xs text-cat-orange font-semibold hover:underline ml-3 flex-shrink-0">Open Settings →</button>
          </div>
        )}
        {renderModule()}
      </Layout>
      <ToastContainer />
    </>
  )
}
