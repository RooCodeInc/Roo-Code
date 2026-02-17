# AI-Native IDE — Architecture Notes

> _Technical mapping of the existing Roo Code extension architecture and identification of governance hook insertion points._

**Version**: 1.0.0 | **Authored**: 2026-02-17

---

## Table of Contents

1. [Current Extension Architecture Overview](#1-current-extension-architecture-overview)
2. [Tool Execution Loop Mapping](#2-tool-execution-loop-mapping)
3. [LLM Request/Response Lifecycle](#3-llm-requestresponse-lifecycle)
4. [System Prompt Construction Pipeline](#4-system-prompt-construction-pipeline)
5. [Identified Interception Points](#5-identified-interception-points)
6. [Proposed Hook Middleware Boundary](#6-proposed-hook-middleware-boundary)
7. [Orchestration Data Integration Points](#7-orchestration-data-integration-points)
8. [State Machine Modification Plan](#8-state-machine-modification-plan)
9. [Concurrency & Safety Injection Points](#9-concurrency--safety-injection-points)

---

## 1. Current Extension Architecture Overview

### 1.1 High-Level Component Map

The extension follows a standard VS Code Webview Extension architecture with three distinct execution domains:

```
┌──────────────────────────────────────────────────────────────────┐
│                       VS Code Extension Host                     │
│                                                                  │
│  ┌──────────────┐  ┌──────────┐  ┌─────────────────────────┐    │
│  │ extension.ts │──│ activate │──│   ClineProvider          │    │
│  │  (entry)     │  │ (cmds)   │  │   (webview host)         │    │
│  └──────────────┘  └──────────┘  └────────┬────────────────┘    │
│                                            │                     │
│                                            ▼                     │
│                                   ┌────────────────┐             │
│                                   │     Task       │             │
│                                   │  (core loop)   │             │
│                                   └───┬────┬───┬───┘             │
│                                       │    │   │                 │
│                          ┌────────────┘    │   └──────────┐      │
│                          ▼                 ▼              ▼      │
│                   ┌────────────┐   ┌────────────┐  ┌──────────┐ │
│                   │ API Layer  │   │ Tool Layer │  │ Prompts  │ │
│                   │ (providers)│   │ (BaseTool) │  │ (system) │ │
│                   └────────────┘   └────────────┘  └──────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ Services: MCP | CodeIndex | Skills | Checkpoints | Glob   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ Integrations: Terminal | Editor | Diagnostics | Workspace │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
        ▲                                              │
        │  postMessage / onDidReceiveMessage           │
        ▼                                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Webview (React UI)                         │
│  webview-ui/src/                                                 │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Chat View     │  │ Settings     │  │ History / Task List   │ │
│  │ (messages)    │  │ (config)     │  │ (task management)     │ │
│  └───────────────┘  └──────────────┘  └───────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Webview (UI Layer) Responsibilities

**Location:** `webview-ui/src/`

The Webview is a React application rendered inside a VS Code Webview Panel. It is a **pure presentation layer** with no direct access to the filesystem, Node.js APIs, or extension state.

**Responsibilities:**

- Renders the chat interface (user messages, assistant responses, tool use visualizations)
- Presents tool approval dialogs (ask/approve/deny workflow)
- Displays settings, task history, and mode selection
- Sends user actions as typed messages to the Extension Host via `vscode.postMessage()`
- Receives state updates from the Extension Host via `onDidReceiveMessage`

**Communication boundary:**

- All communication is serialized JSON over the VS Code message bridge
- The Webview CANNOT invoke tools, access files, or call LLM APIs directly
- State flows unidirectionally: Extension Host → Webview (state push), Webview → Extension Host (user action messages)

### 1.3 Extension Host Responsibilities

**Location:** `src/`

The Extension Host runs in Node.js within the VS Code process. It owns all business logic, state, and external integrations.

**Key components and their roles:**

| Component                 | Location                                             | Responsibility                                                                                            |
| ------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `extension.ts`            | `src/extension.ts`                                   | Entry point. Activates extension, registers commands, creates ClineProvider                               |
| `ClineProvider`           | `src/core/webview/ClineProvider.ts`                  | Webview host. Manages Task lifecycle, routes webview messages, holds `ContextProxy` (settings state)      |
| `Task`                    | `src/core/task/Task.ts`                              | **Core execution engine.** Manages the LLM conversation loop, tool dispatch, message history, checkpoints |
| `ApiHandler`              | `src/api/index.ts`                                   | Abstraction over LLM providers. `buildApiHandler()` factory creates provider-specific handlers            |
| `BaseTool`                | `src/core/tools/BaseTool.ts`                         | Abstract base for all tools. Defines `execute()`, `handlePartial()`, `handle()` lifecycle                 |
| `presentAssistantMessage` | `src/core/assistant-message/`                        | Processes streamed assistant content blocks, dispatches tool invocations, handles approval flow           |
| `NativeToolCallParser`    | `src/core/assistant-message/NativeToolCallParser.ts` | Parses native tool call responses from LLM streaming                                                      |
| `system.ts`               | `src/core/prompts/system.ts`                         | Constructs the system prompt from modular sections                                                        |
| `build-tools.ts`          | `src/core/task/build-tools.ts`                       | Builds the tools array for LLM requests, filtered by mode and experiments                                 |
| `validateToolUse`         | `src/core/tools/validateToolUse.ts`                  | Validates tool names and mode-based permissions at execution time                                         |
| `AutoApprovalHandler`     | `src/core/auto-approval/`                            | Manages automatic approval rules for tool operations                                                      |

### 1.4 Package Architecture

The project uses a monorepo structure with isolated packages:

| Package                 | Location                | Role                                   |
| ----------------------- | ----------------------- | -------------------------------------- |
| `@roo-code/types`       | `packages/types/`       | Shared TypeScript type definitions     |
| `@roo-code/core`        | `packages/core/`        | Core utilities, custom tool registry   |
| `@roo-code/ipc`         | `packages/ipc/`         | Inter-process communication primitives |
| `@roo-code/telemetry`   | `packages/telemetry/`   | Usage telemetry                        |
| `@roo-code/cloud`       | `packages/cloud/`       | Cloud service integration              |
| `@roo-code/vscode-shim` | `packages/vscode-shim/` | VS Code API shim for testing           |

---

## 2. Tool Execution Loop Mapping

### 2.1 Complete Tool Call Lifecycle

The following describes the exact lifecycle of a tool invocation from LLM response to UI feedback:

```
Phase 1: LLM Response Streaming
─────────────────────────────────────────────────────────
 Task.recursivelyMakeClineRequests()
   │
   ├── Calls ApiHandler.createMessage(systemPrompt, messages, metadata)
   │   └── Returns ApiStream (async generator of chunks)
   │
   ├── Iterates stream chunks, accumulates:
   │   ├── Text content blocks
   │   ├── Tool use blocks (via NativeToolCallParser)
   │   └── Usage/reasoning metadata
   │
   └── On stream completion → moves to Phase 2

Phase 2: Assistant Message Presentation
─────────────────────────────────────────────────────────
 presentAssistantMessage(task)
   │
   ├── Iterates accumulated content blocks sequentially
   │
   ├── For TEXT blocks:
   │   └── task.say("text", content) → pushes to Webview
   │
   ├── For TOOL_USE blocks:
   │   ├── Extracts tool name and parameters
   │   ├── Validates tool name: isValidToolName(toolName)
   │   ├── Validates mode permission: validateToolUse(toolName, mode, ...)
   │   │   └── Throws if tool not allowed for current mode
   │   │
   │   ├── Dispatches to specific tool handler:
   │   │   ├── writeToFileTool.handle(task, block, callbacks)
   │   │   ├── executeCommandTool.handle(task, block, callbacks)
   │   │   ├── readFileTool.handle(task, block, callbacks)
   │   │   ├── ... (20+ tool handlers)
   │   │   └── Each extends BaseTool<ToolName>
   │   │
   │   └── Callbacks provided to tool:
   │       ├── askApproval() → prompts user via Webview
   │       ├── handleError() → formats error, pushes tool_result
   │       └── pushToolResult() → adds tool_result to userContent
   │
   └── Returns accumulated userMessageContent (tool_results)

Phase 3: Tool Execution (inside tool.handle())
─────────────────────────────────────────────────────────
 BaseTool.handle(task, block, callbacks)
   │
   ├── If block.partial → handlePartial(task, block) → return
   │
   ├── Extract params from block.nativeArgs
   │   └── Throws if nativeArgs missing (legacy XML rejected)
   │
   └── execute(params, task, callbacks)
       │
       ├── Tool-specific logic (e.g., WriteToFileTool):
       │   ├── Resolves file path
       │   ├── callbacks.askApproval() → waits for user response
       │   ├── Performs file operation (fs.writeFile, etc.)
       │   ├── Creates diff for UI display
       │   └── callbacks.pushToolResult(result)
       │
       └── On error → callbacks.handleError(action, error)

Phase 4: Loop Continuation
─────────────────────────────────────────────────────────
 Back in recursivelyMakeClineRequests():
   │
   ├── Collects all tool_results from Phase 2
   ├── Appends assistant message to conversation history
   ├── Appends user message (tool_results) to conversation history
   ├── Saves conversation history to disk
   │
   └── Recurses: recursivelyMakeClineRequests(userContent)
       └── Next LLM call includes tool_results
```

### 2.2 Write Operations: `write_to_file` Flow

**Location:** `src/core/tools/WriteToFileTool.ts`

```
WriteToFileTool.execute(params, task, callbacks)
  │
  ├── Extract: path, content from params
  ├── Resolve absolute path against task.cwd
  ├── Check file existence (new file vs. edit)
  │
  ├── If existing file:
  │   ├── Read current content
  │   ├── Compute unified diff (current → new)
  │   └── Display diff in approval dialog
  │
  ├── callbacks.askApproval("tool", diffDisplay)
  │   └── User sees diff, approves or rejects
  │
  ├── If approved:
  │   ├── fs.writeFile(absolutePath, content)  ← MUTATION POINT
  │   ├── Track file in filesContentBeforeEditing
  │   └── callbacks.pushToolResult(successMessage)
  │
  └── If rejected:
      └── callbacks.pushToolResult(rejectionMessage)
```

### 2.3 Command Execution: `execute_command` Flow

**Location:** `src/core/tools/ExecuteCommandTool.ts`

```
ExecuteCommandTool.execute(params, task, callbacks)
  │
  ├── Extract: command, cwd from params
  ├── Resolve working directory
  │
  ├── callbacks.askApproval("command", commandDisplay)
  │   └── User sees command, approves or rejects
  │
  ├── If approved:
  │   ├── executeCommandInTerminal(task, options)  ← MUTATION POINT
  │   │   ├── Creates VS Code terminal
  │   │   ├── Sends command via shell integration
  │   │   ├── Captures output via OutputInterceptor
  │   │   └── Returns [completed, output]
  │   │
  │   └── callbacks.pushToolResult(output)
  │
  └── If rejected:
      └── callbacks.pushToolResult(rejectionMessage)
```

### 2.4 Response Propagation to UI

Tool results propagate back to the Webview through a defined chain:

```
Tool.execute()
  └── callbacks.pushToolResult(content)
        └── Adds Anthropic.ToolResultBlockParam to userMessageContent[]
              └── presentAssistantMessage() returns userMessageContent
                    └── recursivelyMakeClineRequests() processes results
                          ├── task.addToClineMessages() → saved to disk
                          ├── Webview receives state update via postMessage
                          └── Recurses with tool_results as next user message
```

---

## 3. LLM Request/Response Lifecycle

### 3.1 Complete Request Flow

```
Task.recursivelyMakeClineRequests(userContent)
  │
  ├── 1. BUILD SYSTEM PROMPT
  │   └── SYSTEM_PROMPT(context, cwd, supportsComputerUse, ...)
  │       ├── generatePrompt() assembles sections:
  │       │   ├── roleDefinition (from mode config)
  │       │   ├── markdownFormattingSection()
  │       │   ├── getSharedToolUseSection()
  │       │   ├── getToolUseGuidelinesSection()
  │       │   ├── getCapabilitiesSection(cwd, mcpHub)
  │       │   ├── getModesSection(context)
  │       │   ├── getSkillsSection(skillsManager, mode)
  │       │   ├── getRulesSection(cwd, settings)
  │       │   ├── getSystemInfoSection(cwd)
  │       │   ├── getObjectiveSection()
  │       │   └── addCustomInstructions(base, global, cwd, mode)
  │       │       └── Reads .roo/rules, .clinerules, custom instructions
  │       │
  │       └── Returns assembled system prompt string
  │
  ├── 2. BUILD TOOLS ARRAY
  │   └── buildNativeToolsArrayWithRestrictions(options)
  │       ├── getNativeTools({ supportsImages })
  │       ├── filterNativeToolsForMode(tools, mode, ...)
  │       ├── getMcpServerTools(mcpHub)
  │       ├── filterMcpToolsForMode(mcpTools, mode, ...)
  │       ├── customToolRegistry (if experiment enabled)
  │       └── Returns { tools[], allowedFunctionNames[] }
  │
  ├── 3. CONSTRUCT MESSAGES
  │   ├── Conversation history (apiConversationHistory[])
  │   ├── Appends current userContent (text/tool_results)
  │   └── Optional: environment details, context condensing
  │
  ├── 4. CALL API
  │   └── this.api.createMessage(systemPrompt, messages, metadata)
  │       ├── metadata = { taskId, mode, tools, tool_choice, ... }
  │       ├── Provider-specific handler (Anthropic, OpenAI, Gemini, ...)
  │       └── Returns ApiStream (async generator)
  │
  ├── 5. PROCESS STREAM
  │   ├── For each chunk in stream:
  │   │   ├── "text" → accumulate text content
  │   │   ├── "tool_use" → NativeToolCallParser processes
  │   │   ├── "usage" → track token consumption
  │   │   └── "reasoning" → capture reasoning blocks
  │   │
  │   └── Yields partial updates to presentAssistantMessage()
  │
  ├── 6. POST-STREAM PROCESSING
  │   ├── presentAssistantMessage(this) → dispatches tools
  │   ├── Collects tool_results
  │   ├── Saves conversation history
  │   └── Creates checkpoint (if enabled)
  │
  └── 7. RECURSE OR TERMINATE
      ├── If tool_results exist → recurse with results
      ├── If attempt_completion → task completes
      └── If error/abort → task aborts
```

### 3.2 Provider Abstraction

```
ApiHandler interface
  │
  ├── createMessage(systemPrompt, messages, metadata) → ApiStream
  ├── getModel() → { id, info: ModelInfo }
  └── countTokens(content) → number

buildApiHandler(configuration: ProviderSettings) → ApiHandler
  └── Switch on apiProvider:
      ├── "anthropic"  → AnthropicHandler
      ├── "openai"     → OpenAiHandler
      ├── "gemini"     → GeminiHandler
      ├── "bedrock"    → AwsBedrockHandler
      ├── "vertex"     → VertexHandler
      ├── "ollama"     → NativeOllamaHandler
      ├── "openrouter" → OpenRouterHandler
      ├── ... (20+ providers)
      └── default      → AnthropicHandler
```

---

## 4. System Prompt Construction Pipeline

### 4.1 Prompt Assembly Chain

**Location:** `src/core/prompts/system.ts`

The system prompt is assembled from modular sections. Each section is a function that returns a string fragment:

```
SYSTEM_PROMPT()
  └── generatePrompt()
        │
        ├── roleDefinition           ← Mode-specific role text
        ├── markdownFormattingSection ← Output formatting rules
        ├── getSharedToolUseSection   ← Common tool use instructions
        ├── getToolUseGuidelinesSection ← Tool usage rules
        ├── getCapabilitiesSection    ← Environment capabilities
        ├── getModesSection           ← Available modes description
        ├── getSkillsSection          ← Loaded skills catalog
        ├── getRulesSection           ← Rules from .roo/ and settings
        ├── getSystemInfoSection      ← OS, shell, cwd information
        ├── getObjectiveSection       ← High-level objective framing
        └── addCustomInstructions     ← User/project custom rules
              ├── Reads .roo/rules-{mode}/
              ├── Reads .clinerules
              ├── Reads CLAUDE.md (if exists)
              └── Appends global custom instructions
```

### 4.2 Prompt Section Sources

**Location:** `src/core/prompts/sections/`

| Section File             | Content                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `capabilities.ts`        | Lists environment capabilities (file ops, terminal, MCP)    |
| `custom-instructions.ts` | Loads project-level and global custom instructions          |
| `markdown-formatting.ts` | Output format constraints                                   |
| `modes.ts`               | Available mode descriptions                                 |
| `objective.ts`           | High-level task framing                                     |
| `rules.ts`               | Project rules from `.roo/`, `.clinerules`, protection rules |
| `skills.ts`              | Loaded skills descriptions                                  |
| `system-info.ts`         | OS, shell, working directory, timestamps                    |
| `tool-use.ts`            | Shared tool use section                                     |
| `tool-use-guidelines.ts` | Tool usage guidelines                                       |

### 4.3 Custom Instructions Loading (Critical Integration Point)

**Location:** `src/core/prompts/sections/custom-instructions.ts`

The `addCustomInstructions()` function reads from multiple sources in order:

1. Mode-specific instructions (from `promptComponent`)
2. Global custom instructions (from user settings)
3. Project-level rules:
    - `.roo/rules-{mode}/` files (mode-specific)
    - `.roo/rules/` files (global)
    - `.clinerules` (legacy)
    - `CLAUDE.md` (if present)
4. Language preference
5. RooIgnore instructions
6. Protection settings

**This is the primary injection point for governance prompt modifications.**

---

## 5. Identified Interception Points

### 5.1 Pre-Hook Interception Points

These are locations where governance logic can intercept BEFORE an action occurs:

| ID        | Location                                                         | Intercepts                | Current Flow                                          |
| --------- | ---------------------------------------------------------------- | ------------------------- | ----------------------------------------------------- |
| **PRE-1** | `Task.recursivelyMakeClineRequests()` — before `createMessage()` | LLM requests              | System prompt + messages assembled, about to call API |
| **PRE-2** | `presentAssistantMessage()` — before tool dispatch               | All tool invocations      | Tool name validated, about to call `tool.handle()`    |
| **PRE-3** | `BaseTool.handle()` — before `execute()`                         | Individual tool execution | Params parsed, about to execute                       |
| **PRE-4** | `WriteToFileTool.execute()` — before `fs.writeFile()`            | File write mutations      | Path resolved, diff computed, approval received       |
| **PRE-5** | `ExecuteCommandTool.execute()` — before terminal execution       | Command execution         | Command string known, approval received               |
| **PRE-6** | `SYSTEM_PROMPT()` — during prompt assembly                       | System prompt content     | All sections available, prompt being concatenated     |
| **PRE-7** | `buildNativeToolsArray()` — during tools construction            | Available tools list      | Tools being filtered by mode                          |
| **PRE-8** | `Task.startTask()` — before first LLM call                       | Task initialization       | User message known, about to enter loop               |

### 5.2 Post-Hook Interception Points

These are locations where governance logic can observe AFTER an action completes:

| ID         | Location                                                        | Observes                | Current Flow                         |
| ---------- | --------------------------------------------------------------- | ----------------------- | ------------------------------------ |
| **POST-1** | `Task.recursivelyMakeClineRequests()` — after stream completion | LLM response content    | Full assistant message available     |
| **POST-2** | `presentAssistantMessage()` — after all tools dispatched        | Completed tool results  | All tool_results accumulated         |
| **POST-3** | `BaseTool.handle()` — after `execute()` returns                 | Individual tool outcome | Tool completed or errored            |
| **POST-4** | `WriteToFileTool.execute()` — after `fs.writeFile()`            | File mutation evidence  | File written, path and content known |
| **POST-5** | `ExecuteCommandTool.execute()` — after terminal output          | Command output          | Execution completed, output captured |
| **POST-6** | `Task.addToApiConversationHistory()` — after message saved      | Conversation state      | New message persisted to history     |
| **POST-7** | `Task.saveClineMessages()` — after UI messages saved            | UI message state        | Cline messages persisted             |
| **POST-8** | `Task.abortTask()` / completion                                 | Task lifecycle end      | Task finishing, all state available  |

### 5.3 State Injection Points (Before LLM Calls)

These are locations where orchestration state can be injected into the LLM context:

| ID        | Location                              | Injection Target       | Mechanism                                              |
| --------- | ------------------------------------- | ---------------------- | ------------------------------------------------------ |
| **INJ-1** | `addCustomInstructions()`             | System prompt          | Append governance rules as custom instructions         |
| **INJ-2** | `generatePrompt()`                    | System prompt sections | Add new governance section alongside existing sections |
| **INJ-3** | `Task.recursivelyMakeClineRequests()` | User message content   | Prepend governance context to `userContent[]`          |
| **INJ-4** | `buildNativeToolsArray()`             | Tools definition       | Add/modify/restrict tools based on active intent       |
| **INJ-5** | `Task.startTask()`                    | Initial message        | Inject intent selection requirement into first message |

---

## 6. Proposed Hook Middleware Boundary

### 6.1 Clean Interceptor Pattern

The Hook Engine SHALL be implemented as a middleware layer that wraps existing execution flows without modifying core logic. The pattern follows a pipeline architecture:

```
                    ┌─────────────────────────────────┐
                    │         Hook Engine              │
                    │         src/hooks/               │
                    │                                  │
 Existing Flow ───▶ │  ┌─────────┐    ┌─────────────┐ │ ───▶ Existing Flow
                    │  │Pre-Hooks│ ──▶│ Post-Hooks  │ │      (continues)
                    │  │ Chain   │    │ Chain       │ │
                    │  └─────────┘    └─────────────┘ │
                    │       │              │           │
                    │       ▼              ▼           │
                    │  ┌──────────────────────────┐    │
                    │  │  Orchestration State      │    │
                    │  │  (read/write)             │    │
                    │  └──────────────────────────┘    │
                    └─────────────────────────────────┘
```

**Hook Engine responsibilities:**

- Receive interception calls from instrumented points in core code
- Execute registered pre-hooks in priority order
- Allow/deny the operation based on hook results
- Execute registered post-hooks for logging and state updates
- Provide typed interfaces for hook implementations

**Hook interface contract (conceptual):**

```
HookContext {
  operation:     OperationType        // "tool_execute", "llm_request", "file_write", ...
  agentId:       string               // Active agent identity
  intentId:      string | undefined   // Active intent (if declared)
  targetPath:    string | undefined   // File path being operated on
  toolName:      string | undefined   // Tool being invoked
  timestamp:     number               // Operation timestamp
  metadata:      Record<string, any>  // Operation-specific data
}

PreHookResult {
  allow:         boolean              // Whether to proceed
  reason:        string | undefined   // Denial reason (for logging)
  modifiedContext: Partial<HookContext> // Optional context modifications
}

PostHookInput {
  context:       HookContext           // Original operation context
  result:        OperationResult       // Outcome of the operation
  duration:      number                // Execution duration
}
```

### 6.2 Isolation Strategy: `src/hooks/`

**Location:** `src/hooks/` (currently empty — reserved for governance)

The hooks directory SHALL contain all governance logic, fully isolated from core extension code. The isolation boundary is strict:

```
src/hooks/
  ├── engine/
  │   ├── HookEngine.ts              # Central hook dispatcher
  │   ├── HookRegistry.ts            # Hook registration and ordering
  │   └── types.ts                   # Hook interfaces and types
  │
  ├── pre/
  │   ├── IntentValidationHook.ts    # Validates active intent exists
  │   ├── ScopeEnforcementHook.ts    # Validates operation within scope
  │   ├── PrivilegeCheckHook.ts      # Validates agent permissions
  │   └── LockAcquisitionHook.ts     # Acquires file-level locks
  │
  ├── post/
  │   ├── AuditLogHook.ts            # Writes to agent_trace.jsonl
  │   ├── ContentHashHook.ts         # Computes and records content hashes
  │   ├── IntentProgressHook.ts      # Updates intent completion state
  │   └── ScopeDriftDetectionHook.ts # Detects out-of-scope mutations
  │
  ├── state/
  │   ├── OrchestrationState.ts      # Reads/writes orchestration YAML
  │   ├── IntentRegistry.ts          # Active intent management
  │   └── AgentIdentity.ts           # Current agent identity resolution
  │
  └── index.ts                       # Public API for hook integration
```

### 6.3 How Core Logic Remains Untouched

The integration strategy follows the **Decorator Pattern** — core functions are wrapped with hook calls at their boundaries, not modified internally:

**Principle:** No governance logic SHALL exist inside `src/core/`, `src/api/`, or `src/services/`. All governance logic lives in `src/hooks/`. Core code receives minimal instrumentation: a single call to the Hook Engine at each identified interception point.

**Instrumentation pattern (conceptual flow, not code):**

```
BEFORE (current):
  WriteToFileTool.execute() → fs.writeFile(path, content)

AFTER (instrumented):
  WriteToFileTool.execute()
    → hookEngine.pre("file_write", { path, content, intentId })
      → If denied: return rejection result
    → fs.writeFile(path, content)                    [UNCHANGED]
    → hookEngine.post("file_write", { path, hash, result })
```

**Changes to core files are limited to:**

1. Importing the Hook Engine
2. Adding `hookEngine.pre()` calls before operations
3. Adding `hookEngine.post()` calls after operations
4. Core logic flow, error handling, and data structures remain unchanged

---

## 7. Orchestration Data Integration Points

### 7.1 When `active_intents.yaml` Is Read

The orchestration state file (`.orchestration/active_intents.yaml`) SHALL be read at the following points:

| Trigger                    | Location                                        | Purpose                                                                                 |
| -------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Task start**             | `Task.startTask()`                              | Load active intents. Determine if agent must select intent before proceeding            |
| **Before each LLM call**   | `Task.recursivelyMakeClineRequests()` via PRE-1 | Verify active intent is still valid. Load scope constraints for system prompt injection |
| **Before tool execution**  | `presentAssistantMessage()` via PRE-2           | Resolve scope boundaries for the active intent. Validate tool target is within scope    |
| **On intent state change** | Hook Engine state management                    | When an intent transitions lifecycle state (active → completed, etc.)                   |

**Read strategy:** The file SHALL be read lazily and cached within the Hook Engine's `OrchestrationState` manager. Cache invalidation occurs on file change (via VS Code `FileSystemWatcher`) or on explicit state transition.

### 7.2 When `agent_trace.jsonl` Is Written

The audit trail (`.orchestration/agent_trace.jsonl`) SHALL be written by POST hooks at these points:

| Event                    | Trigger Location                  | Trace Record Contents                                        |
| ------------------------ | --------------------------------- | ------------------------------------------------------------ |
| **Intent declared**      | Hook Engine (intent registration) | Intent ID, scope, agent ID, timestamp                        |
| **Intent activated**     | Hook Engine (intent validation)   | Intent ID, validation result, timestamp                      |
| **Tool invoked**         | POST-3 (after BaseTool.handle)    | Tool name, params, intent ID, agent ID, result, duration     |
| **File mutated**         | POST-4 (after WriteToFileTool)    | Path, content hash (before), content hash (after), intent ID |
| **Command executed**     | POST-5 (after ExecuteCommandTool) | Command, exit code, output hash, intent ID                   |
| **LLM request sent**     | POST-1 (after stream completion)  | Provider, model, token usage, intent ID, response hash       |
| **Intent completed**     | Hook Engine (intent lifecycle)    | Intent ID, completion status, final scope summary            |
| **Governance violation** | Any pre-hook denial               | Violation type, denied operation, agent ID, intent ID        |

**Write strategy:** Append-only. Each line is a self-contained JSON object. The file SHALL NOT be truncated or edited during normal operation.

### 7.3 When `CLAUDE.md` Is Appended

The custom instructions file (`CLAUDE.md` or `.roo/rules`) SHALL be programmatically augmented at these points:

| Trigger                                | Modification                                                      | Purpose                                                             |
| -------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Task start (before first LLM call)** | Append active intent constraints to custom instructions via INJ-1 | Ensure LLM is aware of scope boundaries and governance requirements |
| **Intent activation**                  | Update custom instructions with new scope definition              | Refresh LLM awareness when intent scope changes                     |
| **Governance violation detected**      | Append violation feedback to custom instructions                  | Inform LLM of the violation so it can self-correct                  |

**Strategy note:** Rather than modifying `CLAUDE.md` on disk, the governance layer SHALL inject content dynamically through the `addCustomInstructions()` pipeline at INJ-1. This preserves the original file and allows governance instructions to be computed per-request based on current orchestration state.

---

## 8. State Machine Modification Plan

### 8.1 Two-Stage Intent Handshake Integration

The Intent Handshake introduces a mandatory pre-execution phase into the Task lifecycle. It modifies the state machine as follows:

```
CURRENT STATE MACHINE:
═══════════════════════════════════════════════

  User Message → startTask() → recursivelyMakeClineRequests() → [Loop]


PROPOSED STATE MACHINE:
═══════════════════════════════════════════════

  User Message → startTask()
                    │
                    ▼
              ┌──────────────┐
              │ STAGE 1:     │
              │ Intent       │  ← Agent MUST call select_active_intent
              │ Selection    │    before any other tool
              │              │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │ Intent       │  ← Validates intent exists in active_intents.yaml
              │ Validation   │    Validates scope is well-formed
              │              │    Validates no scope conflicts
              └──────┬───────┘
                     │
                     ▼ (intent validated)
              ┌──────────────┐
              │ STAGE 2:     │
              │ Governed     │  ← Normal tool loop, but every tool call
              │ Execution    │    passes through Hook Engine
              │              │    Scope enforcement active
              └──────────────┘
```

### 8.2 How Prompt Modification Enforces `select_active_intent`

The governance layer enforces the Two-Stage Handshake by modifying the system prompt and tool availability:

**Stage 1 enforcement (before intent is selected):**

1. **System prompt injection (INJ-2):** A governance section is prepended to the system prompt stating:

    - "You MUST call `select_active_intent` before performing any other action"
    - "Any tool call other than `select_active_intent` will be rejected"
    - Lists available intents from `active_intents.yaml`

2. **Tool restriction (INJ-4):** The `buildNativeToolsArray()` output is filtered by the Hook Engine to expose ONLY `select_active_intent` until an intent is active. All other tools are removed from the tools array.

3. **Pre-hook enforcement (PRE-2):** Even if the LLM attempts to call a non-intent-selection tool, the pre-hook at `presentAssistantMessage()` rejects it and returns a tool_error explaining that intent must be selected first.

**Stage 2 transition (after intent is selected):**

1. The `select_active_intent` tool handler validates the intent and transitions the Hook Engine state
2. On next `recursivelyMakeClineRequests()` iteration, the full tool set is restored (filtered by scope)
3. The system prompt governance section updates to reflect the active intent and its scope boundaries
4. All subsequent tool calls pass through scope validation pre-hooks

---

## 9. Concurrency & Safety Injection Points

### 9.1 Where Optimistic Locking Will Be Enforced

Optimistic locking prevents concurrent agents from silently overwriting each other's changes:

| Resource               | Lock Granularity | Enforcement Point                     | Mechanism                                                                                  |
| ---------------------- | ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Files (write)**      | Per-file path    | PRE-4 (before `fs.writeFile`)         | Content hash comparison: read hash at lock acquisition, verify hash unchanged before write |
| **Files (edit)**       | Per-file path    | PRE-3 (before `EditFileTool.execute`) | Same content hash mechanism                                                                |
| **Intent state**       | Per-intent ID    | Hook Engine `OrchestrationState`      | YAML file atomic read-modify-write with version counter                                    |
| **Orchestration YAML** | Whole file       | Hook Engine state manager             | File-level lock with version field in YAML                                                 |
| **Terminal commands**  | Per-terminal ID  | PRE-5 (before terminal execution)     | Terminal ID reservation in orchestration state                                             |

**Optimistic locking flow:**

```
Agent A wants to write file X:
  1. PRE-4 hook reads current hash of file X → hash_A
  2. Agent A proceeds with write
  3. POST-4 hook computes new hash → hash_B, records (file X, hash_A → hash_B)

Agent B wants to write file X concurrently:
  1. PRE-4 hook reads current hash of file X → hash_B (changed by Agent A)
  2. PRE-4 compares expected hash (from B's intent scope) vs actual hash
  3. MISMATCH: file was modified outside B's knowledge
  4. PRE-4 DENIES write → returns conflict error
  5. Conflict logged to agent_trace.jsonl
```

### 9.2 Where Scope Validation Will Occur

Scope validation ensures agents only operate within their declared intent boundaries:

| Validation Point    | Location                                                                       | What Is Checked                                        |
| ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **File write path** | PRE-4 (`WriteToFileTool`)                                                      | Target path ∈ active intent's scope set                |
| **File edit path**  | PRE-3 (`EditFileTool`, `ApplyDiffTool`, `SearchReplaceTool`, `ApplyPatchTool`) | Target path ∈ active intent's scope set                |
| **File read path**  | PRE-3 (`ReadFileTool`)                                                         | Optional: warn if reading outside scope (non-blocking) |
| **Command CWD**     | PRE-5 (`ExecuteCommandTool`)                                                   | Working directory ∈ active intent's scope set          |
| **File list path**  | PRE-3 (`ListFilesTool`)                                                        | Optional: scoped directory listing                     |
| **LLM request**     | PRE-1                                                                          | Intent ID present in metadata. Scope still valid       |
| **MCP tool call**   | PRE-3 (`UseMcpToolTool`)                                                       | MCP operation target ∈ active intent's scope set       |

**Scope validation flow:**

```
Tool invocation arrives at PRE-2/PRE-3:
  │
  ├── Resolve active intent from OrchestrationState
  │     └── If no active intent → DENY (Intent Handshake not completed)
  │
  ├── Extract target path(s) from tool parameters
  │     ├── WriteToFileTool → params.path
  │     ├── ExecuteCommandTool → params.cwd
  │     ├── EditFileTool → params.path
  │     └── ApplyPatchTool → extracted paths from patch content
  │
  ├── Resolve target paths to absolute paths (against task.cwd)
  │
  ├── For each target path:
  │     ├── Check: path ∈ intent.scope.files OR
  │     │          path ∈ intent.scope.directories (prefix match) OR
  │     │          path matches intent.scope.patterns (glob match)
  │     │
  │     ├── If MATCH → continue
  │     └── If NO MATCH → DENY (scope violation)
  │
  └── All paths validated → ALLOW operation
```

### 9.3 Existing Safety Mechanisms (Preserved)

The current codebase already has safety mechanisms that governance hooks will complement, not replace:

| Mechanism             | Location                            | Function                          | Governance Relationship                                                  |
| --------------------- | ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `validateToolUse()`   | `src/core/tools/validateToolUse.ts` | Mode-based tool permission        | Preserved. Governance adds intent-based permission on top                |
| `askApproval()`       | Tool callbacks                      | Human approval for mutations      | Preserved. Governance pre-validates before approval is even requested    |
| `AutoApprovalHandler` | `src/core/auto-approval/`           | Automatic approval rules          | Preserved. Auto-approval only fires if governance pre-hooks allow        |
| `ProtectTool`         | `src/core/protect/`                 | File protection patterns          | Preserved. Governance scope is an additional layer above file protection |
| `RooIgnore`           | `src/core/ignore/`                  | .gitignore-style file exclusion   | Preserved. Governance scope is additive to ignore rules                  |
| Checkpoint system     | `src/core/checkpoints/`             | File state snapshots for rollback | Essential for governance rollback on partial failures                    |

---

## Appendix A: File Reference Map

| Governance Concern   | Primary Source Files                                                 |
| -------------------- | -------------------------------------------------------------------- |
| Core execution loop  | `src/core/task/Task.ts` (L2511–3743: `recursivelyMakeClineRequests`) |
| Tool dispatch        | `src/core/assistant-message/presentAssistantMessage.ts`              |
| Tool base class      | `src/core/tools/BaseTool.ts`                                         |
| File write tool      | `src/core/tools/WriteToFileTool.ts`                                  |
| Command tool         | `src/core/tools/ExecuteCommandTool.ts`                               |
| Tool validation      | `src/core/tools/validateToolUse.ts`                                  |
| System prompt        | `src/core/prompts/system.ts`                                         |
| Prompt sections      | `src/core/prompts/sections/`                                         |
| Custom instructions  | `src/core/prompts/sections/custom-instructions.ts`                   |
| Tools array builder  | `src/core/task/build-tools.ts`                                       |
| Native tool parser   | `src/core/assistant-message/NativeToolCallParser.ts`                 |
| API handler factory  | `src/api/index.ts`                                                   |
| API providers        | `src/api/providers/`                                                 |
| Webview provider     | `src/core/webview/ClineProvider.ts`                                  |
| Message handler      | `src/core/webview/webviewMessageHandler.ts`                          |
| Auto-approval        | `src/core/auto-approval/`                                            |
| Terminal integration | `src/integrations/terminal/`                                         |
| Editor integration   | `src/integrations/editor/`                                           |
| Extension entry      | `src/extension.ts`                                                   |
| Hooks directory      | `src/hooks/` (empty — reserved)                                      |

---

## Appendix B: Modification Impact Summary

| Modification                            | Files Touched                                           | Risk Level | Core Logic Changed?                           |
| --------------------------------------- | ------------------------------------------------------- | ---------- | --------------------------------------------- |
| Hook Engine creation                    | `src/hooks/` (new)                                      | Low        | No — new code only                            |
| Task.ts instrumentation                 | `src/core/task/Task.ts`                                 | Medium     | Minimal — add hook calls at boundaries        |
| presentAssistantMessage instrumentation | `src/core/assistant-message/presentAssistantMessage.ts` | Medium     | Minimal — add hook calls before tool dispatch |
| System prompt governance section        | `src/core/prompts/system.ts` or new section             | Low        | Additive — new section added                  |
| Tool restriction for handshake          | `src/core/task/build-tools.ts`                          | Medium     | Conditional — hook decides tool filtering     |
| select_active_intent tool               | `src/core/tools/` (new)                                 | Low        | No — new tool following existing pattern      |
| Orchestration state manager             | `src/hooks/state/` (new)                                | Low        | No — new code only                            |
| BaseTool instrumentation                | `src/core/tools/BaseTool.ts`                            | Low        | Minimal — add hook call in `handle()`         |

---

_This document maps the existing architecture for analysis and governance planning purposes. It does not contain implementation code. All proposed modifications follow the principle of minimal core intrusion and maximum hook isolation._
