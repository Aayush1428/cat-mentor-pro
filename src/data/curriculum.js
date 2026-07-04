// Complete CAT curriculum with priority levels and topic metadata

export const SECTIONS = {
  VARC: {
    id: 'VARC',
    label: 'Verbal Ability & RC',
    color: '#3B82F6',
    icon: '📖',
    description: 'Reading Comprehension, Para Jumbles, Para Summary, Vocabulary, Grammar',
    topics: [
      // Reading Comprehension
      { id: 'rc_main_idea',    name: 'RC — Main Idea & Title',          priority: 1, weight: 'High',   marks: 16, tags: ['RC'] },
      { id: 'rc_inference',   name: 'RC — Inference Questions',         priority: 1, weight: 'High',   marks: 16, tags: ['RC'] },
      { id: 'rc_tone',        name: 'RC — Author Tone & Attitude',      priority: 1, weight: 'High',   marks: 16, tags: ['RC'] },
      { id: 'rc_vocab',       name: 'RC — Vocabulary in Context',       priority: 2, weight: 'High',   marks: 16, tags: ['RC'] },
      { id: 'rc_summary',     name: 'RC — Paragraph Summary',           priority: 2, weight: 'High',   marks: 16, tags: ['RC'] },
      // Para questions
      { id: 'para_jumble',    name: 'Para Jumbles (PJ)',                priority: 1, weight: 'High',   marks: 4,  tags: ['VA'] },
      { id: 'para_summary',   name: 'Para Summary',                     priority: 1, weight: 'High',   marks: 4,  tags: ['VA'] },
      { id: 'odd_sentence',   name: 'Odd Sentence Out',                 priority: 2, weight: 'Medium', marks: 4,  tags: ['VA'] },
      // Vocabulary
      { id: 'vocab_synonyms', name: 'Vocabulary — Synonyms/Antonyms',  priority: 2, weight: 'Medium', marks: 0,  tags: ['Vocab'] },
      { id: 'vocab_idioms',   name: 'Idioms & Phrases',                 priority: 3, weight: 'Medium', marks: 0,  tags: ['Vocab'] },
      { id: 'vocab_words',    name: 'Word Usage & Fill-in-Blanks',      priority: 2, weight: 'Medium', marks: 4,  tags: ['VA'] },
      // Grammar
      { id: 'grammar_tenses', name: 'Grammar — Tenses & Agreement',    priority: 3, weight: 'Low',    marks: 0,  tags: ['Grammar'] },
      { id: 'grammar_errors', name: 'Grammar — Error Correction',       priority: 3, weight: 'Low',    marks: 0,  tags: ['Grammar'] },
    ],
  },

  DILR: {
    id: 'DILR',
    label: 'Data Interpretation & LR',
    color: '#8B5CF6',
    icon: '🧩',
    description: 'Data Interpretation sets, Logical Reasoning puzzles',
    topics: [
      // DI
      { id: 'di_tables',      name: 'DI — Tables',                     priority: 1, weight: 'High',   tags: ['DI'] },
      { id: 'di_bar',         name: 'DI — Bar Charts',                 priority: 1, weight: 'High',   tags: ['DI'] },
      { id: 'di_line',        name: 'DI — Line Graphs',                priority: 1, weight: 'High',   tags: ['DI'] },
      { id: 'di_pie',         name: 'DI — Pie Charts',                 priority: 1, weight: 'High',   tags: ['DI'] },
      { id: 'di_caselet',     name: 'DI — Caselets (Text-based DI)',   priority: 2, weight: 'High',   tags: ['DI'] },
      { id: 'di_network',     name: 'DI — Network / Route Diagrams',   priority: 2, weight: 'Medium', tags: ['DI'] },
      // LR
      { id: 'lr_seating',     name: 'LR — Seating Arrangements',       priority: 1, weight: 'High',   tags: ['LR'] },
      { id: 'lr_games',       name: 'LR — Games & Tournaments',        priority: 1, weight: 'High',   tags: ['LR'] },
      { id: 'lr_scheduling',  name: 'LR — Scheduling & Ordering',      priority: 1, weight: 'High',   tags: ['LR'] },
      { id: 'lr_grouping',    name: 'LR — Grouping & Selection',       priority: 2, weight: 'High',   tags: ['LR'] },
      { id: 'lr_venn',        name: 'LR — Venn Diagrams',              priority: 2, weight: 'Medium', tags: ['LR'] },
      { id: 'lr_coins',       name: 'LR — Coins & Weights',            priority: 2, weight: 'Medium', tags: ['LR'] },
      { id: 'lr_blood',       name: 'LR — Blood Relations',            priority: 3, weight: 'Low',    tags: ['LR'] },
      { id: 'lr_directions',  name: 'LR — Directions & Distances',     priority: 3, weight: 'Low',    tags: ['LR'] },
    ],
  },

  QA: {
    id: 'QA',
    label: 'Quantitative Aptitude',
    color: '#10B981',
    icon: '🔢',
    description: 'Arithmetic, Algebra, Geometry, Number System, Modern Math',
    topics: [
      // Arithmetic — highest priority
      { id: 'qa_percentages', name: 'Percentages',                      priority: 1, weight: 'High',   tags: ['Arithmetic'] },
      { id: 'qa_profit',      name: 'Profit, Loss & Discount',         priority: 1, weight: 'High',   tags: ['Arithmetic'] },
      { id: 'qa_ratio',       name: 'Ratio & Proportion',              priority: 1, weight: 'High',   tags: ['Arithmetic'] },
      { id: 'qa_averages',    name: 'Averages & Mixtures',             priority: 1, weight: 'High',   tags: ['Arithmetic'] },
      { id: 'qa_tsd',         name: 'Time, Speed & Distance',          priority: 1, weight: 'High',   tags: ['Arithmetic'] },
      { id: 'qa_tw',          name: 'Time & Work / Pipes & Cisterns',  priority: 1, weight: 'High',   tags: ['Arithmetic'] },
      { id: 'qa_si_ci',       name: 'Simple & Compound Interest',      priority: 2, weight: 'Medium', tags: ['Arithmetic'] },
      // Number System
      { id: 'qa_numbers',     name: 'Number System & Divisibility',    priority: 1, weight: 'High',   tags: ['Numbers'] },
      { id: 'qa_hcf_lcm',    name: 'HCF & LCM',                       priority: 2, weight: 'Medium', tags: ['Numbers'] },
      { id: 'qa_remainders',  name: 'Remainders & Factors',            priority: 2, weight: 'Medium', tags: ['Numbers'] },
      // Algebra
      { id: 'qa_linear_eq',   name: 'Linear & Quadratic Equations',    priority: 1, weight: 'High',   tags: ['Algebra'] },
      { id: 'qa_inequalities',name: 'Inequalities & Modulus',          priority: 2, weight: 'High',   tags: ['Algebra'] },
      { id: 'qa_functions',   name: 'Functions & Graphs',              priority: 2, weight: 'Medium', tags: ['Algebra'] },
      { id: 'qa_progressions',name: 'AP, GP & Special Series',         priority: 2, weight: 'Medium', tags: ['Algebra'] },
      // Geometry
      { id: 'qa_triangles',   name: 'Triangles & Properties',          priority: 1, weight: 'High',   tags: ['Geometry'] },
      { id: 'qa_circles',     name: 'Circles & Tangents',              priority: 2, weight: 'High',   tags: ['Geometry'] },
      { id: 'qa_mensuration', name: 'Mensuration (2D & 3D)',           priority: 2, weight: 'High',   tags: ['Geometry'] },
      { id: 'qa_coordinate',  name: 'Coordinate Geometry',             priority: 2, weight: 'Medium', tags: ['Geometry'] },
      { id: 'qa_trigo',       name: 'Trigonometry',                    priority: 3, weight: 'Low',    tags: ['Geometry'] },
      // Modern Math
      { id: 'qa_pc',          name: 'Permutation & Combination',       priority: 2, weight: 'High',   tags: ['Modern'] },
      { id: 'qa_probability', name: 'Probability',                     priority: 2, weight: 'Medium', tags: ['Modern'] },
      { id: 'qa_set_theory',  name: 'Set Theory',                      priority: 3, weight: 'Medium', tags: ['Modern'] },
      { id: 'qa_logs',        name: 'Logarithms & Surds',              priority: 3, weight: 'Low',    tags: ['Modern'] },
    ],
  },
}

export const PRIORITY_LABELS = { 1: '🔴 Must Do', 2: '🟡 Important', 3: '🟢 Good to Have' }
export const WEIGHT_COLORS   = { High: '#EF4444', Medium: '#F59E0B', Low: '#10B981' }

// CAT Previous Year Papers metadata (2014–2024)
export const PREVIOUS_PAPERS = [
  { year: 2024, slots: ['Slot 1', 'Slot 2', 'Slot 3'] },
  { year: 2023, slots: ['Slot 1', 'Slot 2', 'Slot 3'] },
  { year: 2022, slots: ['Slot 1', 'Slot 2', 'Slot 3'] },
  { year: 2021, slots: ['Slot 1', 'Slot 2', 'Slot 3'] },
  { year: 2020, slots: ['Slot 1', 'Slot 2', 'Slot 3'] },
  { year: 2019, slots: ['Slot 1', 'Slot 2'] },
  { year: 2018, slots: ['Slot 1', 'Slot 2'] },
  { year: 2017, slots: ['Slot 1', 'Slot 2'] },
  { year: 2016, slots: ['Slot 1', 'Slot 2'] },
  { year: 2015, slots: ['Slot 1', 'Slot 2'] },
  { year: 2014, slots: ['Slot 1', 'Slot 2'] },
]

export const PAPER_SOURCES = [
  { name: 'Cracku',  url: 'https://cracku.in/cat-previous-papers/' },
  { name: 'CATKing', url: 'https://catking.in/exam/cat-exam/previous-year-papers' },
  { name: 'iQuanta', url: 'https://www.iquanta.in/cat-question-papers' },
]

export const getAllTopics = () => Object.values(SECTIONS).flatMap(s => s.topics.map(t => ({ ...t, sectionId: s.id, sectionLabel: s.label })))
