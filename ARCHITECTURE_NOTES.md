# ARCHITECTURE_NOTES.md — TRP1 Phase 0 & Hook System

## How the VS Code extension works

- **Entry**: Extension activates in `src/activate/` (e.g. `activate.ts`), which registers the **ClineProvider** (sidebar/tab panel) and commands.
- **Provider**: `src/core/webview/ClineProvider.ts` holds the **Task** stack, MCP hub, settings, and webview messaging. It does **not** execute tools; it creates **Task** instances and forwards messages.
- **Task**: `src/core/task/Task.ts` holds per-conversation state (API handler, history, mode, cwd, **activeIntentId** for TRP1), runs the API stream, and pushes assistant content for presentation.
- **Tool execution path**: When the model streams a `tool_use` (or `mcp_tool_use`) block, **presentAssistantMessage** in `src/core/assistant-message/presentAssistantMessage.ts` processes it: validates, then **dispatches to the correct tool handler** via a large `switch (block.name)`.

## Tool loop and mutation points

- **Single choke point**: All native and MCP tool execution goes through **presentAssistantMessage**:
    - **Native**: `case "tool_use":` → `switch (block.name)` with cases for `apply_patch`, `write_to_file`, `edit`, `execute_command`, **select_active_intent**, etc. Each case calls `someTool.handle(cline, block, { askApproval, handleError, pushToolResult })`.
    - **MCP**: `case "mcp_tool_use":` → builds a synthetic `use_mcp_tool` block and calls **useMcpToolTool.handle**.
- **File / mutation tools**: Implementations live under `src/core/tools/`:
    - **ApplyPatchTool** (`ApplyPatchTool.ts` + `apply-patch/`): parses patch, applies add/update/delete; uses **rooIgnoreController**, **rooProtectedController**, **diffViewProvider**, and **askApproval** before writing.
    - **WriteToFileTool**, **EditTool**, **ApplyDiffTool**, etc.: same pattern (validate, optional approval, then mutate).
- **execute_command** and **write_to_file** (and equivalents) are all invoked from this same `presentAssistantMessage` switch; there is no other code path that performs tool execution for the assistant.

## Prompt builder

- **System prompt**: Built in `src/core/prompts/system.ts` via **generatePrompt** (and exported **SYSTEM_PROMPT**). It composes:
    - Role and mode from **getModeBySlug** / **getModeSelection**
    - Sections from `src/core/prompts/sections/`: **getSharedToolUseSection**, **getToolUseGuidelinesSection**, **getCapabilitiesSection**, **getModesSection**, **getRulesSection**, **getSystemInfoSection**, **getObjectiveSection**, **addCustomInstructions**
- **Intent-first instruction**: In **getObjectiveSection** (`sections/objective.ts`) we add the TRP1 rule: before any mutating tool, the model **must** call **select_active_intent(intent_id)**; otherwise the Hook Engine blocks the call.
- **Tools catalog**: Tool definitions (names, descriptions, parameters) come from **getNativeTools** / **buildNativeToolsArrayWithRestrictions** in `src/core/task/build-tools.ts`, which uses `src/core/prompts/tools/native-tools/` (including **select_active_intent**) and mode filtering from `filter-tools-for-mode.ts`.

## Hook Engine (TRP1) integration

- **Location**: `src/hooks/` — **HookEngine.ts**, **types.ts**, **classifier.ts**, **sidecarWriter.ts**.
- **Wiring**: In **presentAssistantMessage**, **before** the tool `switch` we build a **HookContext** (taskId, activeIntentId, mode, modelId, toolName, params, cwd, timestamp) and instantiate **HookEngine** with:
    - **Pre-hooks**: **requireActiveIntent** (block destructive tools if no **activeIntentId**), **hashMutation** (set contentHash from mutationSummary).
    - **Post-hooks**: **syncActiveIntent** (write/update **.orchestration/active_intents.yaml** when intent is set).
- **runWithHooks**: We call **hookEngine.runWithHooks(hookContext, async () => { switch (block.name) { ... } })**. If any pre-hook returns **allow: false**, the tool is **not** executed and we push a **tool_result** error (e.g. "No active intent selected. Call select_active_intent first."). After execution (or after a deny), post-hooks run and we append to **.orchestration/agent_trace.jsonl** (flat entry and, when intent+hash exist, a TRP1-shaped entry with **files[].conversations[].ranges[].content_hash** and **related**).
- **select_active_intent**: New tool in **SelectActiveIntentTool.ts**. It sets **task.activeIntentId**, reads **.orchestration/active_intents.yaml** via **loadActiveIntents**, and returns an **<intent_context>** XML block (constraints, owned_scope) as the tool result so the model has context for subsequent edits.
- **.orchestration/**: Machine-managed directory in workspace root: **active_intents.yaml** (TRP1 intent list), **agent_trace.jsonl** (append-only trace with optional TRP1 schema). **intent_map.md** and **AGENT.md/CLAUDE.md** are specified by TRP1 for later phases (spatial map, shared brain).

## Diagrams (high level)

```
User / Webview
       │
       ▼
ClineProvider (state, webview, Task creation)
       │
       ▼
Task (conversation, API stream, activeIntentId)
       │
       ▼
presentAssistantMessage (for each content block)
       │
       ├─ tool_use ──► HookEngine.runWithHooks(ctx, () => switch(block.name) { … })
       │                    │
       │                    ├─ Pre: requireActiveIntent, hashMutation
       │                    ├─ execute(): apply_patch | write_to_file | select_active_intent | …
       │                    └─ Post: syncActiveIntent; writeTrace(agent_trace.jsonl)
       │
       └─ mcp_tool_use ──► useMcpToolTool.handle (no hook wrapper in current interim)
```

## Interim deliverable checklist

- [x] Fork Roo Code and run in Extension Host.
- [x] Trace tool loop: **presentAssistantMessage** → **switch (block.name)** → tool.handle().
- [x] Locate prompt builder: **system.ts** + **sections/**; intent-first rule in **objective.ts**.
- [x] **src/hooks/** with HookEngine, classifier, sidecarWriter, types.
- [x] **select_active_intent** tool and context injection from **active_intents.yaml**.
- [x] Pre-hook: block mutating tools when **activeIntentId** is missing.
- [x] Post-hook: append **agent_trace.jsonl** (flat + TRP1 schema when intent+hash present).
- [ ] Phase 2+: Scope enforcement (owned_scope), HITL approval in hook, .intentignore.
- [ ] Phase 3+: Full mutation_class (AST_REFACTOR vs INTENT_EVOLUTION), VCS revision_id in trace.
- [ ] Phase 4: Optimistic locking (stale file detection), lessons in CLAUDE.md.
