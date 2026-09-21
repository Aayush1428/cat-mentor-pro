// Tracks per-topic performance for the analysis dashboard

const KEY = 'cat_performance'

const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
const save = (d) => localStorage.setItem(KEY, JSON.stringify(d))

export const recordAttempt = (section, topic, correct, timeSec = 0) => {
  const d = load()
  const k = `${section}__${topic}`
  if (!d[k]) d[k] = { section, topic, attempts: 0, correct: 0, totalTime: 0 }
  d[k].attempts++
  if (correct) d[k].correct++
  d[k].totalTime += timeSec
  d[k].lastAttempt = new Date().toISOString()
  save(d)
  recordDaily(correct)
}

// ─── Daily accuracy rollup (for progress-over-time charts) ───────────────────
const DAILY_KEY = 'cat_daily'
const loadDaily = () => { try { return JSON.parse(localStorage.getItem(DAILY_KEY) || '{}') } catch { return {} } }

const recordDaily = (correct) => {
  const d = loadDaily()
  const day = new Date().toISOString().slice(0, 10)
  if (!d[day]) d[day] = { a: 0, c: 0 }
  d[day].a++
  if (correct) d[day].c++
  localStorage.setItem(DAILY_KEY, JSON.stringify(d))
}

export const getDailyHistory = () =>
  Object.entries(loadDaily())
    .map(([date, v]) => ({ date, attempts: v.a, correct: v.c, accuracy: v.a ? Math.round((v.c / v.a) * 100) : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))

// ─── Mock-test score history (for the score trend chart) ─────────────────────
const MOCK_KEY = 'cat_mock_history'
const loadMocks = () => { try { return JSON.parse(localStorage.getItem(MOCK_KEY) || '[]') } catch { return [] } }

export const saveMockResult = ({ label, netScore, maxScore, accuracy, percentile, attempted, total }) => {
  const list = loadMocks()
  list.push({
    date: new Date().toISOString(), label, netScore, maxScore,
    accuracy, percentile, attempted, total,
  })
  localStorage.setItem(MOCK_KEY, JSON.stringify(list.slice(-50)))
}

export const getMockHistory = () => loadMocks()
export const clearMockHistory = () => localStorage.removeItem(MOCK_KEY)

export const getPerformance = () => load()

export const getTopicStats = (section, topic) => {
  const d = load()
  const k = `${section}__${topic}`
  return d[k] || { attempts: 0, correct: 0, totalTime: 0 }
}

export const getSectionStats = (section) => {
  const d = load()
  return Object.values(d).filter(x => x.section === section)
}

export const getAccuracy = (stats) => stats.attempts === 0 ? null : Math.round((stats.correct / stats.attempts) * 100)

// Average seconds spent per question on a topic (null if no timed attempts recorded yet).
export const getAvgTime = (stats) => stats.attempts === 0 || !stats.totalTime ? null : Math.round(stats.totalTime / stats.attempts)

// Speed + accuracy across every attempted topic, for the "how am I doing overall" summary.
export const getOverallStats = () => {
  const rows = Object.values(load())
  const totalAttempts = rows.reduce((s, r) => s + r.attempts, 0)
  const totalCorrect = rows.reduce((s, r) => s + r.correct, 0)
  const totalTime = rows.reduce((s, r) => s + (r.totalTime || 0), 0)
  const timedAttempts = rows.reduce((s, r) => s + (r.totalTime ? r.attempts : 0), 0)
  return {
    totalAttempts,
    totalCorrect,
    accuracy: totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : null,
    avgTimeSec: timedAttempts ? Math.round(totalTime / timedAttempts) : null,
  }
}

// Ranks every attempted topic by how much it needs work: low accuracy first, then slow topics.
// verdict: 'weak-slow' | 'weak' | 'slow' | 'strong' — used to phrase a concrete recommendation.
export const getImprovementInsights = (limit = 6) => {
  const rows = Object.values(load()).filter(r => r.attempts > 0)
  const { avgTimeSec: overallAvgTime } = getOverallStats()
  const withMetrics = rows.map(r => {
    const accuracy = getAccuracy(r)
    const avgTimeSec = getAvgTime(r)
    const slow = avgTimeSec !== null && overallAvgTime !== null && avgTimeSec > overallAvgTime * 1.15
    const weak = accuracy !== null && accuracy < 60
    const verdict = weak && slow ? 'weak-slow' : weak ? 'weak' : slow ? 'slow' : 'strong'
    return { section: r.section, topic: r.topic, accuracy, avgTimeSec, attempts: r.attempts, verdict }
  })
  const rank = { 'weak-slow': 0, weak: 1, slow: 2, strong: 3 }
  return withMetrics
    .sort((a, b) => rank[a.verdict] - rank[b.verdict] || (a.accuracy ?? 100) - (b.accuracy ?? 100))
    .slice(0, limit)
}

export const getStrengthLabel = (accuracy) => {
  if (accuracy === null) return 'Not Attempted'
  if (accuracy >= 80) return 'Strong'
  if (accuracy >= 60) return 'Average'
  if (accuracy >= 40) return 'Needs Work'
  return 'Weak'
}

export const getStrengthColor = (accuracy) => {
  if (accuracy === null) return '#4A5568'
  if (accuracy >= 80) return '#10B981'
  if (accuracy >= 60) return '#F59E0B'
  if (accuracy >= 40) return '#F97316'
  return '#EF4444'
}

export const clearPerformance = () => localStorage.removeItem(KEY)

// Daily study time
export const addStudyTime = (seconds) => {
  const today = new Date().toDateString()
  const v = parseInt(localStorage.getItem(`cat_time_${today}`) || '0') + seconds
  localStorage.setItem(`cat_time_${today}`, v)
}

export const getTodayStudyTime = () => parseInt(localStorage.getItem(`cat_time_${new Date().toDateString()}`) || '0')
