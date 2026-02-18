# ARCHITECTURE_NOTES.md

This document captures the current Roo Code extension execution architecture and identifies the exact insertion points for Phase 1+ hook and intent-traceability work.

## Scope of this note

This note answers:

1. Where native tool calls are executed.
2. Where approval/authorization happens.
3. Where system prompt and tool definitions are built.
4. Where to inject pre/post hook middleware and intent handshake enforcement.

## Runtime boundaries

- Webview UI sends user actions/messages into extension host via webview message listener in `src/core/webview/ClineProvider.ts:1326`.
- Extension host routes webview messages in `src/core/webview/webviewMessageHandler.ts:580`.
- Task runtime processes LLM assistant content and executes tools in `src/core/assistant-message/presentAssistantMessage.ts:61`.
- Tool implementations live under `src/core/tools/`.

## End-to-end execution path (native tool calling)

1. System prompt is generated in `src/core/prompts/system.ts:41` and exposed through `src/core/prompts/system.ts:112`.
2. Tools are built from native definitions in `src/core/prompts/tools/native-tools/index.ts:42`.
3. Per-request tool set is filtered/built in `src/core/task/build-tools.ts:82`.
4. Streaming assistant output is processed and tool blocks are executed in `src/core/assistant-message/presentAssistantMessage.ts:61`.
5. Native tool-use case entry begins at `src/core/assistant-message/presentAssistantMessage.ts:298`.
6. Tool permission/mode validation happens via `validateToolUse(...)` at `src/core/assistant-message/presentAssistantMessage.ts:597`.
7. Human approval function is constructed at `src/core/assistant-message/presentAssistantMessage.ts:494`.
8. Tool result callback is constructed at `src/core/assistant-message/presentAssistantMessage.ts:449`.
9. Tool dispatch switch starts at `src/core/assistant-message/presentAssistantMessage.ts:678`.
10. `write_to_file` dispatch occurs at `src/core/assistant-message/presentAssistantMessage.ts:679`.
11. `execute_command` dispatch occurs at `src/core/assistant-message/presentAssistantMessage.ts:764`.
12. Each tool executes in its class `execute(...)` implementation, e.g. `src/core/tools/WriteToFileTool.ts:29` and `src/core/tools/ExecuteCommandTool.ts:34`.

## Approval and auto-approval flow

- Task-level ask/approval orchestration lives in `src/core/task/Task.ts:1368`.
- Auto-approval policy engine entry point is `src/core/auto-approval/index.ts:47`.
- The approval result (approve, deny, timeout, ask) influences whether tool execution continues or returns a blocking tool_result.

## Detailed sequence: write_to_file

1. Assistant emits `tool_use(write_to_file)` to `presentAssistantMessage`.
2. `validateToolUse` gate runs.
3. `askApproval` gate runs.
4. `WriteToFileTool.execute(...)` runs at `src/core/tools/WriteToFileTool.ts:29`.
5. File access and protected-file checks are applied in `src/core/tools/WriteToFileTool.ts:50` and `src/core/tools/WriteToFileTool.ts:58`.
6. Diff/approval UX and save path execute.
7. File context tracker is updated at `src/core/tools/WriteToFileTool.ts:173`.
8. Result is pushed through `pushToolResult` callback back into user tool_result stream.

## Detailed sequence: execute_command

1. Assistant emits `tool_use(execute_command)` to `presentAssistantMessage`.
2. `validateToolUse` gate runs.
3. `askApproval` gate runs.
4. `ExecuteCommandTool.execute(...)` runs at `src/core/tools/ExecuteCommandTool.ts:34`.
5. Terminal command is executed with timeout/allowlist checks in `src/core/tools/ExecuteCommandTool.ts:70` and `src/core/tools/ExecuteCommandTool.ts:80`.
6. Output/status is streamed to webview and final result becomes `tool_result`.

## Existing architectural strengths for hook work

- Single central execution boundary for all tool calls: `src/core/assistant-message/presentAssistantMessage.ts:61`.
- Central tool validation point before execution: `src/core/assistant-message/presentAssistantMessage.ts:597`.
- Unified approval callback abstraction for tools: `src/core/assistant-message/presentAssistantMessage.ts:494`.
- Unified tool result callback abstraction for tools: `src/core/assistant-message/presentAssistantMessage.ts:449`.

## Hook injection points (for next phases)

### Pre-hook insertion point

- Insert immediately before tool dispatch switch in `src/core/assistant-message/presentAssistantMessage.ts:678`.
- This pre-hook should receive `tool name`, `tool args`, `task context`, and should be able to:

1. Enforce active intent handshake.
2. Enforce intent scope (`owned_scope`) for mutating tools.
3. Classify safe vs destructive tool operations.
4. Block execution with structured tool_result errors.

### Post-hook insertion point

- Insert immediately after each tool handler returns and before flow continues to next content block in `src/core/assistant-message/presentAssistantMessage.ts:920`.
- This post-hook should:

1. Record mutation trace entry.
2. Compute and persist content hashes for modified segments.
3. Update sidecar intent metadata artifacts.

### Prompt protocol insertion point

- System prompt generation: `src/core/prompts/system.ts:41`.
- Add handshake rule requiring first action `select_active_intent(intent_id)` before mutating tools.

### Tool contract insertion point

- Add new native tool in tool registry: `src/core/prompts/tools/native-tools/index.ts:42`.
- Add execution handler integration in `presentAssistantMessage` dispatch switch at `src/core/assistant-message/presentAssistantMessage.ts:678`.

## Current gaps against target architecture

- No `select_active_intent` tool exists yet.
- No `.orchestration` sidecar integration in tool execution path yet.
- No intent-linked `agent_trace.jsonl` write path yet.
- No explicit mutation class (`AST_REFACTOR`, `INTENT_EVOLUTION`) yet.
- No stale-write optimistic lock guard in write path yet.

## Architecture mapping checklist status

1. Tool loop identified with exact file/line: complete.
2. Prompt builder located: complete.
3. Write/command execution paths documented: complete.
4. Hook insertion points proposed with exact locations: complete.
