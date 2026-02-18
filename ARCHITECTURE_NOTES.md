# Roo Code Architecture Notes

## 1. Extension Runtime Overview

### Activation and bootstrap
- Entry point is `src/extension.ts:120` (`activate`).
- Core services are initialized (state/config, telemetry, terminal registry, MCP, code index, cloud sync).
- Main provider is created at `src/extension.ts:195` via `new ClineProvider(...)`.
- Sidebar webview provider is registered at `src/extension.ts:332`.
- Commands and actions are registered at:
  - `src/extension.ts:353` (`registerCommands`)
  - `src/extension.ts:390` (`registerCodeActions`)
  - `src/extension.ts:391` (`registerTerminalActions`)

### Webview message flow
- Frontend/backend bridge handler: `src/core/webview/webviewMessageHandler.ts`.
- New chat task creation path:
  - `newTask` case at `src/core/webview/webviewMessageHandler.ts:549`
  - calls `provider.createTask(...)` at `src/core/webview/webviewMessageHandler.ts:555`

### Provider orchestration
- `ClineProvider` is the central orchestrator (`src/core/webview/ClineProvider.ts`).
- It owns task stack, task history, UI state propagation, and service wiring.
- Task creation entrypoint: `createTask(...)` at `src/core/webview/ClineProvider.ts:2914`.
- Actual `Task` construction occurs at `src/core/webview/ClineProvider.ts:2974`.

### API surface for external automation
- Extension API wrapper: `src/extension/api.ts`.
- Supports starting tasks, resuming, sending messages, profile management, IPC events.

---

## 2. Main Tool Execution Loop

### Core loop location
- `Task` runtime class: `src/core/task/Task.ts`.
- New task startup:
  - constructor initializes API + services at `src/core/task/Task.ts:424` and `src/core/task/Task.ts:491`
  - `startTask(...)` at `src/core/task/Task.ts:1924`
- Main agent loop:
  - `initiateTaskLoop(...)` at `src/core/task/Task.ts:2477`
  - repeatedly calls `recursivelyMakeClineRequests(...)` at `src/core/task/Task.ts:2511`

### Request/response loop behavior
- User content is normalized, mentions resolved, and environment details injected around `src/core/task/Task.ts:2606`-`src/core/task/Task.ts:2650`.
- User message gets appended to API history at `src/core/task/Task.ts:2660`.
- API stream is initiated from `attemptApiRequest(...)` (`src/core/task/Task.ts:3988`).
- Provider call is made via `this.api.createMessage(...)` at `src/core/task/Task.ts:4279`.

### Assistant tool call processing
- Assistant message + tool_use blocks are persisted **before** tool execution:
  - comment and logic at `src/core/task/Task.ts:3409`
  - write to history at `src/core/task/Task.ts:3550`
- Tool execution dispatch happens in:
  - `presentAssistantMessage(...)` at `src/core/assistant-message/presentAssistantMessage.ts:61`

---

## 3. Specific Tools: `execute_command` and `write_to_file`

### Dispatch points
- In `presentAssistantMessage` switch:
  - `write_to_file` dispatch at `src/core/assistant-message/presentAssistantMessage.ts:679`
  - `execute_command` dispatch at `src/core/assistant-message/presentAssistantMessage.ts:764`

### `execute_command`
- Tool class: `src/core/tools/ExecuteCommandTool.ts:31`.
- Main handler: `execute(...)` at `src/core/tools/ExecuteCommandTool.ts:34`.
- Terminal execution helper: `executeCommandInTerminal(...)` at `src/core/tools/ExecuteCommandTool.ts:149`.
- Uses terminal abstraction layers:
  - `src/integrations/terminal/TerminalRegistry.ts`
  - `src/integrations/terminal/Terminal.ts`
  - `src/integrations/terminal/TerminalProcess.ts`
- Includes:
  - approval flow (`askApproval`)
  - timeout handling
  - streaming terminal output
  - persisted large output artifacts + `read_command_output` follow-up path

### `write_to_file`
- Tool class: `src/core/tools/WriteToFileTool.ts:26`.
- Main handler: `execute(...)` at `src/core/tools/WriteToFileTool.ts:29`.
- Validates roo-ignore/roo-protected access, computes edit/create mode, and routes through `diffViewProvider`.
- Key save paths:
  - direct save path at `src/core/tools/WriteToFileTool.ts:136`
  - diff-view save path at `src/core/tools/WriteToFileTool.ts:169`
- Emits tool result via `pushToolWriteResult` at `src/core/tools/WriteToFileTool.ts:178`.

---

## 4. System Prompt Construction and LLM Handoff

### Runtime prompt construction
- Runtime prompt builder is `Task.getSystemPrompt()` in `src/core/task/Task.ts`.
- It calls `SYSTEM_PROMPT(...)` at `src/core/task/Task.ts:3792`.
- `SYSTEM_PROMPT` implementation is in `src/core/prompts/system.ts`.

### Prompt composition architecture
- Prompt section composition is centralized in `src/core/prompts/system.ts`.
- Section modules are exported from `src/core/prompts/sections/index.ts`:
  - rules
  - system-info
  - objective
  - tool-use and tool-use-guidelines
  - capabilities
  - modes
  - skills
  - custom instructions

### Sending prompt to the model
- Actual send occurs in `attemptApiRequest(...)`:
  - `this.api.createMessage(systemPrompt, cleanConversationHistory, metadata)`
  - `src/core/task/Task.ts:4279`
- API provider is selected via `buildApiHandler(...)` in `src/api/index.ts`.
- Providers implement `ApiHandler.createMessage(systemPrompt, messages, metadata)`.

### Prompt preview path (UI utility)
- Webview “get/copy system prompt” is separate from runtime execution:
  - `src/core/webview/generateSystemPrompt.ts:12`
  - called from `src/core/webview/webviewMessageHandler.ts:1595` and `src/core/webview/webviewMessageHandler.ts:1611`

---

## 5. Agent Architecture (Design View)

### Layered structure
- Extension host + activation: `src/extension.ts`
- Provider/UI orchestration: `src/core/webview/*`
- Task runtime state machine: `src/core/task/Task.ts`
- Tool parsing + dispatch: `src/core/assistant-message/*`
- Tool implementations: `src/core/tools/*`
- Prompt generation: `src/core/prompts/*`
- Provider abstraction + model transforms: `src/api/*`
- Integrations (terminal/editor/workspace): `src/integrations/*`
- Services (MCP, skills, indexing, checkpoints): `src/services/*`

### Tool definition vs tool execution split
- Tool schemas exposed to the model are defined under:
  - `src/core/prompts/tools/native-tools/*`
  - catalog index: `src/core/prompts/tools/native-tools/index.ts`
- Runtime tool availability/filtering is built in:
  - `src/core/task/build-tools.ts`

### Streaming protocol pipeline
- Stream chunk types are defined in `src/api/transform/stream.ts`.
- Native function-call chunk assembly and partial parsing are handled by:
  - `src/core/assistant-message/NativeToolCallParser.ts`
- Parsed tool calls then flow into `presentAssistantMessage(...)` for execution.

### Persistence and consistency strategy
- Task and API histories are persisted in `src/core/task-persistence/*`.
- The loop enforces strict ordering: assistant `tool_use` is written before user `tool_result` to avoid protocol errors.

---

## 6. Hook Engine Insertion Points (Recommended)

### A. Pre-request hooks (before model call)
- Candidate location: in `Task.attemptApiRequest(...)` before `this.api.createMessage(...)` (`src/core/task/Task.ts:4279`).
- Use cases:
  - mutate/annotate messages
  - inject policy checks
  - observe prompt + metadata + tools

### B. Stream hooks (during model output)
- Candidate location: inside `recursivelyMakeClineRequests(...)` stream chunk processing loop.
- Use cases:
  - inspect/transform chunk events
  - detect tool-call patterns
  - collect reasoning/usage telemetry

### C. Tool lifecycle hooks
- Pre-dispatch hook: top of `presentAssistantMessage(...)` before switch dispatch.
- Per-tool hook wrappers: around `tool.handle(...)` calls in `presentAssistantMessage.ts`.
- Use cases:
  - approvals/policies
  - timing/retries/metrics
  - audit trails

### D. Tool implementation hooks
- Deep hooks in specific tools:
  - `ExecuteCommandTool.execute(...)`
  - `WriteToFileTool.execute(...)`
- Use cases:
  - command sandbox policy
  - file-write validators
  - post-action indexing/event emission

### E. Persistence hooks
- Candidate locations around:
  - `addToApiConversationHistory(...)`
  - task message save flows in `task-persistence`
- Use cases:
  - durable hook logs
  - replay/debug records

---

## 7. Minimal End-to-End Sequence

1. User sends message from webview.
2. `webviewMessageHandler` routes request to `ClineProvider.createTask(...)` or existing `Task.submitUserMessage(...)`.
3. `Task.initiateTaskLoop(...)` starts/continues.
4. `Task.recursivelyMakeClineRequests(...)` prepares user content + env details + history.
5. `Task.attemptApiRequest(...)` builds system prompt and sends `createMessage(...)` to provider.
6. Stream chunks are processed (text/reasoning/tool-call/usage).
7. Assistant message and tool_use blocks are committed to history.
8. `presentAssistantMessage(...)` dispatches tools.
9. Tool results are pushed as user `tool_result` content.
10. Loop continues until `attempt_completion` or termination condition.

---

## 8. Notes for Hook Engine Design

- Preserve ordering invariants around `tool_use`/`tool_result` persistence.
- Keep hooks async-safe and non-blocking where possible (especially stream hooks).
- Define hook phases explicitly:
  - `before_request`
  - `on_stream_chunk`
  - `before_tool`
  - `after_tool`
  - `on_tool_error`
  - `before_persist`
  - `after_persist`
- Include task-scoped context in all hook payloads (`taskId`, `mode`, provider/model, tool name/id).
- Add failure isolation so hook exceptions do not crash the task loop.
