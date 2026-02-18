# Intent Spatial Map

This file maps high-level business intents to the physical files and code regions they own.
It is updated whenever an `INTENT_EVOLUTION` mutation class is recorded in `agent_trace.jsonl`.

---

## INT-001 — Hook Engine Middleware Integration

**Status**: IN_PROGRESS  
**Agent**: Builder  
**Mutation class**: AST_REFACTOR

### Owned Files

| File                                                    | Role                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `src/hooks/types.ts`                                    | Shared hook contracts (PreToolHook, PostToolHook, HookDecision) |
| `src/hooks/HookEngine.ts`                               | Middleware runner — pre and post hook orchestration             |
| `src/hooks/index.ts`                                    | Public exports                                                  |
| `src/hooks/README.md`                                   | Integration guide                                               |
| `src/hooks/builtin/RequireIntentPreHook.ts`             | Gatekeeper: blocks mutating tools without intent_id             |
| `src/hooks/builtin/ScopeEnforcementPreHook.ts`          | Scope validator: checks file path against owned_scope           |
| `src/hooks/builtin/TraceMutationPostHook.ts`            | Ledger writer: appends to agent_trace.jsonl with SHA-256 hashes |
| `src/core/assistant-message/presentAssistantMessage.ts` | Integration target (pre-hook at :678, post-hook at :920)        |

### Key AST Nodes

- `HookEngine.runPreHooks()` — entry point for all pre-tool interceptions
- `HookEngine.runPostHooks()` — entry point for all post-tool trace recording
- `RequireIntentPreHook.run()` — returns INTENT_REQUIRED block if no intent_id
- `ScopeEnforcementPreHook.run()` — returns SCOPE_VIOLATION block if file not in owned_scope
- `TraceMutationPostHook.run()` — appends AgentTraceRecord to `.orchestration/agent_trace.jsonl`

---

## INT-002 — select_active_intent Tool Implementation

**Status**: IN_PROGRESS  
**Agent**: Builder  
**Mutation class**: AST_REFACTOR

### Owned Files

| File                                                          | Role                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/core/prompts/tools/native-tools/select_active_intent.ts` | Tool schema definition (OpenAI function format)                    |
| `src/core/prompts/tools/native-tools/index.ts`                | Tool registry — registers select_active_intent in getNativeTools() |
| `.orchestration/active_intents.yaml`                          | Sidecar data source for intent resolution                          |

### Key AST Nodes

- `select_active_intent` function schema — `intent_id`, `mutation_class` parameters
- `getNativeTools()` return array — includes `selectActiveIntent`

---

## INT-003 — AI-Native Git Trace Ledger

**Status**: PLANNED  
**Agent**: Builder  
**Mutation class**: INTENT_EVOLUTION

### Owned Files

| File                                         | Role                                |
| -------------------------------------------- | ----------------------------------- |
| `src/hooks/builtin/TraceMutationPostHook.ts` | Post-hook that writes to the ledger |
| `.orchestration/agent_trace.jsonl`           | Append-only trace ledger            |

### Key AST Nodes

- `TraceMutationPostHook.run()` — full implementation pending Phase 3 wiring
- `sha256()` utility — computes spatial-independence content hashes
- `AgentTraceRecord` interface — full schema per challenge specification

---

_Last updated: 2026-02-18 (auto-maintained by TraceMutationPostHook on INTENT_EVOLUTION events)_
