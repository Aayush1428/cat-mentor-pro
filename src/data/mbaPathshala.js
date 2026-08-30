// MBA Pathshala Questions — topic metadata for the Quant practice module.
//
// Each topic maps to a folder of compressed lecture-board images under
// public/mba-pathshala/<slug>/ (see scripts/extract_mba_images.py + manifest.json)
// and to an existing QA curriculum topic name so daily-practice attempts feed the
// same analytics as the main Quant module.
//
// `profile` is the per-topic sub-type list the AI is grounded on when it generates
// the daily 10 questions — this is what keeps generated questions "similar in type"
// to the MBA Pathshala set for that topic.

export const MBA_TOPICS = [
  // ---- Arithmetic ----
  {
    slug: 'percentages', name: 'Percentages', qaTopic: 'Percentages', tag: 'Arithmetic', priority: 1,
    profile: 'Percentage change & successive change; percentage↔fraction conversions; income–expenditure–savings; exam marks & passing %; "x% more/less than"; product-constancy (price up x% → how much less to buy); population/price increase–decrease.',
  },
  {
    slug: 'profit-loss-discount', name: 'Profit, Loss & Discount', qaTopic: 'Profit, Loss & Discount', tag: 'Arithmetic', priority: 1,
    profile: 'CP/SP & profit%; marked price with successive discounts; discount vs markup; dishonest shopkeeper / false weights; profit% on cost vs on SP; buy-x-get-y offers; multiple articles & break-even.',
  },
  {
    slug: 'ratio-proportion', name: 'Ratio & Proportion', qaTopic: 'Ratio & Proportion', tag: 'Arithmetic', priority: 1,
    profile: 'Simple & compound ratio; dividing an amount in a ratio; ratio of ages; mean/third/fourth proportional; direct/inverse/joint variation; coins & partnership ratios.',
  },
  {
    slug: 'averages', name: 'Averages', qaTopic: 'Averages & Mixtures', tag: 'Arithmetic', priority: 1,
    profile: 'Simple average; change on adding/removing/replacing an element; weighted average; average of consecutive numbers / an AP; average speed vs average of speeds; age problems.',
  },
  {
    slug: 'mixtures-alligations', name: 'Mixtures & Alligations', qaTopic: 'Averages & Mixtures', tag: 'Arithmetic', priority: 1,
    profile: 'Alligation rule for two/more ingredients; mean price; repeated removal & replacement formula; milk–water mixing; blending solutions of different concentrations; profit by mixing.',
  },
  {
    slug: 'time-speed-distance', name: 'Time, Speed & Distance', qaTopic: 'Time, Speed & Distance', tag: 'Arithmetic', priority: 1,
    profile: 'Basic speed–distance–time; average speed; relative speed (same/opposite direction); trains crossing pole/platform/each other; boats & streams; races & circular tracks; meeting points.',
  },
  {
    slug: 'time-work', name: 'Time & Work', qaTopic: 'Time & Work / Pipes & Cisterns', tag: 'Arithmetic', priority: 1,
    profile: 'Individual vs combined work rate; men-days-hours (M·D·H); pipes & cisterns (inlet/outlet); efficiency ratios; alternate-day working; wages shared by work done; joining/leaving midway.',
  },
  {
    slug: 'simple-interest', name: 'Simple Interest', qaTopic: 'Simple & Compound Interest', tag: 'Arithmetic', priority: 2,
    profile: 'SI formula; finding P/R/T; interest across different periods; installments; sum doubling/tripling in SI; comparing two investments; rate varying year-wise.',
  },
  {
    slug: 'compound-interest', name: 'Compound Interest', qaTopic: 'Simple & Compound Interest', tag: 'Arithmetic', priority: 2,
    profile: 'CI formula with annual/half-yearly/quarterly compounding; CI–SI difference for 2 & 3 years; population growth/decay; equal installments to repay a loan; effective annual rate.',
  },
  // ---- Algebra ----
  {
    slug: 'linear-equations', name: 'Linear Equations', qaTopic: 'Linear & Quadratic Equations', tag: 'Algebra', priority: 1,
    profile: 'One & two-variable linear equations; word problems (ages, coins, digits); consistency of a system; integer/positive solutions; systems with a parameter; cost–revenue break-even.',
  },
  {
    slug: 'quadratic-equations', name: 'Quadratic Equations', qaTopic: 'Linear & Quadratic Equations', tag: 'Algebra', priority: 1,
    profile: 'Roots by factorisation/formula; nature of roots (discriminant); sum & product of roots; forming an equation from roots; maxima/minima of a quadratic; word problems reducing to quadratics.',
  },
  {
    slug: 'ap-gp', name: 'AP & GP', qaTopic: 'AP, GP & Special Series', tag: 'Algebra', priority: 2,
    profile: 'nth term & sum of an AP; arithmetic means; GP nth term & sum (finite & infinite); geometric means; mixed AP–GP; sum of special series (squares/cubes); sequence word problems.',
  },
  // ---- Modern / Number-based ----
  {
    slug: 'surds-indices', name: 'Surds & Indices', qaTopic: 'Logarithms & Surds', tag: 'Modern', priority: 2,
    profile: 'Laws of indices; simplifying surds; rationalisation; comparing surds; nested/continued radicals; solving index equations; surd-based word problems.',
  },
  {
    slug: 'logarithms', name: 'Logarithms', qaTopic: 'Logarithms & Surds', tag: 'Modern', priority: 3,
    profile: 'Log laws (product/quotient/power); change of base; characteristic & mantissa; solving log equations & inequalities; number of digits in a power; comparing logarithms.',
  },
]

export const MBA_TAG_ORDER = ['Arithmetic', 'Algebra', 'Modern']

export const getMBATopic = (slug) => MBA_TOPICS.find(t => t.slug === slug)
