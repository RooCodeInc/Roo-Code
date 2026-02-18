# Roo Code Architecture Summary

**Document Version:** 1.0  
**Generated:** 2026-02-18  
**Purpose:** Internal architecture documentation for Roo Code VS Code extension

---

## Overview

Roo Code is a VS Code extension that provides an AI-powered coding assistant. The architecture follows a **Model-View-Controller** pattern with the extension host acting as the controller, a webview UI, and LLM providers as the model.

---

## Tool Execution Flow

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Extension Host (Node.js)                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                        Task.ts                                  │ │
│  │  • recursivelyMakeClineRequests() - Main request loop          │ │
│  │  • Manages API conversation history                            │ │
│  │  • Handles streaming responses                                 │ │
│  └────────────────┬──────────────────────────────────┬────────────┘ │
│                   │                                   │              │
│                   ▼                                   ▼              │
│  ┌────────────────────────────┐   ┌──────────────────────────────┐ │
│  │  presentAssistantMessage   │   │   ApiHandler (api/index.ts)  │ │
│  │  • Processes tool_use      │   │   • Creates LLM requests     │ │
│  │  • Routes to tool handlers │   │   • Streams responses        │ │
│  └────────────┬───────────────┘   └──────────────────────────────┘ │
│               │                                                      │
│               ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              BaseTool.handle() → Tool.execute()                 │ │
│  │  • ExecuteCommandTool    • WriteToFileTool                     │ │
│  │  • ReadFileTool          • ApplyDiffTool                       │ │
│  │  • NewTaskTool           • AttemptCompletionTool               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                   │                                                  │
│                   ▼                                                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │           VS Code APIs & File System Operations                 │ │
│  │  • vscode.workspace.fs    • Terminal integration               │ │
│  │  • File watchers          • Diff view provider                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                   │                                   ▲
                   │ postMessage                       │ webview.onDidReceiveMessage
                   ▼                                   │
┌─────────────────────────────────────────────────────────────────────┐
│                      Webview (React UI)                              │
│  • Displays chat messages, tool approvals, diff views               │
│  • Sends user input, approval responses                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Call Sequence Details

**1. User sends a message:**

- `webview-ui/src/App.tsx` → `postMessage({ type: "askResponse", ... })`
- `ClineProvider.ts` → `webviewMessageHandler.ts` processes message
- Creates/resumes `Task` instance

**2. Task executes LLM request loop:**

```typescript
Task.recursivelyMakeClineRequests()
  ├─ Builds system prompt (SYSTEM_PROMPT from src/core/prompts/system.ts)
  ├─ Builds tools array (buildNativeToolsArray from src/core/task/build-tools.ts)
  ├─ Calls ApiHandler.createMessage() with conversation history
  ├─ Streams response chunks
  ├─ Parses tool_use blocks (NativeToolCallParser)
  └─ Calls presentAssistantMessage() for each content block
```

**3. Tool execution:**

```typescript
presentAssistantMessage(task)
  ├─ Iterates assistantMessageContent array
  ├─ For tool_use blocks:
  │   ├─ Validates tool permissions (mode restrictions)
  │   ├─ Creates callbacks: { askApproval, handleError, pushToolResult }
  │   └─ Routes to tool handler (e.g., writeToFileTool.handle())
  │
  └─ Tool execution flow:
      BaseTool.handle()
        ├─ handlePartial() if streaming (optional)
        ├─ Parse nativeArgs from tool_use block
        └─ execute(params, task, callbacks)
            ├─ Perform file/command operations
            ├─ Call askApproval() if user confirmation needed
            └─ Call pushToolResult() with result
```

**4. Tool result collection:**

- `pushToolResult()` adds `tool_result` to `task.userMessageContent[]`
- After all tools execute, `userMessageContent` is added to `apiConversationHistory`
- Loop continues with next LLM request

---

## Key Files

### Core Execution Loop

| File                                                    | Purpose                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/core/task/Task.ts`                                 | Main task orchestrator, contains `recursivelyMakeClineRequests()` |
| `src/core/assistant-message/presentAssistantMessage.ts` | Routes tool_use blocks to handlers                                |
| `src/core/tools/BaseTool.ts`                            | Abstract base class for all tools                                 |
| `src/core/tools/ExecuteCommandTool.ts`                  | Executes shell commands via terminal                              |
| `src/core/tools/WriteToFileTool.ts`                     | Writes content to files                                           |
| `src/core/tools/ReadFileTool.ts`                        | Reads file content with line ranges                               |

### Prompt Construction

| File                                   | Purpose                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `src/core/prompts/system.ts`           | `SYSTEM_PROMPT()` - Main entry point for system prompt      |
| `src/core/prompts/sections/`           | Modular prompt components (capabilities, rules, objective)  |
| `src/core/task/build-tools.ts`         | `buildNativeToolsArray()` - Builds tool definitions for LLM |
| `src/core/prompts/tools/native-tools/` | Tool schemas (read_file.ts, write_to_file.ts, etc.)         |

### Communication Layer

| File                                        | Purpose                                  |
| ------------------------------------------- | ---------------------------------------- |
| `src/core/webview/ClineProvider.ts`         | Main provider, manages webview lifecycle |
| `src/core/webview/webviewMessageHandler.ts` | Processes messages from webview          |
| `src/shared/WebviewMessage.ts`              | Message type definitions                 |
| `webview-ui/src/App.tsx`                    | React UI entry point                     |

---

## Prompt Construction

### System Prompt Location

- **Entry point:** `src/core/prompts/system.ts` → `SYSTEM_PROMPT()` (line 111)
- **Builder:** `generatePrompt()` (line 40)

### Prompt Components (in order)

1. **Role Definition** - Mode-specific role (architect, code, ask, etc.)
2. **Markdown Formatting** - Instructions for markdown usage
3. **Shared Tool Use** - Cross-cutting tool guidelines
4. **Tool Use Guidelines** - General rules for tool calling
5. **Capabilities** - Available tools, MCP servers, workspace info
6. **Modes Section** - Available modes and switching
7. **Skills Section** - Custom skills if available
8. **Rules Section** - `.roo/rules/` custom instructions
9. **System Info** - OS, shell, CWD details
10. **Objective** - Final instructions

### Context Injection Points

**Custom Instructions:**

```typescript
// src/core/prompts/sections/add-custom-instructions.ts
addCustomInstructions(
	baseInstructions, // Mode-specific instructions
	globalCustomInstructions, // User's global custom instructions
	cwd,
	mode,
	{ language, rooIgnoreInstructions, settings },
)
```

**Custom XML blocks can be injected via:**

1. **Global custom instructions:** Settings → "Custom Instructions"
2. **Mode-specific prompts:** Custom modes in `.roo/modes/`
3. **Roo rules:** Files in `.roo/rules/` directory
4. **Skills:** `.roo/skills/` directory with YAML metadata

**System prompt preview:**

```typescript
// Request via webview message:
{ type: "getSystemPrompt", mode: "code" }

// Handled in webviewMessageHandler.ts (line 1596)
const systemPrompt = await generateSystemPrompt(provider, message)
```

---

## Extension Host ↔ Webview Communication

### Message Schema

**Direction: Webview → Extension Host**

```typescript
// Defined in packages/types/src/webview-message.ts
type WebviewMessage =
  | { type: "askResponse", askResponse: "yesButtonClicked" | "noButtonClicked" | ... }
  | { type: "newTask", text: string, images?: string[] }
  | { type: "apiConfiguration", apiConfiguration: ProviderSettings }
  | { type: "getSystemPrompt", mode?: string }
  | { type: "selectImages" }
  | { type: "exportCurrentTask" }
  // ... 50+ message types
```

**Direction: Extension Host → Webview**

```typescript
// Defined in packages/types/src/extension-message.ts
type ExtensionMessage =
  | { type: "state", state: ExtensionState }
  | { type: "action", action: "chatButtonClicked" | "didBecomeVisible" | ... }
  | { type: "messageUpdated", clineMessage: ClineMessage }
  | { type: "commandExecutionStatus", text: string }
  | { type: "workspaceUpdated", filePaths: string[], openedTabs: TabInfo[] }
  // ... 40+ message types
```

### Communication Flow

**Setup (src/core/webview/ClineProvider.ts):**

```typescript
// Line 1329
const messageDisposable = webview.onDidReceiveMessage(onReceiveMessage)

// onReceiveMessage routes to webviewMessageHandler.ts
```

**Sending from Extension to Webview:**

```typescript
// ClineProvider.postMessageToWebview() (line 1126)
await this.view?.webview.postMessage(message)
```

**Receiving in Webview:**

```typescript
// webview-ui/src/App.tsx
useEffect(() => {
	const messageHandler = (event: MessageEvent) => {
		const message = event.data as ExtensionMessage
		// Process message...
	}
	window.addEventListener("message", messageHandler)
}, [])
```

### State Persistence

**State is persisted between turns in multiple layers:**

1. **API Conversation History:**

    - File: `~/.roo-code/tasks/<taskId>/api_messages.json`
    - Managed by: `Task.saveApiConversationHistory()` (line 1116)

2. **UI Messages (Chat):**

    - File: `~/.roo-code/tasks/<taskId>/cline_messages.json`
    - Managed by: `Task.saveClineMessages()`

3. **Task Metadata:**

    - File: `~/.roo-code/tasks/<taskId>/metadata.json`
    - Contains: task description, mode, timestamps

4. **Extension State:**
    - VS Code context storage (workspace + global)
    - API configuration, custom modes, settings

**State synchronization:**

```typescript
// Full state update
provider.postMessageToWebview({ type: "state", state: await provider.getState() })

// Incremental updates (avoid resending task history)
provider.postStateToWebviewWithoutTaskHistory()
```

---

## Hook Injection Points

### PreToolUse Hook Candidates

**Option 1: In presentAssistantMessage (RECOMMENDED)**

```typescript
// File: src/core/assistant-message/presentAssistantMessage.ts
// Location: Line 676 (before switch statement executing tools)

switch (block.name) {
  case "write_to_file":
    // ⚡ INJECTION POINT: Before tool execution
    // await preToolUseHook(task, block, { toolName: "write_to_file" })

    await checkpointSaveAndMark(cline)
    await writeToFileTool.handle(cline, block as ToolUse<"write_to_file">, {
      askApproval,
      handleError,
      pushToolResult,
    })
    break
```

**Option 2: In BaseTool.handle (applies to all tools)**

```typescript
// File: src/core/tools/BaseTool.ts
// Location: Line 112 (before execute)

async handle(task: Task, block: ToolUse<TName>, callbacks: ToolCallbacks): Promise<void> {
  if (block.partial) {
    // Handle partial streaming...
    return
  }

  // Parse parameters
  let params = block.nativeArgs as ToolParams<TName>

  // ⚡ INJECTION POINT: Before any tool executes
  // await this.preToolUseHook?.(task, block, params, callbacks)

  // Execute with typed parameters
  await this.execute(params, task, callbacks)
}
```

### PostToolUse Hook Candidates

**Option 1: Modify pushToolResult callback**

```typescript
// File: src/core/assistant-message/presentAssistantMessage.ts
// Location: Line 448 (inside tool_use block handler)

const pushToolResult = (content: ToolResponse) => {
	// ... existing duplicate check logic ...

	cline.pushToolResultToUserContent({
		type: "tool_result",
		tool_use_id: sanitizeToolUseId(toolCallId),
		content: resultContent,
	})

	// ⚡ INJECTION POINT: After tool result is collected
	// await postToolUseHook?.(task, block, content, { success: true })

	hasToolResult = true
}
```

**Option 2: In BaseTool.execute (each tool implements)**

```typescript
// Individual tools can override execute() and add post-execution logic
async execute(params: ToolParams<TName>, task: Task, callbacks: ToolCallbacks): Promise<void> {
  try {
    // ... existing tool logic ...

    callbacks.pushToolResult(result)

    // ⚡ INJECTION POINT: Tool-specific post-execution
    // await this.postToolUseHook?.(task, params, result)
  } catch (error) {
    callbacks.handleError("tool execution", error)
  }
}
```

**Option 3: After userMessageContent is saved (RECOMMENDED for analytics)**

```typescript
// File: src/core/task/Task.ts
// Location: After recursivelyMakeClineRequests adds user message to history

// Around line 1800+ (in recursivelyMakeClineRequests)
await this.addToApiConversationHistory({
	role: "user",
	content: this.userMessageContent,
})

// ⚡ INJECTION POINT: All tool results are now persisted
// await this.postToolUseHook?.(this.userMessageContent)

this.userMessageContent = []
```

### Available VS Code APIs

**File System:**

```typescript
import * as vscode from "vscode"

// Read/write files
await vscode.workspace.fs.readFile(uri)
await vscode.workspace.fs.writeFile(uri, content)

// File watching
const watcher = vscode.workspace.createFileSystemWatcher("**/*")
watcher.onDidCreate((uri) => {
	/* handle */
})
watcher.onDidChange((uri) => {
	/* handle */
})
watcher.onDidDelete((uri) => {
	/* handle */
})
```

**UI & User Interaction:**

```typescript
// Show modal dialogs
await vscode.window.showInformationMessage("Message", "Button1", "Button2")
await vscode.window.showErrorMessage("Error")
await vscode.window.showWarningMessage("Warning")

// Input boxes
await vscode.window.showInputBox({ prompt: "Enter value" })
await vscode.window.showQuickPick(["Option 1", "Option 2"])

// Status bar
const statusBarItem = vscode.window.createStatusBarItem()
statusBarItem.text = "Roo: Active"
statusBarItem.show()
```

**Workspace & Editor:**

```typescript
// Get workspace root
const workspaceFolders = vscode.workspace.workspaceFolders
const rootPath = workspaceFolders?.[0]?.uri.fsPath

// Read workspace files
const files = await vscode.workspace.findFiles("**/*.ts")

// Active editor
const editor = vscode.window.activeTextEditor
const document = editor?.document
const selection = editor?.selection
```

**Configuration:**

```typescript
// Read settings
const config = vscode.workspace.getConfiguration("roo-code")
const value = config.get<boolean>("enableFeature")

// Update settings
await config.update("enableFeature", true, vscode.ConfigurationTarget.Global)
```

**Commands:**

```typescript
// Register commands
vscode.commands.registerCommand("roo-code.myCommand", async () => {
	// Command logic
})

// Execute existing commands
await vscode.commands.executeCommand("workbench.action.files.save")
```

**Example: File watcher integration (already in use):**

```typescript
// src/integrations/workspace/WorkspaceTracker.ts (line 41)
const watcher = vscode.workspace.createFileSystemWatcher("**")
watcher.onDidCreate(async (uri) => {
	await this.addFilePath(uri.fsPath)
	this.workspaceDidUpdate()
})
```

---

## Risks & Constraints

### What Could Break with Hooks

**1. Tool Result Ordering**

- **Risk:** If PreToolUse hook throws an error, `pushToolResult` might not be called
- **Impact:** LLM expects `tool_result` for every `tool_use` → API 400 error
- **Mitigation:** Hooks must be in try/catch, always call pushToolResult even on hook failure

**2. Streaming Interference**

- **Risk:** Hooks that take too long delay streaming UI updates
- **Impact:** Tool appears "frozen" to user during execution
- **Mitigation:** Keep hooks fast (<100ms), use async background tasks for heavy work

**3. Task Delegation (NewTaskTool)**

- **Risk:** Parent task disposes before child finishes, hooks on parent may fail
- **Impact:** PostToolUse hook might not fire for delegated tasks
- **Mitigation:** Use `task.rootTask` reference, ensure hooks check if task is aborted

**4. Parallel Tool Calling**

- **Risk:** Multiple tools execute simultaneously, hooks may be called concurrently
- **Impact:** Race conditions in shared state
- **Mitigation:** Hooks should be stateless or use task-scoped state (task.customData)

**5. Tool Validation Failures**

- **Risk:** Tool fails validation before execute(), PreToolUse already fired
- **Impact:** Hook sees tool that never ran
- **Mitigation:** Place PreToolUse after validation (line 623 in presentAssistantMessage)

### Backward Compatibility Requirements

**1. Message Format**

- ✅ **Safe:** Adding new ExtensionMessage types
- ⚠️ **Risky:** Changing existing message schemas (breaks old webview)
- ✅ **Safe:** Adding optional fields to messages

**2. Tool Schemas**

- ⚠️ **Risky:** Changing tool parameter names/types (breaks LLM context)
- ✅ **Safe:** Adding new optional parameters
- ⚠️ **Risky:** Removing tools (breaks tasks that used them)

**3. API History Format**

- ⚠️ **Risky:** Changing `api_messages.json` structure (breaks task resume)
- ✅ **Safe:** Adding new fields with default values
- ⚠️ **Risky:** Changing how tool_use/tool_result blocks are stored

**4. Hook Integration**

- ✅ **Safe:** Optional hooks (check if defined before calling)
- ✅ **Safe:** Event emitters (existing pattern in Task class)
- ⚠️ **Risky:** Required hooks (breaks if not implemented)

**Recommended Hook Pattern (Backward Compatible):**

```typescript
// In BaseTool.ts
export interface ToolHooks {
  preToolUse?: (task: Task, toolUse: ToolUse, params: any) => Promise<void>
  postToolUse?: (task: Task, toolUse: ToolUse, result: any) => Promise<void>
}

// Optional injection
export class BaseTool<TName extends ToolName> {
  static hooks?: ToolHooks

  async handle(...) {
    // Pre-hook (optional)
    await BaseTool.hooks?.preToolUse?.(task, block, params)

    // Execute tool
    await this.execute(params, task, callbacks)

    // Post-hook (optional)
    await BaseTool.hooks?.postToolUse?.(task, block, result)
  }
}
```

---

## Additional Notes

### Tool Execution Lifecycle

1. **Streaming starts** → `presentAssistantMessage()` called repeatedly
2. **Partial tool_use** → `tool.handlePartial()` shows streaming UI
3. **Complete tool_use** → Validation → `tool.handle()` → `tool.execute()`
4. **Approval required** → `askApproval()` shows modal → waits for user
5. **Tool executes** → File/command operations
6. **Result collected** → `pushToolResult()` adds to `userMessageContent`
7. **All tools complete** → `userMessageContentReady = true`
8. **Next LLM request** → Loop continues

### Context Management

**Context condensing:**

- When conversation exceeds token limit, older messages are summarized
- Implemented in `src/core/condense/index.ts`
- Uses `summarizeConversation()` to create compact summaries

**Context tracking:**

- `FileContextTracker` monitors which files are mentioned
- Used for intelligent context inclusion in follow-up requests

### Checkpointing

**Purpose:** Save git snapshots before file modifications  
**Location:** `src/core/checkpoints/`  
**Trigger:** Before `write_to_file`, `apply_diff`, `edit_file` tools  
**Storage:** `.git` worktree with checkpoint branches

---

## Summary

**Tool execution flow:**  
`Task.recursivelyMakeClineRequests()` → LLM API → `presentAssistantMessage()` → Tool handlers → VS Code APIs

**Best injection points:**

- **PreToolUse:** `presentAssistantMessage.ts` line 676 (before switch) or `BaseTool.handle()` line 112
- **PostToolUse:** `pushToolResult` callback line 448 or after `addToApiConversationHistory()` in Task.ts

**Key constraints:**

- Always call `pushToolResult()` for every `tool_use` (even on errors)
- Hooks must be fast to avoid blocking streaming
- Use optional patterns for backward compatibility
- Check `task.abort` before long operations

**Available APIs:**

- Full VS Code extension API (file system, UI, commands, workspace)
- File watching via `vscode.workspace.createFileSystemWatcher()`
- Modal dialogs via `vscode.window.show*Message()`
- Configuration via `vscode.workspace.getConfiguration()`

---

## Phase 1: Intent-Driven Architect Protocol

### Overview

The Intent-Driven Architect protocol enforces a structured workflow where agents must "check out" an intent before making code changes. This ensures:

1. **Scope isolation** - Agents only modify files within their declared intent scope
2. **Context awareness** - Agents receive relevant constraints and acceptance criteria
3. **Traceability** - All changes are linked to a specific intent for audit purposes

---

### Tool Schema: select_active_intent

#### TypeScript Interface

```typescript
// Add to src/shared/tools.ts

/** Tool parameter for select_active_intent */
export interface SelectActiveIntentParams {
	/** Intent ID to activate (e.g., "INT-001") */
	intent_id: string
}

/** Tool use block for select_active_intent */
export interface SelectActiveIntentToolUse extends ToolUse<"select_active_intent"> {
	name: "select_active_intent"
	input: SelectActiveIntentParams
}

/** Response from select_active_intent tool */
export interface SelectActiveIntentResponse {
	/** Whether the intent was successfully loaded */
	success: boolean
	/** Intent context as XML string (injected into next prompt) */
	context?: string
	/** Error message if intent not found or invalid */
	error?: string
	/** The loaded intent metadata */
	intent?: {
		id: string
		name: string
		status: string
		owned_scope: string[]
		constraints: string[]
		acceptance_criteria: string[]
	}
}
```

#### OpenAI Tool Schema

```typescript
// src/core/prompts/tools/native-tools/select_active_intent.ts

import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select and activate an intent from .orchestration/active_intents.yaml before making code changes. This tool loads the intent's scope, constraints, and acceptance criteria into your context.

**CRITICAL PROTOCOL:** You MUST call select_active_intent before using write_to_file, apply_diff, edit_file, or any other file modification tools. Attempting to modify files without declaring an intent will result in an error.

The intent defines:
- owned_scope: File patterns you are allowed to modify (glob patterns)
- constraints: Technical or architectural rules you must follow
- acceptance_criteria: Definition of done for this intent

After selecting an intent, you receive an enriched context block that guides your implementation. This ensures you stay within scope and follow project guidelines.

Example: Selecting an intent for authentication work
{ "intent_id": "INT-001" }

Available intent IDs are listed in .orchestration/active_intents.yaml under the 'id' field of each intent.`

const INTENT_ID_PARAMETER_DESCRIPTION = `The unique identifier of the intent to activate (e.g., "INT-001"). Must match an ID in .orchestration/active_intents.yaml. Format: "INT-" followed by a zero-padded number (e.g., INT-001, INT-042).`

export default {
	type: "function",
	function: {
		name: "select_active_intent",
		description: SELECT_ACTIVE_INTENT_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description: INTENT_ID_PARAMETER_DESCRIPTION,
					pattern: "^INT-\\d{3,}$", // Enforces format: INT-001, INT-042, etc.
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
```

#### Input Validation Rules

1. **Format validation:**

    - Must match pattern: `^INT-\d{3,}$` (e.g., INT-001, INT-042)
    - Case-sensitive (uppercase INT only)
    - Minimum 3 digits after "INT-"

2. **Existence validation:**

    - Intent ID must exist in `.orchestration/active_intents.yaml`
    - File must be readable and valid YAML
    - Intent must have `status != "DONE"`

3. **State validation:**
    - Cannot select an intent if one is already active (must clear first)
    - Cannot select BLOCKED intents (status: BLOCKED)

#### Expected Return Format

**Success case:**

```typescript
{
  success: true,
  context: `<intent_context intent_id="INT-001">
  <name>Implement JWT authentication</name>
  <status>IN_PROGRESS</status>
  <owned_scope>
    <pattern>src/auth/**</pattern>
    <pattern>tests/auth/**</pattern>
  </owned_scope>
  <constraints>
    <constraint>Use bcrypt for password hashing (min 10 rounds)</constraint>
    <constraint>JWT tokens expire after 24 hours</constraint>
    <constraint>Store refresh tokens in Redis</constraint>
  </constraints>
  <acceptance_criteria>
    <criterion>All auth endpoints return proper HTTP status codes</criterion>
    <criterion>Password validation prevents common weak passwords</criterion>
    <criterion>Token refresh mechanism works without re-login</criterion>
  </acceptance_criteria>
</intent_context>`,
  intent: {
    id: "INT-001",
    name: "Implement JWT authentication",
    status: "IN_PROGRESS",
    owned_scope: ["src/auth/**", "tests/auth/**"],
    constraints: ["Use bcrypt...", "JWT tokens...", "Store refresh..."],
    acceptance_criteria: ["All auth...", "Password...", "Token..."]
  }
}
```

**Error cases:**

1. **Intent not found:**

```typescript
{
  success: false,
  error: "Intent 'INT-999' not found in .orchestration/active_intents.yaml. Available intents: INT-001, INT-002, INT-003"
}
```

2. **Malformed ID:**

```typescript
{
  success: false,
  error: "Invalid intent_id format: 'int-1'. Expected format: INT-XXX (e.g., INT-001, INT-042)"
}
```

3. **File read failure:**

```typescript
{
  success: false,
  error: "Failed to read .orchestration/active_intents.yaml: ENOENT (file not found). Please create the file with at least one intent."
}
```

4. **YAML parse error:**

```typescript
{
  success: false,
  error: "Invalid YAML in .orchestration/active_intents.yaml at line 12: unexpected token. Please fix the YAML syntax."
}
```

5. **Intent already active:**

```typescript
{
  success: false,
  error: "Intent 'INT-001' is already active in this session. Clear the current intent before selecting a new one."
}
```

6. **Blocked intent:**

```typescript
{
  success: false,
  error: "Intent 'INT-005' has status 'BLOCKED'. Cannot activate blocked intents. Reason: Waiting for API keys from client."
}
```

---

### Pre-Hook Context Injection Flow

#### Sequence Diagram

```
┌─────────┐          ┌──────────────┐          ┌─────────────┐          ┌──────────────┐
│   LLM   │          │ Tool Handler │          │  Pre-Hook   │          │ Intent Loader│
└────┬────┘          └──────┬───────┘          └──────┬──────┘          └──────┬───────┘
     │                      │                         │                        │
     │ tool_use:            │                         │                        │
     │ select_active_intent │                         │                        │
     │ { intent_id: "INT-001" }                      │                        │
     ├─────────────────────>│                         │                        │
     │                      │                         │                        │
     │                      │ executePreToolUseHooks()│                        │
     │                      ├────────────────────────>│                        │
     │                      │  (task, toolUse, params)│                        │
     │                      │                         │                        │
     │                      │                    ┌────▼────────────────────────┴────┐
     │                      │                    │ PAUSE EXECUTION                 │
     │                      │                    │ Check if intent_id is valid      │
     │                      │                    └────┬────────────────────────────┬┘
     │                      │                         │                        │
     │                      │                         │ loadIntentContext()    │
     │                      │                         │ ("INT-001")            │
     │                      │                         ├───────────────────────>│
     │                      │                         │                        │
     │                      │                         │   Read .orchestration/ │
     │                      │                         │   active_intents.yaml  │
     │                      │                         │<───────────────────────┤
     │                      │                         │                        │
     │                      │                         │   Extract intent data: │
     │                      │                         │   - id: INT-001        │
     │                      │                         │   - owned_scope        │
     │                      │                         │   - constraints        │
     │                      │                         │   - acceptance_criteria│
     │                      │                         │<───────────────────────┤
     │                      │                         │                        │
     │                      │                         │ formatIntentAsXml()    │
     │                      │                         ├───────────────────────>│
     │                      │                         │                        │
     │                      │                         │ <intent_context>...    │
     │                      │                         │ </intent_context>      │
     │                      │                         │<───────────────────────┤
     │                      │                         │                        │
     │                      │  HookResult:            │                        │
     │                      │  { continue: true,      │                        │
     │                      │    contextToInject: xml }│                       │
     │                      │<────────────────────────┤                        │
     │                      │                         │                        │
     │                      │ tool.execute()          │                        │
     │                      │ (with intent context)   │                        │
     │                      │                         │                        │
     │                      │ pushToolResult()        │                        │
     │                      │ (XML context added to   │                        │
     │                      │  tool_result)           │                        │
     │                      │                         │                        │
     │ tool_result:         │                         │                        │
     │ "Intent INT-001 active"│                       │                        │
     │ + <intent_context>...</intent_context>         │                        │
     │<─────────────────────┤                         │                        │
     │                      │                         │                        │
     │ [Next API request includes intent context]     │                        │
     │                      │                         │                        │
```

#### Step-by-Step Flow

**Step 1: Agent calls select_active_intent**

```json
{
	"type": "tool_use",
	"id": "toolu_01ABC",
	"name": "select_active_intent",
	"input": {
		"intent_id": "INT-001"
	}
}
```

**Step 2: Pre-Hook intercepts → Pauses execution**

```typescript
// In presentAssistantMessage.ts (before tool execution)
const preHookResult = await executePreToolUseHooks(task, toolUse, params)
if (!preHookResult.continue) {
	// Abort tool execution
	pushToolResult({
		type: "error",
		error: preHookResult.reason,
	})
	return
}
```

**Step 3: Hook reads .orchestration/active_intents.yaml**

```typescript
// In src/hooks/intent-loader.ts
const yamlContent = await fs.readFile(path.join(task.cwd, ".orchestration/active_intents.yaml"), "utf-8")
const parsed = YAML.parse(yamlContent)
```

**Step 4: Hook extracts intent data**

```typescript
const intent = parsed.active_intents.find((i) => i.id === intentId)
if (!intent) {
	return {
		continue: false,
		reason: `Intent '${intentId}' not found`,
	}
}

const extracted = {
	owned_scope: intent.owned_scope || [],
	constraints: intent.constraints || [],
	acceptance_criteria: intent.acceptance_criteria || [],
}
```

**Step 5: Hook formats as XML**

```typescript
const xml = formatIntentAsXml(intent)
// Returns: <intent_context intent_id="INT-001">...</intent_context>
```

**Step 6: Hook returns XML as contextToInject**

```typescript
return {
	continue: true,
	contextToInject: xml,
}
```

**Step 7: Execution resumes with enriched context**

```typescript
// Tool executes normally
await tool.execute(params, task, callbacks)

// Result includes injected context
pushToolResult({
	type: "text",
	text: `Intent INT-001 activated successfully.\n\n${preHookResult.contextToInject}`,
})
```

**Step 8: Next LLM request includes intent context**

```json
{
	"role": "user",
	"content": [
		{
			"type": "tool_result",
			"tool_use_id": "toolu_01ABC",
			"content": "Intent INT-001 activated successfully.\n\n<intent_context intent_id=\"INT-001\">...</intent_context>"
		}
	]
}
```

The LLM now sees the intent context in its conversation history and uses it to guide all subsequent actions.

---

### Gatekeeper Logic

#### State Machine

```
┌────────────────────────────────────────────────────────────────┐
│                    Intent Session State                         │
│                                                                 │
│  ┌──────────────┐   select_active_intent    ┌───────────────┐ │
│  │  NO_INTENT   │──────────────────────────>│ INTENT_ACTIVE │ │
│  │  (default)   │                            │  (INT-XXX)    │ │
│  └──────┬───────┘                            └───────┬───────┘ │
│         │                                            │         │
│         │ write_to_file,                             │         │
│         │ apply_diff, etc.                           │         │
│         │ ❌ BLOCKED                                 │         │
│         │                                            │         │
│         │                            attempt_completion         │
│         │                            or clear_intent            │
│         │                            ─────────────────┘         │
│         │                                    │                  │
│         │                                    ▼                  │
│         │◄───────────────────────────────────┘                  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### Core Rule

**"Agent CANNOT call write_to_file without first declaring a valid intent_id"**

This applies to all file modification tools:

- `write_to_file`
- `apply_diff`
- `edit_file`
- `edit`
- `apply_patch`

#### Implementation Strategy

**Option 1: PreToolUse Hook (Recommended)**

```typescript
// In src/hooks/gatekeeper.ts

export async function gatekeeperPreHook(context: PreToolUseContext): Promise<HookResult> {
	const fileModificationTools = ["write_to_file", "apply_diff", "edit_file", "edit", "apply_patch"]

	if (!fileModificationTools.includes(context.toolUse.name)) {
		// Not a file modification tool, allow
		return { continue: true }
	}

	// Check if intent is active in task metadata
	const activeIntent = context.task.metadata?.activeIntentId

	if (!activeIntent) {
		return {
			continue: false,
			reason: formatGatekeeperError("NO_INTENT_DECLARED", context.toolUse.name),
		}
	}

	// Check if file path is within intent's owned_scope
	const filePath = context.params.path as string
	const intentScope = context.task.metadata?.activeIntentScope || []

	if (!isPathInScope(filePath, intentScope)) {
		return {
			continue: false,
			reason: formatGatekeeperError("OUT_OF_SCOPE", context.toolUse.name, {
				path: filePath,
				intentId: activeIntent,
				allowedScope: intentScope,
			}),
		}
	}

	// All checks passed
	return { continue: true }
}
```

#### State Tracking

**Store intent state in Task metadata:**

```typescript
// In src/core/task/Task.ts

export interface TaskMetadata {
	// ... existing fields
	activeIntentId?: string
	activeIntentScope?: string[] // Glob patterns
	activeIntentStatus?: string
	activeIntentTimestamp?: number
}

// Set when select_active_intent executes
task.metadata.activeIntentId = "INT-001"
task.metadata.activeIntentScope = ["src/auth/**", "tests/auth/**"]
task.metadata.activeIntentStatus = "IN_PROGRESS"
task.metadata.activeIntentTimestamp = Date.now()

// Clear when attempt_completion succeeds
task.metadata.activeIntentId = undefined
task.metadata.activeIntentScope = undefined
```

#### Error Formats for LLM Self-Correction

**Error 1: No Intent Declared**

```typescript
function formatGatekeeperError(type: "NO_INTENT_DECLARED", toolName: string): string {
	return `❌ PROTOCOL VIOLATION: Cannot execute ${toolName} without declaring an intent.

**Required Action:** Call select_active_intent first to declare which intent you're working on.

**Example:**
1. Call select_active_intent({ intent_id: "INT-001" })
2. Wait for confirmation
3. Then call ${toolName}

**Available Intents:** Check .orchestration/active_intents.yaml for valid intent IDs.

**Why This Matters:** Intent declaration ensures:
- You only modify files within your assigned scope
- You follow relevant constraints and acceptance criteria
- All changes are traceable to a specific intent for audit purposes`
}
```

**Error 2: File Out of Scope**

```typescript
function formatGatekeeperError(
	type: "OUT_OF_SCOPE",
	toolName: string,
	details: {
		path: string
		intentId: string
		allowedScope: string[]
	},
): string {
	return `❌ SCOPE VIOLATION: File '${details.path}' is outside intent ${details.intentId}'s scope.

**Current Intent:** ${details.intentId}
**Allowed Scope:**
${details.allowedScope.map((p) => `  - ${p}`).join("\n")}

**Attempted File:** ${details.path}

**Resolution Options:**
1. If this file should be part of ${details.intentId}, update .orchestration/active_intents.yaml to include the path pattern
2. If this belongs to a different intent, call select_active_intent with the correct intent_id
3. If you need to modify files across multiple intents, create a parent intent that includes both scopes

**Why This Matters:** Scope enforcement prevents accidental modifications to unrelated code and maintains clear boundaries between different work streams.`
}
```

**Error 3: Intent Already Active**

```typescript
function formatGatekeeperError(
	type: "INTENT_ALREADY_ACTIVE",
	currentIntentId: string,
	attemptedIntentId: string,
): string {
	return `❌ STATE ERROR: Intent ${currentIntentId} is already active. Cannot activate ${attemptedIntentId}.

**Current Active Intent:** ${currentIntentId}

**Resolution:**
1. If you're done with ${currentIntentId}, call attempt_completion to close it
2. If you need to switch, explicitly clear the current intent first (implementation TBD)
3. If you meant to continue with ${currentIntentId}, just proceed with your file modifications

**Note:** Only one intent can be active at a time to maintain clear scope boundaries.`
}
```

#### Error Format Strategy

All gatekeeper errors follow this pattern:

1. **Clear violation type** (❌ PROTOCOL VIOLATION, ❌ SCOPE VIOLATION, etc.)
2. **Explanation** of what went wrong
3. **Required action** to resolve
4. **Example** showing correct usage
5. **Rationale** explaining why the rule exists

This format enables LLM self-correction without human intervention.

---

### active_intents.yaml Schema

#### Complete YAML Example

```yaml
# .orchestration/active_intents.yaml
#
# Intent registry for the Intent-Driven Architect protocol.
# Each intent represents a discrete unit of work with defined scope and constraints.

active_intents:
    - id: "INT-001"
      name: "Implement JWT authentication"
      description: "Add JWT-based authentication to replace session cookies"
      status: "IN_PROGRESS"
      owner: "auth-team"
      created_at: "2024-01-15T10:30:00Z"
      updated_at: "2024-01-20T14:22:00Z"

      # Files this intent is allowed to modify (glob patterns)
      owned_scope:
          - "src/auth/**"
          - "src/middleware/auth.ts"
          - "tests/auth/**"
          - "docs/authentication.md"

      # Technical constraints that must be followed
      constraints:
          - "Use bcrypt for password hashing with minimum 10 salt rounds"
          - "JWT tokens must expire after 24 hours"
          - "Store refresh tokens in Redis with 7-day TTL"
          - "All auth endpoints must use rate limiting (10 req/min per IP)"
          - "Never log passwords or tokens, even in error messages"
          - "Follow OWASP authentication best practices"

      # Definition of done
      acceptance_criteria:
          - "All auth endpoints return appropriate HTTP status codes (200, 401, 403, 429)"
          - "Password validation rejects common weak passwords (top 10k list)"
          - "Token refresh mechanism works without requiring re-login"
          - "Rate limiting prevents brute force attacks"
          - "Unit tests achieve 90% coverage on auth module"
          - "Integration tests verify end-to-end auth flow"

      # Optional: Dependencies on other intents
      dependencies:
          - "INT-002" # Redis setup must be complete

      # Optional: Related documentation or design docs
      references:
          - "docs/architecture/auth-design.md"
          - "https://owasp.org/www-project-top-ten/"

      # Optional: Blocked reason if status is BLOCKED
      blocked_reason: null

    - id: "INT-002"
      name: "Set up Redis for session management"
      description: "Configure Redis instance for storing refresh tokens and session data"
      status: "DONE"
      owner: "infrastructure-team"
      created_at: "2024-01-10T09:00:00Z"
      updated_at: "2024-01-12T16:45:00Z"

      owned_scope:
          - "infrastructure/redis/**"
          - "docker-compose.yml"
          - "src/config/redis.ts"
          - "tests/integration/redis/**"

      constraints:
          - "Use Redis 7.x or higher"
          - "Enable persistence (AOF mode)"
          - "Set maxmemory-policy to allkeys-lru"
          - "Configure TLS for production connections"

      acceptance_criteria:
          - "Redis container starts successfully in development"
          - "Connection pooling configured with max 50 connections"
          - "Health check endpoint verifies Redis connectivity"
          - "Failover tested with Redis Sentinel (production only)"

      dependencies: []
      references:
          - "docs/infrastructure/redis-setup.md"
      blocked_reason: null

    - id: "INT-003"
      name: "Refactor user model for new auth system"
      description: "Update User model to support JWT tokens and remove session dependencies"
      status: "DRAFT"
      owner: "backend-team"
      created_at: "2024-01-18T11:20:00Z"
      updated_at: "2024-01-18T11:20:00Z"

      owned_scope:
          - "src/models/User.ts"
          - "src/models/RefreshToken.ts"
          - "migrations/**"
          - "tests/models/**"

      constraints:
          - "Preserve backward compatibility during migration"
          - "Use database migrations (no manual SQL)"
          - "Add indexes for email and refreshToken lookups"
          - "Soft-delete users instead of hard delete"

      acceptance_criteria:
          - "Migration can run on production without downtime"
          - "Rollback migration tested successfully"
          - "All existing user records migrate without data loss"
          - "New fields have appropriate validation rules"

      dependencies:
          - "INT-001"
          - "INT-002"
      references:
          - "docs/database/migration-guide.md"
      blocked_reason: null

    - id: "INT-004"
      name: "Add rate limiting middleware"
      description: "Implement rate limiting to prevent API abuse"
      status: "BLOCKED"
      owner: "security-team"
      created_at: "2024-01-19T14:00:00Z"
      updated_at: "2024-01-21T09:30:00Z"

      owned_scope:
          - "src/middleware/rateLimit.ts"
          - "tests/middleware/rateLimit.spec.ts"

      constraints:
          - "Use Redis for distributed rate limiting"
          - "Support configurable limits per endpoint"
          - "Return 429 Too Many Requests with Retry-After header"

      acceptance_criteria:
          - "Rate limits enforced across multiple server instances"
          - "Performance impact < 5ms per request"
          - "Rate limit counters reset at proper intervals"

      dependencies:
          - "INT-002"
      references:
          - "docs/security/rate-limiting.md"
      blocked_reason: "Waiting for Redis setup (INT-002) to be deployed to staging environment"

# Metadata about the intent file itself
metadata:
    version: "1.0"
    last_updated: "2024-01-21T09:30:00Z"
    schema_version: "1.0"
```

#### Schema Definition (TypeScript)

```typescript
// src/hooks/intent-schema.ts

export interface ActiveIntentsFile {
	active_intents: Intent[]
	metadata?: IntentFileMetadata
}

export interface Intent {
	/** Unique identifier (format: INT-XXX) */
	id: string

	/** Human-readable name */
	name: string

	/** Detailed description of the intent */
	description?: string

	/** Current status */
	status: IntentStatus

	/** Team or individual responsible */
	owner?: string

	/** ISO 8601 timestamp */
	created_at: string

	/** ISO 8601 timestamp */
	updated_at: string

	/** Glob patterns for files this intent can modify */
	owned_scope: string[]

	/** Technical constraints and rules */
	constraints: string[]

	/** Definition of done */
	acceptance_criteria: string[]

	/** Intent IDs that must be completed first */
	dependencies?: string[]

	/** Links to relevant documentation */
	references?: string[]

	/** Reason if status is BLOCKED */
	blocked_reason?: string | null
}

export type IntentStatus =
	| "DRAFT" // Not started yet
	| "IN_PROGRESS" // Currently being worked on
	| "DONE" // Completed and verified
	| "BLOCKED" // Blocked by dependencies or external factors

export interface IntentFileMetadata {
	version: string
	last_updated: string
	schema_version: string
}
```

#### Validation Rules

**1. Intent ID Format**

- **Pattern:** `^INT-\d{3,}$`
- **Examples:** ✅ INT-001, INT-042, INT-999 | ❌ int-1, INT01, INTENT-001
- **Uniqueness:** All IDs must be unique within the file
- **Sequential:** Recommended to increment sequentially (INT-001, INT-002, ...)

**2. Status Validation**

- **Enum:** Must be one of: `["DRAFT", "IN_PROGRESS", "DONE", "BLOCKED"]`
- **Case-sensitive:** Uppercase only
- **State transitions:**
    - DRAFT → IN_PROGRESS
    - IN_PROGRESS → DONE or BLOCKED
    - BLOCKED → IN_PROGRESS
    - DONE cannot transition (create new intent instead)

**3. owned_scope Validation**

- **Type:** Array of strings (glob patterns)
- **Minimum:** At least 1 pattern required
- **Pattern validity:** Must be valid glob syntax
    - ✅ `src/auth/**`, `*.ts`, `tests/**/auth.spec.ts`
    - ❌ `src/auth/[invalid`, `/absolute/paths` (should be relative)
- **No overlaps:** Warn if scopes overlap between IN_PROGRESS intents
- **Workspace-relative:** All paths relative to workspace root

**4. constraints Validation**

- **Type:** Array of strings
- **Minimum:** At least 1 constraint recommended (not enforced)
- **Format:** Free-form text, should be actionable
- **Best practice:** Start with imperative verbs (Use, Implement, Follow, Never)

**5. acceptance_criteria Validation**

- **Type:** Array of strings
- **Minimum:** At least 1 criterion recommended (not enforced)
- **Format:** Free-form text, should be testable/verifiable
- **Best practice:** Should be measurable (avoid vague criteria like "works well")

**6. Timestamps Validation**

- **Format:** ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)
- **Timezone:** UTC recommended
- **Ordering:** `updated_at >= created_at`

**7. Dependencies Validation**

- **Type:** Array of strings (intent IDs)
- **Reference validity:** Each ID must exist in the same file
- **Circular detection:** No circular dependencies allowed
- **Status check:** Warn if IN_PROGRESS intent depends on DRAFT/BLOCKED intents

**8. File-level Validation**

- **YAML syntax:** Must be valid YAML
- **Root structure:** Must have `active_intents` array
- **Encoding:** UTF-8
- **File size:** Recommend max 1000 intents per file (soft limit)

#### Validation Implementation

```typescript
// src/hooks/intent-validator.ts

import * as yaml from "yaml"
import { minimatch } from "minimatch"

export interface ValidationResult {
	valid: boolean
	errors: ValidationError[]
	warnings: ValidationWarning[]
}

export interface ValidationError {
	type: string
	message: string
	intent_id?: string
	field?: string
}

export interface ValidationWarning {
	type: string
	message: string
	intent_id?: string
}

export async function validateActiveIntentsFile(filePath: string): Promise<ValidationResult> {
	const errors: ValidationError[] = []
	const warnings: ValidationWarning[] = []

	try {
		// Read and parse YAML
		const content = await fs.readFile(filePath, "utf-8")
		const parsed = yaml.parse(content) as ActiveIntentsFile

		// Validate root structure
		if (!parsed.active_intents || !Array.isArray(parsed.active_intents)) {
			errors.push({
				type: "MISSING_ACTIVE_INTENTS",
				message: "File must have 'active_intents' array at root",
			})
			return { valid: false, errors, warnings }
		}

		const intentIds = new Set<string>()
		const inProgressScopes: Map<string, string[]> = new Map()

		for (const intent of parsed.active_intents) {
			// Validate ID format
			if (!intent.id || !/^INT-\d{3,}$/.test(intent.id)) {
				errors.push({
					type: "INVALID_ID_FORMAT",
					message: `Invalid intent ID: ${intent.id}. Must match pattern INT-XXX`,
					intent_id: intent.id,
				})
			}

			// Check uniqueness
			if (intentIds.has(intent.id)) {
				errors.push({
					type: "DUPLICATE_ID",
					message: `Duplicate intent ID: ${intent.id}`,
					intent_id: intent.id,
				})
			}
			intentIds.add(intent.id)

			// Validate status
			const validStatuses: IntentStatus[] = ["DRAFT", "IN_PROGRESS", "DONE", "BLOCKED"]
			if (!validStatuses.includes(intent.status)) {
				errors.push({
					type: "INVALID_STATUS",
					message: `Invalid status: ${intent.status}. Must be one of: ${validStatuses.join(", ")}`,
					intent_id: intent.id,
					field: "status",
				})
			}

			// Validate owned_scope
			if (!intent.owned_scope || intent.owned_scope.length === 0) {
				errors.push({
					type: "EMPTY_SCOPE",
					message: "Intent must have at least one owned_scope pattern",
					intent_id: intent.id,
					field: "owned_scope",
				})
			}

			// Validate glob patterns
			for (const pattern of intent.owned_scope || []) {
				try {
					minimatch("test", pattern) // Test if pattern is valid
				} catch (e) {
					errors.push({
						type: "INVALID_GLOB",
						message: `Invalid glob pattern: ${pattern}`,
						intent_id: intent.id,
						field: "owned_scope",
					})
				}

				// Warn about absolute paths
				if (pattern.startsWith("/")) {
					warnings.push({
						type: "ABSOLUTE_PATH",
						message: `Scope pattern uses absolute path: ${pattern}. Should be workspace-relative.`,
						intent_id: intent.id,
					})
				}
			}

			// Track IN_PROGRESS scopes for overlap detection
			if (intent.status === "IN_PROGRESS") {
				inProgressScopes.set(intent.id, intent.owned_scope || [])
			}

			// Validate timestamps
			try {
				const created = new Date(intent.created_at)
				const updated = new Date(intent.updated_at)
				if (updated < created) {
					warnings.push({
						type: "INVALID_TIMESTAMP",
						message: "updated_at is before created_at",
						intent_id: intent.id,
					})
				}
			} catch (e) {
				errors.push({
					type: "INVALID_TIMESTAMP_FORMAT",
					message: "Timestamps must be valid ISO 8601 format",
					intent_id: intent.id,
				})
			}

			// Validate dependencies
			for (const depId of intent.dependencies || []) {
				if (!intentIds.has(depId)) {
					errors.push({
						type: "INVALID_DEPENDENCY",
						message: `Dependency ${depId} not found in active_intents`,
						intent_id: intent.id,
						field: "dependencies",
					})
				}
			}

			// Warn if missing constraints or acceptance_criteria
			if (!intent.constraints || intent.constraints.length === 0) {
				warnings.push({
					type: "MISSING_CONSTRAINTS",
					message: "Intent has no constraints defined",
					intent_id: intent.id,
				})
			}

			if (!intent.acceptance_criteria || intent.acceptance_criteria.length === 0) {
				warnings.push({
					type: "MISSING_ACCEPTANCE_CRITERIA",
					message: "Intent has no acceptance criteria defined",
					intent_id: intent.id,
				})
			}
		}

		// Check for circular dependencies
		const circularDeps = detectCircularDependencies(parsed.active_intents)
		for (const cycle of circularDeps) {
			errors.push({
				type: "CIRCULAR_DEPENDENCY",
				message: `Circular dependency detected: ${cycle.join(" → ")}`,
			})
		}

		// Check for scope overlaps in IN_PROGRESS intents
		const overlaps = detectScopeOverlaps(inProgressScopes)
		for (const overlap of overlaps) {
			warnings.push({
				type: "SCOPE_OVERLAP",
				message: `Intents ${overlap.intent1} and ${overlap.intent2} have overlapping scopes: ${overlap.pattern}`,
			})
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		}
	} catch (e) {
		errors.push({
			type: "YAML_PARSE_ERROR",
			message: `Failed to parse YAML: ${e.message}`,
		})
		return { valid: false, errors, warnings }
	}
}

function detectCircularDependencies(intents: Intent[]): string[][] {
	// TODO: Implement cycle detection using DFS
	return []
}

function detectScopeOverlaps(
	scopes: Map<string, string[]>,
): Array<{ intent1: string; intent2: string; pattern: string }> {
	// TODO: Implement scope overlap detection
	return []
}
```

---

### Open Questions

#### 1. Multi-Intent Workflows

**Question:** How should agents handle changes that span multiple intents?

**Options:**

- **A) Sequential activation:** Agent must close current intent before starting next
- **B) Parent intent:** Create a parent intent that includes both scopes
- **C) Intent composition:** Allow multiple intents to be active simultaneously

**Recommendation:** Start with **Option A** (sequential) for Phase 1 simplicity. Add composition in Phase 2 if needed.

**Tradeoffs:**

- Sequential is simple but may feel restrictive
- Parent intents add overhead (need to create meta-intents)
- Composition adds complexity to scope validation

---

#### 2. Intent Lifecycle Management

**Question:** Who/what transitions intent status? Agent or human?

**Options:**

- **A) Agent-driven:** Agent calls `attempt_completion` which transitions intent to DONE
- **B) Human-driven:** Status changes only via manual YAML edits
- **C) Hybrid:** Agent proposes transition, human approves

**Recommendation:** **Option A** for automation, with audit trail.

**Implementation:**

```typescript
// New tool: complete_intent
{
  "name": "complete_intent",
  "description": "Mark the current active intent as DONE after verifying all acceptance criteria",
  "parameters": {
    "intent_id": "string",
    "verification_notes": "string" // Evidence that criteria are met
  }
}
```

**Tradeoffs:**

- Agent-driven is faster but requires trust in agent validation
- Human-driven is safer but slower
- Hybrid provides best balance but adds UI complexity

---

#### 3. Scope Violation Recovery

**Question:** What happens when agent tries to modify a file outside scope?

**Current behavior:** Hard block with error message

**Alternative options:**

- **A) Auto-expand scope:** Add pattern to intent's owned_scope automatically
- **B) Suggest intent switch:** Recommend switching to intent that owns the file
- **C) Request approval:** Ask human to approve one-time scope expansion

**Recommendation:** Stick with **hard block** for Phase 1. Add approval mechanism in Phase 2.

**Rationale:** Hard blocks force intentional scope design, preventing scope creep.

---

#### 4. Intent Discovery UX

**Question:** How does agent discover available intents?

**Current design:** Agent reads `.orchestration/active_intents.yaml` directly

**Alternatives:**

- **A) list_active_intents tool:** Returns structured list of intents
- **B) Prompt injection:** Include intent list in system prompt
- **C) File read only:** Keep current approach

**Recommendation:** Add **Option A** (`list_active_intents` tool) for better UX.

**Implementation:**

```typescript
// New tool
{
  "name": "list_active_intents",
  "description": "List all available intents with their status and scope",
  "parameters": {
    "status_filter": "string?" // Optional: filter by status
  },
  "returns": {
    "intents": [
      {
        "id": "INT-001",
        "name": "...",
        "status": "IN_PROGRESS",
        "owned_scope": ["..."]
      }
    ]
  }
}
```

---

#### 5. Constraint Enforcement

**Question:** Should constraints be machine-enforceable or guidance-only?

**Current design:** Constraints are free-text, guidance-only

**Future possibility:**

- Structured constraints with validation rules
- Example: `{ "type": "library", "name": "bcrypt", "min_version": "5.0.0" }`
- Pre-hook can validate actual code against constraints

**Recommendation:** Keep as **guidance-only** for Phase 1. Explore structured constraints in Phase 2.

**Rationale:**

- Free-text is flexible and covers edge cases
- Structured constraints require significant engineering
- LLMs can follow text instructions effectively

**Example of future structured constraint:**

```yaml
constraints:
    - type: "library_version"
      library: "bcrypt"
      min_version: "5.0.0"
      validation: "Check package.json dependencies"

    - type: "code_pattern"
      pattern: "No console.log in production code"
      validation: "Scan for console.log outside test files"

    - type: "file_size"
      max_lines: 500
      scope: "src/**/*.ts"
      validation: "Check line count of modified files"
```

---

### Phase 1 Implementation Checklist

**Core Tool:**

- [ ] Create `src/core/prompts/tools/native-tools/select_active_intent.ts`
- [ ] Add tool to `buildNativeToolsArray()` in `src/core/task/build-tools.ts`
- [ ] Implement `SelectActiveIntentTool` class extending `BaseTool`
- [ ] Add `select_active_intent` to `ToolName` union type

**Intent Loader:**

- [ ] Implement `loadIntentContext()` in `src/hooks/intent-loader.ts`
- [ ] Implement `parseActiveIntents()` with YAML parsing
- [ ] Implement `formatIntentAsXml()` with proper escaping
- [ ] Add error handling for file not found, invalid YAML

**Gatekeeper:**

- [ ] Implement `gatekeeperPreHook()` in `src/hooks/gatekeeper.ts`
- [ ] Register gatekeeper hook in extension activation
- [ ] Add `activeIntentId` and `activeIntentScope` to Task metadata
- [ ] Implement scope validation with glob matching

**Validation:**

- [ ] Implement `validateActiveIntentsFile()` in `src/hooks/intent-validator.ts`
- [ ] Add validation on file load
- [ ] Generate helpful error messages for common mistakes

**Testing:**

- [ ] Unit tests for intent loader
- [ ] Unit tests for gatekeeper logic
- [ ] Unit tests for YAML validation
- [ ] Integration test: full workflow from select → modify → complete

**Documentation:**

- [ ] Add `.orchestration/active_intents.yaml` template to repo
- [ ] Document intent protocol in user-facing README
- [ ] Add examples to documentation

---

**Last Updated:** 2026-02-18  
**Status:** Phase 1 Design Complete ✅  
**Next Step:** Begin implementation of select_active_intent tool
