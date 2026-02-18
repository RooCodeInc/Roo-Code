# TRP1 Challenge – Interim Submission: AI-Native IDE with Intent-Code Traceability

**Author:** [Author Name]  
**Date:** February 18, 2025  
**Repository:** [Repository URL]

---

## 1. How the VS Code Extension Works

### Extension host vs webview

- **Extension host:** Node.js process where the VS Code extension runs. It has access to the workspace, file system, terminals, and APIs. Entry point is `src/extension.ts`; activation is via `activationEvents` (e.g. `onLanguage`, `onStartupFinished`).
- **Webview:** Isolated UI (React app in `webview-ui/`) that renders the Roo Code sidebar/panel. It communicates with the extension host only via `postMessage`. The extension host owns the conversation state, API calls, and tool execution; the webview displays chat and sends user messages.

### Key components

| Component          | Location                                                                        | Role                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ClineProvider**  | `src/core/webview/ClineProvider.ts`                                             | Webview provider: owns webview lifecycle, state, and message handling for the sidebar.                                                                                         |
| **ContextProxy**   | `src/core/config/ContextProxy.ts`                                               | Source of truth for extension state (API config, mode, settings); used by settings and tasks.                                                                                  |
| **Task**           | `src/core/task/Task.ts`                                                         | One conversation/task: holds API conversation history, system prompt, and drives the streaming loop; triggers tool execution via `presentAssistantMessage`.                    |
| **Tool execution** | `src/core/assistant-message/presentAssistantMessage.ts` + `src/core/tools/*.ts` | Dispatches tool calls: validates, runs pre/post hooks where implemented, and calls each tool’s `handle(task, block, callbacks)`; results are pushed back via `pushToolResult`. |

### Data flow

1. User interacts with the **webview** (React UI).
2. Webview sends messages to the **extension host** via `postMessage`; **webviewMessageHandler** routes them.
3. Creating or continuing a task uses **Task**. Task builds the system prompt, builds tools, calls the API handler `createMessage(systemPrompt, messages, metadata)`, then consumes the stream.
4. Streamed content (text, `tool_use` blocks) is appended to Task’s `assistantMessageContent`. **presentAssistantMessage** processes each block (show text or run a tool).
5. Tool execution lives in **src/core/tools/**; each tool’s `handle(task, block, callbacks)` performs the action and pushes results via `pushToolResult` into the next API request.

---

## 2. Code and Design Architecture of the Agent

### Tool loop

- **Tool definitions (for the LLM):** `src/core/prompts/tools/native-tools/` — one file per tool (name, description, parameters). Filtering per mode is done in `build-tools.ts` → **buildNativeToolsArrayWithRestrictions**.
- **Execution path:** All tool execution goes through **presentAssistantMessage** (`src/core/assistant-message/presentAssistantMessage.ts`). Flow for a single tool call:
    1. Streaming yields events (e.g. `content_block_start` with `tool_use`); **NativeToolCallParser** parses and normalizes blocks.
    2. **presentAssistantMessage** reads the block, resolves tool description, handles rejection/validation (e.g. **validateToolUse**), runs repetition check, then dispatches via **switch (block.name)**.
    3. Each tool handler (e.g. **WriteToFileTool**, **ExecuteCommandTool**) implements `handle(task, block, { askApproval, handleError, pushToolResult })`, performs the action, and pushes the result.

### Key files and purposes

| File or folder                                          | Responsibility                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/extension.ts`                                      | Activation: ContextProxy, ClineProvider, commands, MCP, code index.                                                                         |
| `src/core/webview/ClineProvider.ts`                     | Webview provider; state; postMessage to webview.                                                                                            |
| `src/core/webview/webviewMessageHandler.ts`             | Handles webview messages (run task, getSystemPrompt, chat, etc.).                                                                           |
| `src/core/task/Task.ts`                                 | Single task: conversation history, `getSystemPrompt()`, `attemptApiRequest()`, streaming loop, calls **presentAssistantMessage** per block. |
| `src/core/assistant-message/presentAssistantMessage.ts` | Dispatches blocks (text vs tool_use); validation; gatekeeper; pre/post hooks; calls each tool’s `.handle()`.                                |
| `src/core/assistant-message/NativeToolCallParser.ts`    | Parses/normalizes streaming tool_use blocks.                                                                                                |
| `src/core/tools/*.ts`                                   | One class per native tool; each implements **handle()**.                                                                                    |
| `src/core/task/build-tools.ts`                          | **buildNativeToolsArrayWithRestrictions**: builds tools array for the API from mode, disabled tools, MCP, etc.                              |
| `src/core/prompts/system.ts`                            | **SYSTEM_PROMPT** / **generatePrompt**: assembles the system prompt from sections.                                                          |
| `src/core/prompts/sections/*.ts`                        | Sections: rules, system-info, capabilities, modes, skills, tool-use, custom-instructions.                                                   |
| `src/core/prompts/tools/native-tools/*.ts`              | Per-tool definitions for the LLM.                                                                                                           |
| `src/hooks/preHooks/*.ts`, `src/hooks/postHooks/*.ts`   | Pre- and post-hooks for `select_active_intent` and `write_to_file`.                                                                         |
| `src/hooks/models/orchestration.ts`                     | Types for `.orchestration/` (e.g. **ActiveIntent**, **ActiveIntentsFile**).                                                                 |

### Prompt builder location

- **Runtime:** **Task.getSystemPrompt()** in `src/core/task/Task.ts` (~line 3745), used when building each API request.
- **Assembly:** **SYSTEM_PROMPT** / **generatePrompt** in `src/core/prompts/system.ts`; sections come from `src/core/prompts/sections/` (rules, capabilities, modes, skills, tool-use, system-info, objective, custom-instructions). Tool definitions are built separately in **buildNativeToolsArrayWithRestrictions** and passed in **metadata.tools**.

### Hook injection points

- **Before/after tool execution:** In **presentAssistantMessage**, before the **switch (block.name)**: gatekeeper (intent check) and per-tool pre-hooks (e.g. **selectActiveIntentPreHook**, **writeFilePreHook**). After the tool’s `handle()`: post-hooks (e.g. **writeFilePostHook**).
- **Intent selection:** For `select_active_intent`, the pre-hook runs first (load/validate from `.orchestration/active_intents.yaml`, set `task.currentIntentId`), then the tool result (context XML) is pushed; the tool’s `handle()` is not invoked separately.
- **Scope enforcement:** **writeFilePreHook** (Phase 2) will use `owned_scope` from active intents to block out-of-scope writes.
- **Traceability:** **writeFilePostHook** (Phase 3) will append to `.orchestration/agent_trace.jsonl` and update `.orchestration/intent_map.md`.

---

## 3. Architectural Decisions for the Hook System

| Decision                                     | Choice                                                                                                                                                                                                        | Rationale                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Two-stage state machine**                  | (1) Reasoning Intercept: agent selects intent, pre-hook loads context and injects it into the prompt; (2) Contextualized Action: LLM acts with that context, tool calls go through hooks for scope and trace. | Separates “what we’re working on” from “what we do.” Intent is fixed and visible before edits, so traceability and scope are consistent. |
| **Pre-hook intercept pattern**               | Before a tool runs, a pre-hook can validate (e.g. intent exists, path in scope) and block or allow. No change to tool implementations.                                                                        | Single interception point in **presentAssistantMessage**; tools stay unaware of orchestration; easy to add new hooks per tool.           |
| **Gatekeeper pattern**                       | Before dispatching any tool except `select_active_intent`, require `task.currentIntentId` to be set; otherwise return an error and skip execution.                                                            | Ensures the agent always selects an intent before file-modifying or constrained actions, so every change is tied to an intent.           |
| **`.orchestration/` as source of truth**     | Active intents in `.orchestration/active_intents.yaml`; trace log in `.orchestration/agent_trace.jsonl`; intent–path map in `.orchestration/intent_map.md`.                                                   | File-based, versionable, and independent of in-memory state; aligns with constitution and AI-native git.                                 |
| **Content hashing for spatial independence** | Post-hook computes a content hash (e.g. SHA-256) of changed code and stores it in the trace.                                                                                                                  | Enables verification and diff-agnostic traceability: “this intent produced this hash” without depending on line numbers.                 |
| **Scope enforcement**                        | `owned_scope` in each intent is a list of globs (with `!` exclusions); write_file pre-hook resolves the target path and blocks if out of scope.                                                               | Keeps edits within the intent’s declared scope; reduces accidental cross-intent edits and supports multi-intent workspaces.              |

---

## 4. Diagrams and Schemas

### Two-stage state machine

Diagram: **[docs/diagrams/two-stage-state-machine.md](docs/diagrams/two-stage-state-machine.md)**

- States: **Request** (user prompt) → **Reasoning Intercept** (identify intent, call `select_active_intent`, pre-hook, validate, load context, build XML, inject context) → **Contextualized Action** (LLM generates changes, `write_file`, post-hook: hash, trace, log, map).

### Hook flow

Diagram: **[docs/diagrams/hook-flow.md](docs/diagrams/hook-flow.md)**

- Extension host flow: User message → Tool call → Gatekeeper (intent selected?) → Route by tool type. Shows `select_active_intent` (pre-hook only), `write_to_file` (pre-hook → tool → post-hook), `execute_command` (no hooks), and connections to `.orchestration/` files.

### active_intents.yaml schema

Full schema and field reference: **[docs/schemas/active_intents.md](docs/schemas/active_intents.md)**.

Minimal example:

```yaml
active_intents:
    - id: INT-001
      name: Add dark mode toggle to settings
      status: IN_PROGRESS
      owned_scope:
          - "src/settings/**"
          - "!**/node_modules/**"
      constraints:
          - "Use cachedState for inputs; do not bind to useExtensionState()"
      acceptance_criteria:
          - "Toggle appears in Settings UI and persists across reloads"
```

---

## 5. Implementation Status

| Area                                    | Status      | Notes                                                                                                                                                                                                   |
| --------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 0: Schema and types**           | Complete    | Schema documented in `docs/schemas/active_intents.md`; TypeScript types in `src/hooks/models/orchestration.ts`; `select_active_intent` in tool names and param type in `packages/types` / shared tools. |
| **Hooks structure**                     | Complete    | `src/hooks/preHooks/selectActiveIntent.ts`, `writeFile.ts`; `src/hooks/postHooks/writeFile.ts`; `src/hooks/tools/selectActiveIntent.ts`; `src/hooks/models/orchestration.ts`.                           |
| **Models and utilities**                | Implemented | **ActiveIntent**, **ActiveIntentsFile** (and related) in `orchestration.ts`; pre/post hook signatures and stubs in place.                                                                               |
| **Gatekeeper**                          | Implemented | In **presentAssistantMessage**: require `currentIntentId` for all tools except `select_active_intent`; error message pushed and execution skipped if missing.                                           |
| **select_active_intent in host**        | Implemented | Case in **presentAssistantMessage**; calls **selectActiveIntentPreHook**; sets `cline.currentIntentId`; pushes context or message; no separate tool handle.                                             |
| **Native tool definition**              | Implemented | `src/core/prompts/tools/native-tools/select_active_intent.ts`; added to native tools index.                                                                                                             |
| **Phase 1: Tool definition (full)**     | Planned     | YAML loader, XML context build, and full pre-hook logic (load from file, validate, return XML) to be completed.                                                                                         |
| **Phase 2: System prompt**              | Planned     | Intent-selection section (require calling `select_active_intent` before file-modifying actions) and wire into **generatePrompt**.                                                                       |
| **Phase 3: Pre-hook (full)**            | Planned     | Pre-hook to read `.orchestration/active_intents.yaml`, validate intent_id, set `currentIntentId`/context, return XML block.                                                                             |
| **Phase 4: Load YAML + XML**            | Planned     | Load intent from YAML, build `<intent_context>` XML with scope, constraints, acceptance_criteria; push as tool result.                                                                                  |
| **Phase 5: Gatekeeper (polish)**        | Partial     | Core gatekeeper done; allowlist for tools without intent and clear on reset are planned.                                                                                                                |
| **Scope enforcement (write_file)**      | Planned     | **writeFilePreHook** to resolve path against `owned_scope` and block out-of-scope writes (Phase 2 follow-up).                                                                                           |
| **Traceability (write_file post-hook)** | Planned     | **writeFilePostHook** to compute hash, create trace entry, append to `agent_trace.jsonl`, update `intent_map.md` (Phase 3).                                                                             |

---

## 6. Next Steps (Final Submission)

- **Phase 1:** Finish tool definition: YAML loader for `.orchestration/active_intents.yaml`, build XML context in pre-hook or tool, ensure `select_active_intent` case and types are fully wired.
- **Phase 2:** Add intent-selection section to system prompt (e.g. **getIntentSelectionSection()** in `sections/`) and wire into **generatePrompt**; implement **writeFilePreHook** scope check using `owned_scope`.
- **Phase 3:** Complete **selectActiveIntentPreHook** (read YAML, validate, set `task.currentIntentId` and context, return XML); complete **writeFilePostHook** (hash, trace entry, append to `agent_trace.jsonl`, update `intent_map.md`).
- **Phase 4:** Load intent from YAML in pre-hook, build `<intent_context intent_id="...">` XML with scope, constraints, acceptance_criteria; push via tool result; document and verify INT-XXX format and integration (Phase 6 tasks).

---

## 7. References

- **Challenge document:** [TRP1 challenge specification — link to be added]
- **ARCHITECTURE_NOTES.md:** [ARCHITECTURE_NOTES.md](ARCHITECTURE_NOTES.md) — extension architecture, tool loop, prompt builder, hook injection points.
- **GitHub Spec Kit:** [.specify/specs/](.specify/specs/) — intent orchestration (001), intent system (002); spec and plan in [.specify/specs/002-intent-system/](.specify/specs/002-intent-system/).
- **AISpec:** [AISpec](https://github.com/aispec-dev/aispec) — specification and planning references.
