# SPEC-005: Governance and Enforcement

## Deterministic Hook System

The hook layer MUST intercept all tool executions relevant to mutation and
governance checks.

## Pre-Execution Enforcement

- Intent MUST be selected.
- Context MUST be injected for the active intent.
- Human authorization MUST gate destructive commands.
- Write targets MUST match `owned_scope`.

If any check fails, execution MUST be blocked.

## Post-Execution Enforcement

- Compute SHA-256 hashes for modified content.
- Serialize mutation metadata.
- Append to `agent_trace.jsonl`.
- Update intent/documentation side effects.
