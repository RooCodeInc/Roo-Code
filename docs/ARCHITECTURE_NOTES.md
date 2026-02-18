# ARCHITECTURE_NOTES

**Goal**
Upgrade the Roo Code extension into a governed AI-Native IDE by adding a deterministic Hook Engine that enforces intent-aware tool use, full traceability, and human-in-the-loop (HITL) governance.

**Overview**

- The IDE is split into three privilege layers: Webview (UI), Extension Host (logic), and Hook Engine (middleware). The Hook Engine intercepts every tool execution to enforce context, record intent traces, and require authorization when necessary.

**Key Components**

- **Webview (UI)**: Presents chat and mode controls; requests system prompt previews and sends user messages. (integration points: `src/core/webview/generateSystemPrompt.ts`, webview message handler).
- **System Prompt Builder**: Canonical prompt for LLMs is produced by `src/core/prompts/system.ts` (export `SYSTEM_PROMPT`). The prompt is invoked for previews by `src/core/webview/generateSystemPrompt.ts` and at runtime by `src/core/task/Task.ts` via `getSystemPrompt()`.
- **Task / Execution Loop**: `src/core/task/Task.ts` coordinates conversation state, builds tool metadata and API calls, and uses `SYSTEM_PROMPT` before calling the LLM.
- **Tools Surface / Types**: Tool schemas and names live in `src/shared/tools.ts` (native tool signatures like `write_to_file` and `execute_command`).
- **Destructive Tool Implementations**: The write and command tools (referred to as `WriteToFileTool.ts` and `ExecuteCommandTool.ts`) are the primary interception targets — wrap these implementations with Pre/Post hooks.

**Hook Engine (Middleware)**

- Implement a middleware/interceptor pattern that wraps all tool dispatch paths in the Extension Host.
- Two hook phases:
    - **PreToolUse**: Validate intent context, scope, and authorization. Reject or block tool requests that fail validation. For destructive actions, pause execution and prompt the user with `vscode.window.showWarningMessage("Approve/Reject")` or similar.
    - **PostToolUse**: Record a canonical Agent Trace entry (see "Trace Ledger"), compute spatial content hashes, and update sidecar state (`.orchestration/`).
- Hooks must be composable and fail-safe: non-blocking reads continue; destructive calls default to rejected if hook fails.

**Two-Stage State Machine (Handshake)**

1. **Request**: User asks the agent (e.g., "Refactor auth middleware").
2. **Handshake / Reasoning Intercept**:
    - Agent _must_ call a mandatory tool: `select_active_intent(intent_id)` (new tool).
    - PreToolUse intercepts `select_active_intent`, loads `active_intents.yaml`, and returns a compact `<intent_context>` block containing scope, constraints, and acceptance criteria.
    - If no valid `intent_id` is supplied, block and return: "You must cite a valid active Intent ID." to the model.
3. **Contextualized Action**: Agent proceeds to call LLM with injected intent context and then uses tools (e.g., `write_to_file`). PostToolUse hooks record traces.

**Data Model (.orchestration/)**

- `active_intents.yaml` — the intent registry (id, name, status, owned_scope, constraints, acceptance_criteria).
- `agent_trace.jsonl` — append-only ledger linking intent IDs to content hashes, file paths, ranges, timestamps, contributor metadata, and VCS revision.
- `intent_map.md` — spatial map linking intents to files/AST nodes.
- `AGENT.md` / `CLAUDE.md` — shared brain for lessons, rules, and style guidance.

**Agent Trace Schema (high level)**

- Each record (JSON object) includes: `id`, `timestamp`, `vcs.revision_id`, `files[]` where each file entry has `relative_path`, `conversations[]` with `contributor`, `ranges[]` including `start_line`, `end_line`, and `content_hash` (sha256). Append each record as a newline-delimited JSON entry in `agent_trace.jsonl`.
- Spatial hashing: use SHA-256 of the code _block_ content (not line numbers) to preserve identity when code moves.

**Scope & Authorization Rules**

- Enforce `owned_scope` from `active_intents.yaml` in PreToolUse for `write_to_file` and other destructive actions. If file not in scope, block and return: "Scope Violation: <intent_id> is not authorized to edit [filename]."
- Provide an "intent expansion" flow when required (agent may request scope expansion via a controlled tool call).

**Concurrency & Optimistic Locking**

- On write attempt: compute hash of the on-disk file and compare to the hash the agent read earlier.
- If mismatch => return "Stale File" error; block write and require agent to re-read and attempt reconciliation.

**Integration Points (where to implement changes)**

- System prompt construction: `src/core/prompts/system.ts` (modify to include Handshake instructions and mandatory `select_active_intent` behavior).
- Webview preview: `src/core/webview/generateSystemPrompt.ts` (used for preview/testing).
- Task runtime: `src/core/task/Task.ts` — `getSystemPrompt()` and the API call flow; integrate Pre/Post hook invocation points here.
- Tool definitions/types: `src/shared/tools.ts` — update native arg schemas and add `select_active_intent` tool signature.
- Tool execution wrappers: wrap the implementations of write/execute tools (the files referred to as `WriteToFileTool.ts` and `ExecuteCommandTool.ts`) so Pre/Post hooks run on every mutation or external command.
- Hooks directory: create `src/hooks/` containing `HookEngine`, `preHooks/*.ts`, `postHooks/*.ts` and an adapter that registers hooks with the tool dispatcher.

**Security & Auditability**

- All PostToolUse traces must be cryptographically integrity-protected (consider signed entries) and append-only.
- Limit tool rights based on workspace config (use `.intentignore`-style file for exceptions).
- For rejected or failed hook checks, return standardized JSON tool-errors so the model can recover.

**Developer Experience**

- Keep the hooks opt-in per workspace or profile during rollout (feature flag in settings).
- Provide clear UI flows for approvals, scope requests, and visible `.orchestration/` files in the Explorer (machine-managed but viewable).

**Minimal Implementation Roadmap**

1. Add new tool signature `select_active_intent(intent_id: string)` to `src/shared/tools.ts`.
2. Implement a lightweight `HookEngine` in `src/hooks/` and wire it into the tool dispatch pipeline in the Extension Host.
3. Modify `src/core/prompts/system.ts` to include Handshake protocol language requiring `select_active_intent` before destructive actions.
4. Wrap `WriteToFile` and `ExecuteCommand` implementations with Pre/Post hooks (scope check, approval UI, trace logging).
5. Implement `active_intents.yaml` and a trace writer that appends `agent_trace.jsonl` with content hashes.
6. Add optimistic locking logic to the write flow.
