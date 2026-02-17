# Shared Brain

This file is the shared operational memory for architect, builder, and tester
agents.

## Working Rules

- Use `.orchestration/active_intents.yaml` as the source of intent scope and
  constraints.
- Select an active intent before any mutation-capable operation.
- Treat `.orchestration/agent_trace.jsonl` as append-only.
- Update `.orchestration/intent_map.md` when intent evolution introduces new files
  or new scope surfaces.

## Lessons Learned

- 2026-02-17: SDD baseline established with constitution v1.0.0 and specs 000-008.
