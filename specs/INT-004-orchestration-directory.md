# INT-004 — Orchestration Directory Management

## Intent
Implement a robust data model for managing `.orchestration/` directory files with proper initialization, validation, and atomic updates.

## Scope (owned_scope)
- `src/core/orchestration/OrchestrationDataModel.ts`
- `.orchestration/active_intents.yaml`
- `.orchestration/agent_trace.jsonl`
- `.orchestration/intent_map.md`
- `.orchestration/AGENT.md`

## Constraints
- `.orchestration/` directory must be machine-managed (not user-edited directly).
- `active_intents.yaml` must be valid YAML and follow the schema defined in `document.md`.
- `agent_trace.jsonl` must be append-only (no modifications, only appends).
- All file operations must be atomic (write to temp file, then rename).
- Directory and files must be initialized on first use.

## Acceptance Criteria
- `OrchestrationDataModel` class provides methods:
  - `initialize()`: Creates directory and initializes files if missing.
  - `readActiveIntents()`: Parses and returns active intents.
  - `appendAgentTrace()`: Appends trace entry to JSONL file.
  - `updateIntentMap()`: Updates intent-to-file mapping.
  - `appendAgentKnowledge()`: Appends to AGENT.md.
- All methods handle errors gracefully and log failures.
- Files are created with proper templates if missing.
- YAML parsing validates schema and reports errors clearly.

