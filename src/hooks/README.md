# Hooks Directory - Clean Hook Interfaces

This directory contains the clean, composable hook implementations for the governed AI-native IDE.

## Pre-Hooks (Execution Phase)

| Hook                | Phase   | Purpose                                             |
| ------------------- | ------- | --------------------------------------------------- |
| `validateIntent`    | Phase 1 | Ensures active intent exists before execution       |
| `classifyCommand`   | Phase 2 | Categorizes SAFE vs DESTRUCTIVE commands            |
| `enforceScope`      | Phase 2 | Validates file against intent's owned_scope         |
| `authorizeHITL`     | Phase 2 | Shows user approval dialog for destructive commands |
| `loadIntentContext` | Phase 1 | Loads intent context from active_intents.yaml       |

## Post-Hooks (Completion Phase)

| Hook                 | Phase   | Purpose                                         |
| -------------------- | ------- | ----------------------------------------------- |
| `hashContent`        | Phase 3 | Generates SHA-256 content hash for traceability |
| `classifyMutation`   | Phase 3 | Determines REFACTOR vs EVOLUTION                |
| `recordTrace`        | Phase 3 | Appends trace entry to agent_trace.jsonl        |
| `validateLock`       | Phase 4 | Checks for stale files before write             |
| `captureInitialHash` | Phase 4 | Captures pre-write hash for optimistic locking  |

## Integration Points

These hooks are wired into the following locations:

- **Pre-execution:** `src/core/assistant-message/presentAssistantMessage.ts`
- **Post-execution:** `src/core/tools/WriteToFileTool.ts`
- **Pre-prompt:** `src/core/task/Task.ts`

## Architecture Philosophy

- **Isolated:** Each hook is independent and focused
- **Composable:** Hooks can be combined in different orders
- **Fail-safe:** All hooks are wrapped in try/catch blocks
- **Non-intrusive:** Added without modifying core logic
