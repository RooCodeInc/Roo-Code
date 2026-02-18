# Architecture Notes (Roo Code)

## 1. Primary Runtime Entry Points

- `src/extension.ts`

    - `export async function activate(context: vscode.ExtensionContext)`
    - Boots services (telemetry/cloud/i18n/terminal/model cache), creates `ClineProvider`, registers commands/webview providers, and returns the extension API.

- `src/core/webview/ClineProvider.ts`

    - Main extension-side controller for webview state, task lifecycle, provider profiles, and task stack/delegation.
    - Registers webview receive handler and routes messages to `webviewMessageHandler`.

- `src/core/webview/webviewMessageHandler.ts`

    - `export const webviewMessageHandler = async (provider: ClineProvider, message: WebviewMessage, marketplaceManager?: MarketplaceManager) => { ... }`
    - Handles inbound UI events (task submit/edit/delete, settings/profile updates, worktree actions, skills, etc.).

- `src/core/task/Task.ts`
    - Runtime engine for a single task: model streaming, tool-call parsing, tool-result persistence, retries, context management, approvals, and task messaging.

## 2. System Prompt Assembly

- `src/core/prompts/system.ts`

    - `export const SYSTEM_PROMPT = async (...) => Promise<string>`
    - Composes the system prompt from section builders in `src/core/prompts/sections/*`.

- Current notable sections:
    - `system-info.ts`: OS/shell/workspace context.
    - `intent-governance.ts`: intent-first policy and `select_active_intent` workflow.
    - `tool-use.ts`, `tool-use-guidelines.ts`, `rules.ts`, `modes.ts`, `skills.ts`, `objective.ts`, `capabilities.ts`.

## 3. Tool Definitions vs Tool Implementations

- Prompt-side tool schema (what the model can call):

    - `src/core/prompts/tools/native-tools/index.ts`
    - Includes `select_active_intent`, `write_to_file`, `apply_patch`, `execute_command`, etc.

- Runtime tool implementations (what executes):

    - `src/core/tools/*.ts`
    - Example: `src/core/tools/WriteToFileTool.ts`
    - Example: `src/core/tools/SelectActiveIntentTool.ts`

- Tool array construction (mode filtering + MCP + custom tools):
    - `src/core/task/build-tools.ts`
    - `buildNativeToolsArrayWithRestrictions(...)`

## 4. Tool Call Execution Flow

1. Webview sends message -> `ClineProvider` `onDidReceiveMessage(...)`.
2. `webviewMessageHandler` routes events; task messages call `Task.submitUserMessage(...)`.
3. `Task` builds prompt + tools (`SYSTEM_PROMPT`, `buildNativeToolsArrayWithRestrictions`) and streams model output.
4. Tool call chunks are parsed by `NativeToolCallParser`, represented in `assistantMessageContent`.
5. `presentAssistantMessage(...)` executes matching tool classes from `src/core/tools/*`.
6. Tool results are pushed into `userMessageContent` as `tool_result`, then persisted to API history in correct order.

## 5. `write_to_file` Architecture

- Tool schema:

    - `src/core/prompts/tools/native-tools/write_to_file.ts`

- Runtime logic:
    - `src/core/tools/WriteToFileTool.ts`
    - Validates params -> checks ignore/protect policies -> opens/updates diff view -> asks approval -> saves file -> tracks file context -> emits structured tool result.

## 6. Intent-Governed Additions

- Prompt instruction layer:

    - `src/core/prompts/sections/intent-governance.ts`
    - Injects requirement to choose active intent before destructive operations.

- Tool schema:

    - `src/core/prompts/tools/native-tools/select_active_intent.ts`

- Runtime tool:
    - `src/core/tools/SelectActiveIntentTool.ts`
    - Uses `IntentManager` + `OrchestrationStorage`, validates intent status, sets active intent per task, returns scoped summary.

## 7. High-Level Message Diagram

`Webview UI` -> `ClineProvider` -> `webviewMessageHandler` -> `Task.submitUserMessage` -> `API stream` -> `tool_call parsing` -> `Tool class execute` -> `tool_result persisted` -> `webview state update`

## 8. Maintenance Note

This file includes documentation-only updates and does not change runtime behavior.
