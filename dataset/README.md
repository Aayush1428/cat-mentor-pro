# CAT Question Dataset

A machine-friendly dataset of CAT practice questions, built to **seed / few-shot
LLMs and ML models so they can generate more similar questions** — and to serve
as a corpus if you later want to fine-tune a model.

It is generated from the app's own verified questions
([`src/data/pyqBank.js`](../src/data/pyqBank.js)) plus anything you add under
[`seed/`](seed/), and it uses the **same question schema the app already uses**,
so generated questions drop straight back into the app.

## Layout

```
dataset/
├── README.md                 ← this file
├── schema.json               ← JSON Schema for one question record
├── manifest.json             ← generated: counts by section / topic / difficulty / source
├── questions/                ← generated JSONL (one JSON object per line)
│   ├── qa.jsonl
│   ├── varc.jsonl
│   ├── dilr.jsonl
│   └── all.jsonl
├── sources/                  ← YOUR questions, organised by folder (section/topic)
│   ├── previous-year/        ←   source tag "pyq"
│   ├── practice/             ←   source tag "practice"
│   ├── needs_practice/       ←   source tag "needs_practice" (exported from the app's Revision screen)
│   └── mba-pathshala/        ←   source tag "mba" (filled by the extractor)
├── seed/                     ← loose extra questions (.jsonl) merged into the build
├── prompts/
│   └── generate-similar.md   ← ready-to-use LLM prompt for making new questions
└── scripts/
    ├── build.mjs             ← build questions/*.jsonl + manifest.json
    ├── validate.mjs          ← validate every row against schema.json
    ├── extract.mjs           ← vision-LLM: images/screenshots/PDFs → questions
    └── lib/resolve.mjs       ← infer section/topic from folder names
```

> `questions/*.jsonl` and `manifest.json` are build outputs — regenerate them
> with the build script rather than editing by hand.

`npm run dataset:build` also writes `public/dataset/pyq_corpus.json` — a curated,
topic-grouped subset of everything tagged `source: "pyq"` (real previous-year
questions extracted from `sources/previous-year/`, via `dataset:extract`). The
app's Quant module fetches this at runtime to ground its "Generate 5 — Previous-
Year Style" mode and cite which past question each new one was modeled on via
the `reference` field. It starts out empty until you extract at least one PDF.

### Questions I got wrong (`sources/needs_practice/`)

In the app, Revision → "Export to dataset/needs_practice" downloads a `.jsonl` of
your wrong/flagged questions (schema-shaped, topic already resolved from what you
practiced). Drop the file into `sources/needs_practice/` and re-run
`npm run dataset:build` to fold it into the versioned dataset.

## Record schema

Each line in `questions/*.jsonl` is one question (see [`schema.json`](schema.json)):

```json
{
  "id": "pq_pct_1",
  "sectionId": "QA",
  "section": "Quantitative Aptitude",
  "topicId": "qa_percentages",
  "topic": "Percentages",
  "tags": ["Arithmetic"],
  "difficulty": "Easy",
  "type": "MCQ",
  "question": "The price of an article is increased by 25%. By what percent must the new price be decreased to bring it back to the original price?",
  "options": ["A) 25%", "B) 18.75%", "C) 20%", "D) 15%"],
  "correct": "C",
  "concept": "Successive percentage change",
  "solution": "New price = 1.25×original. Required decrease = 0.25/1.25 = 1/5 = 20%.",
  "source": "pyqBank"
}
```

`topicId` matches the curriculum in [`src/data/curriculum.js`](../src/data/curriculum.js),
so the dataset stays aligned with the app's analytics and topic browser.

## Build & validate

```bash
npm run dataset:build      # writes questions/*.jsonl + manifest.json
npm run dataset:validate   # checks every row against the schema
```

(or run directly: `node dataset/scripts/build.mjs`)

## Bring your own questions (folders + images)

Put your material under [`sources/`](sources/), organised by folder — the build
**infers the section and topic from the folder names**, so you don't repeat
metadata in every record:

```
sources/previous-year/quantitative-aptitude/percentages/…
sources/practice/varc/fill-in-the-blanks/…
sources/practice/lrdi/di/pie-chart/…
```

- **Section folder** → `quantitative-aptitude`/`quant`/`qa`, `varc`/`verbal`,
  `lrdi`/`dilr`/`di`/`lr`.
- **Topic folder(s)** → e.g. `percentages`, `rc`, `para-jumbles`, `di/pie-chart`,
  `lr/seating`. Common names map to curriculum topic ids; anything else still
  lands in the right section with a free-form topic label.
- Files can be `.jsonl` or `.json` (an array). `id`/`sectionId`/`topicId` are
  optional — inferred/generated. Explicit fields always win.

### Images, PDFs, screenshots & Word docs (and MBA Pathshala)

Mostly have PDFs/screenshots/Word docs? Drop the **images, PDFs or `.docx` files**
into the same topic folders and let a vision LLM transcribe them into `.jsonl`:

```bash
npm run dataset:extract -- --dry-run          # preview: what maps to which section/topic (no API)
GROQ_API_KEY=...  npm run dataset:extract      # or NVIDIA_API_KEY=...
GROQ_API_KEY=...  npm run dataset:extract:mba  # transcribe public/mba-pathshala/ images
```

- Reads `.png/.jpg/.jpeg/.webp` directly, `.pdf` (each page is rasterized
  in-process — no poppler/ghostscript needed — then sent page-by-page; use
  `--max-pages`/`--scale` to tune), and `.docx` (typed practice docs — text is
  read via mammoth, and any pasted data-table image is sent alongside; long docs
  are auto-split into chunks). A scenario PDF/doc with a shared table/image +
  4-5 questions still works: the shared context is embedded in each question's text.
- The API key is read from the environment only, never written to disk
  (deepseek has no vision model — use Groq or NVIDIA).
- `--mba` maps each image's folder slug to its QA topic via
  [`src/data/mbaPathshala.js`](../src/data/mbaPathshala.js) and writes to
  `sources/mba-pathshala/<slug>/…`.
- Re-run safely: files already extracted are skipped (use `--force` to redo).

After extracting, run `npm run dataset:build && npm run dataset:validate`. The
build also refreshes `public/dataset/pyq_corpus.json`, which the app fetches to
**ground its generation** — previous-year *and* your own practice material feed
the Quant "From Papers & My Practice" button, the DILR Daily 5, and the RC
Trainer's daily passages.

## Generate more similar questions

Two ways to use this dataset to produce new questions:

1. **Few-shot prompting (works today).** Sample a few rows for a `topicId` from
   `questions/*.jsonl`, paste them as examples, and ask an LLM for fresh ones.
   The ready-made prompt is in [`prompts/generate-similar.md`](prompts/generate-similar.md).
   This is the same approach the app uses at runtime in
   [`src/utils/captured.js`](../src/utils/captured.js) (`generateSimilarQuestions`).

2. **Fine-tuning corpus.** Convert rows to your provider's chat/JSONL format and
   fine-tune a smaller model to emit questions in this schema. See the
   fine-tuning note at the end of `prompts/generate-similar.md`.

### Grow the dataset

```
Add questions to sources/ (or images → extract)  →  npm run dataset:build  →  npm run dataset:validate
```

Organise questions by folder under [`sources/`](sources/) (section/topic).
Loose one-off files can also go in [`seed/`](seed/). The build merges and
de-duplicates everything (verified `pyqBank` rows win on `id` collisions).

## Provenance & copyright

These are original CAT-**style** questions, not verbatim copies of copyrighted
past papers. Keep it that way: when generating, never reproduce real exam text or
attribute questions to a specific CAT year/slot. Verified real past papers live
behind the external links in the app's Previous Papers screen.
