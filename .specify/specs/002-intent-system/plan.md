# Implementation plan: select_active_intent tool

**Feature:** 002-intent-system  
**Spec:** [spec.md](./spec.md)  
**Constitution:** [.specify/memory/constitution.md](../../memory/constitution.md)

This plan covers the **select_active_intent** tool: definition, system prompt change, pre-hook interception, loading intent context from `.orchestration/active_intents.yaml`, returning an XML context block to the LLM, and gatekeeper validation.

---

## Phase 0: Prerequisites and schema

### 0.1 active_intents.yaml schema (minimal for this tool)

Define a minimal schema so the tool and pre-hook can read intent context. Full schema may be extended in a later task.

```yaml
# .orchestration/active_intents.yaml
version: 1
current_intent_id: null | "INT-001"   # null = none selected
intents:
  - id: "INT-001"
    summary: string
    scope:
      allow_glob: string[]   # e.g. ["src/**/*.ts"]
      deny_glob: string[]   # optional
    constraints:
      disallow_tools: string[]
      disallow_patterns: string[]
    acceptance_criteria:
      - id: string
        description: string
        status: "pending" | "met" | "failed"
```

- **Location:** `.orchestration/active_intents.yaml` (workspace root relative).
- **Reader:** Use existing YAML parsing (e.g. `yaml` in package.json); add a small typed loader in `src/orchestration/` or next to the tool.

### 0.2 Tool name and types

- Add **`select_active_intent`** to `ToolName` in `packages/types` (or `src/shared/tools.ts` if types live there).
- Add param type: e.g. `{ intent_id: string }` (required). Optionally `{ intent_id?: string }` for “list available” when no ID given.
- Add to native tool definitions so the model can call it.

---

## Phase 1: Tool definition — `src/hooks/tools/selectActiveIntent.ts`

**Note:** The codebase currently uses `src/core/tools/` for native tools. Two options: (a) Put the new tool under **`src/hooks/tools/selectActiveIntent.ts`** as a dedicated orchestration/hook surface and wire it from there, or (b) Use **`src/core/tools/SelectActiveIntentTool.ts`** for consistency. This plan uses **`src/hooks/tools/`** as requested; if the project prefers a single tools dir, the same logic can live in `src/core/tools/SelectActiveIntentTool.ts`.

### 1.1 Create the tool class

- **File:** `src/hooks/tools/selectActiveIntent.ts`.
- **Class:** `SelectActiveIntentTool extends BaseTool<"select_active_intent">`.
- **Params:** `{ intent_id: string }` (required). Validate format `INT-XXX` (regex or simple prefix check).
- **execute():**
    - Resolve workspace root (e.g. from `task.cwd` or first workspace folder).
    - Read `.orchestration/active_intents.yaml` (create directory/file if missing, with safe defaults).
    - Find intent with `id === intent_id` in `intents`; if not found, pushToolResult with error and return.
    - Build an **XML context block** string containing:
        - `current_intent_id`
        - Selected intent’s `scope`, `constraints`, `acceptance_criteria` (and optionally `summary`).
    - **pushToolResult**(xmlContextBlock) so the LLM receives it as the tool result in the next turn.
- **handlePartial:** Optional; no-op unless streaming UX is needed later.
- Use **formatResponse** or a small helper to wrap the XML so it’s clearly delimited (e.g. `<intent_context>...</intent_context>`).

### 1.2 Register the tool in the execution path

- **presentAssistantMessage** (`src/core/assistant-message/presentAssistantMessage.ts`): In the `switch (block.name)` add:
    - `case "select_active_intent":` → call `selectActiveIntentTool.handle(cline, block, { askApproval, handleError, pushToolResult })`.
- Import the tool from `src/hooks/tools/selectActiveIntent` (or from core if moved). Ensure the tool is registered so it’s available in the same way as `execute_command` / `write_to_file`.

### 1.3 Native tool definition (for the LLM)

- **File:** `src/core/prompts/tools/native-tools/select_active_intent.ts` (same pattern as `execute_command.ts`).
- **name:** `"select_active_intent"`.
- **description:** State that the agent must select an active intent by ID (format INT-XXX) before performing file-modifying or constrained actions; the tool returns the intent’s scope, constraints, and acceptance criteria for the current turn.
- **parameters:** `intent_id` (string, required).
- Export and add to the native tools list in `src/core/prompts/tools/native-tools/index.ts` (and ensure **buildNativeToolsArrayWithRestrictions** / filter-tools-for-mode include it for the appropriate mode(s)).

### 1.4 shared/tools.ts and types

- In `src/shared/tools.ts` (and any central ToolName / param type definition):
    - Add `select_active_intent` to the tool name union and to any param map (e.g. `select_active_intent: { intent_id: string }`).
- Add a **ToolUse<"select_active_intent">** type if the codebase uses per-tool types.

---

## Phase 2: System prompt — require intent selection first

### 2.1 Add “intent selection first” rule

- **Option A (recommended):** Add a new section (e.g. **getIntentSelectionSection()**) in `src/core/prompts/sections/` that returns a short block of text:
    - “You must call the **select_active_intent** tool with a valid intent ID (format INT-XXX) before performing any file-modifying or constrained actions. If no intent is selected, call select_active_intent first.”
- **Option B:** Append the same text inside **getRulesSection** or **getObjectiveSection** in `src/core/prompts/sections/`.
- Wire the new section into **generatePrompt** in `src/core/prompts/system.ts` (e.g. after rules or before capabilities).

### 2.2 Placement

- Insert the intent-selection requirement early in the prompt (e.g. after role/formatting, before or with tool-use guidelines) so the model sees it before tool descriptions.

---

## Phase 3: Pre-hook that intercepts select_active_intent calls

### 3.1 Purpose of the pre-hook

- **Intercept** every **select_active_intent** tool call before the actual tool executes.
- Use this to: (1) ensure the call is valid, (2) optionally load context from YAML and attach to task state for downstream hooks, (3) optionally short-circuit (e.g. return cached XML) or delegate to the real tool.

### 3.2 Implementation options

- **Option A — In presentAssistantMessage, before the switch:** When `block.name === "select_active_intent"`, run a **pre-hook** function (e.g. `orchestrationPreHook.selectActiveIntent(task, block)`). The pre-hook can:
    - Read `.orchestration/active_intents.yaml`.
    - Validate `intent_id` and that the intent exists.
    - Set on the task a “pending intent context” (e.g. `task.currentIntentContext`) so the tool’s execute() can use it, or the pre-hook can push the XML and skip the tool (if “intercept” means “handle here”).
- **Option B — Wrapper around the tool:** A thin wrapper in presentAssistantMessage: when `block.name === "select_active_intent"`, call `selectActiveIntentPreHook(task, block, callbacks)` which may load YAML, run validation, then call `selectActiveIntentTool.handle(...)` (or push result and not call handle).

Recommended: **Option A** — run a pre-hook before the switch; pre-hook loads YAML and sets task-level state (e.g. `task.currentIntentId`, `task.currentIntentContext`); then fall through to the tool’s handle(), which uses that state to build and push the XML (or the pre-hook pushes the XML and the tool no-ops if preferred). This keeps “load and validate” in one place and “format for LLM” in the tool.

### 3.3 Where to define the pre-hook

- **File:** e.g. `src/hooks/preHooks/selectActiveIntent.ts` or `src/orchestration/selectActiveIntentPreHook.ts`.
- **Function:** `selectActiveIntentPreHook(task, block, callbacks): Promise<boolean>` — returns `true` to continue to tool execution, `false` to skip (e.g. already pushed result). Read `.orchestration/active_intents.yaml`, validate, set `task.currentIntentId` and optionally `task.currentIntentContext` (parsed object). If validation fails, push error via `pushToolResult` and return `false`.

---

## Phase 4: Load intent context from YAML and return XML context block

### 4.1 Loading

- In the **pre-hook** (or inside the tool): Read `.orchestration/active_intents.yaml` from workspace root (path: `path.join(task.cwd, ".orchestration", "active_intents.yaml")` or via `vscode.workspace.workspaceFolders[0].uri.fsPath`).
- Parse YAML; find the intent with `id === block.params.intent_id` (or `block.nativeArgs?.intent_id`).
- If file missing or intent not found: pushToolResult with a clear error message and return.

### 4.2 XML context block

- Build a string, e.g.:
    - `<intent_context intent_id="INT-001">`
    - `<scope>...</scope>` (allow_glob, deny_glob)
    - `<constraints>...</constraints>`
    - `<acceptance_criteria>...</acceptance_criteria>`
    - `</intent_context>`
- **pushToolResult**(xmlString) so the next API request receives this as the tool result content. The LLM can then use scope/constraints/criteria for the rest of the turn.

### 4.3 Update current intent on task

- After a successful select_active_intent: set `task.currentIntentId = intent_id` and optionally `task.currentIntentContext = parsedIntent` so the **gatekeeper** (Phase 6) and scope-enforcement hooks can use it.

---

## Phase 5: Gatekeeper validation

### 5.1 Purpose

- Ensure that **before** any tool other than **select_active_intent** is executed, an intent has been selected (i.e. `task.currentIntentId != null` or equivalent).

### 5.2 Placement

- In **presentAssistantMessage**, inside the `block.type === "tool_use"` path, **before** the `switch (block.name)`:
    - If `block.name !== "select_active_intent"` and there is no current intent (e.g. `!cline.currentIntentId`):
        - pushToolResult with a message like: “No active intent selected. You must call select_active_intent with a valid intent ID (INT-XXX) before using other tools.”
        - **break** (do not execute the tool).
    - Optionally: allow a small allowlist of “always allowed” tools (e.g. `read_file`, `list_files`) without an intent; document the allowlist in the plan or spec.

### 5.3 Edge cases

- First user message: no intent selected yet. The system prompt (Phase 2) tells the model to call select_active_intent first; the gatekeeper enforces it if the model tries another tool.
- After select_active_intent succeeds: set `task.currentIntentId` so subsequent tools pass the gatekeeper.
- Task/session reset: clear `task.currentIntentId` when starting a new task or when the user explicitly “clears” intent (if such a command exists later).

---

## Phase 6: Integration checklist

- [ ] **Tool:** `src/hooks/tools/selectActiveIntent.ts` (or `src/core/tools/SelectActiveIntentTool.ts`) implements BaseTool; reads YAML, validates intent_id, builds XML, pushToolResult.
- [ ] **Types:** `select_active_intent` added to ToolName and param types; presentAssistantMessage has a case for it.
- [ ] **Native tool def:** `src/core/prompts/tools/native-tools/select_active_intent.ts` added and exported; tool included in buildNativeToolsArrayWithRestrictions for the relevant mode(s).
- [ ] **System prompt:** New section or rule “intent selection first” added and wired in system.ts.
- [ ] **Pre-hook:** `selectActiveIntentPreHook` runs for every select_active_intent call; loads YAML, validates, sets task.currentIntentId and context; on failure pushes error and returns.
- [ ] **XML context:** Tool (or pre-hook) returns an XML block with scope, constraints, acceptance_criteria to the LLM via tool result.
- [ ] **Gatekeeper:** In presentAssistantMessage, before switch(block.name), if block.name !== "select_active_intent" and !task.currentIntentId, push error and skip execution.
- [ ] **Schema:** Minimal `.orchestration/active_intents.yaml` schema documented (or a TypeScript type in packages/types or src/orchestration).
- [ ] **Constitution:** Two-stage flow (intent selection → execution) and hook middleware respected; `.orchestration/` remains source of truth.

---

## File creation order (suggested)

1. **Schema / types:** Define ActiveIntentsYaml type and minimal schema (e.g. in `src/orchestration/types.ts` or next to the tool).
2. **Tool:** `src/hooks/tools/selectActiveIntent.ts` (or core/tools) — implement execute, YAML read, XML build, pushToolResult.
3. **Native tool def:** `src/core/prompts/tools/native-tools/select_active_intent.ts` + register in index.
4. **shared/tools.ts:** Add select_active_intent name and params.
5. **presentAssistantMessage:** Add case "select_active_intent" and import tool.
6. **Pre-hook:** Implement selectActiveIntentPreHook; call it when block.name === "select_active_intent" before invoking the tool.
7. **System prompt:** Add intent-selection-first section and wire in system.ts.
8. **Gatekeeper:** Add check before switch(block.name) in presentAssistantMessage; set task.currentIntentId after successful select_active_intent.

---

_This plan implements the select_active_intent tool and gatekeeper as specified; scope enforcement (blocking write_to_file outside scope) and constraint enforcement can be added in a follow-up task (pre-tool hook for write_to_file, edit_file, etc.)._
