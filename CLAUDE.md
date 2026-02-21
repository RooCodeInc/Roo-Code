# CLAUDE.md

Shared Brain for parallel agent sessions (Architect, Builder, Tester).
This file is append-only for lessons and durable project decisions.

## Working Rules

- Always select a valid intent before mutating code.
- Respect `owned_scope` in `.orchestration/active_intents.yaml`.
- Log every mutating write to `.orchestration/agent_trace.jsonl`.
- Update `.orchestration/intent_map.md` when intent scope evolves.
- Prefer minimal, verifiable changes with tests where applicable.

## Architectural Decisions

- Hook middleware is the enforcement boundary for pre/post tool checks.
- Intent context is injected through a two-stage handshake.
- Traceability uses content hashing (`sha256`) for spatial independence.

## Lessons Learned

- 2026-02-21: Initialize shared brain to coordinate parallel sessions and reduce context drift.

## Open Questions

- Define strict rules for `mutation_class` classification (`AST_REFACTOR` vs `INTENT_EVOLUTION`).
- Decide when scope expansion requires explicit human approval.
