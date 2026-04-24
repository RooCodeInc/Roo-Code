# Architecture Notes - Roo Code Extension

**Date:** 2026-02-16  
**Phase:** 0 - Archaeological Dig  
**Goal:** Map the codebase structure for hook system injection

---

## Executive Summary

This document maps the Roo Code extension architecture to identify injection points for the Intent-Code Traceability hook system. The hook system will enforce a two-stage state machine (Reasoning Loop) and maintain `.orchestration/` directory for intent tracking.

---

## 1. Tool Execution Flow

### 1.1 Entry Point: `presentAssistantMessage()`

**File:** `src/core/assistant-message/presentAssistantMessage.ts`

**Function:** `presentAssistantMessage(cline: Task)` (line 61)

**Flow:**

1. LLM generates assistant message with tool calls
2. Function processes content blocks sequentially
3. For each `ToolUse` block, routes to specific tool handler via `switch (block.name)` (line 678)
4. Tools are executed with callbacks: `askApproval`, `handleError`, `pushToolResult`

**Key Tool Handlers:**

- `write_to_file` → `WriteToFileTool.handle()` (line 681)
- `execute_command` → `ExecuteCommandTool.handle()` (line 750)
- `edit_file` → `EditFileTool.handle()` (line 721)
- Custom tools → `customToolRegistry.get(block.name)` (line 419)

**Hook Injection Point:**

- **Pre-Hook:** Before `tool.handle()` call (line 681, 721, etc.)
- **Post-Hook:** After `tool.execute()` completes, before `pushToolResult()`

---

### 1.2 Tool Base Architecture

**File:** `src/core/tools/BaseTool.ts`

**Class:** `BaseTool<TName extends ToolName>` (line 29)

**Key Methods:**

- `abstract execute(params, task, callbacks): Promise<void>` - Main execution logic
- `async handlePartial(task, block): Promise<void>` - Streaming support
- `resetPartialState(): void` - Cleanup

**Tool Instances:**
All tools are singleton instances imported at module level:

- `writeToFileTool` from `WriteToFileTool.ts`
- `executeCommandTool` from `ExecuteCommandTool.ts`
- `editFileTool` from `EditFileTool.ts`
- etc.

**Hook Injection Strategy:**

- Wrap `execute()` method calls
- Intercept in `presentAssistantMessage()` before tool.handle()
- Store active intent context in `Task` instance

---

### 1.3 Tool Registration

**File:** `src/core/task/build-tools.ts`

**Function:** `buildNativeToolsArrayWithRestrictions()` (line 82)

**Process:**

1. Filters native tools based on mode
2. Loads MCP tools from `mcpHub`
3. Loads custom tools from `.roo/tools/` directories via `customToolRegistry`
4. Returns combined tool array for LLM

**Custom Tool Registry:**

- **File:** `packages/core/src/custom-tools/custom-tool-registry.ts`
- **Class:** `CustomToolRegistry` (line 31)
- **Methods:** `register()`, `get()`, `has()`, `getAllSerialized()`

**Hook Injection Point:**

- Add `select_active_intent` to native tools array
- Register via custom tool registry OR add to native tools list

---

## 2. System Prompt Construction

### 2.1 Prompt Builder

**File:** `src/core/prompts/system.ts`

**Main Function:** `SYSTEM_PROMPT()` (line 112)

**Called From:** `Task.getSystemPrompt()` (line 3745 in `Task.ts`)

**Construction Flow:**

1. Gets mode configuration and role definition
2. Builds sections: formatting, tool use, capabilities, modes, rules, system info
3. Adds custom instructions and rooignore rules
4. Returns complete prompt string

**Key Sections:**

- `roleDefinition` - Mode-specific role (line 65)
- `getSharedToolUseSection()` - Tool catalog
- `getToolUseGuidelinesSection()` - Tool usage rules
- `getRulesSection()` - Workspace rules
- `getObjectiveSection()` - Task objectives

**Hook Injection Point:**

- Modify `getToolUseGuidelinesSection()` or add new section
- Add Reasoning Loop instructions before tool guidelines
- Enforce: "You MUST call select_active_intent before writing code"

---

### 2.2 Prompt Usage

**File:** `src/core/task/Task.ts`

**Method:** `getSystemPrompt()` (line 3745)

**Called During:**

- Initial task creation
- Each LLM request (via `recursivelyMakeClineRequests()`)

**Hook Injection Point:**

- Intercept prompt before sending to LLM
- Inject active intent context if `select_active_intent` was called
- Add `<intent_context>` XML block to prompt

---

## 3. Task Lifecycle

### 3.1 Task Class

**File:** `src/core/task/Task.ts`

**Class:** `Task` (line 163)

**Key Properties:**

- `taskId: string` - Unique task identifier
- `cwd: string` - Working directory
- `providerRef: WeakRef<ClineProvider>` - Extension provider reference
- `api: ApiHandler` - LLM API handler
- `clineMessages: Anthropic.Message[]` - Conversation history

**Key Methods:**

- `startTask(text, images)` - Initialize task
- `recursivelyMakeClineRequests()` - Main LLM request loop
- `getSystemPrompt()` - Get system prompt
- `say()`, `ask()` - User interaction methods

**Hook Storage Point:**

- Add `activeIntentId?: string` property to Task
- Store intent context loaded from `.orchestration/active_intents.yaml`

---

## 4. Extension Architecture

### 4.1 Extension Host

**File:** `src/extension.ts`

**Function:** `activate(context: vscode.ExtensionContext)` (line 120)

**Initialization:**

1. Creates `ClineProvider` instance
2. Registers commands and webview
3. Sets up MCP hub if enabled
4. Initializes code index manager

**Provider:**

- **File:** `src/core/webview/ClineProvider.ts`
- **Class:** `ClineProvider`
- Manages tasks, state, and webview communication

---

### 4.2 Webview Communication

**Flow:**

1. Webview (UI) sends messages via `postMessage`
2. `webviewMessageHandler.ts` routes messages
3. Provider creates/updates tasks
4. Tasks execute tools and send results back

**Hook Injection Point:**

- Intercept webview messages before task creation
- Validate intent selection before allowing tool execution

---

## 5. File System Operations

### 5.1 Write Operations

**Tools:**

- `WriteToFileTool` - Full file write
- `EditFileTool` - Partial file edits
- `ApplyDiffTool` - Diff-based edits
- `SearchReplaceTool` - Search/replace operations

**Common Pattern:**

1. Validate parameters
2. Check `rooIgnoreController` for access
3. Show diff view (if enabled)
4. Request approval via `askApproval()`
5. Save changes via `diffViewProvider.saveChanges()`
6. Track file context
7. Push tool result

**Hook Injection Points:**

- **Pre-Hook:** Before `askApproval()` - Check intent scope
- **Post-Hook:** After `saveChanges()` - Log to `agent_trace.jsonl`

---

## 6. Hook System Architecture (Planned)

### 6.1 Hook Engine Location

**Proposed File:** `src/core/hooks/HookEngine.ts`

**Responsibilities:**

- Intercept tool execution requests
- Enforce Pre-Hook and Post-Hook logic
- Manage intent context injection
- Validate scope and constraints

**Integration Points:**

1. Wrap tool execution in `presentAssistantMessage()`
2. Inject into `BaseTool.execute()` wrapper
3. Store hook state in `Task` instance

---

### 6.2 Orchestration Directory

**Location:** `.orchestration/` in workspace root

**Files:**

- `active_intents.yaml` - Intent specifications
- `agent_trace.jsonl` - Append-only trace ledger
- `intent_map.md` - Spatial mapping
- `AGENT.md` - Shared knowledge base

**Access:**

- Read/write via Node.js `fs` APIs
- Initialize on first task creation
- Validate on extension activation

---

## 7. Implementation Strategy

### 7.1 Phase 1: The Handshake

**Steps:**

1. Create `SelectActiveIntentTool` extending `BaseTool`
2. Add tool to native tools array in `build-tools.ts`
3. Create `HookEngine` class with Pre-Hook/Post-Hook methods
4. Modify `presentAssistantMessage()` to call hooks
5. Create `.orchestration/` directory structure
6. Implement `OrchestrationDataModel` for YAML/JSONL access
7. Modify system prompt to enforce Reasoning Loop
8. Implement context injection for `select_active_intent`

---

### 7.2 File Structure (Planned)

```
src/
  core/
    hooks/
      HookEngine.ts          # Main hook middleware
      PreHook.ts             # Pre-execution hooks
      PostHook.ts            # Post-execution hooks
      OrchestrationDataModel.ts  # Data model access
    tools/
      SelectActiveIntentTool.ts  # New intent selection tool
    orchestration/
      ActiveIntentsManager.ts    # YAML management
      AgentTraceLogger.ts        # JSONL logging
      IntentMapManager.ts         # Markdown mapping
```

---

## 8. Key Dependencies

### 8.1 External Libraries

- `@anthropic-ai/sdk` - LLM API
- `yaml` - YAML parsing (need to add)
- `crypto` - SHA-256 hashing (built-in)
- `fs/promises` - File system operations

### 8.2 Internal Dependencies

- `@roo-code/types` - Type definitions
- `@roo-code/core` - Core utilities
- `Task` class - Task lifecycle
- `BaseTool` - Tool base class

---

## 9. Testing Strategy

### 9.1 Unit Tests

- Hook engine interception logic
- Orchestration data model read/write
- Intent context injection
- Scope validation

### 9.2 Integration Tests

- End-to-end tool execution with hooks
- Intent selection → context injection → code write
- Trace logging verification
- Parallel agent collision detection

---

## 10. Open Questions

1. **Tool Registration:** Should `select_active_intent` be a native tool or custom tool?

    - **Decision:** Native tool (simpler, always available)

2. **Hook Timing:** Should hooks be synchronous or async?

    - **Decision:** Async (allows for file I/O and user prompts)

3. **Error Handling:** How to handle hook failures?

    - **Decision:** Fail-safe - log error, allow execution to continue with warning

4. **State Persistence:** Where to store active intent ID?
    - **Decision:** Task instance property + `.orchestration/active_intents.yaml`

---

## 11. Next Steps

1. ✅ Complete Phase 0 (this document)
2. ⏳ Implement Phase 1: The Handshake
    - Create `SelectActiveIntentTool`
    - Build `HookEngine` infrastructure
    - Implement `.orchestration/` data models
    - Modify system prompt
3. ⏳ Implement Phase 2: Hook Middleware & Security
4. ⏳ Implement Phase 3: AI-Native Git Layer
5. ⏳ Implement Phase 4: Parallel Orchestration

---

Complete execution flow diagram
┌─────────────────────────────────────────────────────────────┐
│ 1. LLM Response (Streaming) │
│ Anthropic API → Task.recursivelyMakeClineRequests() │
└──────────────────────┬──────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Tool Call Parsing │
│ Task.ts:2989-3016 │
│ - Receives "tool_call" chunk │
│ - Parses via NativeToolCallParser │
│ - Creates ToolUse object │
│ - Adds to assistantMessageContent[] │
└──────────────────────┬──────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Message Presentation Router │
│ presentAssistantMessage.ts:63 │
│ - Checks lock (prevents concurrent execution) │
│ - Gets current block from assistantMessageContent │
│ - Routes by block.type → "tool_use" │
└──────────────────────┬──────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Tool Routing (SWITCH STATEMENT) │
│ presentAssistantMessage.ts:691 │
│ switch (block.name) { │
│ case "write_to_file": │
│ case "execute_command": │
│ ... │
│ } │
└──────────────────────┬──────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Tool Execution │
│ tool.handle(task, block, callbacks) │
│ BaseTool.ts:113 │
│ - Parses block.nativeArgs → params │
│ - Calls tool.execute(params, task, callbacks) │
└──────────────────────┬──────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Actual Tool Logic │
│ WriteToFileTool.execute() or ExecuteCommandTool.execute()│
│ - Validates parameters │
│ - Checks permissions │
│ - Asks user approval │
│ - Performs operation │
│ - Calls pushToolResult() │
└──────────────────────┬──────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Result Back to LLM │
│ pushToolResult() → task.pushToolResultToUserContent() │
│ - Creates tool_result block │
│ - Adds to userMessageContent[] │
│ - LLM receives result in next request │
└─────────────────────────────────────────────────────────────┘

**End of Architecture Notes**
