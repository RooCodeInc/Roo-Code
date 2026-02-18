# Hook Architectural Decisions

This note captures explicit decisions for the hook system design and the rationale behind each choice.

## Decision 1: Middleware Boundary at Tool Execution Loop

- Decision: Place hook execution at the extension host tool loop before and after tool dispatch.
- Why: This is the only central path where every tool call passes.
- Location: `src/core/assistant-message/presentAssistantMessage.ts`.
- Tradeoff: Tight coupling to current execution loop shape; requires careful refactor if the loop changes.

## Decision 2: Two-Stage Handshake for Mutating Tools

- Decision: Mutating tools must require an active intent selected through `select_active_intent(intent_id)` before execution.
- Why: Enforces intent-code traceability and avoids unaudited edits.
- Tradeoff: Adds one extra call before writes and commands.

## Decision 3: Fail-Closed for Governance, Fail-Safe for Observability

- Decision: Pre-hooks block on policy violations. Post-hooks do not block user progress if telemetry write fails.
- Why: Policy enforcement must be strict, but logging failures should not corrupt the main task loop.
- Tradeoff: Post-hook failures must be surfaced clearly for audit.

## Decision 4: Sidecar Data Model in `.orchestration/`

- Decision: Persist intent and trace artifacts in workspace-local sidecar files.
- Why: Keeps audit metadata close to code changes and under version control.
- Tradeoff: File-based writes need locking and append discipline.

## Decision 5: Append-Only Trace Ledger

- Decision: `agent_trace.jsonl` uses append-only records with content hashes.
- Why: Prevents silent history rewrites and supports deterministic auditing.
- Tradeoff: Requires periodic compaction strategy if file grows large.

## Decision 6: Minimal Clean Hook Module

- Decision: Keep hook contracts and engine isolated in `src/hooks/`.
- Why: Prevents spaghetti logic in core execution loop and enables composable hooks.
- Tradeoff: Requires explicit wiring points and tests for integration.
