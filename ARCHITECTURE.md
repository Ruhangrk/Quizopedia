# Quizopedia — Architecture

Personal HFT quiz platform. Frontend-only. One repo. No backend.

This document is the source of truth for building the app.

For generating new question JSON files, use [`questions/QUESTION_BANK_SPEC.md`](questions/QUESTION_BANK_SPEC.md).

---

## 1. Goals

- Practice HFT topics via **single-correct MCQ**, **multi-correct MCQ**, and **Fill-in-the-blank (FIB)**.
- Load questions from a **nested folder of JSON files** in the repo (`questions/`).
- Let the user **multi-select** topic files, then start in **straight** or **random** order.
- Show **results** after a full attempt: **total time**, **per-question time (ms)**, score, correct list, wrong list, useful breakdowns.
- UI must feel like a **polished personal product**, not a bare form demo.
- Persist **attempt history on disk** (append-only). **Retest** reuses the same file set and appends a new history entry (older entries stay).

## 2. Non-goals

- Backend, auth, multi-user, cloud sync.
- Creating / editing question JSON from the UI.
- Extra question types beyond single MCQ, multi MCQ, and FIB (for now).
- Mobile-first polish, PWA install, offline packaging (nice-to-have later, not required).

---

## 3. Stack

| Layer | Choice |
|--------|--------|
| App | Vite + React + TypeScript |
| Styling | Global design tokens + CSS modules (custom professional UI; no generic “AI purple dashboard” look) |
| Timing | `performance.now()` for elapsed durations; ISO timestamps only for wall-clock start/finish |
| Question content | Static JSON under `questions/` (versioned in git) |
| Attempt history | File System Access API → `history/attempts.json` on disk |
| In-session cache | IndexedDB (optional fast mirror of history for UI; disk is source of truth) |
| Routing | Simple client state / lightweight router (home, quiz, results, history) |

No second repo. No server process.

---

## 4. Repository layout

```text
Quizopedia/
├── ARCHITECTURE.md          # this file
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json
├── questions/               # source of truth for question banks (git)
│   └── hft/
│       ├── latency/
│       │   └── basics.json
│       └── matching/
│           └── order-book.json
├── history/                 # on-disk attempts (gitignored recommended)
│   ├── .gitkeep
│   └── attempts.json        # created/updated by the app at runtime
├── scripts/
│   └── refresh_question_paths.py  # fix JSON path fields after moves
├── public/                  # static assets if any
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── styles/
    │   ├── tokens.css       # color, type, space, motion tokens
    │   └── global.css
    ├── domain/              # pure types + grading + shuffle (no I/O)
    │   ├── types.ts
    │   ├── grade.ts
    │   ├── session.ts
    │   ├── timing.ts        # duration helpers from performance marks
    │   └── analysis.ts
    ├── content/             # load + index question files
    │   ├── manifest.ts      # discover nested JSON via import.meta.glob
    │   └── loader.ts
    ├── storage/             # history persistence
    │   ├── historyFs.ts     # File System Access API
    │   ├── historyIdb.ts    # optional IndexedDB mirror
    │   └── historyService.ts
    ├── state/               # quiz / UI state
    │   └── quizStore.ts
    ├── components/
    └── pages/
        ├── HomePage.tsx         # tree + multi-select + mode + start
        ├── QuizPage.tsx
        ├── ResultsPage.tsx
        └── HistoryPage.tsx
```

**Content rule:** questions are authored in the repo (editor / git). The UI never writes under `questions/`.

**History rule:** the app writes only under a user-granted folder, conventionally `history/`.

---

## 5. Question JSON schema

One file = one leaf topic bank.

**Storage folder (locked):** repo root **`questions/`** only.  
There is no `banks/` folder. “Bank” in this doc means a JSON file, not a directory name.

```text
Quizopedia/
└── questions/                    ← only place question JSON lives
    └── hft/
        └── latency/
            └── basics.json       ← resolved path: questions/hft/latency/basics.json
```

### `path` field (required identity for history / retest)

| Concept | Role |
|---------|------|
| **`path` inside JSON** | Required. Canonical locator for history `sources` and retest. Form: `questions/…` from repo root |
| **Actual file on disk** | Must match `path`. Home tree still discovers via glob; if JSON `path` ≠ real location, show a clear warning and treat that bank as **unusable for new attempts / retest** until fixed |

After moving/renaming files under `questions/`, run:

```bash
python3 scripts/refresh_question_paths.py
```

That script rewrites only incorrect/missing `path` values (see §5.1). The app does **not** fall back to bank `id` to find files.

```json
{
  "id": "hft-latency-basics",
  "title": "Latency Basics",
  "path": "questions/hft/latency/basics.json",
  "tags": ["hft", "latency"],
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "Which is typically lowest latency for colocated trading?",
      "options": [
        { "id": "rest", "text": "REST over HTTPS" },
        { "id": "udp", "text": "UDP multicast market data" },
        { "id": "email", "text": "Email alerts" },
        { "id": "batch", "text": "Daily batch files" }
      ],
      "correctOptionIds": ["udp"],
      "explanation": "UDP multicast is common for market data fanout."
    },
    {
      "id": "q2",
      "type": "mcq_multi",
      "prompt": "Which of the following reduce market-data path latency? (select all)",
      "options": [
        { "id": "colo", "text": "Colocation near the matching engine" },
        { "id": "json_logs", "text": "Verbose JSON logging on the hot path" },
        { "id": "kernel_bypass", "text": "Kernel-bypass networking" },
        { "id": "gc_pauses", "text": "Frequent stop-the-world GC on the feed handler" }
      ],
      "correctOptionIds": ["colo", "kernel_bypass"],
      "explanation": "Colo and kernel bypass help; hot-path logging and GC pauses hurt."
    },
    {
      "id": "q3",
      "type": "fib",
      "prompt": "RTT stands for round-trip ____.",
      "answers": ["time"],
      "caseSensitive": false,
      "explanation": "Round-trip time."
    },
    {
      "id": "q4",
      "type": "mcq",
      "prompt": "You see p99 latency jump on the feed handler. Which checklist item is **most** suspicious?\n\n- Hot-path logging\n- NIC interrupt coalescing mis-tuned\n- Both of the above can matter; pick the best first check\n\n```text\np50=12us p99=800us\n```",
      "options": [
        { "id": "logs", "text": "Disable/audit hot-path logging first" },
        { "id": "ignore", "text": "Ignore p99; only p50 matters in HFT" },
        { "id": "email", "text": "Switch the feed to email alerts" }
      ],
      "correctOptionIds": ["logs"],
      "explanation": "p99 spikes often come from avoidable hot-path work; logging is a common first check."
    }
  ]
}
```

### Field rules

| Field | Rule |
|--------|------|
| `id` (bank) | Stable bank id; unique across the repo (display / question keys). **Not** used to locate files for history/retest |
| `title` | Display name |
| `path` | Required. Must equal real repo-relative location, e.g. `questions/hft/latency/basics.json`. History and retest locate banks **only** by this value |
| `tags` | Optional string tags for analysis |
| Question `id` | Stable; unique **within** the bank |
| `type` | `"mcq"` \| `"mcq_multi"` \| `"fib"` |
| `prompt` | String. **Always treated as Markdown** in the app (see below) |
| Option `id` | Stable string; unique **within that question**; answers reference these ids (never display order / index) |
| Option `text` | Plain label shown in UI (not Markdown, to keep options scannable) |

### Prompt Markdown (locked)

- There is **one** field: `prompt` (a JSON string). No `promptFormat`, no MD vs plain mode flag.
- The UI **always** renders `prompt` through a Markdown renderer (Quiz + Results).
- Plain sentences with no Markdown syntax are fine — they still render as normal text.
- Authors may use Markdown when needed: paragraphs, bullet/numbered lists, **bold** / *italic*, inline `code`, fenced code blocks. Use `\n` in JSON for newlines.
- No raw HTML in prompts (renderer must not execute HTML).
- Same rule for `explanation` when shown on results: always Markdown-rendered; plain text works without special syntax.
- `options[].text` stays **plain text** (not Markdown).
| `correctOptionIds` | For `mcq`: exactly **one** id. For `mcq_multi`: **two or more** ids. Order in the array does not matter |
| FIB `answers` | One or more acceptable strings (no need to duplicate case variants when `caseSensitive` is false) |
| FIB `caseSensitive` | Default `false` |
| `explanation` | Optional; shown on results |

### Option shuffle (runtime, not in JSON)

For every **new attempt** (including retest), when building the session:

- For each `mcq` and `mcq_multi` question, **shuffle `options` order in memory** for display.
- JSON file order is only the authoring default; it is never relied on for grading.
- Grading always uses option **ids**.
- FIB has no options; nothing to shuffle.

### Validation (load time)

Reject / skip invalid questions with a clear console + UI warning:

- Missing bank `id` / `title` / `path`
- JSON `path` ≠ actual file location → mark bank invalid for selection/retest; tell user to run `scripts/refresh_question_paths.py`
- Duplicate `path` values across banks → error both
- Missing question `id` / `prompt` / `type`
- Duplicate question ids within a bank
- Duplicate bank `id` across two files — warn
- MCQ types: missing `options`, empty options, duplicate option ids
- `mcq`: `correctOptionIds` length ≠ 1, or id not in options
- `mcq_multi`: `correctOptionIds` length < 2, or any id not in options
- FIB without non-empty `answers`

Do not crash the whole bank if one question is bad; skip that question.

### 5.1 Path refresh script (`scripts/refresh_question_paths.py`)

Maintenance tool (stdlib only). Run from repo root after moving/renaming question files.

#### Phase A — question banks

1. Walk `questions/**/*.json`.
2. For each file, compute `expected =` repo-relative path using `/` separators, e.g. `questions/hft/latency/basics.json`.
3. Read JSON. Read current `path` (may be missing).
4. If `path == expected` → **do not write** the file; count as unchanged.
5. If missing or different → set `path = expected`, write JSON (keep other fields; stable formatting: indent 2, trailing newline), record remap `prev → new`, print one result line.

#### Phase B — history (same run)

6. If `history/attempts.json` exists, load it. If missing, print `HISTORY: skipped (file not found)` and go to summary.
7. Using the remap map from Phase A (`prev_path → new_path`), rewrite path strings everywhere they appear in history, including at least:
   - `attempt.sources[]`
   - `attempt.items[].sourcePath`
   - `attempt.breakdown.bySource[].path`
8. Only rewrite occurrences that exactly match a `prev` key from this run. Do not guess via bank `id`.
9. If any replacements were made → write `history/attempts.json` and print what changed. If nothing matched → leave the file untouched.

Printed result per modified question file:

```text
MODIFIED  questions/hft/latency/basics.json
  prev: questions/hft/old/basics.json
  new:  questions/hft/latency/basics.json
```

Printed history updates (idea):

```text
HISTORY  history/attempts.json
  remapped sources/fields using 3 path change(s)
  example: questions/hft/old/basics.json -> questions/hft/latency/basics.json
  attempts touched: 2
```

```text
OK (unchanged banks): 40
MODIFIED banks: 3
HISTORY: updated
ERRORS: 0
```

Rules:

- Never invent content beyond fixing `path` / remapping those path strings in history.
- Skip / error clearly on invalid JSON.
- No network. No deps beyond Python 3 stdlib.
- **Run the script after moves in one go** so Phase B sees the remaps. If you fixed bank `path` by hand earlier without remaps, history cannot be auto-fixed later (no old→new map).
- History rows remain append-only semantically; this is an in-place path rewrite for location hygiene only, not deleting/replacing attempts.
---

## 6. History schema (`history/attempts.json`)

Append-only array. Never overwrite or delete past attempts from the happy path.

`sources` store each bank’s JSON **`path`** value at attempt time. Retest locates files **only** via that path (lookup: find loaded bank where `bank.path === source`, which must match a real file after the refresh script).

```json
[
  {
    "id": "att_20261004_t1",
    "startedAt": "2026-10-04T07:30:00.000Z",
    "finishedAt": "2026-10-04T07:44:12.000Z",
    "durationMs": 852147,
    "timing": {
      "totalMs": 852147,
      "activeMs": 848902,
      "perQuestionMs": {
        "min": 4200,
        "max": 91000,
        "avg": 34085
      }
    },
    "mode": "random",
    "sources": [
      "questions/hft/latency/basics.json",
      "questions/hft/matching/order-book.json"
    ],
    "sourceTitles": ["Latency Basics", "Order Book"],
    "totals": {
      "correct": 18,
      "wrong": 7,
      "total": 25,
      "percent": 72
    },
    "breakdown": {
      "bySource": [
        { "path": "questions/hft/latency/basics.json", "correct": 10, "total": 12 }
      ],
      "byType": {
        "mcq": { "correct": 10, "total": 12 },
        "mcq_multi": { "correct": 4, "total": 6 },
        "fib": { "correct": 4, "total": 7 }
      },
      "byTag": [
        { "tag": "latency", "correct": 8, "total": 10 }
      ]
    },
    "items": [
      {
        "questionId": "hft-latency-basics:q1",
        "sourcePath": "questions/hft/latency/basics.json",
        "type": "mcq",
        "prompt": "Which is typically lowest latency…",
        "userAnswer": ["udp"],
        "correctOptionIds": ["udp"],
        "expectedDisplay": ["UDP multicast market data"],
        "userDisplay": ["UDP multicast market data"],
        "isCorrect": true,
        "durationMs": 12458,
        "explanation": "…"
      },
      {
        "questionId": "hft-latency-basics:q2",
        "sourcePath": "questions/hft/latency/basics.json",
        "type": "mcq_multi",
        "prompt": "Which of the following reduce…",
        "userAnswer": ["colo"],
        "correctOptionIds": ["colo", "kernel_bypass"],
        "expectedDisplay": ["Colocation near the matching engine", "Kernel-bypass networking"],
        "userDisplay": ["Colocation near the matching engine"],
        "isCorrect": false,
        "durationMs": 28301,
        "explanation": "…"
      }
    ]
  }
]
```

For FIB items, `userAnswer` is a string (or single-element display helpers); `correctOptionIds` is omitted; store `expectedDisplay` from accepted answers.

Every graded item **must** include `durationMs` (integer milliseconds spent on that question in this attempt).

### Retest

1. For each string in `sources[]`, find the bank whose JSON `path` equals that string (and whose file is valid on disk).
2. If any source path cannot be found, list missing paths clearly. Do not invent id-based fallbacks. User should run `python3 scripts/refresh_question_paths.py` (updates bank `path` **and** remaps those strings inside `history/attempts.json`), then retry. Or cancel / continue with found subset after confirm / pick a fresh set from Home.
3. User picks mode again (or default to previous mode). Options are shuffled again for the new attempt.
4. On finish, **push a new object** into `attempts.json` with current `path` values in `sources`. Previous object unchanged.
---

## 7. Runtime architecture

```text
┌─────────────────────────────────────────────────────────┐
│  UI (pages / components)                                │
│  Home → Quiz → Results → History                        │
└───────────────┬───────────────────────────┬─────────────┘
                │                           │
                ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│  content/                 │   │  storage/historyService   │
│  manifest + loader        │   │  FS Access (disk SoT)     │
│  questions/**/*.json      │   │  IndexedDB (optional)     │
└───────────────┬───────────┘   └───────────────┬───────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│  domain/                  │   │  history/attempts.json    │
│  types, grade, session,   │   │  (user machine disk)      │
│  analysis                 │   └───────────────────────────┘
└───────────────────────────┘
```

### Layer duties

| Module | Responsibility | Must not |
|--------|----------------|----------|
| `domain/` | Types, shuffle, grade, score, analysis pure functions | Touch DOM, FS, fetch |
| `content/` | Discover tree, load/parse/validate banks | Grade or store history |
| `storage/` | Grant folder, read/write attempts safely | Know React components |
| `state/` | Current attempt lifecycle | Persist formats by itself (calls storage) |
| `pages/` | Wire UI to state + content + storage | Embed grading rules inline |

---

## 8. Content discovery

Use Vite `import.meta.glob` against `../questions/**/*.json` (or equivalent path).

Build a **tree** for the Home picker:

```ts
type TreeNode =
  | { kind: "dir"; name: string; path: string; children: TreeNode[] }
  | { kind: "file"; name: string; path: string; title: string; questionCount: number };
```

- Discover files via glob under `questions/`.
- For each file, require JSON `path` to equal the real repo-relative path; otherwise show warning and disable that file in the picker until `refresh_question_paths.py` is run.
- Tree / selection / history identity uses the JSON `path` field.
- Multi-select only allows **files** (dirs expand/collapse).
- Selecting a directory may optionally select all descendant files (UX nicety).

---

## 9. Quiz session flow

```text
Home
  select files[] + mode (straight | random)
  click Start
       │
       ▼
  Build SessionQuestion[]
    - load each selected JSON
    - flatten questions
    - attach sourcePath (= bank.path) + bankId + stable question key ("bankId:questionId")
    - refuse to start if any selected bank has path mismatch
    - for each mcq / mcq_multi: shuffle options into `displayOptions` for this attempt
    - straight: keep file order, then question order
    - random: shuffle flattened question list
       │
       ▼
  Quiz
    - wall startedAt = Date ISO (for history display)
    - perfOrigin = performance.now() at quiz start
    - one question at a time
    - on enter question i: mark questionStartedPerf = performance.now()
    - on leave question i (Next / Finish / jump):
        durationMs[i] += round(performance.now() - questionStartedPerf)
      (if user navigates back to a question, time accumulates on that question)
    - mcq: radio (one option id)
    - mcq_multi: checkboxes (set of option ids)
    - fib: text input
    - collect answers + per-question durationMs in memory
    - no disk writes until Finish
       │
       ▼
  Finish
    - wall finishedAt = Date ISO
    - total durationMs = round(performance.now() - perfOrigin)
    - activeMs = sum(per-question durationMs)
    - grade each item (domain/grade.ts) by option ids / fib normalize
    - attach each item.durationMs
    - build analysis including slowest / fastest questions
    - navigate to Results
    - historyService.append(attempt) → disk (+ IDB mirror)
```

### Timing accuracy (locked)

| Clock | Use |
|--------|-----|
| `performance.now()` | All **durations** (total + per question). Monotonic, ms precision suitable for UI timing |
| `Date` / `toISOString()` | **Wall-clock labels only** (`startedAt`, `finishedAt`) |

Rules:

- Store durations as **integer milliseconds**.
- Per-question timer starts when the question becomes active; stops when it becomes inactive.
- Revisiting a question **adds** more time to that question (does not reset).
- `durationMs` (attempt) = full quiz elapsed from Start → Finish.
- `timing.activeMs` = sum of per-question ms (can be slightly less than total if interstitial UI gaps exist; both are stored).
- Do **not** use `Date.now()` differences for grading/analytics durations (NTP / clock adjustments can skew).
- Tab backgrounding: browser may throttle timers; we still record `performance.now()` deltas as best-effort. Optional later: pause-on-blur — not required for v1.

### Grading

| Type | Correct when |
|------|----------------|
| `mcq` | User selected option id equals the single `correctOptionIds[0]` |
| `mcq_multi` | User selected set **equals** `correctOptionIds` as a set (order irrelevant). Partial credit: none (all-or-nothing) |
| `fib` | Trim + collapse whitespace; then exact match if `caseSensitive`, else case-insensitive match against any `answers[]` |

Unanswered = wrong.  
Never grade by on-screen option position.

---

## 10. History persistence (File System Access API)

### Why

Browser `localStorage` / IndexedDB alone are **not permanent** (cleared with site data).  
Disk file under a user-granted folder survives browser clears.

### UX

1. On first history write/read, prompt: **Connect history folder**.
2. User selects the repo’s `history/` directory (or any folder they prefer).
3. Store the directory handle (browser may persist permission for this origin).
4. Read/write `attempts.json` inside that folder.

### Safe write protocol

Avoid corrupt JSON if the tab dies mid-write:

1. Read existing array (or `[]` if missing).
2. Append new attempt.
3. Write to `attempts.tmp.json`.
4. Rename/replace over `attempts.json` (or write final file after successful serialize — if rename unsupported, write full file once after in-memory serialize is complete).
5. Update IndexedDB mirror only after disk success (or best-effort mirror with “disk failed” toast).

### Permissions lost

If the handle is invalid / permission revoked:

- Show banner: reconnect history folder.
- Keep last in-memory / IDB view read-only until reconnected.
- Do not silently invent a second history file elsewhere.

### Browser support

Primary: Chromium (Chrome / Edge).  
If FS Access unavailable: fall back to **download `attempts.json`** after each attempt + manual “Import history JSON” on History page. Document this in UI briefly.

---

## 11. UI quality bar + surfaces

### Quality bar (required)

This is a personal product, but the UI must still feel **intentional and professional**:

- Clear visual direction via CSS tokens (typography, spacing, surfaces, accent) — not browser defaults.
- Expressive fonts (not Inter/Roboto/Arial/system default stack as the whole identity).
- Atmospheric background (subtle gradient/pattern), not a flat dead white/gray page.
- One job per screen; no dense dashboard clutter on first view.
- Cards only where they aid interaction (e.g. selectable topic rows, history rows) — not decorative card spam.
- At least 2–3 purposeful motions (screen enter, progress advance, results reveal).
- Excellent desktop layout first; usable on mobile widths.
- Avoid generic AI-looking purple-glow / cream-serif-terracotta clichés.

### Home

- Nested folder tree from `questions/`
- Multi-select files
- Mode: Straight | Random
- Start (disabled until ≥1 file)
- Entry to History
- Status: history folder connected or not

### Quiz

- Progress `i / n`
- Live total elapsed timer (`performance.now()` based)
- Optional current-question elapsed (nice-to-have in chrome)
- Render `prompt` as **Markdown** (lists, emphasis, code); wrap long content; sanitize (no raw HTML execution)
- `mcq`: radio options (shuffled `displayOptions`)
- `mcq_multi`: checkbox options (shuffled `displayOptions`); hint that multiple may apply
- `fib`: text input
- Next / Finish (confirm if unanswered remain)

### Results

- Score %, correct/total
- Total time + active time
- Per-question times visible on Correct / Wrong lists
- Analysis: by source path, by type, by tag, **slowest questions**
- Wrong items show prompt, user/expected answers, explanation, time spent
- Actions: Retest same set | Back home | View in history

### History

- List attempts newest-first: date, score, total duration, source titles, mode
- Expand row → summary + per-question times + detail
- Retest button → same `sources` → Home/Quiz start path
- Connect / reconnect history folder

---

## 12. State model (conceptual)

```ts
type AppScreen = "home" | "quiz" | "results" | "history";

type QuizMode = "straight" | "random";

interface McqOption {
  id: string;
  text: string;
}

interface SessionQuestion {
  key: string;                 // `${bankId}:${questionId}`
  sourcePath: string;          // bank.path, e.g. questions/hft/latency/basics.json
  bankId: string;
  tags: string[];
  question: McqQuestion | McqMultiQuestion | FibQuestion;
  displayOptions?: McqOption[]; // shuffled copy for this attempt (mcq / mcq_multi only)
}

interface QuizRuntime {
  mode: QuizMode;
  sources: string[];           // bank.path values
  questions: SessionQuestion[];
  index: number;
  startedAt: string;           // ISO wall clock
  perfOrigin: number;          // performance.now() at start
  questionStartedPerf: number; // performance.now() when current question activated
  // key → selected option id | option id[] | fib string
  answers: Record<string, string | string[]>;
  // key → accumulated ms on that question
  questionDurationMs: Record<string, number>;
}
```

Keep runtime in React state or a tiny store. Persist only finished `Attempt` objects (including per-question `durationMs`).

---

## 13. Extensibility (without overbuilding)

Designed seams — use only when needed:

| Extension | Where it plugs in |
|-----------|-------------------|
| New question type | `domain/types.ts` + `grade.ts` + one Quiz renderer |
| New analysis card | `domain/analysis.ts` + Results section |
| Export CSV | `storage/` helper reading attempts |
| Tag filters on Home | filter tree using bank `tags` |
| Pause timer while tab hidden | `QuizRuntime` blur/focus hooks |
| Hard per-question time limit | `QuizRuntime` + QuizPage |

Do **not** add plugin systems, DI containers, or backend abstractions “just in case.”

---

## 14. Git / privacy notes

- Commit: `questions/**`, app source, this architecture doc.
- Prefer **gitignore** `history/attempts.json` (personal scores).
- Keep `history/.gitkeep` so the folder exists in clone.
- Never put secrets in question files.

---

## 15. Build order

1. Scaffold Vite React TS; add `questions/` samples + empty `history/`.
2. `scripts/refresh_question_paths.py` + sample banks with correct `path`.
3. `domain/types` + `grade` + unit-smoke via a quick manual check.
4. `content/manifest` + Home tree multi-select (enforce path match).
5. QuizPage + session build (straight/random) + `performance.now()` total + per-question timing.
6. ResultsPage + `analysis` (includes slowest questions / times).
7. `historyService` (FS Access + safe append) + HistoryPage + retest **by path**.
8. Fallback import/download if FS Access missing.
9. Visual polish pass against UI quality bar (tokens, motion, results hierarchy).
10. Fill more HFT JSON banks over time.

---

## 16. Decisions locked

| Topic | Decision |
|--------|----------|
| Backend | No |
| Question authoring UI | No |
| Question storage | Repo `questions/**/*.json` only (no `banks/` folder) |
| File locator for history/retest | JSON `path` only (not bank `id`) |
| Path maintenance after moves | `python3 scripts/refresh_question_paths.py` fixes bank `path` + remaps those old→new strings in `history/attempts.json` |
| Path mismatch in app | Warn + disable bank until script fixes it |
| History storage | Disk via File System Access API (`history/attempts.json`) |
| History semantics | Append-only; retest = new row |
| Question types | `mcq`, `mcq_multi`, `fib` |
| Prompt format | `prompt` / `explanation` always Markdown-rendered (plain text is valid MD); no format flag; options stay plain text |
| MCQ options | `{ id, text }`; answers via `correctOptionIds` |
| Option order | Shuffled in UI every attempt (mcq + mcq_multi) |
| Multi MCQ grading | All-or-nothing set equality |
| Modes | Straight, Random |
| Timing | `performance.now()` total + per-question ms stored on each item |
| UI | Professional product UI via tokens + CSS modules (not a bare demo) |
| Permanence | Disk file is source of truth |

When implementation drifts, update this file in the same change.
