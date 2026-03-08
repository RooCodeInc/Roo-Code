# Testing the AI-Native Git Layer (Traceability)

How to test the semantic tracking ledger and `agent_trace.jsonl` **in the terminal**.

## Prerequisites

- From the **repo root**: `.orchestration/active_intents.yaml` must exist (it does in this repo).
- Node/pnpm: `pnpm install` already run.

## 1. Run the full hook test suite

Runs content-hash, context-loader, scope, pre-hook, post-hook, and middleware:

```bash
pnpm test:hooks
```

Or without pnpm:

```bash
npx tsx scripts/test-hooks.ts
```

## 2. Run the trace scenario (one flow end-to-end)

Simulates: **select_active_intent** → **write_to_file** (pre-hook) → **post-hook** appends to `agent_trace.jsonl`, then prints the last trace entry.

```bash
pnpm test:trace-scenario
```

Or:

```bash
npx tsx scripts/test-trace-scenario.ts
```

You should see:

- Intent `INT-001` loaded
- `write_to_file` allowed (in scope)
- A new line in `.orchestration/agent_trace.jsonl`
- The last entry printed with `intent_id`, `content_hash`, and **REQ-ID** in `related`

## 3. Inspect the trace file yourself

After running the scenario (or after real agent writes):

```bash
# Last 3 trace entries (pretty-printed)
tail -n 3 .orchestration/agent_trace.jsonl | while read line; do echo "$line" | jq .; done

# Or just the raw last line
tail -n 1 .orchestration/agent_trace.jsonl
```

## 4. Create your own scenario

Copy `scripts/test-trace-scenario.ts` and change:

- `intent_id` (must exist in `.orchestration/active_intents.yaml`)
- `path` (must be under that intent’s `owned_scope`, e.g. `src/api/**`)
- `content` and `mutation_class` (`AST_REFACTOR` | `INTENT_EVOLUTION` | `NEW_FILE`)

Then run:

```bash
pnpm exec tsx scripts/your-scenario.ts
```

## Summary

| Command                    | What it does                                                            |
| -------------------------- | ----------------------------------------------------------------------- |
| `pnpm test:hooks`          | All hook unit-style checks (content-hash, pre/post-hook, middleware).   |
| `pnpm test:trace-scenario` | One full flow: select intent → write → append trace → print last entry. |

Both run in the terminal with no VS Code or extension required.
