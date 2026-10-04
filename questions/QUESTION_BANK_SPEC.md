# Question bank JSON — authoring spec

Use this file when generating a **new** quiz bank JSON for Quizopedia.

Output: **one valid JSON file** the user will save under `questions/…`.  
Do not invent app features. Do not wrap the JSON in markdown fences unless asked.

---

## Where the file goes

```text
Quizopedia/questions/<topic>/<subtopic>/<name>.json
```

Example on-disk path:

```text
questions/hft/latency/basics.json
```

The JSON field `"path"` **must exactly equal** that repo-relative path (forward slashes).

---

## Top-level shape

```json
{
  "id": "hft-latency-basics",
  "title": "Latency Basics",
  "path": "questions/hft/latency/basics.json",
  "tags": ["hft", "latency"],
  "questions": []
}
```

| Field | Required | Rules |
|--------|----------|--------|
| `id` | yes | Stable kebab-case; unique across all banks |
| `title` | yes | Short human title |
| `path` | yes | Exact file location from repo root, starts with `questions/` |
| `tags` | no | Lowercase topic tags for analysis |
| `questions` | yes | Non-empty array of question objects |

---

## Question types

Exactly one of: `mcq` | `mcq_multi` | `fib`

### Shared fields

| Field | Required | Rules |
|--------|----------|--------|
| `id` | yes | Unique **within this file** (e.g. `q1`, `q2`) |
| `type` | yes | `mcq` / `mcq_multi` / `fib` |
| `prompt` | yes | String. Always treated as **Markdown** (plain text is fine). Use `\n` for newlines. Bullets/lists/code OK. **No raw HTML** |
| `explanation` | no | Markdown string; shown on results |

### `mcq` — single correct

```json
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
}
```

- `options`: ≥2 items; each `{ "id", "text" }`
- Option `id`: unique within the question; stable slug (not `"1"`, `"A"` preferred as meaning-bearing ids)
- Option `text`: **plain text only** (not Markdown)
- `correctOptionIds`: **exactly one** option id

### `mcq_multi` — multi correct (all-or-nothing)

```json
{
  "id": "q2",
  "type": "mcq_multi",
  "prompt": "Which reduce market-data path latency? (select all)\n\n- Think about colo and networking\n- Ignore joke options",
  "options": [
    { "id": "colo", "text": "Colocation near the matching engine" },
    { "id": "json_logs", "text": "Verbose JSON logging on the hot path" },
    { "id": "kernel_bypass", "text": "Kernel-bypass networking" },
    { "id": "gc", "text": "Frequent stop-the-world GC on the feed handler" }
  ],
  "correctOptionIds": ["colo", "kernel_bypass"],
  "explanation": "Colo and kernel bypass help; hot-path logging and GC hurt."
}
```

- `correctOptionIds`: **two or more** option ids
- Order in `correctOptionIds` does not matter
- App shuffles option order every attempt; grading uses ids only

### `fib` — fill in the blank

```json
{
  "id": "q3",
  "type": "fib",
  "prompt": "RTT stands for round-trip ____.",
  "answers": ["time"],
  "caseSensitive": false,
  "explanation": "Round-trip time."
}
```

- `answers`: ≥1 acceptable string
- `caseSensitive`: default `false` if omitted
- When `caseSensitive` is false, do **not** list case variants (`time` is enough)
- App trims and collapses whitespace before compare

---

## Markdown in `prompt` / `explanation`

- Always Markdown-rendered; no format flag in JSON
- Plain one-line prompts are valid
- For lists, use real Markdown with `\n` in the JSON string:

```json
"prompt": "Which apply?\n\n- Item one\n- Item two\n- Item three"
```

---

## Authoring checklist (AI must satisfy)

1. Valid JSON (no trailing comments, no trailing commas)
2. `path` matches where the user will save the file
3. Every question has unique `id` in the file
4. Every option has unique `id` within its question
5. `mcq` → exactly 1 correct id; `mcq_multi` → ≥2 correct ids; all correct ids exist in `options`
6. Prompts are accurate for the requested topic; prefer clear, testable wording
7. Mix types only if the user asked; otherwise follow the user’s requested mix
8. Prefer 4 options for MCQ unless the user specifies otherwise
9. Do not include UI/app metadata beyond the schema above

---

## Minimal complete example

File to save as: `questions/hft/networking/udp-basics.json`

```json
{
  "id": "hft-networking-udp-basics",
  "title": "UDP Basics",
  "path": "questions/hft/networking/udp-basics.json",
  "tags": ["hft", "networking", "udp"],
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "Why is UDP often used for market data fanout?",
      "options": [
        { "id": "handshake", "text": "It requires a handshake per packet" },
        { "id": "low_overhead", "text": "Lower overhead than TCP for one-way fanout" },
        { "id": "ordered", "text": "It guarantees global ordering across feeds" },
        { "id": "retry", "text": "It automatically retries lost packets" }
      ],
      "correctOptionIds": ["low_overhead"],
      "explanation": "UDP avoids TCP connection/retry overhead for one-to-many market data."
    }
  ]
}
```

---

## What the app does with this file (context only)

- Discovers JSON under `questions/`
- User multi-selects banks → straight or random quiz
- MCQ options are shuffled each attempt; answers graded by option **id**
- History stores bank `path` strings for retest
- If files are moved later, user runs `python3 scripts/refresh_question_paths.py` to fix `path` fields

When generating: output **only** the bank JSON (or the JSON plus the suggested save path if the user asks).
