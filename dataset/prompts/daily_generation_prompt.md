# Daily generation prompt

Pair this short user prompt with the system contract in
[`CAT_SYSTEM_PROMPT.md`](CAT_SYSTEM_PROMPT.md). The system prompt already carries every
rule (originality, CAT style, difficulty, validation, answer policy, section rules), so the
everyday ask can stay tiny.

In the web app this is exactly what the runtime modules do: they build the system prompt
from [`src/data/promptContract.js`](../../src/data/promptContract.js) (which mirrors the
contract) and send a short, section-specific user prompt with the day's anchors and the
student's weak areas already filled in.

---

## Full daily set

```
Generate today's CAT practice set.

QA:   10 questions
LRDI: 5 complete sets
VARC: 5 RC passages

Difficulty: CAT level — a mix of Medium, Medium-Hard and Hard.

Use:
- CAT PYQs as the primary style/pattern reference
- my practice material for additional patterns
- my performance history for personalisation

Prioritise my weak and under-practiced areas, but keep topic diversity.
Do not repeat questions or create near-duplicates of recently generated ones.
Do not show answers or solutions in the student view.
Return JSON matching the section schema so my app can store and evaluate it later.
```

## Per-section quick asks

**QA — 5 a day, personalised mix:**

```
Generate 5 QA questions: 2 weak-area, 1 revision, 1 new/under-practiced, 1 mixed CAT-style.
Weak areas: {{weak_topics}}.  Anchors: {{pyq_anchors}}.
Return a JSON array per schemas/qa.schema.json.
```

**LRDI — 5 sets a day:**

```
Generate 5 LRDI sets: 2 weak set-types, 1 recently-practiced type, 1 new type, 1 PYQ-inspired mixed.
Weak set-types: {{weak_types}}.  Anchors: {{pyq_anchors}}.
Each set = scenario + data + conditions + 3-4 questions.
Return JSON per schemas/lrdi.schema.json.
```

**VARC — 5 RC passages a day:**

```
Generate 5 RC passages: 2 weak question-types, 1 weak/under-practiced genre, 1 new genre, 1 mixed CAT-style.
Weak question-types: {{weak_rc_types}}.  Genres to vary: {{genres}}.  Anchors: {{pyq_anchors}}.
Each passage 500-750 words + 4 CAT-style questions.
Return JSON per schemas/varc.schema.json.
```

## Recommended daily mix

The app's daily generators already follow this balance; keep it if you run generation
manually:

| Section | Count | Composition |
| --- | --- | --- |
| QA | 5 | 2 weak · 1 revision · 1 new/under-practiced · 1 mixed |
| QA | 10 | 3 weak · 3 recent concepts · 2 new · 2 mixed revision |
| LRDI | 5 sets | 2 weak set-types · 1 recent · 1 new · 1 PYQ-inspired |
| VARC | 5 RC | 2 weak question-types · 1 weak genre · 1 new genre · 1 mixed |

The template placeholders (`{{weak_topics}}`, `{{pyq_anchors}}`, …) are filled from the
app's performance store and the published anchor corpus (`public/dataset/pyq_corpus.json`).
