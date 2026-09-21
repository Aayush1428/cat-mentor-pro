// Shared helpers: turn a folder path like
//   previous-year/quantitative-aptitude/percentages
// into a { sectionId, topicId, topic, tags } so questions can be organised by
// folder without repeating metadata in every record. Used by build.mjs and
// extract.mjs.

export const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const humanize = (slug) =>
  String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ')

// Folder name (slug) → section id.
const SECTION_ALIASES = {
  qa: 'QA',
  quant: 'QA',
  quantitative: 'QA',
  'quantitative-aptitude': 'QA',
  varc: 'VARC',
  va: 'VARC',
  verbal: 'VARC',
  'verbal-ability': 'VARC',
  'verbal-ability-rc': 'VARC',
  dilr: 'DILR',
  lrdi: 'DILR',
  di: 'DILR',
  lr: 'DILR',
  'data-interpretation': 'DILR',
  'logical-reasoning': 'DILR',
  'di-lr': 'DILR',
  'lr-di': 'DILR',
}

// Tricky folder names that don't slug-match a curriculum topic name directly.
const TOPIC_ALIASES = {
  // DI
  'pie-chart': 'di_pie', 'pie-charts': 'di_pie', pie: 'di_pie',
  'table-chart': 'di_tables', 'table-charts': 'di_tables', tables: 'di_tables', table: 'di_tables',
  'tabular-data': 'di_tables',
  'bar-chart': 'di_bar', 'bar-charts': 'di_bar', bar: 'di_bar',
  'line-graph': 'di_line', 'line-graphs': 'di_line', 'line-chart': 'di_line',
  caselet: 'di_caselet', caselets: 'di_caselet',
  network: 'di_network', routes: 'di_network', 'route-diagram': 'di_network', 'routes-and-networks': 'di_network',
  'calculative-di': 'di_calculative', calculative: 'di_calculative',
  'logical-di': 'di_logical',
  // LR
  seating: 'lr_seating', 'seating-arrangement': 'lr_seating', 'seating-arrangements': 'lr_seating',
  arrangements: 'lr_seating', arrangement: 'lr_seating',
  games: 'lr_games', tournaments: 'lr_games', 'games-tournaments': 'lr_games', 'games-and-tournaments': 'lr_games',
  scheduling: 'lr_scheduling', ordering: 'lr_scheduling',
  grouping: 'lr_grouping', groupings: 'lr_grouping', selection: 'lr_grouping',
  'groupings-and-conditionalities': 'lr_grouping', conditionalities: 'lr_grouping',
  venn: 'lr_venn', 'venn-diagram': 'lr_venn', 'venn-diagrams': 'lr_venn',
  'blood-relations': 'lr_blood', 'blood-relation': 'lr_blood',
  directions: 'lr_directions', 'directions-distances': 'lr_directions',
  'coding-decoding': 'lr_coding_decoding', coding: 'lr_coding_decoding', decoding: 'lr_coding_decoding',
  distribution: 'lr_distribution',
  puzzles: 'lr_puzzles', puzzle: 'lr_puzzles',
  // VARC
  rc: 'rc_main_idea', reading: 'rc_main_idea', 'reading-comprehension': 'rc_main_idea', rcs: 'rc_main_idea',
  'para-jumble': 'para_jumble', 'para-jumbles': 'para_jumble', parajumbles: 'para_jumble', pj: 'para_jumble',
  'para-summary': 'para_summary', 'paragraph-summary': 'para_summary',
  'odd-sentence': 'odd_sentence', 'odd-one-out': 'odd_sentence', 'odd-man-out': 'odd_sentence',
  'sentence-insertion': 'sentence_insertion', 'sentence-completion': 'sentence_insertion',
  'fill-in-the-blanks': 'vocab_words', 'fill-in-blanks': 'vocab_words', fillups: 'vocab_words', 'fill-ups': 'vocab_words',
  synonyms: 'vocab_synonyms', antonyms: 'vocab_synonyms', 'synonyms-antonyms': 'vocab_synonyms',
  idioms: 'vocab_idioms', phrases: 'vocab_idioms', 'idioms-phrases': 'vocab_idioms',
  grammar: 'grammar_errors', 'sentence-correction': 'grammar_errors', 'error-correction': 'grammar_errors',
  // QA (fixes folder names that don't slug-match the curriculum name, e.g. "and" vs "&")
  'linear-and-quadratic-equation': 'qa_linear_eq', 'linear-and-quadratic-equations': 'qa_linear_eq',
  'profit-loss-and-discount': 'qa_profit',
  'ratio-and-proportion': 'qa_ratio',
  'averages-and-mixtures': 'qa_averages',
  'time-speed-and-distance': 'qa_tsd',
  'time-and-work-pipes-and-cisterns': 'qa_tw', 'time-and-work': 'qa_tw', 'pipes-and-cisterns': 'qa_tw',
  'simple-and-compound-interest': 'qa_si_ci',
  'number-system-and-divisibility': 'qa_numbers',
  'hcf-and-lcm': 'qa_hcf_lcm',
  'remainders-and-factors': 'qa_remainders',
  'inequalities-and-modulus': 'qa_inequalities',
  'functions-and-graphs': 'qa_functions',
  'ap-gp-and-special-series': 'qa_progressions',
  'triangles-and-properties': 'qa_triangles',
  'circles-and-tangents': 'qa_circles',
  'permutation-and-combination': 'qa_pc',
  'logarithms-and-surds': 'qa_logs',
  // QA — labels as printed inside real PYQ PDFs (e.g. MBA Pathshala's "Topic: ..." tag per
  // question), which use different wording/grouping than the curriculum names above.
  'linear-and-special-equations': 'qa_linear_eq',
  'algebraic-identities': 'qa_linear_eq',
  'permutations-and-combinations': 'qa_pc',
  'number-system-and-modern-maths': 'qa_numbers', 'number-system-and-modern-math': 'qa_numbers',
  'simple-interest-and-compound-interest': 'qa_si_ci',
  'average-mixture-and-allegation': 'qa_averages', 'averages-mixture-and-allegation': 'qa_averages',
  'time-work-pipe-cistern': 'qa_tw', 'time-work-pipe-and-cistern': 'qa_tw',
  'surds-and-indices': 'qa_logs',
  'series-and-sequences': 'qa_progressions',
  'maxima-minima': 'qa_functions', 'maxima-and-minima': 'qa_functions',
}

// Build resolvers from getAllTopics() (curriculum).
export const buildResolvers = (topics) => {
  const bySection = {}
  for (const t of topics) {
    ;(bySection[t.sectionId] ||= []).push({ id: t.id, name: t.name, slug: slugify(t.name), tags: t.tags || [] })
  }
  const topicById = Object.fromEntries(topics.map((t) => [t.id, t]))

  const resolveSection = (parts) => {
    for (const p of parts.map(slugify)) if (SECTION_ALIASES[p]) return SECTION_ALIASES[p]
    return null
  }

  const resolveTopic = (sectionId, parts) => {
    const cands = bySection[sectionId] || []
    for (const raw of [...parts].reverse()) {
      const fs = slugify(raw)
      if (!fs || SECTION_ALIASES[fs]) continue
      // Genre-tagged RC folders (e.g. "Aesthetics RC", "Philosophy RC") are all the
      // same skill (Reading Comprehension) — route them to rc_main_idea and keep the
      // subject/genre as a tag instead of minting one topic per domain.
      if (sectionId === 'VARC' && fs !== 'rc' && fs.endsWith('-rc')) {
        const t = topicById.rc_main_idea
        const genre = humanize(fs.slice(0, -3))
        return t
          ? { topicId: t.id, topic: t.name, tags: [...(t.tags || []), genre] }
          : { topicId: 'rc_main_idea', topic: 'Reading Comprehension', tags: [genre] }
      }
      if (TOPIC_ALIASES[fs]) {
        const t = topicById[TOPIC_ALIASES[fs]]
        return t
          ? { topicId: t.id, topic: t.name, tags: t.tags || [] }
          : { topicId: TOPIC_ALIASES[fs], topic: humanize(fs), tags: [] }
      }
      const m =
        cands.find((c) => c.slug === fs) ||
        cands.find((c) => c.slug.includes(fs) || fs.includes(c.slug))
      if (m) return { topicId: m.id, topic: m.name, tags: m.tags }
    }
    // Fallback: use the deepest folder name as a free-form topic under the section.
    const deep = [...parts].reverse().map(slugify).find((p) => p && !SECTION_ALIASES[p])
    if (deep && sectionId) return { topicId: `${sectionId.toLowerCase()}_${deep}`, topic: humanize(deep), tags: [] }
    return { topicId: null, topic: null, tags: [] }
  }

  return { resolveSection, resolveTopic, topicById }
}
