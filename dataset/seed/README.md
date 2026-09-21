# dataset/seed/

Drop extra questions here as `.jsonl` files (one JSON object per line) using the
schema in [`../schema.json`](../schema.json). Anything in this folder is merged
into the built dataset when you run:

```bash
npm run dataset:build
```

Use it to grow the dataset:

- hand-written questions you've verified,
- LLM-generated questions (see [`../prompts/generate-similar.md`](../prompts/generate-similar.md)),
- questions exported from the app's "captured / generated" bank.

Rules:

- Each line must be one complete JSON object (no trailing commas, no wrapping array).
- On an `id` collision, the app's verified `src/data/pyqBank.js` wins over seed rows.
- Run `npm run dataset:validate` after building to catch malformed rows.

`example.jsonl` shows the exact format.
