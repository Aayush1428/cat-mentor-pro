import React, { useState, useRef } from 'react'
import { Card, SectionHeader, Badge, showToast } from '../components/ui/index.jsx'
import { testGroqConnection, testDeepseekConnection, clearAllCache } from '../utils/ai.js'
import { clearPerformance } from '../utils/performance.js'
import { downloadBackup, importBackup, readFileAsText } from '../utils/backup.js'
import { Key, Zap, RotateCcw, Wifi, WifiOff, Trash2, CheckCircle, Download, Upload } from 'lucide-react'

const get = () => { try { return JSON.parse(localStorage.getItem('cat_settings') || '{}') } catch { return {} } }

const Btn = ({ opts, value, onChange }) => (
  <div className="flex flex-wrap gap-2 mt-1">
    {opts.map(o => <button key={o} onClick={() => onChange(o)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${value === o ? 'bg-cat-blue text-white border-cat-blue' : 'border-border text-text-secondary hover:border-cat-blue/50'}`}>{o}</button>)}
  </div>
)

export default function Settings({ onSave }) {
  const saved = get()
  const [groqKey, setGroqKey] = useState(saved.groqKey || '')
  const [deepseekKey, setDeepseekKey] = useState(saved.deepseekKey || '')
  const [newsDataKey, setNewsDataKey] = useState(saved.newsDataKey || '')
  const [newsCatcherKey, setNewsCatcherKey] = useState(saved.newsCatcherKey || '')
  const [newsApiKey, setNewsApiKey] = useState(saved.newsApiKey || '')
  const [preferred, setPreferred] = useState(saved.preferredProvider || 'groq')
  const [level, setLevel] = useState(saved.level || 'Beginner')
  const [targetPct, setTargetPct] = useState(saved.targetPct || '95')
  const [saving, setSaving] = useState(false)
  const [testG, setTestG] = useState(null); const [testingG, setTestingG] = useState(false)
  const [testD, setTestD] = useState(null); const [testingD, setTestingD] = useState(false)
  const fileRef = useRef(null)

  const doExport = () => {
    const n = downloadBackup({ includeCache: false })
    showToast(`Exported ${n} items to a backup file`, 'success')
  }

  const doImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const n = importBackup(text, { merge: true })
      showToast(`Restored ${n} items — reloading...`, 'success')
      setTimeout(() => window.location.reload(), 900)
    } catch (err) { showToast('Import failed: ' + err.message, 'error') }
    finally { if (fileRef.current) fileRef.current.value = '' }
  }

  const save = () => {
    setSaving(true)
    localStorage.setItem('cat_settings', JSON.stringify({
      groqKey,
      deepseekKey,
      newsDataKey,
      newsCatcherKey,
      newsApiKey,
      preferredProvider: preferred,
      level,
      targetPct,
    }))
    if (onSave) onSave()
    showToast('Settings saved', 'success')
    setTimeout(() => setSaving(false), 800)
  }

  const doTestGroq = async () => {
    if (!groqKey.trim()) { showToast('Enter Groq key first', 'error'); return }
    setTestingG(true); setTestG(null)
    try { await testGroqConnection(groqKey.trim()); setTestG('ok'); showToast('Groq connected ✓', 'success') }
    catch { setTestG('err'); showToast('Groq connection failed', 'error') }
    finally { setTestingG(false) }
  }

  const doTestDeepseek = async () => {
    if (!deepseekKey.trim()) { showToast('Enter DeepSeek key first', 'error'); return }
    setTestingD(true); setTestD(null)
    try { await testDeepseekConnection(deepseekKey.trim()); setTestD('ok'); showToast('DeepSeek connected ✓', 'success') }
    catch { setTestD('err'); showToast('DeepSeek connection failed', 'error') }
    finally { setTestingD(false) }
  }

  const KeyInput = ({ label, sub, val, setVal, testing, testResult, onTest, placeholder }) => (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        <Key size={13} className="text-cat-blue" />
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {val && <Badge variant="green">Set</Badge>}
      </div>
      <p className="text-xs text-text-secondary mb-3">{sub}</p>
      <div className="flex gap-2">
        <input type="password" value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
          className="flex-1 bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cat-blue transition-colors" />
        <button onClick={onTest} disabled={testing} className="px-3 py-2 rounded-lg border border-border text-xs text-text-secondary hover:border-cat-blue hover:text-cat-blue transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50">
          {testing ? <RotateCcw size={12} className="animate-spin"/> : testResult === 'ok' ? <Wifi size={12} className="text-cat-green"/> : testResult === 'err' ? <WifiOff size={12} className="text-cat-red"/> : <Zap size={12}/>} Test
        </button>
      </div>
    </Card>
  )

  return (
    <div className="max-w-2xl space-y-4 animate-fade-in">
      <SectionHeader title="Settings" subtitle="Configure AI providers, news feeds and learning preferences" />
      <KeyInput label="Groq API Key" sub="Free tier available — get key at console.groq.com (Llama 3.3 70B, fastest)" val={groqKey} setVal={setGroqKey} testing={testingG} testResult={testG} onTest={doTestGroq} placeholder="gsk_..." />
      <KeyInput label="DeepSeek API Key" sub="Get key at platform.deepseek.com — deep reasoning, great for explanations" val={deepseekKey} setVal={setDeepseekKey} testing={testingD} testResult={testD} onTest={doTestDeepseek} placeholder="sk-..." />
      <Card>
        <p className="text-sm font-semibold text-text-primary mb-2">News Feed Providers</p>
        <p className="text-xs text-text-secondary mb-3">For Times of India / Economic Times / Hindustan Times / finance aggregation, add at least one key below (NewsData is recommended).</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-text-muted mb-1">NewsData API Key</p>
            <input type="password" value={newsDataKey} onChange={e => setNewsDataKey(e.target.value)} placeholder="pub_..."
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cat-blue transition-colors" />
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">NewsCatcher API Key</p>
            <input type="password" value={newsCatcherKey} onChange={e => setNewsCatcherKey(e.target.value)} placeholder="newscatcher key"
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cat-blue transition-colors" />
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">NewsAPI Key</p>
            <input type="password" value={newsApiKey} onChange={e => setNewsApiKey(e.target.value)} placeholder="newsapi key"
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cat-blue transition-colors" />
          </div>
        </div>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-text-primary mb-1">Preferred AI Provider</p>
        <p className="text-xs text-text-secondary mb-2">Used first when both keys are set. App auto-falls-back to the other if a call fails.</p>
        <Btn opts={['groq', 'deepseek']} value={preferred} onChange={setPreferred} />
      </Card>
      <Card>
        <p className="text-sm font-semibold text-text-primary mb-3">CAT Preferences</p>
        <div className="space-y-4">
          <div><p className="text-xs text-text-muted mb-1">Current Level</p><Btn opts={['Beginner', 'Intermediate', 'Advanced']} value={level} onChange={setLevel} /></div>
          <div><p className="text-xs text-text-muted mb-1">Target Percentile</p><Btn opts={['85', '90', '95', '99', '99.5']} value={targetPct} onChange={setTargetPct} /></div>
        </div>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-text-primary mb-1">Data Management</p>
        <p className="text-xs text-text-secondary mb-3">Your progress lives in this browser only. Export a backup regularly so you never lose it — then import it on any device to continue.</p>
        <div className="flex flex-wrap gap-3 mb-3">
          <button onClick={doExport} className="px-3 py-2 rounded-lg border border-cat-green/30 text-xs text-cat-green hover:bg-cat-green/10 transition-all flex items-center gap-1.5">
            <Download size={12}/> Export Progress
          </button>
          <button onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-lg border border-cat-blue/30 text-xs text-cat-blue hover:bg-cat-blue/10 transition-all flex items-center gap-1.5">
            <Upload size={12}/> Import Backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={doImport} className="hidden" />
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => { clearAllCache(); showToast('AI cache cleared', 'success') }} className="px-3 py-2 rounded-lg border border-border text-xs text-text-secondary hover:border-cat-orange hover:text-cat-orange transition-all flex items-center gap-1.5">
            <Trash2 size={12}/> Clear AI Cache
          </button>
          <button onClick={() => { clearPerformance(); showToast('Performance data cleared', 'success') }} className="px-3 py-2 rounded-lg border border-cat-red/30 text-xs text-cat-red hover:bg-cat-red/10 transition-all flex items-center gap-1.5">
            <Trash2 size={12}/> Reset Performance Data
          </button>
        </div>
      </Card>
      <button onClick={save} className="w-full py-3 bg-cat-blue text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2">
        {saving && <CheckCircle size={15}/>}{saving ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
