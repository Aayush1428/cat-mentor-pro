# dataset/sources/

Your own questions, organised by **folder**. The build reads every `.jsonl` and
`.json` file here and **infers the section and topic from the folder names**, so
you don't have to repeat metadata in each record.

## Convention

```
sources/
  previous-year/                 ← provenance tag: "pyq"
    <section>/<topic>/...        ← files here
  practice/                      ← provenance tag: "practice"
    <section>/<topic>/...
  mba-pathshala/                 ← provenance tag: "mba" (filled by the extractor)
    <topic>/...
```

- **Section folder** — name it so it maps to a CAT section:
  - QA → `quantitative-aptitude` (or `quant`, `qa`)
  - VARC → `varc` (or `verbal`)
  - DILR → `lrdi` (or `dilr`, `di`, `lr`)
- **Topic folder(s)** — e.g. `percentages`, `time-speed-distance`, `rc`,
  `para-jumbles`, `fill-in-the-blanks`, `di/pie-chart`, `di/tables`, `lr/seating`.
  Common names are mapped to curriculum topic ids automatically; anything
  unrecognised still lands in the right **section** with a free-form topic label.

## What you can put here

1. **Structured questions** — `.jsonl` (one JSON object per line) or `.json`
   (an array). You can omit `sectionId`/`topicId`/`id` — they're inferred from the
   path and auto-generated. Explicit fields, if present, always win. See
   [`../schema.json`](../schema.json) and the `example.jsonl` files in this tree.

2. **Images / screenshots** (`.png` `.jpg` `.jpeg` `.webp`) — drop them in the same
   topic folders, then run the extractor to turn them into `.jsonl`:

   ```bash
   GROQ_API_KEY=... npm run dataset:extract          # or NVIDIA_API_KEY=...
   npm run dataset:extract -- --dry-run              # preview without calling the API
   ```

   > PDFs: export the pages to images first (the extractor reads images, not PDFs).

## Build

```bash
npm run dataset:build      # merges sources/ + seed/ + verified pyqBank → questions/*.jsonl
npm run dataset:validate
```

Verified questions in `src/data/pyqBank.js` win on `id` collisions.
