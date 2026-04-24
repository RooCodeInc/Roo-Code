# INT-001 — Intent-Code Traceability (Spec)

## Intent
Build an Intent-Code Traceability system for Roo Code that enforces a two-stage reasoning loop and produces durable, auditable traces linking intents to code changes.

## Scope (owned_scope)
- `src/core/assistant-message/**`
- `src/core/tools/**`
- `src/core/hooks/**`
- `src/core/orchestration/**`
- `src/core/prompts/**`
- `.orchestration/**`

## Constraints
- Must enforce **intent selection before any destructive tool** (`write_to_file`, `edit_file`, `apply_diff`, etc.).
- Must keep **privilege separation**: UI emits events; extension host executes privileged actions; hooks are middleware.
- Must log **spatially independent** traces via content hashing.

## Acceptance Criteria
- Agent cannot write code before calling `select_active_intent(intent_id)`.
- When a file is written, a JSONL entry is appended to `.orchestration/agent_trace.jsonl` that includes:
  - intent id
  - file path
  - line range (best-effort)
  - `sha256:` content hash of the modified block
- `.orchestration/active_intents.yaml` exists and contains this intent.


