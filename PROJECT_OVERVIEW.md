# CAT Mentor Pro — Complete Project Overview & Fine-Tuning Guide

A single reference for the entire app: what every file does, how data flows, and **exactly where to change each behavior**. Read the [Fine-Tuning Knobs](#9-fine-tuning-knobs-quick-reference) table first if you just want to tweak something.

---

## 1. What the app is

A personal, browser-based CAT (MBA entrance) exam-prep app. It generates unlimited CAT-style practice (Quant, VARC, DILR), tracks performance, and can **ground generation on your own previous-year/practice material** so new questions mirror real CAT papers. All practice content is produced by an LLM **at runtime** — there is no trained/offline ML model.

Key ideas:
- **No backend database.** All user data lives in the browser's `localStorage`.
- **AI calls go through thin serverless proxies** (`api/*.js`) that just forward your request + API key to Groq / DeepSeek / NVIDIA.
- **"Grounding"** = feeding real previous-year questions (the "corpus") into the generation prompt as style/difficulty anchors, while the model writes 100% original, copyright-safe questions.

---

## 2. Tech stack & commands

| | |
|---|---|
| Framework | React 18 + Vite 5 |
| Styling | Tailwind CSS (+ PostCSS, autoprefixer) |
| Charts | Recharts |
| Icons | lucide-react |
| Deploy | Vercel (auto-builds on `git push origin main`) |
| Dataset tools | Node ESM scripts; `pdfjs-dist` + `@napi-rs/canvas` (PDF render), `mammoth` + `jszip` (DOCX) |

```bash
npm install            # once
npm run dev            # local dev server (Vite, with /api proxy)
npm run build          # production build → dist/  (this is what Vercel runs)
npm run preview        # preview the production build
npm test               # node --test (planner unit tests)

# Dataset pipeline (see §7)
npm run dataset:extract    # PDFs/DOCX/images → structured JSONL (needs an API key)
npm run dataset:build      # JSONL + pyqBank → questions/*.jsonl + pyq_corpus.json
npm run dataset:validate   # schema-check the built questions
```

---

## 3. High-level architecture

- **No react-router.** [src/App.jsx](src/App.jsx) holds an `activeModule` state and a `switch()` that renders the matching module. The sidebar/topbar call `onNavigate(moduleId)`.
- **No server state.** Every module reads/writes `localStorage` directly through the `utils/` helpers.
- **One AI entry point.** Everything calls `callAI` / `chatAI` / `getCachedContent` in [src/utils/ai.js](src/utils/ai.js), which handles provider fallback, JSON parsing, and caching.
- **Deterministic "daily" content.** Daily sets are seeded by the calendar day so they're stable within a day and rotate automatically.

```
Browser ── React modules ── utils/ai.js ──HTTP──> /api/{groq,deepseek,nvidia}.js ──> LLM provider
                │                                         (Vercel serverless / Vite dev proxy)
                └── localStorage (performance, review, settings, caches, SRS, …)

Grounding:  dataset/sources/** ──extract──> *.extracted.jsonl ──build──> public/dataset/pyq_corpus.json
                                                                              │
                                                 utils/pyq.js fetches it at runtime → anchors into prompts
```

---

## 4. Directory map (every file)

### Root
| Path | Purpose |
|---|---|
| [index.html](index.html) | Vite HTML entry |
| [vite.config.js](vite.config.js) | Build config + **dev/preview `/api` proxy** to Groq/DeepSeek/NVIDIA |
| [tailwind.config.js](tailwind.config.js) / [postcss.config.js](postcss.config.js) | Styling config |
| [vercel.json](vercel.json) | Vercel build/output + SPA routing |
| [package.json](package.json) | Scripts + dependencies |

### `api/` — serverless proxies (run on Vercel; mirrored by Vite dev proxy)
| File | Forwards to |
|---|---|
| [api/groq.js](api/groq.js) | Groq OpenAI-compatible chat/completions |
| [api/deepseek.js](api/deepseek.js) | DeepSeek chat/completions |
| [api/nvidia.js](api/nvidia.js) | NVIDIA `integrate.api.nvidia.com` (hardened: handles non-JSON bodies) |
| [api/news.js](api/news.js) | News provider proxy |

### `src/` — entry
| File | Purpose |
|---|---|
| [src/main.jsx](src/main.jsx) | React root mount |
| [src/App.jsx](src/App.jsx) | Module router (`activeModule` switch), study-time/streak tracking, "no API key" banner |
| [src/index.css](src/index.css) | Tailwind layers + global styles |

### `src/modules/` — one screen each (route id in parentheses)
| Module | Route | What it does |
|---|---|---|
| [Dashboard.jsx](src/modules/Dashboard.jsx) | `dashboard` | Home: streak, study time, quick stats, Question of the Day |
| [StudyPlanner.jsx](src/modules/StudyPlanner.jsx) | `planner` | Readiness + priority-focus plan from performance |
| [Analysis.jsx](src/modules/Analysis.jsx) | `analysis` | Accuracy/speed charts, improvement focus, mistake breakdown |
| [VARC.jsx](src/modules/VARC.jsx) | `varc` | RC, Daily RC, Para Jumbles, Para Summary, **Odd One Out, Sentence Insertion**, Grammar — all PYQ-groundable |
| [RCTrainer.jsx](src/modules/RCTrainer.jsx) | `rc_trainer` | Daily-5 RC coach (bilingual Hinglish), Decode tab, Playbook, history |
| [DILR.jsx](src/modules/DILR.jsx) | `dilr` | Daily-5 LR/DI sets (grounded) + topic practice + AI-Tutor-minted new types |
| [Quant.jsx](src/modules/Quant.jsx) | `quant` | Today's Practice (daily-5), per-topic generate, "From Papers & My Practice", composer |
| [MBAPathshala.jsx](src/modules/MBAPathshala.jsx) | `mba_pathshala` | Daily practice + image board from MBA Pathshala content |
| [NewsHub.jsx](src/modules/NewsHub.jsx) | `news` | Daily current-affairs + reading feeds |
| [Vocabulary.jsx](src/modules/Vocabulary.jsx) | `vocabulary` | Word of day + SRS deck |
| [PreviousPapers.jsx](src/modules/PreviousPapers.jsx) | `pyq` / `pyq_topics` | PYQ bank browser + per-topic sessions (bank, captured, dynamic topics) |
| [MockTest.jsx](src/modules/MockTest.jsx) | `mock` | Timed full mock; saves scores to history |
| [Revision.jsx](src/modules/Revision.jsx) | `revision` | Error-log review (SRS-style), mistake tagging, export to dataset |
| [AITutor.jsx](src/modules/AITutor.jsx) | `tutor` | Chat tutor w/ image/file upload (vision), markdown answers, auto-learn |
| [Settings.jsx](src/modules/Settings.jsx) | `settings` | API keys, preferred provider, connection tests, backup/restore, cache clear |

### `src/utils/` — logic (all exports listed)
| File | Key exports / role |
|---|---|
| [ai.js](src/utils/ai.js) | `callAI` (JSON), `chatAI` (chat/vision), `getCachedContent`, `parseJSON`, `visionAvailable`, `clearCache`, provider test fns. **Provider config lives here.** |
| [performance.js](src/utils/performance.js) | `recordAttempt`, `getTopicStats`, `getAccuracy`, `getAvgTime`, `getOverallStats`, `getImprovementInsights`, daily history, mock history, study time |
| [bookmarks.js](src/utils/bookmarks.js) | Error/review log (`cat_review`): `logResult`, `ERROR_TYPES`, `setErrorType`, `getReviewItems`, `getMistakeBreakdown`, `exportReviewAsDataset` |
| [pyq.js](src/utils/pyq.js) | **Grounding:** `loadPYQCorpus`, `pyqAnchorsForTopic(s)`, `pyqAnchorsForSection`, `pyqAnchorsTopicThenSection`, `formatAnchors`, `resolveModeledRef` |
| [dailyPlan.js](src/utils/dailyPlan.js) | **Daily planner:** `classifyTopics`, `getNeedsPractice`, `needScore`, `rankByNeed`, `buildDailyComposition`, `ROLES` |
| [similarity.js](src/utils/similarity.js) | **De-dup:** `filterNovel`, `isDuplicate`, `rememberGenerated`, `cosine`, `DEFAULT_THRESHOLD` (lexical n-gram, not neural) |
| [captured.js](src/utils/captured.js) | AI-Tutor learning: `classifyAndCapture`, `generateSimilarQuestions`, `classifyAndGenerateFromInput`, dynamic topics |
| [srs.js](src/utils/srs.js) | Leitner vocab deck (`cat_srs`): `addCard`, `reviewCard`, `getDueCards` |
| [news.js](src/utils/news.js) | News/reading feeds, daily brief, word explain |
| [backup.js](src/utils/backup.js) | Export/import all `cat_*` keys |
| [image.js](src/utils/image.js) | `downscaleImage` (canvas → JPEG under size cap for vision) |

### `src/data/` — static datasets & the prompt contract
| File | Role |
|---|---|
| [curriculum.js](src/data/curriculum.js) | **Source of truth** for sections/topics (`SECTIONS` = VARC/DILR/QA with id, name, priority, weight, tags), `getAllTopics()`, `PREVIOUS_PAPERS` |
| [promptContract.js](src/data/promptContract.js) | **Shared generation rules** `CAT_CORE` + `SECTION_RULES` + `catSystem(sectionId, extra)` used by every generator |
| [pyqBank.js](src/data/pyqBank.js) | 28 verified CAT-level questions (offline fallback) |
| [pyqOfficial.js](src/data/pyqOfficial.js) | Official-PYQ metadata + localStorage merge |
| [mbaPathshala.js](src/data/mbaPathshala.js) | `MBA_TOPICS` (14) + image-folder mapping |
| [vocabSeed.js](src/data/vocabSeed.js) | ~88 seed vocabulary words |

### `src/components/`
| File | Role |
|---|---|
| [ui/index.jsx](src/components/ui/index.jsx) | Primitives: `Card`, `Badge`, `SectionHeader`, `CardSkeleton`, `ProgressBar`, `ScoreRing`, `BookmarkButton`, `showToast`/`ToastContainer` |
| [layout/Sidebar.jsx](src/components/layout/Sidebar.jsx) | Nav list (module order/labels) |
| [layout/TopBar.jsx](src/components/layout/TopBar.jsx) | Title + provider label + study timer |
| [layout/Layout.jsx](src/components/layout/Layout.jsx) | Shell |
| [Markdown.jsx](src/components/Markdown.jsx) | Dependency-free, XSS-safe markdown renderer (tables/steps) for tutor answers |
| [LearnPanel.jsx](src/components/LearnPanel.jsx) | Cached concept primer per topic |
| [QuestionComposer.jsx](src/components/QuestionComposer.jsx) | Paste a question (text/photo) → get similar questions |

### `dataset/` — offline corpus pipeline (see §7)
| Path | Role |
|---|---|
| [dataset/scripts/build.mjs](dataset/scripts/build.mjs) | Aggregates sources + pyqBank → `questions/*.jsonl` + **`public/dataset/pyq_corpus.json`** |
| [dataset/scripts/extract.mjs](dataset/scripts/extract.mjs) | Vision-LLM extractor: PDF/DOCX/image → schema JSONL |
| [dataset/scripts/validate.mjs](dataset/scripts/validate.mjs) | Dependency-free schema validator |
| [dataset/scripts/lib/resolve.mjs](dataset/scripts/lib/resolve.mjs) | Folder/topic-name → `{sectionId, topicId}` resolver (**aliases live here**) |
| [dataset/schema.json](dataset/schema.json) | One-question JSON Schema |
| [dataset/prompts/](dataset/prompts/) | Master prompt + daily prompt + per-section output schemas |
| `dataset/sources/{previous-year,practice,mba-pathshala}/<section>/<topic>/` | **Where you drop raw material** (organized by folder) |
| `dataset/questions/*.jsonl`, `dataset/manifest.json` | Build outputs (regenerate, don't hand-edit) |

### `public/`
| Path | Role |
|---|---|
| [public/dataset/pyq_corpus.json](public/dataset/pyq_corpus.json) | **The runtime grounding corpus** the app fetches (`byTopic["SEC:topicId"]`) |
| `public/mba-pathshala/` | MBA Pathshala image frames + manifest |

---

## 5. Module data flow (how a question is made)

1. A module builds a **user prompt** (topic, difficulty, count, optional anchors).
2. It optionally fetches **anchors** via `utils/pyq.js` from `pyq_corpus.json`.
3. It calls `callAI(SYSTEM, userPrompt, maxTokens)` where `SYSTEM = catSystem(sectionId)`.
4. `ai.js` tries providers in order (preferred first), each with its candidate model(s), parses JSON, returns it.
5. Array generators pass results through `filterNovel()` (de-dup) before display.
6. On submit, `recordAttempt()` (analytics) + `logResult()` (review log) are called.

**Daily sets** additionally cache per-day via `getCachedContent(key, …)` and persist answers under a `cat_*_<date>` key.

---

## 6. AI layer (providers & models) — [src/utils/ai.js](src/utils/ai.js)

- **Providers:** `['groq', 'deepseek', 'nvidia']`. Order = your preferred provider first, then the rest as fallback. Keys stored in `cat_settings` (localStorage only — never hardcoded).
- **Text models:**
  - groq → `openai/gpt-oss-120b` (a reasoning model; `reasoning_effort: 'low'` is set so reasoning tokens don't eat the output budget)
  - deepseek → `deepseek-chat`
  - nvidia → tries `llama-3.1-nemotron-70b` → `-51b` → `mistral-large-2` → `gemma-3-12b` (NVIDIA retires/gates models often)
- **Vision models (image reading):** groq `llama-4-scout`→`maverick`; nvidia `llama-3.2-90b`→`11b-vision`. DeepSeek has no vision.
- **Temperature:** `0.2` (low, for consistent/parseable output).
- **Endpoints:** `/api/groq`, `/api/deepseek`, `/api/nvidia` → proxied to the real APIs.

---

## 7. Dataset / grounding pipeline (the key to "no hallucination")

**Goal:** make generated RC/DI/LR/QA questions mirror *your* real previous-year & practice material.

```
dataset/sources/<provenance>/<section>/<topic>/<file>
   provenance: previous-year | practice | mba-pathshala | needs_practice
   file:  .jsonl/.json (structured, read directly)   OR   .pdf/.docx/.png (need extraction)

  (A) .pdf/.docx/.png  --(dataset:extract, vision LLM, YOUR API KEY)-->  <file>.extracted.jsonl
  (B) .jsonl/.json already structured                                     (skip extraction)

        │  npm run dataset:build
        ▼
  dataset/questions/{qa,varc,dilr,all}.jsonl   (full corpus, all provenances)
  public/dataset/pyq_corpus.json               (grounding anchors: source in {pyq, practice, needs_practice},
                                                 grouped byTopic "SEC:topicId", ≤8 per topic)
        │  git push → Vercel serves it
        ▼
  utils/pyq.js fetches /dataset/pyq_corpus.json → anchors → into generation prompts
```

Rules that keep it correct:
- **Folder names infer section + topic** via [resolve.mjs](dataset/scripts/lib/resolve.mjs) (aliases map "Averages and Mixtures" → `qa_averages`, "reading-comprehension" → `rc_main_idea`, etc.). Explicit `sectionId`/`topicId` in a record always win. A record's own `topic` **name** is also resolved.
- **Provenance tag** comes from the top folder (`previous-year`→`pyq`, `practice`→`practice`). Only `pyq`/`practice`/`needs_practice` reach the grounding corpus (pyqBank/seed are CAT-*level*, not real papers, so excluded from "previous year").
- **Vercel does NOT run the dataset scripts.** `pyq_corpus.json` must be **committed**; it only changes when you run `dataset:build` locally and push.
- **Copyright-safe:** generators are told to *calibrate* on anchors but write 100% original content — never copy a passage/set.

> ⚠️ After adding/removing anything under `dataset/sources/`, run `npm run dataset:build` (and `dataset:extract` first for PDFs/DOCX/images) or the app's grounding stays stale.

Current `jsonl_topics/` QA files are already structured (no extraction). VARC/LRDI are PDFs → run `dataset:extract --dir dataset/sources/previous-year/varc` (and `.../lrdi`) with your key.

---

## 8. localStorage keys (complete)

| Key | Written by | Holds |
|---|---|---|
| `cat_settings` | Settings | API keys, `preferredProvider` |
| `cat_performance` | performance.js | per-section/topic attempts, correct, time |
| `cat_review` | bookmarks.js | error/flag log (powers Revision) |
| `cat_daily` | performance.js | daily accuracy history |
| `cat_mock_history` | performance.js | saved mock scores |
| `cat_streak`, `cat_last_study`, `cat_time_<date>` | App/performance | streak & study time |
| `cat_srs` | srs.js | Leitner vocab deck |
| `cat_captured`, `cat_dyn_topics` | captured.js | AI-Tutor-learned questions + minted topics |
| `cat_gen_history` | similarity.js | generated-question fingerprints (de-dup) |
| `cat_qa5_<day>`, `cat_dilr5_<day>`, `cat_rc5_<day>` | Quant/DILR/RCTrainer | daily-5 answers |
| `cat_rc_history`, `cat_rc_playbook` | RCTrainer | passage history + tips playbook |
| `cat_cache_*` | ai.js `getCachedContent` | cached generated content (daily items, primers, etc.) |
| `cat_news_*`, `cat_news_read`, `cat_brief_*` | news.js/NewsHub | news feeds & reads |
| `cat_official_pyq` | pyqOfficial.js | user-added official PYQ metadata |

Backup/restore (Settings) exports every `cat_*` key (cache optional).

---

## 9. Fine-Tuning Knobs (quick reference)

| I want to change… | Edit this |
|---|---|
| **Question quality / anti-hallucination rules** (solve-first, validate, originality) | `CAT_CORE` in [src/data/promptContract.js](src/data/promptContract.js) — applies to QA + DILR + VARC |
| Section-specific output rules (QA/DILR/VARC) | `SECTION_RULES` in [src/data/promptContract.js](src/data/promptContract.js) |
| A specific generator's prompt (wording, count, difficulty, JSON shape) | the `build*Prompt` fn in that module ([Quant.jsx](src/modules/Quant.jsx), [VARC.jsx](src/modules/VARC.jsx), [DILR.jsx](src/modules/DILR.jsx), [RCTrainer.jsx](src/modules/RCTrainer.jsx)) |
| **Which AI model / provider order / temperature** | `PROVIDER_MODEL`, `PROVIDER_TEXT_MODELS`, `PROVIDER_VISION_MODELS`, `temperature` in [src/utils/ai.js](src/utils/ai.js) |
| Output length (truncation vs cost) | the `maxTokens` arg at each `callAI`/`getCachedContent` call site |
| **Add/rename/re-prioritize a topic** | `SECTIONS` in [src/data/curriculum.js](src/data/curriculum.js) (UI, analytics, grounding keys all follow) |
| **Daily-5 selection logic** (what's weak/stale/slow, weighting) | [src/utils/dailyPlan.js](src/utils/dailyPlan.js) (`needScore`, `classifyTopics`, `buildDailyComposition`) |
| **Duplicate-question strictness** | `DEFAULT_THRESHOLD` in [src/utils/similarity.js](src/utils/similarity.js) (higher = stricter) |
| **Grounding: how many anchors / topic-vs-section mix** | `max`/helpers in [src/utils/pyq.js](src/utils/pyq.js); per-call anchor fetch in each module |
| Map a source folder/topic name to a curriculum topic | `TOPIC_ALIASES` / `SECTION_ALIASES` in [dataset/scripts/lib/resolve.mjs](dataset/scripts/lib/resolve.mjs) |
| Anchors per topic in the corpus / which provenances count | the publish step in [dataset/scripts/build.mjs](dataset/scripts/build.mjs) |
| Extraction behavior (what the vision model is asked for) | `promptFor` / `docxPromptFor` in [dataset/scripts/extract.mjs](dataset/scripts/extract.mjs) |
| Nav order / labels / icons | [src/components/layout/Sidebar.jsx](src/components/layout/Sidebar.jsx) + the `switch` in [src/App.jsx](src/App.jsx) |
| Mistake categories | `ERROR_TYPES` in [src/utils/bookmarks.js](src/utils/bookmarks.js) |
| Vocab seed words | [src/data/vocabSeed.js](src/data/vocabSeed.js) |
| SRS interval boxes | [src/utils/srs.js](src/utils/srs.js) |

### Safe tuning workflow
1. Edit a knob above.
2. `npm run dev` and test the affected screen (clear the relevant `cat_cache_*` key if a daily item is cached).
3. If you touched `dataset/sources/**` or the scripts: `npm run dataset:build && npm run dataset:validate`.
4. `npm run build` to confirm it compiles.
5. `git commit` + `git push origin main` → Vercel redeploys.

---

## 10. Gotchas worth knowing

- **gpt-oss-120b counts reasoning tokens against `max_tokens`** → keep system prompts tight and give enough `maxTokens`, or JSON truncates. This is why `promptContract` is deliberately short.
- **Vercel runs only `npm run build`** — not the dataset scripts. Commit `public/dataset/pyq_corpus.json`.
- **Vite dev proxy ≠ preview proxy** — both are set in [vite.config.js](vite.config.js); changing it needs a dev-server restart.
- **Provider models change** — if a connection test fails with "model unavailable", re-check live models (`curl .../v1/models -H "Authorization: Bearer <key>"`) and update the maps in [ai.js](src/utils/ai.js).
- **Everything degrades gracefully** — empty corpus → ungrounded (still works); no API key → routes to Settings.
