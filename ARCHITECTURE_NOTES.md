# Roo Code Hook Architecture Notes

## Entry Points

- **execute_command**: Handles all tool execution requests from the agent.
- **write_file**: Performs all codebase mutations initiated by the agent.
- These are the primary points where the hook engine intercepts and enforces governance.

## Hook Engine

- **preHook(intentId)**:
    - Validates the selected intent against `active_intents.yaml`.
    - Injects intent-specific constraints and owned scope into the agent context.
    - Blocks execution if no valid intent is selected.
- **postHook(intentId, filePath, content)**:
    - Computes SHA-256 hash of the modified code to ensure **spatial independence**.
    - Appends a structured entry to `.orchestration/agent_trace.jsonl`, linking the change back to the business intent.
    - Supports multiple intents and can track simultaneous agent actions.

## Orchestration Folder

- **active_intents.yaml**: Stores all high-level business intents, their status, constraints, and acceptance criteria.
- **agent_trace.jsonl**: Append-only ledger capturing all mutating actions, with intent mapping and content hashes.
- **intent_map.md**: Maps business intents to physical files and AST nodes for traceability and future planning.

## Demo Flow

1. User selects **INT-001** (e.g., JWT Authentication Migration).
2. **preHook** injects constraints and scope for the selected intent.
3. Agent executes `write_file` to modify code (e.g., `src/auth/jwt.ts`).
4. **postHook** records the file content hash and updates `agent_trace.jsonl`.
5. Repeat for other intents (e.g., INT-002 Billing Refactor, INT-003 Logging Middleware) to demonstrate parallel intent handling.

**Key Features Demonstrated:**

- **Traceability:** Every code change is linked to a specific intent.
- **Governance:** Hooks enforce scope and constraints before code is written.
- **Scalability:** Multiple intents can be managed concurrently with consistent context injection and trace logging.
