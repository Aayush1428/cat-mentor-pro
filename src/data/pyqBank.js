// Verified, hand-checked CAT-level practice questions with correct answers and worked
// solutions. Unlike the AI-generated questions elsewhere in the app, every answer here
// has been manually verified — so this bank is trustworthy for scoring practice.
//
// NOTE: These are original CAT-*level* questions (not verbatim copies of copyrighted
// past papers). For the actual official past papers, use the external links in the
// Previous Papers screen (Cracku / CATKing / iQuanta).

export const PYQ_BANK = [
  // ── Arithmetic ──────────────────────────────────────────────────────────────
  { id: 'pq_pct_1', sectionId: 'QA', topicId: 'qa_percentages', topic: 'Percentages', difficulty: 'Easy',
    question: 'The price of an article is increased by 25%. By what percent must the new price be decreased to bring it back to the original price?',
    options: ['A) 25%', 'B) 18.75%', 'C) 20%', 'D) 15%'], correct: 'C',
    concept: 'Successive percentage change',
    solution: 'New price = 1.25×original. Required decrease = 0.25/1.25 = 1/5 = 20%.' },
  { id: 'pq_pct_2', sectionId: 'QA', topicId: 'qa_percentages', topic: 'Percentages', difficulty: 'Medium',
    question: 'In an election between two candidates, the winner secured 60% of the valid votes and won by 900 votes. How many valid votes were cast?',
    options: ['A) 5400', 'B) 4500', 'C) 3600', 'D) 2250'], correct: 'B',
    concept: 'Percentage difference',
    solution: 'Winner 60%, loser 40%, margin = 20% = 900 votes ⇒ total = 900/0.20 = 4500.' },
  { id: 'pq_pl_1', sectionId: 'QA', topicId: 'qa_profit', topic: 'Profit, Loss & Discount', difficulty: 'Medium',
    question: 'A shopkeeper marks his goods 40% above cost price and then allows a discount of 10%. His profit percent is:',
    options: ['A) 30%', 'B) 25%', 'C) 24%', 'D) 26%'], correct: 'D',
    concept: 'Markup and discount chain',
    solution: 'SP = 0.9 × 1.4 × CP = 1.26 CP ⇒ profit = 26%.' },
  { id: 'pq_pl_2', sectionId: 'QA', topicId: 'qa_profit', topic: 'Profit, Loss & Discount', difficulty: 'Easy',
    question: 'By selling an article for ₹450 a man loses 10%. At what price should he sell it to gain 10%?',
    options: ['A) ₹550', 'B) ₹500', 'C) ₹540', 'D) ₹600'], correct: 'A',
    concept: 'Cost price from loss %',
    solution: 'CP = 450/0.9 = ₹500. For 10% gain, SP = 1.1 × 500 = ₹550.' },
  { id: 'pq_ratio_1', sectionId: 'QA', topicId: 'qa_ratio', topic: 'Ratio & Proportion', difficulty: 'Easy',
    question: 'If a : b = 3 : 4 and b : c = 6 : 5, then a : b : c is:',
    options: ['A) 3 : 4 : 5', 'B) 9 : 12 : 5', 'C) 9 : 12 : 10', 'D) 9 : 8 : 10'], correct: 'C',
    concept: 'Combining ratios',
    solution: 'Make b common: a:b = 9:12, b:c = 12:10 ⇒ a:b:c = 9:12:10.' },
  { id: 'pq_avg_1', sectionId: 'QA', topicId: 'qa_averages', topic: 'Averages & Mixtures', difficulty: 'Medium',
    question: 'The average of 11 numbers is 50. The average of the first six is 49 and of the last six is 52. The sixth number is:',
    options: ['A) 46', 'B) 56', 'C) 50', 'D) 52'], correct: 'B',
    concept: 'Overlapping averages',
    solution: 'Sum(11) = 550. First6 = 294, last6 = 312; their sum 606 counts the 6th twice ⇒ 6th = 606 − 550 = 56.' },
  { id: 'pq_tsd_1', sectionId: 'QA', topicId: 'qa_tsd', topic: 'Time, Speed & Distance', difficulty: 'Easy',
    question: 'A train 150 m long crosses a pole in 15 seconds. Its speed is:',
    options: ['A) 36 km/h', 'B) 40 km/h', 'C) 45 km/h', 'D) 54 km/h'], correct: 'A',
    concept: 'Speed = distance/time',
    solution: 'Speed = 150/15 = 10 m/s = 10 × 18/5 = 36 km/h.' },
  { id: 'pq_tsd_2', sectionId: 'QA', topicId: 'qa_tsd', topic: 'Time, Speed & Distance', difficulty: 'Medium',
    question: 'A boat covers 12 km downstream in 2 hours and returns the same distance in 3 hours. The speed of the boat in still water is:',
    options: ['A) 10 km/h', 'B) 6 km/h', 'C) 4.5 km/h', 'D) 5 km/h'], correct: 'D',
    concept: 'Boats and streams',
    solution: 'Downstream = 6 km/h, upstream = 4 km/h. Still water = (6+4)/2 = 5 km/h.' },
  { id: 'pq_tw_1', sectionId: 'QA', topicId: 'qa_tw', topic: 'Time & Work / Pipes & Cisterns', difficulty: 'Easy',
    question: 'A can finish a job in 12 days and B in 15 days. Working together, they finish it in:',
    options: ['A) 27/4 days', 'B) 7 days', 'C) 20/3 days', 'D) 9/2 days'], correct: 'C',
    concept: 'Combined rate of work',
    solution: '1/12 + 1/15 = 9/60 = 3/20 per day ⇒ time = 20/3 = 6⅔ days.' },
  { id: 'pq_ci_1', sectionId: 'QA', topicId: 'qa_si_ci', topic: 'Simple & Compound Interest', difficulty: 'Easy',
    question: 'The compound interest on ₹10,000 at 10% per annum for 2 years, compounded annually, is:',
    options: ['A) ₹2000', 'B) ₹2100', 'C) ₹2200', 'D) ₹1100'], correct: 'B',
    concept: 'Compound interest',
    solution: 'Amount = 10000(1.1)² = 12100 ⇒ CI = 12100 − 10000 = ₹2100.' },
  { id: 'pq_ci_2', sectionId: 'QA', topicId: 'qa_si_ci', topic: 'Simple & Compound Interest', difficulty: 'Medium',
    question: 'The difference between compound and simple interest on a sum at 10% per annum for 2 years is ₹50. The sum is:',
    options: ['A) ₹5000', 'B) ₹6000', 'C) ₹2500', 'D) ₹10000'], correct: 'A',
    concept: 'CI − SI for 2 years = P(r/100)²',
    solution: 'Difference = P(r/100)² = P(0.1)² = 0.01P = 50 ⇒ P = ₹5000.' },

  // ── Number System ─────────────────────────────────────────────────────────────
  { id: 'pq_rem_1', sectionId: 'QA', topicId: 'qa_remainders', topic: 'Remainders & Factors', difficulty: 'Medium',
    question: 'The remainder when 7¹⁰⁰ is divided by 5 is:',
    options: ['A) 4', 'B) 2', 'C) 3', 'D) 1'], correct: 'D',
    concept: 'Cyclicity of remainders',
    solution: '7 ≡ 2 (mod 5). Powers of 2 mod 5 cycle 2,4,3,1 (period 4). 100 is a multiple of 4 ⇒ remainder 1.' },
  { id: 'pq_num_1', sectionId: 'QA', topicId: 'qa_numbers', topic: 'Number System & Divisibility', difficulty: 'Easy',
    question: 'The number of factors of 360 is:',
    options: ['A) 20', 'B) 12', 'C) 24', 'D) 36'], correct: 'C',
    concept: 'Number of divisors',
    solution: '360 = 2³ × 3² × 5¹ ⇒ factors = (3+1)(2+1)(1+1) = 24.' },
  { id: 'pq_hcf_1', sectionId: 'QA', topicId: 'qa_hcf_lcm', topic: 'HCF & LCM', difficulty: 'Easy',
    question: 'The HCF of two numbers is 12 and their LCM is 240. If one number is 48, the other is:',
    options: ['A) 48', 'B) 60', 'C) 72', 'D) 120'], correct: 'B',
    concept: 'Product = HCF × LCM',
    solution: 'a × b = HCF × LCM = 12 × 240 = 2880. Other = 2880/48 = 60.' },

  // ── Algebra ───────────────────────────────────────────────────────────────────
  { id: 'pq_alg_1', sectionId: 'QA', topicId: 'qa_linear_eq', topic: 'Linear & Quadratic Equations', difficulty: 'Easy',
    question: 'For the equation x² − 5x + 6 = 0, the sum of the roots is:',
    options: ['A) 5', 'B) 6', 'C) −5', 'D) 1'], correct: 'A',
    concept: 'Sum of roots = −b/a',
    solution: 'Sum of roots = −(−5)/1 = 5 (roots are 2 and 3).' },
  { id: 'pq_alg_2', sectionId: 'QA', topicId: 'qa_linear_eq', topic: 'Linear & Quadratic Equations', difficulty: 'Easy',
    question: 'The roots of x² − 7x + 12 = 0 are:',
    options: ['A) 2 and 6', 'B) −3 and −4', 'C) 3 and 4', 'D) 1 and 12'], correct: 'C',
    concept: 'Factorising a quadratic',
    solution: 'x² − 7x + 12 = (x−3)(x−4) = 0 ⇒ x = 3 or 4.' },
  { id: 'pq_ineq_1', sectionId: 'QA', topicId: 'qa_inequalities', topic: 'Inequalities & Modulus', difficulty: 'Easy',
    question: 'The number of integer values of x satisfying |x| < 4 is:',
    options: ['A) 8', 'B) 6', 'C) 9', 'D) 7'], correct: 'D',
    concept: 'Modulus inequality',
    solution: '|x| < 4 ⇒ −4 < x < 4 ⇒ x ∈ {−3,−2,−1,0,1,2,3} = 7 integers.' },
  { id: 'pq_ap_1', sectionId: 'QA', topicId: 'qa_progressions', topic: 'AP, GP & Special Series', difficulty: 'Easy',
    question: 'The sum of the first 20 natural numbers is:',
    options: ['A) 210', 'B) 200', 'C) 190', 'D) 420'], correct: 'A',
    concept: 'Sum of first n natural numbers',
    solution: 'Sum = n(n+1)/2 = 20×21/2 = 210.' },
  { id: 'pq_ap_2', sectionId: 'QA', topicId: 'qa_progressions', topic: 'AP, GP & Special Series', difficulty: 'Easy',
    question: 'In an AP with first term 5 and common difference 3, the 10th term is:',
    options: ['A) 35', 'B) 32', 'C) 30', 'D) 29'], correct: 'B',
    concept: 'nth term of an AP',
    solution: 'aₙ = a + (n−1)d = 5 + 9×3 = 32.' },

  // ── Geometry ──────────────────────────────────────────────────────────────────
  { id: 'pq_tri_1', sectionId: 'QA', topicId: 'qa_triangles', topic: 'Triangles & Properties', difficulty: 'Easy',
    question: 'The area of a triangle with sides 6 cm, 8 cm and 10 cm is:',
    options: ['A) 30 cm²', 'B) 40 cm²', 'C) 24 cm²', 'D) 48 cm²'], correct: 'C',
    concept: 'Right-angled triangle (6-8-10)',
    solution: '6² + 8² = 100 = 10² ⇒ right-angled. Area = ½ × 6 × 8 = 24 cm².' },
  { id: 'pq_cir_1', sectionId: 'QA', topicId: 'qa_circles', topic: 'Circles & Tangents', difficulty: 'Easy',
    question: 'The area of a circle is 154 cm². Its radius (take π = 22/7) is:',
    options: ['A) 7 cm', 'B) 14 cm', 'C) 11 cm', 'D) 3.5 cm'], correct: 'A',
    concept: 'Area of a circle',
    solution: 'πr² = 154 ⇒ r² = 154 × 7/22 = 49 ⇒ r = 7 cm.' },
  { id: 'pq_men_1', sectionId: 'QA', topicId: 'qa_mensuration', topic: 'Mensuration (2D & 3D)', difficulty: 'Easy',
    question: 'The volume of a cube is 216 cm³. Its total surface area is:',
    options: ['A) 144 cm²', 'B) 36 cm²', 'C) 72 cm²', 'D) 216 cm²'], correct: 'D',
    concept: 'Cube volume and surface area',
    solution: 'Side = ∛216 = 6 cm. TSA = 6 × side² = 6 × 36 = 216 cm².' },

  // ── Modern Math ───────────────────────────────────────────────────────────────
  { id: 'pq_pc_1', sectionId: 'QA', topicId: 'qa_pc', topic: 'Permutation & Combination', difficulty: 'Medium',
    question: 'The number of distinct arrangements of the letters of the word "LEADER" is:',
    options: ['A) 720', 'B) 360', 'C) 120', 'D) 180'], correct: 'B',
    concept: 'Permutations with repetition',
    solution: 'LEADER has 6 letters with E repeated twice ⇒ 6!/2! = 720/2 = 360.' },
  { id: 'pq_prob_1', sectionId: 'QA', topicId: 'qa_probability', topic: 'Probability', difficulty: 'Easy',
    question: 'A fair die is rolled once. The probability of getting a prime number is:',
    options: ['A) 1/3', 'B) 2/3', 'C) 1/2', 'D) 1/6'], correct: 'C',
    concept: 'Basic probability',
    solution: 'Primes on a die: 2, 3, 5 (three outcomes) ⇒ 3/6 = 1/2.' },
  { id: 'pq_set_1', sectionId: 'QA', topicId: 'qa_set_theory', topic: 'Set Theory', difficulty: 'Easy',
    question: 'In a group of 100 people, 60 like tea, 50 like coffee and 30 like both. How many like neither?',
    options: ['A) 20', 'B) 30', 'C) 10', 'D) 40'], correct: 'A',
    concept: 'Inclusion–exclusion',
    solution: 'Tea or coffee = 60 + 50 − 30 = 80 ⇒ neither = 100 − 80 = 20.' },
  { id: 'pq_log_1', sectionId: 'QA', topicId: 'qa_logs', topic: 'Logarithms & Surds', difficulty: 'Easy',
    question: 'If log₂ x = 5, then x equals:',
    options: ['A) 25', 'B) 10', 'C) 16', 'D) 32'], correct: 'D',
    concept: 'Definition of logarithm',
    solution: 'log₂ x = 5 ⇒ x = 2⁵ = 32.' },

  // ── Verbal (discrete) ─────────────────────────────────────────────────────────
  { id: 'pq_vocab_1', sectionId: 'VARC', topicId: 'vocab_synonyms', topic: 'Vocabulary — Synonyms/Antonyms', difficulty: 'Medium',
    question: 'Choose the word most nearly OPPOSITE in meaning to "GREGARIOUS":',
    options: ['A) sociable', 'B) reclusive', 'C) friendly', 'D) outgoing'], correct: 'B',
    concept: 'Antonyms',
    solution: 'Gregarious = sociable/fond of company. Its opposite is "reclusive" (withdrawn). The other options are synonyms.' },
  { id: 'pq_gram_1', sectionId: 'VARC', topicId: 'grammar_tenses', topic: 'Grammar — Tenses & Agreement', difficulty: 'Medium',
    question: 'Choose the correct option: "Neither the students nor the teacher ____ present."',
    options: ['A) was', 'B) were', 'C) are', 'D) have'], correct: 'A',
    concept: 'Neither…nor subject–verb agreement',
    solution: 'With "neither…nor", the verb agrees with the nearer subject ("teacher", singular) ⇒ "was".' },
]

export const getPYQSections = () => {
  const map = {}
  PYQ_BANK.forEach(q => { map[q.sectionId] = (map[q.sectionId] || 0) + 1 })
  return map
}

export const getPYQTopics = (sectionId = 'All') => {
  const seen = {}
  PYQ_BANK.filter(q => sectionId === 'All' || q.sectionId === sectionId).forEach(q => {
    if (!seen[q.topicId]) seen[q.topicId] = { topicId: q.topicId, topic: q.topic, sectionId: q.sectionId, count: 0 }
    seen[q.topicId].count++
  })
  return Object.values(seen)
}

export const getPYQByTopic = (topicId) => PYQ_BANK.filter(q => q.topicId === topicId)
