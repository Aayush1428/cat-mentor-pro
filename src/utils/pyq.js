// Loads the published generation corpus and exposes anchors for grounding generation.
//
// public/dataset/pyq_corpus.json is produced by `npm run dataset:build` from the real questions
// extracted (via dataset:extract) out of the files under dataset/sources/previous-year/ (real CAT
// papers) AND dataset/sources/practice|needs_practice/ (the user's own practice material). Each
// anchor carries `sourceKind` ('previous-year' | 'practice' | 'needs-practice'). It is grouped by
// "<sectionId>:<topicId>" so any module can ask for the real questions of a topic and generate NEW
// ones modeled on them (with a citation).
//
// It degrades gracefully: if the file is missing or empty (nothing extracted yet), every
// helper just returns [] and callers fall back to ungrounded generation.

let _cache // null once resolved (loaded-or-absent); undefined until first load
let _pending

export const loadPYQCorpus = async () => {
  if (_cache !== undefined) return _cache
  if (_pending) return _pending
  _pending = fetch('/dataset/pyq_corpus.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { _cache = d && d.byTopic ? d : null; return _cache })
    .catch(() => { _cache = null; return null })
  return _pending
}

// Real anchor questions for one topic (e.g. sectionId 'DILR', topicId 'di_pie'). Optionally
// restrict to a single sourceKind ('previous-year' to keep a "papers only" flow honest).
export const pyqAnchorsForTopic = async (sectionId, topicId, max = 6, kind = null) => {
  const c = await loadPYQCorpus()
  let arr = c?.byTopic?.[`${sectionId}:${topicId}`] || []
  if (kind) arr = arr.filter((a) => a.sourceKind === kind)
  return arr.slice(0, max)
}

// Merged anchors across several topic ids — used for RC, which spans rc_main_idea/inference/tone/…
export const pyqAnchorsForTopics = async (sectionId, topicIds, max = 6, kind = null) => {
  const c = await loadPYQCorpus()
  if (!c) return []
  let out = []
  for (const id of topicIds) out.push(...(c.byTopic?.[`${sectionId}:${id}`] || []))
  if (kind) out = out.filter((a) => a.sourceKind === kind)
  return out.slice(0, max)
}

// Any anchors in a section (across all its topics) — used to top up a specific set when the exact
// sub-type has few/no anchors, so the user's general practice material still informs generation.
export const pyqAnchorsForSection = async (sectionId, max = 6, kind = null) => {
  const c = await loadPYQCorpus()
  if (!c) return []
  let out = []
  for (const [k, arr] of Object.entries(c.byTopic || {})) if (k.startsWith(`${sectionId}:`)) out.push(...arr)
  if (kind) out = out.filter((a) => a.sourceKind === kind)
  return out.slice(0, max)
}

// Topic anchors, topped up with other same-section anchors when the topic itself is thin.
export const pyqAnchorsTopicThenSection = async (sectionId, topicId, max = 4) => {
  const topic = await pyqAnchorsForTopic(sectionId, topicId, max)
  if (topic.length >= max) return topic
  const section = await pyqAnchorsForSection(sectionId, max * 3)
  const seen = new Set(topic.map((a) => a.question))
  const extra = section.filter((a) => !seen.has(a.question)).slice(0, max - topic.length)
  return [...topic, ...extra]
}

// Compact, prompt-ready text block describing the anchors (question + options + answer + concept).
export const formatAnchors = (anchors) =>
  (anchors || [])
    .map((a, i) => {
      const ref = a.reference || (a.sourceKind === 'previous-year' ? 'CAT previous year' : 'my practice set')
      const opts = Array.isArray(a.options) && a.options.length ? ` Options: ${a.options.join(' ')}` : ''
      const ans = a.correct ? ` Answer: ${a.correct}.` : ''
      const con = a.concept ? ` Concept: ${a.concept}.` : ''
      return `[${i + 1}] (ref: ${ref}) ${a.question}${opts}${ans}${con}`
    })
    .join('\n')

// Distinct reference strings present in a set of anchors (e.g. ['CAT 2025 Slot 2']).
export const anchorRefs = (anchors) => [...new Set((anchors || []).map((a) => a.reference).filter(Boolean))]

