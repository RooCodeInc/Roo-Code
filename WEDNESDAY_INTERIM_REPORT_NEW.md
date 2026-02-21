# TRP1 Challenge Week 1: Wednesday Interim Deliverable

## Architecting the AI-Native IDE & Intent-Code Traceability

---

**Author:** Kidus Tewodros  
**Program:** 10 Academy Intensive Training
**Repository :** [https://github.com/ketewodros41-star/Roo-Code]
**Repository branch:** [https://github.com/ketewodros41-star/Roo-Code/tree/feature/trp1-wednesday-deliverables](https://github.com/ketewodros41-star/Roo-Code/tree/feature/trp1-wednesday-deliverables)  
**Date:** February 18, 2026

---

**10 Academy Intensive Training - TRP1 Week 1**

<div style="page-break-after: always;"></div>

---

## Table of Contents

1. [How the VS Code Extension Works](#1-how-the-vs-code-extension-works)
2. [Code and Design Architecture](#2-code-and-design-architecture)
3. [Architectural Decisions for the Hook System](#3-architectural-decisions-for-the-hook-system)
4. [Diagrams and Schemas of the Hook System](#4-diagrams-and-schemas-of-the-hook-system)

---

<div style="page-break-after: always;"></div>

## 1. How the VS Code Extension Works

### 1.1 Extension Host ↔ Webview Architecture

Roo Code implements VS Code's standard extension architecture, which enforces strict privilege separation between the user interface layer and the execution environment. This architectural pattern is fundamental to both security and the planned hook system integration.

**Physical Separation**

The extension operates across two isolated runtime environments:

1. **Webview (UI Layer):** A sandboxed browser context (Chromium-based) that renders the React-based chat interface. Located in `webview-ui/src/`, this environment has zero access to Node.js APIs, filesystem operations, or terminal execution. All UI state management occurs through React components in `webview-ui/src/components/`.

2. **Extension Host (Execution Layer):** A Node.js process running in VS Code's Extension Host, providing full access to VS Code APIs (`vscode.*`), Node.js filesystem (`fs`), child process spawning, and network operations. The primary controller is `ClineProvider` in `src/core/webview/ClineProvider.ts`.

**IPC Mechanism: postMessage**

Communication between these environments flows exclusively through VS Code's `postMessage` API:

- **Webview → Extension Host:** User interactions (button clicks, text input, approval decisions) are serialized as `WebviewMessage` objects (defined in `src/shared/WebviewMessage.ts`) and posted via `vscode.postMessage()`.

- **Extension Host → Webview:** State updates, LLM responses, and tool execution results are pushed via `webviewView.webview.postMessage()` from `ClineProvider`. The webview receives these in `webview-ui/src/App.tsx` via event listeners.

### Tool Execution Flow

The core request-response cycle follows this pattern:

```
┌──────────┐
│   User   │  Types message in chat UI
└─────┬────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                     Webview (React UI)                       │
│  • Displays chat messages                                   │
│  • Shows tool approvals, diff views                         │
│  • Sends user input via postMessage()                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ postMessage({ type: "askResponse", ... })
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Extension Host (Node.js)                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  ClineProvider.ts                                   │    │
│  │  • webviewMessageHandler.ts processes message       │    │
│  │  • Creates/resumes Task instance                    │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                      │
│                       ▼                                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Task.recursivelyMakeClineRequests()               │    │
│  │  • Main request loop                                │    │
│  │  • Builds system prompt                             │    │
│  │  • Builds tools array                               │    │
│  │  • Manages conversation history                     │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                      │
│                       ▼                                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │  ApiHandler.createMessage()                        │────┼───┐
│  │  • Sends request to LLM API                        │    │   │
│  │  • Streams response chunks                         │    │   │
│  └────────────────────┬───────────────────────────────┘    │   │
│                       │                                      │   │
│                       │ LLM response with tool_use blocks   │   │
│                       ▼                                      │   │
│  ┌────────────────────────────────────────────────────┐    │   │
│  │  presentAssistantMessage()                         │    │   │
│  │  • Processes tool_use blocks                       │    │   │
│  │  • Routes to tool handlers                         │    │   │
│  └────────────────────┬───────────────────────────────┘    │   │
│                       │                                      │   │
│              ┌────────┴────────┐                            │   │
│              ▼                 ▼                             │   │
│  ┌─────────────────┐  ┌──────────────────────────┐        │   │
│  │  Pre-Hook       │  │  Hook Engine             │        │   │
│  │  Interceptors   │  │  • Intent validation     │        │   │
│  │                 │  │  • Security checks       │        │   │
│  │  ⚡ Intercepts  │  │  • Context injection     │        │   │
│  │  tool calls     │  │  • Trace logging         │        │   │
│  └─────────┬───────┘  └──────────────────────────┘        │   │
│            │                                                 │   │
│            │ continue: true/false                           │   │
│            ▼                                                 │   │
│  ┌────────────────────────────────────────────────────┐    │   │
│  │  BaseTool.handle() → Tool.execute()               │    │   │
│  │  • ExecuteCommandTool                              │    │   │
│  │  • WriteToFileTool                                 │    │   │
│  │  • ReadFileTool                                    │    │   │
│  │  • ApplyDiffTool                                   │    │   │
│  │  • 18+ other tools                                 │    │   │
│  └────────────────────┬───────────────────────────────┘    │   │
│                       │                                      │   │
│                       ▼                                      │   │
│  ┌────────────────────────────────────────────────────┐    │   │
│  │  VS Code APIs & File System                        │    │   │
│  │  • vscode.workspace.fs (read/write files)          │    │   │
│  │  • Terminal integration (execute commands)         │    │   │
│  │  • Diff view provider                              │    │   │
│  └────────────────────┬───────────────────────────────┘    │   │
│                       │                                      │   │
│                       ▼                                      │   │
│  ┌────────────────────────────────────────────────────┐    │   │
│  │  Post-Hook Interceptors                            │    │   │
│  │  • Trace logging                                   │    │   │
│  │  • Analytics                                       │    │   │
│  │  • Follow-up actions                               │    │   │
│  └────────────────────┬───────────────────────────────┘    │   │
│                       │                                      │   │
│                       ▼                                      │   │
│  ┌────────────────────────────────────────────────────┐    │   │
│  │  pushToolResult()                                  │    │   │
│  │  • Adds tool_result to userMessageContent[]       │    │   │
│  │  • Loop continues with next LLM request           │    │   │
│  └────────────────────────────────────────────────────┘    │   │
└─────────────────────────────────────────────────────────────┘   │
                                                                   │
      ┌────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────┐
│    LLM API Provider     │
│  • Anthropic Claude     │
│  • OpenAI GPT           │
│  • Gemini, etc.         │
└─────────────────────────┘
```

### Simplified Flow Diagram

```
[User Types Message]
         │
         ▼
   [Webview UI]
         │
         │ postMessage
         ▼
  [Extension Host]
         │
         ├──> [Build System Prompt]
         ├──> [Build Tools Array]
         ├──> [LLM API Request] ────┐
         │                           │
         │    [LLM Response] <───────┘
         │    (tool_use blocks)
         ▼
  [presentAssistantMessage]
         │
         ├──> [Hook Engine] ◄── Intercepts tool calls
         │         │
         │         ├─> [Intent Gate: Check active intent]
         │         ├─> [Security: Classify command risk]
         │         └─> [Context: Inject constraints]
         │
         ▼
   [Tool Execution]
         │
         ├──> write_to_file
         ├──> execute_command
         ├──> read_file
         └──> apply_diff
         │
         ▼
   [Post-Hooks]
         │
         ├─> [Trace: Log to agent_trace.jsonl]
         ├─> [Analytics: Track tool usage]
         └─> [Follow-up: Trigger side effects]
         │
         ▼
   [pushToolResult]
         │
         │ (tool_result added to conversation)
         ▼
   [Next LLM Request] ──┐
         │              │
         └──────────────┘
         (Loop continues)
```

**Security Rationale**

This architecture prevents privilege escalation attacks. If the webview were compromised (e.g., via XSS in user-provided markdown), the attacker could only send messages—not execute arbitrary code, read secrets, or modify files. Tool execution logic lives exclusively in the Extension Host, where the planned hook middleware (`src/hooks/middleware.ts`) will intercept and validate all operations before filesystem writes occur.

The hook system will leverage this boundary by implementing a **gatekeeper pattern** in the Extension Host: before any tool executes, the PreToolUse hook validates intent alignment, while PostToolUse hooks log execution to the agent trace without blocking UI responsiveness.

### 1.2 Tool Execution Loop

The tool execution pipeline follows this sequence:

```
User Prompt → System Prompt Construction → LLM API Call →
Tool Call Parsing → Hook Interception (Planned) → Tool Execution →
Result Formatting → Response to LLM
```

**Step 1: User Prompt Reception**

When a user submits a message, `webview-ui/src/App.tsx` sends a `webviewDidLaunchClineMessage` to the Extension Host. The `ClineProvider` receives it in `src/core/webview/webviewMessageHandler.ts` and routes it to the active `Task` instance.

**Step 2: LLM Request Orchestration**

The `Task` class (`src/core/task/Task.ts`) orchestrates the conversation loop:

- **Line 1639-1696:** The `recursivelyMakeClineRequests()` method constructs the API request by calling `getSystemPrompt()` (which invokes `SYSTEM_PROMPT()` from `src/core/prompts/system.ts`) and combining it with conversation history from `apiConversationHistory`.

- The method then calls `this.api.createMessage()`, which streams the LLM response.

**Step 3: Tool Call Deserialization**

As the LLM response streams in, `presentAssistantMessage()` in `src/core/assistant-message/presentAssistantMessage.ts` parses tool calls using `NativeToolCallParser` (`src/core/assistant-message/NativeToolCallParser.ts`). When a complete tool block is detected (e.g., `execute_command` or `write_to_file`), the parser extracts parameters.

**Step 4: Tool Execution (Current Implementation)**

Tool execution happens in specialized tool classes:

- **execute_command:** `ExecuteCommandTool` in `src/core/tools/ExecuteCommandTool.ts` (line 33-96) handles command execution. The `execute()` method spawns terminal processes via `executeCommandInTerminal()` (line 148+).

- **write_to_file:** Handled by tool executors in `src/core/tools/` (specific file would be `WriteToFileTool.ts` or similar - the tool execution delegates to VS Code's `workspace.fs` API).

**Hook Injection Points (Wednesday Deliverable)**

The planned hook system will intercept at two points:

1. **PreToolUse Hook:** Before line 96 in `ExecuteCommandTool.execute()`, the middleware will call registered PreToolUse hooks (defined in `src/hooks/types.ts` lines 30-41). These hooks receive a `PreToolUseContext` containing the tool name, parameters, and current task state.

2. **PostToolUse Hook:** After tool execution completes (line 96+), PostToolUse hooks receive `PostToolUseContext` (lines 46-65) with execution results, duration, and success status.

The hook middleware entry point is `src/hooks/middleware.ts`, which exports `executeWithHooks()` (lines 100-167). This function wraps the existing tool execution, ensuring hooks run before/after without modifying core tool logic.

**Tool Call Serialization**

Before sending requests to the LLM, tools are serialized as JSON schemas in the `tools` parameter of the API call. The `buildNativeToolsArrayWithRestrictions()` function in `src/core/task/build-tools.ts` generates these schemas dynamically based on the current mode and available tools.

### 1.3 Prompt Construction Pipeline

**System Prompt Builder Location**

The system prompt is constructed in `src/core/prompts/system.ts`:

- **Entry Point:** `SYSTEM_PROMPT()` function (lines 111-157) is the public API called by `Task.getSystemPrompt()`.

- **Implementation:** The `generatePrompt()` function (lines 40-109) assembles the prompt from multiple sections:
    - Role definition and base instructions (mode-specific)
    - Tool use guidelines (`getToolUseGuidelinesSection()`)
    - Capabilities section (`getCapabilitiesSection()`)
    - Rules section (`getRulesSection()`)
    - System info and environment details
    - Custom instructions and MCP tool descriptions

**Prompt Assembly Process**

The Task class calls `getSystemPrompt()` multiple times during execution:

1. **Initial Request (Task.ts line 1640):** Constructs the full system prompt with current mode, custom instructions, and available tools.

2. **Context Window Management (line 4020):** Regenerates the system prompt when context exceeds token limits.

The system prompt is passed to `generateSystemPrompt()` in `src/core/webview/generateSystemPrompt.ts` (lines 11-69), which integrates:

- API configuration
- Custom mode prompts
- MCP hub status (if enabled)
- Diff strategy settings
- Language preferences

**Intent Context Injection Point (Wednesday Design)**

The hook system will inject `<intent_context>` XML blocks into the system prompt via the `addCustomInstructions()` function (line 102 in `system.ts`). The planned flow:

1. PreToolUse hook calls `loadIntentContext()` from `src/hooks/intent-loader.ts` (line 20)
2. The loader reads `.orchestration/active_intents.yaml` and parses the active intent
3. `formatIntentAsXml()` (line 59) converts the intent into an XML block
4. The XML is injected into `customInstructions` before prompt generation

**Context Engineering Principle**

This design follows Martin Fowler's Context Engineering pattern: instead of dumping entire file trees into the prompt, we **curate** the context window by injecting only intent-relevant information. The `<intent_context>` block will include:

- Intent ID and title
- Owned scope (file globs the agent can modify)
- Related specifications/acceptance criteria
- Previous decisions from `LESSONS.md`

This selective injection keeps token usage efficient while providing the LLM with goal-oriented context, reducing hallucinations and scope creep.

<div style="page-break-after: always;"></div>

---

## 2. Code and Design Architecture

This section summarizes the Phase 0 archaeological analysis documented in `ARCHITECTURE_NOTES.md`, identifying the critical code paths where the hook system will integrate.

### 2.1 Tool Executor Location

**Primary File:** `src/core/tools/ExecuteCommandTool.ts`

**Key Function:** `execute()` method (lines 33-96)

**Role:** The `ExecuteCommandTool` class handles all terminal command execution requests from the LLM. When the agent calls the `execute_command` tool, this executor:

1. Validates the `command` parameter exists (lines 38-41)
2. Resolves the working directory (`cwd` parameter or defaults to workspace root)
3. Requests user approval if auto-approval is disabled (line 52)
4. Spawns a terminal process via `executeCommandInTerminal()` (line 96)
5. Captures output and exit codes through `RooTerminalProcess` callbacks

**Hook Injection Strategy:**

The PreToolUse hook will intercept **before line 96** to:

- Validate the command against security policies (e.g., block `rm -rf /`)
- Check if the command operates on files within the active intent's `owned_scope`
- Inject intent context into the approval prompt shown to the user
- Log the tool invocation to `agent_trace.jsonl` with intent correlation

**Secondary Tool Executors:**

Other file modification tools follow similar patterns:

- `WriteToFileTool`: Writes file content (delegates to `vscode.workspace.fs.writeFile`)
- `ApplyDiffTool`: Applies multi-search-replace patches
- `EditFileTool`: Interactive file editing with LLM-generated patches

All tool executors inherit from `BaseTool` (`src/core/tools/BaseTool.ts`), providing a consistent interface for hook integration via the `execute()` method signature.

### 2.2 Prompt Builder Location

**Primary File:** `src/core/prompts/system.ts`

**Key Function:** `SYSTEM_PROMPT()` (lines 111-157) and `generatePrompt()` (lines 40-109)

**Role:** The prompt builder assembles the system message sent to the LLM on every API request. It constructs a multi-section prompt containing:

1. **Role Definition:** Mode-specific instructions (architect, code, ask, etc.) from `getModeSelection()`
2. **Tool Catalog:** JSON schemas for available tools (generated separately, not in system prompt as of current architecture)
3. **Capabilities:** Environment details, MCP tool descriptions, file operations
4. **Rules:** Custom instructions, `.rooignore` patterns, subfolder rules from `.roo/rules/`
5. **System Info:** OS, shell, working directory, VS Code version
6. **Objective:** High-level task directive

**Context Injection Point:**

The `addCustomInstructions()` function (line 102) merges:

- Base mode instructions
- Global custom instructions (user-defined)
- Language preferences
- RooIgnore instructions

**Hook Integration (Wednesday Design):**

The PreToolUse hook system will extend `addCustomInstructions()` to inject `<intent_context>` XML blocks:

```typescript
// Planned modification to generatePrompt()
const intentContextXml = await loadActiveIntentContext(cwd)
const customInstructionsWithIntent = `${globalCustomInstructions}\n\n${intentContextXml}`
```

This injection happens **before** each LLM request, ensuring the model always has access to the current intent's scope, constraints, and related files.

**Prompt Versioning Consideration:**

The system prompt changes frequently (custom instructions updates, tool availability changes). The hook system must handle prompt regeneration gracefully—intent context should be **dynamically loaded** on each request, not cached at Task initialization.

### 2.3 State Management Between Turns

**Conversation History Persistence:**

Roo Code maintains two parallel conversation streams:

1. **API Conversation History:** `Task.apiConversationHistory` (lines 309 in `Task.ts`)

    - Stored as `ApiMessage[]` in `<globalStoragePath>/tasks/<taskId>/api_conversation_history.json`
    - Persisted via `saveApiConversationHistory()` (lines 1116-1128)
    - Loaded on task resume via `getSavedApiConversationHistory()` (lines 863-865)
    - Format: Anthropic-compatible messages with `role`, `content`, and timestamps

2. **Cline Messages (UI Layer):** `Task.clineMessages` (line 310)
    - Stored in `<globalStoragePath>/tasks/<taskId>/cline_messages.json`
    - Contains user-facing messages: `say`, `ask`, `error`, `completion_result`
    - Includes metadata: tool usage counts, token consumption, approval states

**Session State Storage:**

State is stored **on disk** (not in memory) to support:

- Task resumption after VS Code restart
- History browsing across sessions
- Export to markdown for documentation

The `Task` class tracks ephemeral state in memory:

- `assistantMessageContent`: Streaming response being assembled
- `userMessageContent`: Pending tool results before next API call
- `toolUsage`: Per-tool invocation counts

**Tool Call Tracking Across Turns:**

Each tool call receives a unique `tool_use_id` (generated by the LLM in native tool calling mode). The extension correlates tool results with tool calls via this ID:

```typescript
// From presentAssistantMessage.ts
{ type: "tool_result", tool_use_id: toolUseId, content: resultText }
```

If a tool call fails, the result block includes `is_error: true`, which the LLM uses to self-correct in the next turn.

**Hook Enrichment Opportunity:**

The hook system will extend `ApiMessage` objects with intent metadata:

```typescript
interface EnrichedApiMessage extends ApiMessage {
	intent_id?: string // Active intent when message was created
	content_hashes?: string[] // SHA-256 of files modified in this turn
	related_specs?: string[] // Links to acceptance criteria
}
```

This enrichment happens in PostToolUse hooks after tool execution, **before** messages are saved to disk. On task resume, the intent context can be reconstructed from these annotations.

### 2.4 Hook Injection Points Identified

**PreToolUse Hook Candidates:**

1. **`ExecuteCommandTool.execute()` (line 52-55):**

    - **Location:** After parameter validation, before approval request
    - **Purpose:** Inject intent context into approval prompt, validate command safety
    - **Available Context:** `command`, `cwd`, `Task` instance, user approval state
    - **Risk:** Blocking this hook delays user approval prompt—must complete in <100ms

2. **`presentAssistantMessage()` tool execution block:**
    - **Location:** `src/core/assistant-message/presentAssistantMessage.ts` where tool calls are dispatched
    - **Purpose:** Centralized hook invocation for all tools (not just execute_command)
    - **Available APIs:** `vscode.workspace.fs`, `vscode.window.showWarningMessage`, Task state
    - **Risk:** Exceptions here abort streaming—hooks must handle errors gracefully

**PostToolUse Hook Candidates:**

1. **`ExecuteCommandTool.execute()` completion (after line 96):**

    - **Location:** After `executeCommandInTerminal()` resolves
    - **Purpose:** Log command output, exit code, duration to agent trace
    - **Available Data:** `result`, `exitCode`, `duration`, `success` boolean
    - **Risk:** Low—PostToolUse hooks are non-blocking (failures logged but don't abort)

2. **`Task.addToClineMessages()` (line 1160-1167):**
    - **Location:** After Cline message is added to history
    - **Purpose:** Trigger documentation updates (LESSONS.md, CLAUDE.md, intent_map.md)
    - **Available Data:** Full message object with tool results, approvals, completions
    - **Risk:** Async file writes—must not block UI updates

**Available VS Code APIs for Hooks:**

- `vscode.workspace.fs.readFile()`: Read `.orchestration/active_intents.yaml`
- `vscode.workspace.fs.writeFile()`: Append to `agent_trace.jsonl`
- `vscode.window.showWarningMessage()`: Display intent validation errors
- `vscode.workspace.findFiles()`: Search for files matching intent scope globs
- `vscode.workspace.onDidSaveTextDocument`: React to manual file edits outside agent control

**Risk Assessment:**

| Risk                      | Impact                                | Mitigation                                                                   |
| ------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| PreToolUse hook crashes   | Tool execution aborts, LLM sees error | Wrap hooks in try-catch, return `{ continue: false, reason: error.message }` |
| Slow hook (<1s)           | User approval delayed, poor UX        | Timeout hooks after 500ms, log warning                                       |
| Intent file corrupted     | PreToolUse fails to load context      | Fallback to no-intent mode, warn user                                        |
| PostToolUse write failure | Trace log incomplete                  | Retry with exponential backoff, eventual consistency                         |
| Hook modifies tool params | LLM receives unexpected results       | PreToolUse returns `modifiedParams`, clearly documented                      |

**Wednesday Deliverable Status:**

The hook scaffolding in `src/hooks/` provides TypeScript interfaces (`types.ts`), middleware orchestration (`middleware.ts`), and intent loading stubs (`intent-loader.ts`). These files define the contracts but contain `TODO` placeholders for Saturday's implementation phase.

<div style="page-break-after: always;"></div>

---

## 3. Architectural Decisions for the Hook System

### 3.1 Why Middleware/Interceptor Pattern

The hook system adopts a **middleware pattern** rather than inline logic modifications for four critical reasons:

**1. Composability**

Hooks can be registered, reordered, or disabled without modifying the core `ExecuteCommandTool` or `Task` classes. This follows the **Open/Closed Principle**: the extension is open for enhancement (add new hooks) but closed for modification (don't touch tool executors).

Example from `src/hooks/middleware.ts` (lines 100-167):

```typescript
export async function executeWithHooks<TName extends ToolName>(
	context: PreToolUseContext<TName>,
	executor: () => Promise<unknown>,
): Promise<unknown> {
	// Run all PreToolUse hooks sequentially
	for (const hook of hookRegistry.preToolUseHooks) {
		const result = await hook(context)
		if (!result.continue) {
			throw new Error(result.reason || "Hook aborted execution")
		}
	}

	// Execute the tool
	const toolResult = await executor()

	// Run all PostToolUse hooks (non-blocking)
	for (const hook of hookRegistry.postToolUseHooks) {
		hook(postContext).catch((err) => console.error("PostToolUse hook failed:", err))
	}

	return toolResult
}
```

New hooks register via `registerPreToolUseHook(hookFn)` without touching the wrapper logic.

**2. Testability**

Each hook is a pure function that can be unit-tested in isolation:

```typescript
// Example test for intent validation hook
describe("gatekeeperPreHook", () => {
	it("blocks write_to_file when no active intent", async () => {
		const context = { toolUse: { name: "write_to_file" }, params: { path: "src/foo.ts" } }
		const result = await gatekeeperPreHook(context)
		expect(result.continue).toBe(false)
		expect(result.reason).toContain("must select an active intent")
	})
})
```

Without middleware, testing would require mocking the entire `ExecuteCommandTool` class.

**3. Isolation**

Hook failures don't crash the main execution loop. PreToolUse hooks return `HookResult` objects (defined in `src/hooks/types.ts` lines 16-25):

```typescript
export interface HookResult {
	continue: boolean // false = abort tool execution
	reason?: string // User-facing error message
	modifiedParams?: Record<string, unknown> // Transform tool params
	contextToInject?: string // Add to next LLM prompt
}
```

If a hook throws an exception, the middleware catches it and converts it to `{ continue: false, reason: error.message }`. This **fail-safe** design prevents rogue hooks from breaking the extension.

**4. Alignment with Clean Architecture**

The hook system creates a **dependency inversion**: core tool executors depend on abstract hook interfaces, not concrete implementations. This follows principles from Robert C. Martin's _Clean Architecture_ and aligns with Martin Fowler's **Context Engineering** pattern—hooks curate the context window rather than polluting core logic with intent-specific conditionals.

### 3.2 Privilege Separation: Webview vs Extension Host

The hook system respects VS Code's security boundary:

**Webview Layer (No Hook Access)**

- **Location:** `webview-ui/src/` (React components)
- **Capabilities:** Render UI, receive state updates, send user input
- **Restrictions:** Cannot read files, execute commands, or access secrets
- **Hook Interaction:** Receives hook results (e.g., "Intent validation failed") as display messages

**Extension Host Layer (Hook Execution)**

- **Location:** `src/hooks/` and `src/core/tools/`
- **Capabilities:** Full Node.js + VS Code API access
- **Security Context:** Can read `.orchestration/active_intents.yaml`, write to `agent_trace.jsonl`, spawn processes
- **Hook Execution Environment:** All hooks run in Extension Host with full privileges

**Hook Engine as Middleware Boundary**

The `executeWithHooks()` function acts as a **trust boundary**:

1. **Input Validation:** PreToolUse hooks validate tool parameters before execution (e.g., check `path` against `owned_scope` globs)
2. **Security Classification:** Hooks classify commands as `safe | medium | high | critical` (defined in `CommandClassification` interface, `types.ts` lines 112-123)
3. **Privilege Escalation Prevention:** Hooks can downgrade dangerous operations (e.g., convert `rm -rf` to a safer alternative)

**Example: Command Classification Hook**

```typescript
export async function securityClassifierHook(context: PreToolUseContext<"execute_command">): Promise<HookResult> {
	const { command } = context.params as { command: string }

	if (command.includes("rm -rf /") || command.includes("sudo")) {
		return {
			continue: false,
			reason: "Critical security risk: command requires manual approval",
		}
	}

	return { continue: true }
}
```

This hook runs in the Extension Host (privileged context) but prevents the agent from escalating privileges via malicious commands.

### 3.3 Fail-Safe Design Principles

**1. Structured Errors for LLM Self-Correction**

When a PreToolUse hook blocks execution, it returns a structured error in the tool result:

```json
{
	"type": "tool_result",
	"tool_use_id": "toolu_123",
	"is_error": true,
	"content": {
		"error_type": "intent_validation_failed",
		"message": "File src/unauthorized.ts is outside intent scope",
		"allowed_scope": ["src/auth/**", "tests/auth/**"],
		"suggestion": "Select intent INT-002 or create a new intent"
	}
}
```

The LLM receives this error in the next turn and can **autonomously recover** by:

- Selecting a different intent via `select_active_intent` tool
- Proposing a scope expansion to the user
- Modifying the operation to target allowed files

This follows the principle from Margaret Storey's **Cognitive Debt** research: traceability systems should guide the agent toward correct behavior, not just block incorrect actions.

**2. Blocking Behavior for PreToolUse Hooks**

PreToolUse hooks are **synchronous** and **blocking**: if `continue: false`, the tool never executes. This ensures:

- Invalid operations never reach the filesystem
- Intent violations are caught before state changes
- User approval prompts include intent context

Example from `middleware.ts`:

```typescript
for (const hook of hookRegistry.preToolUseHooks) {
	const result = await hook(context)
	if (!result.continue) {
		// Abort immediately—tool never executes
		throw new ToolExecutionBlockedError(result.reason)
	}
	// Optionally transform params
	if (result.modifiedParams) {
		context.params = { ...context.params, ...result.modifiedParams }
	}
}
```

**3. Non-Blocking PostToolUse Hooks**

PostToolUse hooks are **fire-and-forget**: failures are logged but don't abort the conversation. This prevents trace logging errors from breaking the agent's execution flow.

```typescript
// PostToolUse hooks don't block
for (const hook of hookRegistry.postToolUseHooks) {
	hook(postContext).catch((err) => {
		console.error(`PostToolUse hook failed: ${err.message}`)
		// Continue anyway—trace logging is best-effort
	})
}
```

**4. Autonomous Recovery Pattern**

When a hook rejects a tool call, the agent proposes an alternative in the next turn:

```
Assistant: I attempted to modify src/database.ts, but this file is outside
the current intent scope (INT-001: "Fix authentication bug").

I can either:
1. Select intent INT-005 ("Database schema migration") which allows database changes
2. Ask you to expand INT-001's scope to include database files
3. Proceed with just the auth changes and create a follow-up task for database

What would you prefer?
```

This **guided autonomy** reduces interruptions while maintaining governance.

### 3.4 Alignment with Research Concepts

**Context Engineering (Martin Fowler)**

Traditional AI coding tools dump entire file trees into the prompt, wasting tokens and causing hallucinations. Fowler's Context Engineering pattern advocates for **curated context windows**—inject only what's relevant to the current intent.

The hook system implements this via `loadIntentContext()` in `src/hooks/intent-loader.ts`:

```typescript
export async function loadIntentContext(intentId: string): Promise<string> {
	const intent = await parseActiveIntents(cwd)
	const activeIntent = intent.find((i) => i.intentId === intentId)

	return `<intent_context intent_id="${intentId}">
    <owned_scope>${activeIntent.owned_scope.join(", ")}</owned_scope>
    <acceptance_criteria>${activeIntent.acceptance_criteria}</acceptance_criteria>
    <related_specs>${activeIntent.related_specs.join(", ")}</related_specs>
  </intent_context>`
}
```

This XML block is injected into the system prompt **only when an intent is active**, keeping the context window lean.

**AI-Native Git: Intent-AST Correlation**

Line-based diffs fail for AI-generated code because agents refactor freely—a function moved 50 lines still serves the same intent. The hook system addresses this via **content hashing** in PostToolUse hooks.

From `src/hooks/trace-logger.ts` (planned implementation):

```typescript
export async function contentHashLogger(context: PostToolUseContext): Promise<HookResult> {
	if (context.toolUse.name === "write_to_file") {
		const { path, content } = context.params
		const contentHash = sha256(content)

		await appendToAgentTrace({
			timestamp: new Date().toISOString(),
			event_type: "file_written",
			intent_id: context.task.activeIntentId,
			file_path: path,
			content_hash: contentHash, // Spatial independence
			related: [context.task.activeIntentId], // Links intent → code
		})
	}

	return { continue: true }
}
```

The `content_hash` field enables **spatial independence**: we track _what changed_ (by hashing the code) independent of _where it lives_ (file path + line number). This aligns with research from Cursor's Agent Trace system and the git-ai project.

**Agentic Workflows: Parallel Agents with Shared Memory**

Boris Cherny's _Claude Code Playbook_ advocates for parallel agents sharing a "brain" (CLAUDE.md) rather than sequential handoffs. The hook system supports this via:

1. **Shared Intent Context:** All agents (parent task, delegated child tasks) read the same `.orchestration/active_intents.yaml`
2. **Unified Trace Log:** PostToolUse hooks append to a single `agent_trace.jsonl`, visible to all agents
3. **Living Documentation:** Hooks update `LESSONS.md` and `intent_map.md` after each operation, creating a shared knowledge base

This enables workflows like:

- Agent A starts intent INT-001 ("Add user auth")
- Agent A delegates INT-001-SUB-1 ("Write auth middleware") to Agent B
- Agent B sees INT-001's acceptance criteria in its context
- Both agents log to the same trace file, preventing duplicate work

**Intent Formalization: Executable Specifications**

The hook system treats `active_intents.yaml` as an **executable specification** (inspired by GitHub SpecKit and AISpec research from arXiv 2406.09757). Intents are not passive documentation—they actively govern agent behavior:

```yaml
- id: INT-001
  name: "Add user authentication"
  status: IN_PROGRESS
  owned_scope:
      - "src/auth/**"
      - "tests/auth/**"
  constraints:
      - "Must use bcrypt for password hashing"
      - "Session tokens expire after 24h"
  acceptance_criteria:
      - "Users can register with email/password"
      - "Passwords are hashed before storage"
      - "Login returns a JWT token"
```

The PreToolUse hook reads this YAML and **enforces** constraints:

- If the agent tries to write to `src/database/users.ts`, the hook blocks it (outside `owned_scope`)
- If the agent uses MD5 for hashing, the hook flags it (violates constraint)

This transforms intents from wishful thinking into **runtime governance**.

**Cognitive Debt and Trust Repayment**

Margaret Storey's research on cognitive debt in software engineering identifies **lack of traceability** as a primary source of "trust debt"—teams don't trust AI-generated code because they can't audit its reasoning.

The hook system repays this debt by:

1. **Intent Provenance:** Every file change is linked to an intent ID in `agent_trace.jsonl`
2. **Decision Rationale:** PostToolUse hooks record _why_ a change was made (acceptance criteria, constraints)
3. **Auditable History:** The trace log provides a complete replay of agent decisions

This creates a **trust foundation**: developers can audit the agent's work by reviewing the trace, reducing the need for manual code review.

<div style="page-break-after: always;"></div>

---

## 4. Diagrams and Schemas of the Hook System

### 4.1 Hook Lifecycle Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          HOOK LIFECYCLE FLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

User Prompt
    │
    ├──> System Prompt Construction (generateSystemPrompt.ts)
    │    └──> Intent Context Loader reads .orchestration/active_intents.yaml
    │         └──> <intent_context> XML injected into prompt
    │
    ├──> LLM API Request (Task.recursivelyMakeClineRequests)
    │    └──> Stream response with tool calls
    │
    ├──> Tool Call Parsed (NativeToolCallParser)
    │    └──> Extract tool_name, params, tool_use_id
    │
    ├──> ┌───────────────────────────────────────┐
    │    │   PRE-TOOL-USE HOOK (BLOCKING)        │
    │    ├───────────────────────────────────────┤
    │    │ 1. Intent Gate: Validate tool params  │
    │    │    against owned_scope globs          │
    │    │ 2. Security Classifier: Risk level    │
    │    │ 3. Scope Enforcer: Block out-of-scope │
    │    │ 4. Context Injector: Add intent info  │
    │    │    to approval prompt                 │
    │    └───────────────────────────────────────┘
    │              │
    │              ├──> continue: false? ──> Return error to LLM
    │              │                          (structured JSON with suggestion)
    │              │
    │              ├──> continue: true ──> Proceed to tool execution
    │
    ├──> Tool Execution (ExecuteCommandTool.execute, etc.)
    │    └──> Filesystem write, command execution, API call
    │
    ├──> ┌───────────────────────────────────────┐
    │    │  POST-TOOL-USE HOOK (NON-BLOCKING)    │
    │    ├───────────────────────────────────────┤
    │    │ 1. Trace Logger: Append to            │
    │    │    agent_trace.jsonl                  │
    │    │ 2. Content Hasher: SHA-256 of code    │
    │    │ 3. Documentation Updater: LESSONS.md, │
    │    │    CLAUDE.md, intent_map.md           │
    │    │ 4. Lesson Recorder: Extract patterns  │
    │    └───────────────────────────────────────┘
    │              │
    │              └──> Fire-and-forget (failures logged, don't abort)
    │
    ├──> Tool Result Formatted (formatResponse)
    │    └──> Return to LLM in next turn
    │
    └──> Conversation Continues (or task completes)
```

**Key Decision Points:**

- **Intent Validation (Pre-Hook):** If `write_to_file` targets a file outside `owned_scope`, the hook returns `{ continue: false, reason: "..." }`, aborting execution.
- **Scope Enforcement (Pre-Hook):** Glob matching against intent's `owned_scope` array (e.g., `src/auth/**` allows `src/auth/middleware.ts` but blocks `src/database.ts`).
- **Content Hashing (Post-Hook):** SHA-256 hash of file content enables spatial independence—we track _what code_ changed, not just _where_ it changed.

### 4.2 active_intents.yaml Schema

The intent file serves as the **single source of truth** for agent governance:

```yaml
# .orchestration/active_intents.yaml

intents:
    - id: INT-001
      name: "Add user authentication system"
      description: "Implement JWT-based auth with bcrypt password hashing"
      status: IN_PROGRESS # DRAFT | IN_PROGRESS | DONE | BLOCKED
      created_at: "2026-02-15T14:30:00Z"
      updated_at: "2026-02-18T09:15:00Z"

      # Glob patterns defining files this intent can modify
      owned_scope:
          - "src/auth/**"
          - "src/middleware/auth.ts"
          - "tests/auth/**"
          - "docs/auth-api.md"

      # Hard constraints enforced by PreToolUse hooks
      constraints:
          - "Must use bcrypt for password hashing (min cost factor: 10)"
          - "Session tokens expire after 24 hours"
          - "Passwords must be at least 12 characters"
          - "No plaintext passwords in logs or error messages"

      # Success criteria for intent completion
      acceptance_criteria:
          - "Users can register with email/password"
          - "Passwords are hashed with bcrypt before storage"
          - "Login endpoint returns a valid JWT token"
          - "Protected routes reject requests without valid tokens"
          - "Unit tests cover all auth endpoints (>90% coverage)"

      # Related specifications and documentation
      related_specs:
          - "docs/requirements/auth-spec.md"
          - "docs/security-policy.md"

      # Parent/child intent hierarchy (for delegation)
      parent_intent: null
      child_intents:
          - INT-001-SUB-1 # "Write auth middleware"
          - INT-001-SUB-2 # "Add password reset flow"

      # Metadata for auditing
      contributor: "agent:roo-code-v3.36"
      human_approver: "kidus.tewodros@10academy.org"

    - id: INT-002
      name: "Database schema migration for users table"
      status: BLOCKED
      blocked_reason: "Waiting for INT-001 to define auth requirements"
      owned_scope:
          - "migrations/**"
          - "src/database/schema.sql"
```

**How Pre-Hook Uses This Schema:**

1. **Load:** `parseActiveIntents(cwd)` reads and parses YAML
2. **Match:** Find intent by ID (agent calls `select_active_intent` tool first)
3. **Validate:** Check if `tool.params.path` matches any glob in `owned_scope`
4. **Enforce:** If mismatch, return `{ continue: false, reason: "Path outside scope" }`
5. **Inject:** Add `<intent_context>` XML to system prompt with constraints and acceptance criteria

### 4.3 Agent Trace JSON Schema

The agent trace log provides append-only, immutable audit trail:

```jsonl
{"timestamp":"2026-02-18T10:15:30.123Z","event_type":"tool_use","tool_name":"write_to_file","params":{"path":"src/auth/middleware.ts"},"intent_id":"INT-001","requires_approval":true,"task_id":"task_abc123"}

{"timestamp":"2026-02-18T10:15:35.456Z","event_type":"approval_received","approved":true,"task_id":"task_abc123"}

{"timestamp":"2026-02-18T10:15:36.789Z","event_type":"tool_result","tool_name":"write_to_file","params":{"path":"src/auth/middleware.ts"},"result":"success","duration":1233,"content_hash":"a3f5d8e...","related":["INT-001","docs/auth-spec.md"],"task_id":"task_abc123"}
```

**Critical Fields:**

- **`content_hash`:** SHA-256 of file content, enabling **spatial independence**. If the same function moves from line 50 to line 150 (due to refactoring), the hash remains identical, proving the code's intent hasn't changed.

- **`related` array:** Links the trace entry to:

    - Intent ID (`INT-001`)
    - Related specifications (`docs/auth-spec.md`)
    - Parent intents (for delegated tasks)
    - This enables **intent-AST correlation**: we can trace a specific function back to its originating specification.

- **`contributor` metadata:** Identifies which agent performed the action (useful for multi-agent workflows).

**Schema Definition (TypeScript):**

```typescript
interface AgentTraceRecord {
	timestamp: string // ISO 8601 format
	event_type: "tool_use" | "tool_result" | "approval_requested" | "approval_received"
	tool_name: ToolName
	params?: Record<string, unknown>
	result?: unknown
	requires_approval?: boolean
	approved?: boolean
	duration?: number // milliseconds
	task_id: string

	// Traceability fields
	intent_id?: string
	content_hash?: string // SHA-256 for spatial independence
	related?: string[] // Intent IDs, spec files, parent tasks
	contributor?: string // "agent:roo-code" | "human:user@example.com"

	// Context enrichment
	context?: {
		active_scope?: string[]
		constraints_checked?: string[]
		acceptance_criteria_met?: string[]
	}
}
```

**How Post-Hook Uses This Schema:**

```typescript
export async function traceLogger(context: PostToolUseContext): Promise<HookResult> {
	const record: AgentTraceRecord = {
		timestamp: new Date().toISOString(),
		event_type: "tool_result",
		tool_name: context.toolUse.name,
		params: sanitizeParams(context.params), // Remove secrets
		result: context.success ? "success" : "error",
		duration: context.duration,
		task_id: context.task.taskId,
		intent_id: context.task.activeIntentId,
		content_hash:
			context.toolUse.name === "write_to_file" ? await computeSHA256(context.params.content) : undefined,
		related: [context.task.activeIntentId, ...context.task.relatedSpecs],
	}

	await appendToFile(".orchestration/agent_trace.jsonl", JSON.stringify(record) + "\n")
	return { continue: true }
}
```

### 4.4 Pre-Hook vs Post-Hook Responsibility Matrix

| **Responsibility**                | **Pre-Hook (Blocking)**                                    | **Post-Hook (Non-Blocking)**               |
| --------------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| **Intent Validation**             | ✅ Validate `path` against `owned_scope` globs             | ❌ Already executed                        |
| **Security Classification**       | ✅ Classify command risk level (safe/medium/high/critical) | ❌ Too late to block                       |
| **Scope Enforcement**             | ✅ Abort if file outside intent scope                      | ❌ Already written                         |
| **Context Injection**             | ✅ Add `<intent_context>` to approval prompt               | ❌ Prompt already sent                     |
| **Parameter Transformation**      | ✅ Modify tool params (e.g., add `--dry-run` flag)         | ❌ Tool already executed                   |
| **Trace Logging**                 | ❌ Don't delay execution                                   | ✅ Append to `agent_trace.jsonl`           |
| **Content Hashing**               | ❌ File not written yet                                    | ✅ SHA-256 of final file content           |
| **Documentation Updates**         | ❌ Don't block tool execution                              | ✅ Update LESSONS.md, intent_map.md        |
| **Lesson Recording**              | ❌ No result to analyze                                    | ✅ Extract patterns from execution outcome |
| **Notification Dispatch**         | ❌ Don't delay user approval                               | ✅ Send Slack/email notifications async    |
| **Error Recovery**                | ✅ Return structured error for LLM self-correction         | ❌ Already failed                          |
| **Approval Prompt Customization** | ✅ Inject intent context into UI                           | ❌ Approval already granted/denied         |

**Design Rationale:**

- **Pre-Hook = Gatekeeper:** Prevents invalid operations from executing. Must complete quickly (<100ms) to avoid delaying user experience.

- **Post-Hook = Auditor:** Records what happened after the fact. Failures are logged but don't abort the conversation (eventual consistency).

**Exception Handling:**

```typescript
// Pre-Hook: Exception aborts execution
try {
	const result = await preToolUseHook(context)
	if (!result.continue) {
		throw new ToolExecutionBlockedError(result.reason)
	}
} catch (error) {
	// Return error to LLM for self-correction
	return { continue: false, reason: error.message }
}

// Post-Hook: Exception logged, conversation continues
postToolUseHook(context).catch((err) => {
	console.error(`PostToolUse hook failed: ${err}`)
	// Don't propagate—trace logging is best-effort
})
```

---

## Conclusion

This Wednesday deliverable establishes the architectural foundation for upgrading Roo Code into a governed AI-Native IDE. The hook system design integrates four research-backed principles:

1. **Context Engineering (Martin Fowler):** Curate context windows via `<intent_context>` XML injection, not bulk file dumping.

2. **AI-Native Git (Cursor, git-ai):** Track code changes via content hashing (`content_hash`) for spatial independence, enabling intent-AST correlation.

3. **Cognitive Debt Repayment (Margaret Storey):** Build trust through complete traceability—every file change links to an intent ID in `agent_trace.jsonl`.

4. **Executable Specifications (GitHub SpecKit, AISpec):** Treat `active_intents.yaml` as runtime governance, not passive documentation.

The scaffolding delivered on Wednesday (`src/hooks/types.ts`, `middleware.ts`, `intent-loader.ts`, `security.ts`, `trace-logger.ts`) provides TypeScript interfaces and middleware orchestration. Saturday's implementation phase will replace `TODO` stubs with full hook logic, enabling:

- PreToolUse hooks to enforce intent scope and security policies
- PostToolUse hooks to log execution traces with content hashing
- Intent-driven context injection for reduced token usage
- Autonomous LLM recovery from validation failures

This architecture positions Roo Code as a **governed agentic IDE** where AI autonomy coexists with human oversight, traceability, and testability.

---

**End of Report**
