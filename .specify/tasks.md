# Spec Kit — Task index

Generated from specs and plans. Use **speckit.tasks** to refresh or regenerate.

---

## Specs and task files

| Spec                                                               | Tasks file                                                                   | Summary                                                                                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [001-intent-orchestration](specs/001-intent-orchestration/spec.md) | [001-intent-orchestration/tasks.md](specs/001-intent-orchestration/tasks.md) | Orchestration layer, `.orchestration/` source of truth, two-stage state machine, hook middleware, traceability                |
| [002-intent-system](specs/002-intent-system/spec.md)               | [002-intent-system/tasks.md](specs/002-intent-system/tasks.md)               | Intent IDs (INT-XXX), scope, constraints, acceptance criteria, `select_active_intent` tool, gatekeeper, `active_intents.yaml` |
| [003-hook-middleware-security](specs/003-hook-middleware-security/spec.md) | [003-hook-middleware-security/tasks.md](specs/003-hook-middleware-security/tasks.md) | Hook middleware security boundary, scope enforcement, tool classification (SAFE/DESTRUCTIVE), UI-blocking authorization, structured error recovery |

---

## Quick reference: 002 implementation order

1. **Phase 0:** Schema and types for `active_intents.yaml`; add `select_active_intent` to tool names.
2. **Phase 1:** Tool class, presentAssistantMessage case, native tool definition.
3. **Phase 3:** Pre-hook for select_active_intent (load YAML, validate, set task state).
4. **Phase 4:** Load intent from YAML; build and return XML context block; set task.currentIntentId/Context.
5. **Phase 2:** System prompt section “intent selection first”.
6. **Phase 5:** Gatekeeper in presentAssistantMessage (block other tools until intent selected).
7. **Phase 6:** Integration checklist and spec acceptance.

---

## Status legend

- ☐ Not started
- ☑ In progress
- ✅ Done

Update task status in the per-spec `tasks.md` files.
