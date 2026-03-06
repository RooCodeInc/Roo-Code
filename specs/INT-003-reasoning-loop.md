# INT-003 — Two-Stage Reasoning Loop

## Intent
Implement a two-stage state machine that enforces intent selection before code generation and validates AI output against intent constraints.

## Scope (owned_scope)
- `src/core/hooks/HookEngine.ts`
- `src/core/prompts/sections/tool-use-guidelines.ts`
- `src/core/tools/SelectActiveIntentTool.ts`
- `src/core/task/Task.ts`

## Constraints
- **Stage 1 (Reasoning Intercept):** Agent MUST call `select_active_intent(intent_id)` before any destructive tool.
- **Stage 2 (Contextualized Action):** Agent receives intent context and must include it when making code changes.
- System prompt must enforce this protocol in tool-use guidelines.
- Intent context must be injected into the agent's context before code generation.

## Acceptance Criteria
- System prompt includes instructions requiring `select_active_intent` before code changes.
- `SelectActiveIntentTool` returns XML `<intent_context>` block with scope, constraints, and acceptance criteria.
- Pre-hook blocks destructive tools if no active intent is selected.
- Agent receives intent context in subsequent tool calls.
- Intent context is logged in `agent_trace.jsonl` entries.

