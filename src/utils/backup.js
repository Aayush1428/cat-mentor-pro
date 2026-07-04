// Export / import all CAT Mentor Pro progress so nothing is lost when the browser is cleared.
// Everything this app stores lives under the `cat_` localStorage prefix.

const PREFIX = 'cat_'
const APP = 'cat-mentor-pro'
const VERSION = 1

export const collectData = () => {
  const data = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) data[k] = localStorage.getItem(k)
  }
  return data
}

// Progress-only export skips the (large, regenerable) AI cache.
export const exportProgress = ({ includeCache = false } = {}) => {
  const all = collectData()
  const data = {}
  Object.entries(all).forEach(([k, v]) => {
    if (!includeCache && k.startsWith('cat_cache_')) return
    data[k] = v
  })
  return { app: APP, version: VERSION, exportedAt: new Date().toISOString(), data }
}

export const downloadBackup = ({ includeCache = false } = {}) => {
  const payload = exportProgress({ includeCache })
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `cat-mentor-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return Object.keys(payload.data).length
}

// Returns the number of restored keys. Throws on malformed files.
export const importBackup = (json, { merge = true } = {}) => {
  let parsed
  try { parsed = typeof json === 'string' ? JSON.parse(json) : json }
  catch { throw new Error('File is not valid JSON') }
  if (!parsed || parsed.app !== APP || typeof parsed.data !== 'object')
    throw new Error('Not a CAT Mentor Pro backup file')

  if (!merge) {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
  }
  let count = 0
  Object.entries(parsed.data).forEach(([k, v]) => {
    if (k.startsWith(PREFIX) && typeof v === 'string') { localStorage.setItem(k, v); count++ }
  })
  return count
}

export const readFileAsText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('Could not read file'))
  reader.readAsText(file)
})
