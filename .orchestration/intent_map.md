# .orchestration/intent_map.md

# The Spatial Map — which files belong to which intent.

#

# This file answers: "Where is the hook engine logic?"

# It is incrementally updated when INTENT_EVOLUTION occurs.

# Machine-managed: updated by Post-Hooks when new files are written.

## INT-001: Hook Engine Implementation

**Status:** IN_PROGRESS
**Owner:** AI Agent (Builder)

### Owned Files:

| File                                                    | Role                                  | Last Modified |
| ------------------------------------------------------- | ------------------------------------- | ------------- |
| `src/hooks/types.ts`                                    | Shared types for the hook system      | 2026-02-18    |
| `src/hooks/HookEngine.ts`                               | Singleton middleware engine           | 2026-02-18    |
| `src/hooks/preHooks/intentGate.ts`                      | Pre-hook: blocks tools without intent | 2026-02-18    |
| `src/hooks/preHooks/scopeGuard.ts`                      | Pre-hook: enforces owned_scope        | 2026-02-18    |
| `src/hooks/postHooks/traceLedger.ts`                    | Post-hook: SHA-256 + JSONL trace      | 2026-02-18    |
| `src/hooks/utils/contentHash.ts`                        | SHA-256 hash utility                  | 2026-02-18    |
| `src/hooks/utils/intentLoader.ts`                       | YAML parser + scope matcher           | 2026-02-18    |
| `src/hooks/utils/orchestrationPaths.ts`                 | Path resolution for .orchestration/   | 2026-02-18    |
| `src/core/tools/SelectActiveIntentTool.ts`              | The mandatory handshake tool          | 2026-02-18    |
| `src/core/assistant-message/presentAssistantMessage.ts` | Wired: pre/post hooks + new tool case | 2026-02-18    |

---

## INT-002: Orchestration Data Model Setup

**Status:** IN_PROGRESS
**Owner:** AI Agent (Architect)

### Owned Files:

| File                                 | Role                                 | Last Modified |
| ------------------------------------ | ------------------------------------ | ------------- |
| `.orchestration/active_intents.yaml` | Intent definitions (source of truth) | 2026-02-18    |
| `.orchestration/agent_trace.jsonl`   | Append-only trace ledger             | 2026-02-18    |
| `.orchestration/intent_map.md`       | This file: spatial intent map        | 2026-02-18    |
| `ARCHITECTURE_NOTES.md`              | Phase 0 archaeological dig notes     | 2026-02-18    |

---

## INT-003: System Prompt Intent Enforcement

**Status:** PENDING
**Owner:** Not yet assigned

### Owned Files:

| File                         | Role                         | Last Modified |
| ---------------------------- | ---------------------------- | ------------- |
| `src/core/prompts/system.ts` | Main system prompt assembler | —             |
| `packages/types/src/tool.ts` | Tool name registry           | 2026-02-18    |
