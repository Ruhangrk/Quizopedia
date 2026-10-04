# Quizopedia

Personal HFT quiz platform (MCQ, multi-correct MCQ, fill-in-the-blank). Frontend-only.

## Quick start

```bash
npm install
npm run dev
```

Open the app, select question banks under `questions/`, choose **Straight** or **Random**, then **Start**.

For permanent attempt history (Chrome/Edge): click **Connect history folder** and choose this repo’s `history/` directory.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Vitest (domain/content) |
| `npm run test:python` | Pytest for path refresh script |
| `npm run test:all` | JS + Python tests |
| `python3 scripts/refresh_question_paths.py` | Fix bank `path` fields + remap history |

## Authoring questions

See [`questions/QUESTION_BANK_SPEC.md`](questions/QUESTION_BANK_SPEC.md) — give that file to an AI (or yourself) when generating new banks.

Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md).
