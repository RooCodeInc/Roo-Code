# Governance Notes

This workspace uses deterministic extension-host hooks for governed tool execution.

## Required handshake

1. `select_active_intent(intent_id)`
2. Write/mutation tools may execute only after successful selection.

## Sidecar files

- `active_intents.yaml`: declared governance intents and scope
- `agent_trace.jsonl`: append-only trace ledger
- `intent_map.md`: intent-to-code mapping index

## Fail-safe behavior

- Invalid intent catalog blocks mutating tools.
- Scope violations and stale writes fail fast with structured errors.
- Destructive commands require explicit HITL approval.
