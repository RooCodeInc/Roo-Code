# Phase 0 - Archaeological Dig (Roo Code)

Date: 2026-02-16
Repository: `/Users/gersumasfaw/Roo-Code-10x`

This document maps the extension "nervous system" for:

- how the extension host starts,
- where task/tool execution loops run,
- where `execute_command` and `write_to_file` are handled,
- where the system prompt is built.

## 1. Fork & Run Status

This workspace already contains the Roo Code source and is buildable.

Run commands:

```sh
cd /Users/gersumasfaw/Roo-Code-10x
pnpm install
pnpm --filter roo-cline bundle
```

Observed result:

- `bundle` succeeded and built `/Users/gersumasfaw/Roo-Code-10x/src/dist`.
- Warning only: local Node is `v24.9.0` while repo expects `20.19.2`.

Extension Host run path:

1. Open `/Users/gersumasfaw/Roo-Code-10x` in VS Code.
2. Press `F5` (`Run Extension` launch profile).

Evidence:

- Development instructions: `/Users/gersumasfaw/Roo-Code-10x/src/README.md:90`
- F5 instructions: `/Users/gersumasfaw/Roo-Code-10x/src/README.md:108`
- Extension host launch config: `/Users/gersumasfaw/Roo-Code-10x/.vscode/launch.json:1`
- Background watch tasks used by prelaunch: `/Users/gersumasfaw/Roo-Code-10x/.vscode/tasks.json:1`

## 2. High-Level Runtime Path (Webview -> Task Loop -> Tools)

1. Extension activation creates the main provider (`ClineProvider`).

    - `/Users/gersumasfaw/Roo-Code-10x/src/extension.ts:120`
    - `/Users/gersumasfaw/Roo-Code-10x/src/extension.ts:195`
    - `/Users/gersumasfaw/Roo-Code-10x/src/extension.ts:332`

2. Webview sends `"newTask"` message; handler calls `provider.createTask(...)`.

    - `/Users/gersumasfaw/Roo-Code-10x/src/core/webview/webviewMessageHandler.ts:549`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/webview/webviewMessageHandler.ts:555`

3. `ClineProvider.createTask(...)` constructs `new Task(...)`.

    - `/Users/gersumasfaw/Roo-Code-10x/src/core/webview/ClineProvider.ts:2914`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/webview/ClineProvider.ts:2974`

4. `Task` constructor auto-starts when `startTask` is true.

    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:424`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:573`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:1924`

5. Main agent loop:

    - `initiateTaskLoop(...)` calls `recursivelyMakeClineRequests(...)`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:2477`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:2511`

6. API request and streaming:

    - `attemptApiRequest(...)` builds `systemPrompt`, builds tools, calls `api.createMessage(...)`.
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:3988`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:4020`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:4238`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:4279`

7. Streamed tool calls are parsed and passed to `presentAssistantMessage(this)`.
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:2865`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:2918`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:3015`

## 3. Exact Tool Loop Handlers (Required by Phase 0)

The central dispatch for tool execution is:

- `/Users/gersumasfaw/Roo-Code-10x/src/core/assistant-message/presentAssistantMessage.ts:61`

Inside `case "tool_use"` it validates and dispatches tools. Key lines:

- Tool-use switch start: `/Users/gersumasfaw/Roo-Code-10x/src/core/assistant-message/presentAssistantMessage.ts:678`
- `write_to_file` dispatch: `/Users/gersumasfaw/Roo-Code-10x/src/core/assistant-message/presentAssistantMessage.ts:679`
- `execute_command` dispatch: `/Users/gersumasfaw/Roo-Code-10x/src/core/assistant-message/presentAssistantMessage.ts:764`

### `execute_command` handling chain

1. Dispatch call:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/assistant-message/presentAssistantMessage.ts:765`
2. Tool implementation class:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/tools/ExecuteCommandTool.ts:31`
3. Core execution logic:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/tools/ExecuteCommandTool.ts:34`
4. Terminal execution function:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/tools/ExecuteCommandTool.ts:149`

### `write_to_file` handling chain

1. Dispatch call:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/assistant-message/presentAssistantMessage.ts:681`
2. Tool implementation class:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/tools/WriteToFileTool.ts:26`
3. Core execution logic:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/tools/WriteToFileTool.ts:29`
4. Write approval/save path:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/tools/WriteToFileTool.ts:130`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/tools/WriteToFileTool.ts:169`

## 4. Where Tool Schemas Are Declared

Tool schema and descriptions are defined as native function-tool definitions:

- `execute_command` schema:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/prompts/tools/native-tools/execute_command.ts:22`
- `write_to_file` schema:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/prompts/tools/native-tools/write_to_file.ts:18`
- Included in default native tools list:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/prompts/tools/native-tools/index.ts:42`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/prompts/tools/native-tools/index.ts:56`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/prompts/tools/native-tools/index.ts:70`
- Typed tool args map:
    - `/Users/gersumasfaw/Roo-Code-10x/src/shared/tools.ts:91`
    - `/Users/gersumasfaw/Roo-Code-10x/src/shared/tools.ts:96`
    - `/Users/gersumasfaw/Roo-Code-10x/src/shared/tools.ts:117`

Tool filtering/composition before API call:

- `/Users/gersumasfaw/Roo-Code-10x/src/core/task/build-tools.ts:82`

## 5. Locate Prompt Builder (Required by Phase 0)

The runtime prompt used for actual model calls is built in:

- `Task.getSystemPrompt()`:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:3745`
    - calls `SYSTEM_PROMPT(...)` at `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:3792`

Prompt assembly implementation:

- `/Users/gersumasfaw/Roo-Code-10x/src/core/prompts/system.ts:41` (`generatePrompt`)
- `/Users/gersumasfaw/Roo-Code-10x/src/core/prompts/system.ts:112` (`SYSTEM_PROMPT`)

Prompt preview endpoint from settings UI:

- `/Users/gersumasfaw/Roo-Code-10x/src/core/webview/webviewMessageHandler.ts:1595`
- `/Users/gersumasfaw/Roo-Code-10x/src/core/webview/generateSystemPrompt.ts:12`

## 6. Phase 1 Hook Insertion Candidates (for next step)

These are the safest insertion points for deterministic hook middleware:

1. Pre-tool interception (best central point):

    - immediately before per-tool switch dispatch in
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/assistant-message/presentAssistantMessage.ts:678`

2. Post-tool interception:

    - immediately after each `tool.handle(...)` returns in the same switch.

3. Prompt protocol enforcement:
    - in `SYSTEM_PROMPT` composition:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/prompts/system.ts:85`
    - and/or in task-level `getSystemPrompt()` wrapper:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:3745`

## 7. Phase 0 Completion Checklist

- [x] Fork & run path identified and build verified.
- [x] Exact host tool-loop function identified.
- [x] Exact `execute_command` handler path identified.
- [x] Exact `write_to_file` handler path identified.
- [x] Exact system prompt builder path identified.
- [x] `ARCHITECTURE_NOTES.md` delivered.

## 8. Architecture Specification Alignment Update

This section aligns the codebase to your required architecture:

- strict privilege separation,
- hook middleware boundary,
- mandatory intent handshake before writes,
- `.orchestration/` sidecar state.

### 8.1 Privilege Separation (Mapped to Current Code)

Webview (UI, restricted presentation layer):

- Receives state/events via webview messaging:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/webview/ClineProvider.ts:1127`
- User actions are handled as typed messages:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/webview/webviewMessageHandler.ts:468`

Extension Host (logic, API + MCP + execution):

- Provider/task orchestration is in extension host:
    - `/Users/gersumasfaw/Roo-Code-10x/src/extension.ts:120`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:2511`
- LLM call path:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:3988`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:4279`
- MCP initialization/management:
    - `/Users/gersumasfaw/Roo-Code-10x/src/services/mcp/McpServerManager.ts:20`

Hook Engine (middleware boundary for all tools):

- Central interception location is `presentAssistantMessage(...)` before dispatch:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/assistant-message/presentAssistantMessage.ts:678`
- This is the correct place to inject `PreToolUse` and `PostToolUse`.

### 8.2 `.orchestration/` Sidecar Contract (Required)

Add a machine-managed directory under `task.cwd`:

- `.orchestration/active_intents.yaml`
- `.orchestration/agent_trace.jsonl`
- `.orchestration/intent_map.md`
- `CLAUDE.md` or `AGENT.md` (shared brain)

Recommended implementation location:

- new host-side service module, for example:
    - `src/core/orchestration/OrchestrationStore.ts`
    - `src/core/orchestration/IntentTraceService.ts`

Reason:

- keep file IO and schema logic out of tool classes and out of Webview code.

### 8.3 Two-Stage State Machine Per Turn (Required)

State 1: Request

- User sends prompt from webview (`newTask`/`askResponse`) into task loop.
- Entry points:
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/webview/webviewMessageHandler.ts:549`
    - `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:2477`

State 2: Reasoning Intercept (Handshake)

- Agent must call mandatory tool: `select_active_intent(intent_id)`.
- Pre-hook intercepts this tool call, loads intent constraints/scope/history from `.orchestration`, and returns structured context (for example `<intent_context>...</intent_context>`).
- Execution remains paused naturally because tool execution is awaited in dispatch path.

State 3: Contextualized Action

- Agent continues with mutating tools (`write_to_file`, alias `write_file`).
- Alias evidence:
    - `/Users/gersumasfaw/Roo-Code-10x/src/shared/tools.ts:337`
- Post-hook computes `content_hash` and appends trace record linked to selected `intent_id`.

## 9. Required Gaps to Implement (from your spec)

These items are not present yet and must be added:

1. New mandatory tool: `select_active_intent(intent_id: string)`.

- Add tool schema in native tools.
- Add typed args in `NativeToolArgs`.
- Add tool executor class.
- Add dispatch case in `presentAssistantMessage`.

2. Hook middleware abstraction.

- Create explicit pre/post hook pipeline around tool execution (not scattered inside each tool class).
- Keep all HITL/scope policy at middleware layer.

3. Intent-aware pre-write enforcement.

- Block mutating tools unless active intent is set and valid.
- Enforce `owned_scope` for target file writes.

4. Trace ledger on post-write.

- Compute hash and append to `.orchestration/agent_trace.jsonl`.
- Include `intent_id` mapping in trace `related`.

## 10. Concrete Injection Points for This Repo

1. Tool definitions:

- `/Users/gersumasfaw/Roo-Code-10x/src/core/prompts/tools/native-tools/index.ts:42`
- `/Users/gersumasfaw/Roo-Code-10x/src/shared/tools.ts:91`

2. Dispatch boundary (best hook point):

- `/Users/gersumasfaw/Roo-Code-10x/src/core/assistant-message/presentAssistantMessage.ts:678`

3. Prompt protocol enforcement (reasoning loop instruction):

- `/Users/gersumasfaw/Roo-Code-10x/src/core/prompts/system.ts:85`
- `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:3745`

4. API call where system prompt is consumed:

- `/Users/gersumasfaw/Roo-Code-10x/src/core/task/Task.ts:4279`

## 11. Updated Phase-0 Outcome

Phase 0 now includes:

- exact current architecture mapping,
- exact tool and prompt construction points,
- exact plan to implement your required hook engine, `.orchestration` storage, and two-stage intent handshake in Phase 1.
