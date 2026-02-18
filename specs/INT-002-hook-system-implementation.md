# INT-002 — Hook System Implementation

## Intent
Implement a hook system that intercepts tool execution in Roo Code to enforce intent selection and validate AI-generated code before execution.

## Scope (owned_scope)
- `src/core/hooks/**`
- `src/core/assistant-message/presentAssistantMessage.ts`
- `src/core/tools/**`
- `.orchestration/**`

## Constraints
- Must integrate with existing `presentAssistantMessage()` function without breaking current tool execution flow.
- Pre-hooks must run **before** `tool.handle()` is called.
- Post-hooks must run **after** `tool.execute()` completes but before result is returned.
- Hook system must be non-blocking for non-destructive tools (read-only operations).
- Must maintain backward compatibility with existing tools.

## Acceptance Criteria
- `HookEngine` class exists in `src/core/hooks/HookEngine.ts`.
- Pre-hook validates intent selection for destructive tools (`write_to_file`, `edit_file`, `execute_command`, etc.).
- Pre-hook enforces scope validation (file path must be within intent's `owned_scope`).
- Post-hook logs trace entries to `.orchestration/agent_trace.jsonl` for mutating actions.
- `presentAssistantMessage()` integrates `HookEngine` with Pre-Hook and Post-Hook calls.
- All existing tests pass after hook integration.

