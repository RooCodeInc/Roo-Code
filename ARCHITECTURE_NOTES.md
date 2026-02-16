# Architecture Notes

## 1) Tool Loop (Host Extension)

Exact host-extension dispatcher for `execute_command` and `write_to_file`:
- `presentAssistantMessage(cline: Task)` in `src/core/assistant-message/presentAssistantMessage.ts:61`
- Dispatch switch for tool execution is in the `tool_use` branch:
- `write_to_file` dispatch: `src/core/assistant-message/presentAssistantMessage.ts:679`
- `writeToFileTool.handle(...)`: `src/core/assistant-message/presentAssistantMessage.ts:681`
- `execute_command` dispatch: `src/core/assistant-message/presentAssistantMessage.ts:764`
- `executeCommandTool.handle(...)`: `src/core/assistant-message/presentAssistantMessage.ts:765`

Execution path behind that dispatcher:
- Shared tool entrypoint: `BaseTool.handle(...)` in `src/core/tools/BaseTool.ts:113`
- BaseTool calls concrete tool execution via `await this.execute(...)` in `src/core/tools/BaseTool.ts:160`
- Command implementation: `ExecuteCommandTool.execute(...)` in `src/core/tools/ExecuteCommandTool.ts:34`
- Terminal runner used by command tool: `executeCommandInTerminal(...)` in `src/core/tools/ExecuteCommandTool.ts:149`
- File-write implementation: `WriteToFileTool.execute(...)` in `src/core/tools/WriteToFileTool.ts:29`

How tool calls arrive at `presentAssistantMessage(...)`:
- Stream loop: `Task.attemptApiRequest(...)` in `src/core/task/Task.ts:3978`
- Streaming tool chunks parsed via `NativeToolCallParser.processRawChunk(...)` in `src/core/task/Task.ts:2858`
- Parsed `tool_use` blocks are pushed into `assistantMessageContent`, then `presentAssistantMessage(this)` is called (e.g. `src/core/task/Task.ts:2908`, `src/core/task/Task.ts:2927`, `src/core/task/Task.ts:3005`)

## 2) System Prompt Builder (LLM Instructions)

Runtime path used for real model calls:
- `Task.attemptApiRequest(...)` builds prompt with `const systemPrompt = await this.getSystemPrompt()` in `src/core/task/Task.ts:4010`
- Prompt builder method: `Task.getSystemPrompt()` in `src/core/task/Task.ts:3735`
- `getSystemPrompt()` calls `SYSTEM_PROMPT(...)` in `src/core/task/Task.ts:3782`
- `SYSTEM_PROMPT` is defined in `src/core/prompts/system.ts:112`
- `SYSTEM_PROMPT(...)` delegates to `generatePrompt(...)` in `src/core/prompts/system.ts:140`
- Prompt string is assembled in `generatePrompt(...)` and `const basePrompt = ...` in `src/core/prompts/system.ts:41` and `src/core/prompts/system.ts:85`
- Final API handoff uses `this.api.createMessage(systemPrompt, ...)` in `src/core/task/Task.ts:4269`

Prompt preview path in the UI (not the runtime execution path):
- Webview message handler: `case "getSystemPrompt"` and `case "copySystemPrompt"` in `src/core/webview/webviewMessageHandler.ts:1595` and `src/core/webview/webviewMessageHandler.ts:1611`
- Preview generator: `generateSystemPrompt(...)` in `src/core/webview/generateSystemPrompt.ts:12`
- Preview also calls `SYSTEM_PROMPT(...)` in `src/core/webview/generateSystemPrompt.ts:42`

## 3) Where to Modify to Enforce a "Reasoning Loop"

Primary edit point for global LLM behavior:
- `src/core/prompts/system.ts` controls section composition/order.

Most direct instruction-content edit points:
- `src/core/prompts/sections/objective.ts` (high-level behavior loop/instructions)
- `src/core/prompts/sections/rules.ts` (strict operational constraints)
- `src/core/prompts/sections/tool-use-guidelines.ts` (tool sequencing policy)

Practical recommendation:
- Put the core "Reasoning Loop" policy in `objective.ts` (what to do each turn).
- Put hard constraints/checks in `rules.ts` (must/must-not behavior).
- Keep `system.ts` unchanged unless you need to change section order or add a new section.

## 4) Minimal Mental Model

- API stream emits tool-call chunks.
- `Task.ts` parses chunks -> appends/upgrades `assistantMessageContent` blocks.
- `presentAssistantMessage(...)` is the host dispatcher that routes by tool name.
- Concrete tool classes perform side effects (`execute_command`, `write_to_file`).
- Next LLM turn receives tool results.
- System prompt for each turn comes from `Task.getSystemPrompt()` -> `SYSTEM_PROMPT(...)` -> `generatePrompt(...)`.