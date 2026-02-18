# Roo Code – Architecture Notes

This document describes the VS Code extension architecture, tool execution flow, prompt building, key files, and where to inject hooks (e.g. for intent orchestration and traceability).

---

## 1. VS Code Extension Architecture

### Entry and activation

- **Entry point:** `src/package.json` → `"main": "./dist/extension.js"` (built from `src/extension.ts`).
- **Activation:** `activationEvents: ["onLanguage", "onStartupFinished"]` — extension activates on first use or when a language is used.
- **Activation logic:** `src/extension.ts` → `activate(context)`:
    - Sets up output channel, network proxy, telemetry, i18n, terminal registry, OpenAI Codex OAuth.
    - Gets/creates **ContextProxy** (extension state).
    - Initializes **CodeIndexManager** per workspace folder.
    - Creates **ClineProvider** (sidebar webview provider) and registers it.
    - Registers commands, code actions, terminal actions, URI handler; starts MCP server manager, model cache refresh, etc.

### Core components

| Component                   | Location                                    | Role                                                                                                                    |
| --------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **ClineProvider**           | `src/core/webview/ClineProvider.ts`         | Webview provider for the Roo Code sidebar/panel; owns webview lifecycle, state, and message handling.                   |
| **ContextProxy**            | `src/core/config/ContextProxy.ts`           | Source of truth for extension state (API config, mode, settings); used by settings and tasks.                           |
| **Webview message handler** | `src/core/webview/webviewMessageHandler.ts` | Handles messages from the webview (chat, getSystemPrompt, run task, etc.).                                              |
| **Task**                    | `src/core/task/Task.ts`                     | Represents a single conversation/task: API conversation history, system prompt, tool execution trigger, streaming loop. |

### Data flow (high level)

1. User interacts with the **webview** (React UI in `webview-ui/`).
2. Webview sends messages to the **extension host** via `postMessage`; **webviewMessageHandler** routes them.
3. Creating or continuing a task uses **Task** in the extension. **Task** builds the system prompt, builds tools, calls **API handler** `createMessage(systemPrompt, messages, metadata)`, then consumes the stream.
4. Streamed content (text, tool_use blocks) is appended to **Task**’s `assistantMessageContent`. **presentAssistantMessage** is called to process the current block (show text or run a tool).
5. Tool execution is implemented in **src/core/tools/**; each tool’s `handle(task, block, callbacks)` performs the action and pushes results back via `pushToolResult`.

---

## 2. Tool Execution Flow

### Where tools are defined and executed

- **Tool types / names:** `src/shared/tools.ts` (e.g. `write_to_file`, `execute_command`, `read_file`, `apply_diff`, `use_mcp_tool`, …).
- **Native tool definitions (for the LLM):** `src/core/prompts/tools/native-tools/` — one file per tool (e.g. `write_to_file.ts`, `execute_command.ts`) defining name, description, and parameters for the system prompt.
- **Filtering per mode:** `src/core/prompts/tools/filter-tools-for-mode.ts` and `src/core/task/build-tools.ts` → **buildNativeToolsArrayWithRestrictions** produce the list of tools (and optional `allowedFunctionNames`) sent to the API.
- **Execution:** All tool execution goes through **presentAssistantMessage** in `src/core/assistant-message/presentAssistantMessage.ts`.

### Flow for a single tool call

1. **Streaming:** The API stream yields events (e.g. `content_block_start` with `tool_use`).

    - **NativeToolCallParser** (`src/core/assistant-message/NativeToolCallParser.ts`) parses and normalizes tool call blocks (including streaming partials).
    - Completed blocks are pushed to **Task**’s `assistantMessageContent`.

2. **presentAssistantMessage** runs (from the main streaming loop in **Task** when a content block is ready):

    - Reads the current block from `assistantMessageContent[currentStreamingContentIndex]`.
    - If `block.type === "tool_use"` (or `mcp_tool_use`), it:
        - Resolves a human-readable **toolDescription** (for UI).
        - Handles **didRejectTool** (skips execution, pushes error tool_result).
        - Ensures **nativeArgs** exist for non-partial blocks (else pushes error and breaks).
        - **Validates** the tool with **validateToolUse** (mode, disabled tools, custom modes, etc.).
        - Runs **tool repetition** check (**ToolRepetitionDetector**).
        - Dispatches to the correct tool handler via a **switch (block.name)**.

3. **Tool handlers** (each extends **BaseTool** in `src/core/tools/`):

    - **write_to_file** → `WriteToFileTool.handle()` in `src/core/tools/WriteToFileTool.ts`.
    - **execute_command** → `ExecuteCommandTool.handle()` in `src/core/tools/ExecuteCommandTool.ts`.
    - **read_file** → `ReadFileTool.handle()`, **apply_diff** → **ApplyDiffTool**, **edit_file** → **EditFileTool**, **use_mcp_tool** → **UseMcpToolTool**, etc.
    - Each `handle(task, block, { askApproval, handleError, pushToolResult })`:
        - Validates params (e.g. missing `path` or `command`).
        - Optionally calls **askApproval** (user approval for dangerous tools).
        - Performs the action (e.g. write file, run command in terminal).
        - Pushes the result with **pushToolResult** (and optionally **handleError**).

4. **pushToolResult** (defined inside presentAssistantMessage) pushes a `tool_result` into **Task**’s `userMessageContent` (and thus into the next API request).

### Summary: where write_file and execute_command are handled

- **write_to_file** (and **apply_diff**, **edit_file**, etc.):  
  **presentAssistantMessage** → `case "write_to_file"` → **writeToFileTool.handle(...)** in `src/core/tools/WriteToFileTool.ts`.
- **execute_command**:  
  **presentAssistantMessage** → `case "execute_command"` → **executeCommandTool.handle(...)** in `src/core/tools/ExecuteCommandTool.ts`.

File edits that support checkpoints call **checkpointSaveAndMark(cline)** before the tool handle.

---

## 3. Prompt Builder – Location and Structure

### Entry points

- **Task (runtime):** `Task.getSystemPrompt()` in `src/core/task/Task.ts` (around line 3745). Used when building each API request (e.g. in **attemptApiRequest**).
- **Webview / preview:** `src/core/webview/generateSystemPrompt.ts` → **generateSystemPrompt(provider, message)**. Used for “get system prompt” and “copy system prompt” from the UI. Both ultimately call **SYSTEM_PROMPT** from `src/core/prompts/system.ts`.

### SYSTEM_PROMPT and generatePrompt

- **File:** `src/core/prompts/system.ts`.
- **Function:** `SYSTEM_PROMPT(context, cwd, supportsComputerUse, mcpHub, diffStrategy, mode, customModePrompts, customModes, globalCustomInstructions, experiments, language, rooIgnoreInstructions, settings, todoList, modelId, skillsManager)`.
- It delegates to **generatePrompt** with the same conceptual inputs. **generatePrompt** assembles one large string (the system prompt) from sections.

### Sections (order and source)

The system prompt is built from these sections (see **generatePrompt** in `system.ts` and exports in `src/core/prompts/sections/index.ts`):

| Section             | Function                                   | File                              |
| ------------------- | ------------------------------------------ | --------------------------------- |
| Role / mode         | From **getModeSelection** (roleDefinition) | `shared/modes`, custom modes      |
| Markdown formatting | **markdownFormattingSection()**            | `sections/markdown-formatting.ts` |
| Shared tool use     | **getSharedToolUseSection()**              | `sections/tool-use.ts`            |
| Tool use guidelines | **getToolUseGuidelinesSection()**          | `sections/tool-use-guidelines.ts` |
| Capabilities        | **getCapabilitiesSection(cwd, mcpHub)**    | `sections/capabilities.ts`        |
| Modes               | **getModesSection(context)**               | `sections/modes.ts`               |
| Skills              | **getSkillsSection(skillsManager, mode)**  | `sections/skills.ts`              |
| Rules               | **getRulesSection(cwd, settings)**         | `sections/rules.ts`               |
| System info         | **getSystemInfoSection(cwd)**              | `sections/system-info.ts`         |
| Objective           | **getObjectiveSection()**                  | `sections/objective.ts`           |
| Custom instructions | **addCustomInstructions(...)**             | `sections/custom-instructions.ts` |

Tool definitions sent to the API are **not** part of this string; they are built separately in **buildNativeToolsArrayWithRestrictions** (see **build-tools.ts** and **prompts/tools/**) and passed in **metadata.tools** to **createMessage**.

---

## 4. Key Files and Responsibilities

| File or folder                                            | Responsibility                                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **src/extension.ts**                                      | Activation: ContextProxy, ClineProvider, commands, MCP, code index, cloud, telemetry.                                                            |
| **src/core/webview/ClineProvider.ts**                     | Webview provider; state; postMessage to webview; getState().                                                                                     |
| **src/core/webview/webviewMessageHandler.ts**             | Handles all webview messages (run task, getSystemPrompt, chat, etc.).                                                                            |
| **src/core/task/Task.ts**                                 | Single task: conversation history, getSystemPrompt(), attemptApiRequest(), streaming loop, calls presentAssistantMessage for each content block. |
| **src/core/assistant-message/presentAssistantMessage.ts** | Dispatches assistant content blocks: text vs tool_use; validation; approval; calls each tool’s `.handle()`.                                      |
| **src/core/assistant-message/NativeToolCallParser.ts**    | Parses/normalizes streaming tool_use blocks (including partials).                                                                                |
| **src/core/tools/\*.ts**                                  | One class per native tool (WriteToFileTool, ExecuteCommandTool, ReadFileTool, EditFileTool, etc.); each implements **handle()**.                 |
| **src/core/tools/validateToolUse.ts**                     | Validates that a tool is allowed for the current mode and config.                                                                                |
| **src/core/task/build-tools.ts**                          | **buildNativeToolsArrayWithRestrictions**: builds the tools array (and allowedFunctionNames) for the API from mode, disabled tools, MCP, etc.    |
| **src/core/prompts/system.ts**                            | **SYSTEM_PROMPT** / **generatePrompt**: assembles the system prompt string from sections.                                                        |
| **src/core/prompts/sections/\*.ts**                       | Sections: rules, system-info, capabilities, modes, skills, tool-use, custom-instructions, etc.                                                   |
| **src/core/prompts/tools/native-tools/\*.ts**             | Per-tool definitions (name, description, params) for the LLM.                                                                                    |
| **src/shared/tools.ts**                                   | Tool name types, param shapes, tool use types.                                                                                                   |
| **src/api/index.ts**                                      | **buildApiHandler**; exports **ApiHandler**, **ApiStream**, provider list.                                                                       |
| **src/api/providers/base-provider.ts**                    | Abstract **createMessage(systemPrompt, messages, metadata)**.                                                                                    |
| **src/api/providers/\*.ts**                               | Provider-specific **createMessage** (Anthropic, OpenAI, Gemini, etc.) and stream handling.                                                       |

---

## 5. Where to Inject Hooks

These are the main places to plug in orchestration, intent IDs, or middleware without rewriting the whole flow.

### 5.1 Before/after system prompt creation

- **Task.getSystemPrompt()** (`src/core/task/Task.ts`, ~3745):
    - **Before:** Compute or resolve intent ID; inject intent-specific instructions or tags into the prompt.
    - **After:** Post-process or log the system prompt (e.g. attach intent ID for traceability).  
      You can wrap the existing `SYSTEM_PROMPT(...)` call or add a small wrapper that calls a “prompt hook” with (intentId, systemPrompt).

### 5.2 Before/after API request (createMessage)

- **Task.attemptApiRequest** (~4020–4285):
    - **Before `this.api.createMessage(systemPrompt, cleanConversationHistory, metadata)`:**
        - Attach **intent ID** (and optionally state-machine phase) to **metadata** so providers or stream handlers can log/trace.
        - Optionally add a “request hook” that receives (intentId, systemPrompt, messages, metadata).
    - **After the stream ends:**
        - “Response hook” with (intentId, usage, finish reason) for traceability and analytics.

### 5.3 Before/after tool execution (single tool call)

- **presentAssistantMessage** (`src/core/assistant-message/presentAssistantMessage.ts`), inside the `block.type === "tool_use"` path:
    - **Before the `switch (block.name)`** (and before **validateToolUse** if you want to allow middleware to reject or redirect):
        - **Pre-tool hook:** (task, block, intentId) → allow / deny / transform params.
        - Ensures every tool execution is tied to the current **intent ID** (e.g. from task or context).
    - **After each `tool.handle(...)`** (or in a shared wrapper):
        - **Post-tool hook:** (task, block, result, intentId) for logging and traceability (e.g. record in `.orchestration/` or a trace store).

### 5.4 Tool-level hooks (per-tool class)

- **BaseTool** in `src/core/tools/` (base class for WriteToFileTool, ExecuteCommandTool, etc.):
    - Add optional **beforeHandle** / **afterHandle** (or a single **handleWithHooks**) so every tool run goes through a common middleware (e.g. attach intent ID, write to trace log).
- Alternatively, wrap **handle** at the call site in presentAssistantMessage (one wrapper that calls pre/post hooks then `tool.handle(...)`).

### 5.5 Tool list building (for intent- or phase-specific tools)

- **buildNativeToolsArrayWithRestrictions** in `src/core/task/build-tools.ts`:
    - **Hook:** Before returning, filter or augment the tools array based on **intent** or **state-machine phase** (e.g. “intent selection” vs “execution” might expose different tools).
    - Caller is **Task** in several places (e.g. attemptApiRequest, context management). You can pass intent/phase via an options object if you add it to the task context.

### 5.6 Validation and approval

- **validateToolUse** in `src/core/tools/validateToolUse.ts`:
    - **Hook:** Before or after validation, enforce orchestration rules (e.g. “only these tools in execution phase”) or attach intent ID to the validation context.
- **askApproval** in presentAssistantMessage:
    - **Hook:** Wrap **askApproval** so that approval decisions are logged with intent ID, or so that certain intents auto-approve.

### 5.7 Streaming and tool call parsing

- **NativeToolCallParser** (`src/core/assistant-message/NativeToolCallParser.ts`):
    - When finalizing a tool call (full JSON parsed), you can emit an event or call a **hook** with (taskId, toolName, toolUseId, input) so downstream can record “tool X was invoked with intent Y” before execution.
- **Task** streaming loop (where **content_block_delta** and **content_block_stop** are processed):
    - After a tool_use block is finalized and before **presentAssistantMessage** runs, you can run a **hook** that tags the block with the current intent ID (e.g. store in a Map by content block index).

### Suggested order for intent–code traceability

1. **Intent selection phase:** Resolve or assign an **intent ID** when a user message is accepted (e.g. in the handler that pushes the user message and triggers **recursivelyMakeClineRequests**). Store it on **Task** (e.g. `task.currentIntentId`) or in a small context object.
2. **Before createMessage:** Pass intent ID in **metadata** (e.g. `metadata.intentId`) and/or append a short line to the system prompt (e.g. “Current intent ID: …”).
3. **Pre-tool hook in presentAssistantMessage:** Before the `switch (block.name)`, call a middleware that records (intentId, toolName, toolUseId, params) to `.orchestration/` or your trace store.
4. **Post-tool hook:** After each `tool.handle(...)`, record (intentId, toolName, result status) for traceability.
5. **Optional:** In **buildNativeToolsArrayWithRestrictions**, restrict or add tools based on phase (intent selection vs execution) if your two-stage state machine requires it.

---

_These notes align with the constitution in `.specify/memory/constitution.md`: intent–code traceability, `.orchestration/` as source of truth, two-stage state machine (intent selection → execution), and the hook middleware pattern._
