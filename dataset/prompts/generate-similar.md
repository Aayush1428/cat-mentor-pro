# Prompt: generate similar CAT questions from the dataset

Use this with any LLM (Groq / DeepSeek / NVIDIA / OpenAI …) to turn the dataset
into **new, original** CAT-style questions. The idea is few-shot prompting:
sample a few rows from `dataset/questions/*.jsonl` for the same `topicId`, drop
them in as `EXAMPLES`, and ask for fresh questions in the same style.

This mirrors how the app already generates "similar" questions at runtime in
`src/utils/captured.js` (`generateSimilarQuestions`), so anything you produce
here is drop-in compatible with the app's question schema.

---

## System prompt

```
You are a CAT (Common Admission Test) question writer with 10+ years of experience.
You create ORIGINAL practice questions in the STYLE of CAT (Quantitative Aptitude,
DILR, Verbal Ability & RC).

Rules:
- NEVER copy a question verbatim from any real exam or copyrighted source.
- NEVER claim a question is from a specific real CAT year or slot.
- Each question must be fully self-contained (embed any passage/data in the text).
- Exactly four options for MCQ (labelled "A) ", "B) ", "C) ", "D) "); exactly one correct.
- Match the difficulty, concept, and phrasing style of the EXAMPLES.
- Return ONLY valid JSON — no markdown, no preamble.
```

## User prompt (template)

```
Topic: {{topic}}  (topicId: {{topicId}}, section: {{sectionId}})
Difficulty spread: roughly one-third Easy, one-third Medium, one-third Hard.
Write {{count}} NEW original CAT-style questions on this topic, in the same
style as the EXAMPLES below but with different numbers, contexts and wording.

EXAMPLES (for style only — do not reproduce them):
{{examples_jsonl}}

Return ONLY a JSON array where each item is:
{
  "id": "gen_{{topicId}}_<n>",
  "sectionId": "{{sectionId}}",
  "topicId": "{{topicId}}",
  "topic": "{{topic}}",
  "difficulty": "Easy|Medium|Hard",
  "type": "MCQ",
  "question": "full self-contained question text",
  "options": ["A) ...","B) ...","C) ...","D) ..."],
  "correct": "A|B|C|D",
  "concept": "the single concept tested",
  "solution": "concise step-by-step solution",
  "source": "generated"
}
```

## Filling the template

- `{{examples_jsonl}}` — a handful (3–5) of lines from
  `dataset/questions/<section>.jsonl` whose `topicId` matches `{{topicId}}`.
- Keep the output schema identical to `dataset/schema.json` so generated
  questions can be validated with `npm run dataset:validate` and merged back in
  via `dataset/seed/`.

## Loop back into the dataset

1. Save the model's JSON array as `dataset/seed/<topic>-generated.jsonl`
   (one object per line).
2. Run `npm run dataset:build` to normalise + merge them.
3. Run `npm run dataset:validate` to catch any malformed rows.

## Fine-tuning note

For supervised fine-tuning, convert each row to your provider's chat format, e.g.:

```json
{"messages":[
  {"role":"system","content":"You are a CAT question writer. Return one JSON question."},
  {"role":"user","content":"Section: QA. Topic: Percentages. Difficulty: Medium."},
  {"role":"assistant","content":"{...the question row as JSON...}"}
]}
```
