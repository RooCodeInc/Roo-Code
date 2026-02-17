# ARCHITECTURE_NOTES.md — Roo Code Nervous System

> **Goal**: Map how a user message travels from the Webview UI → Extension Host → LLM → back to a tool execution on the filesystem.

---

## 0. Full End-to-End Execution Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              VS Code Extension Host                         │
│                                                                              │
│  ┌────────────┐     ┌───────────────┐     ┌───────────────────────────────┐  │
│  │  Webview    │     │ ClineProvider │     │          Task.ts              │  │
│  │  (React UI) │────►│ (Bridge)      │────►│  recursivelyMakeClineRequests │  │
│  │            │ msg  │               │task │                               │  │
│  └────────────┘     └───────────────┘     │  ┌─ getSystemPrompt()         │  │
│       ▲                                    │  │   └─ SYSTEM_PROMPT()       │  │
│       │                                    │  │       └─ generatePrompt()  │  │
│       │                                    │  │                            │  │
│       │                                    │  ├─ attemptApiRequest()       │  │
│       │                                    │  │   └─ api.createMessage()───┼──┼──► LLM API
│       │                                    │  │                            │  │
│       │                                    │  │   ◄── stream chunks ◄──────┼──┼─── LLM API
│       │                                    │  │                            │  │
│       │                                    │  ├─ NativeToolCallParser      │  │
│       │                                    │  │   └─ ToolUse blocks        │  │
│       │                                    │  │                            │  │
│       │                                    │  ├─ presentAssistantMessage() │  │
│       │                                    │  │   ├─ validateToolUse()     │  │
│       │                                    │  │   ├─ repetition check      │  │
│       │                                    │  │   └─ switch(block.name)    │  │
│       │                                    │  │       └─ BaseTool.handle() │  │
│       │                                    │  │           └─ execute()     │  │
│       │  askApproval / pushToolResult      │  │               │            │  │
│       ◄────────────────────────────────────┼──┘               ▼            │  │
│                                            │             Filesystem /      │  │
│                                            │             Terminal           │  │
│                                            └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Pseudocode of the full pipeline:**

```
1. User types message in Webview (React UI)
2. Webview posts message:  vscodeApi.postMessage({ type: "newTask", text: "..." })
3. Extension Host receives via webview.onDidReceiveMessage
4. webviewMessageHandler() dispatches on message.type
5. case "newTask" → provider.createTask(text) → new Task({...})
6. Task constructor → recursivelyMakeClineRequests()
7.   → getSystemPrompt() → SYSTEM_PROMPT() → generatePrompt() (11 sections)
8.   → attemptApiRequest() → api.createMessage(systemPrompt, history, tools)
9.   → LLM streams response chunks
10.  → NativeToolCallParser.processRawChunk() → ToolUse blocks
11.  → presentAssistantMessage() → validate → switch(block.name) → BaseTool.handle()
12.  → tool.execute() → askApproval() → user approves → perform action → pushToolResult()
13.  → tool_result sent back → loop continues at step 8
```

---

## 1. Extension Entry Point — `activate()`

|              |                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------- |
| **File**     | [`extension.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/extension.ts) |
| **Function** | `activate(context: vscode.ExtensionContext)` — line 120                                   |

This is where everything starts. When VS Code loads the extension, `activate()` runs and bootstraps the entire system.

### What `activate()` does (in order):

| #   | Action                                               | Line    |
| --- | ---------------------------------------------------- | ------- |
| 1   | Create output channel for logging                    | 122     |
| 2   | Set up network proxy (debug mode)                    | 129     |
| 3   | Initialize custom tool registry                      | 132     |
| 4   | Migrate old settings                                 | 135     |
| 5   | Initialize telemetry (PostHog)                       | 138     |
| 6   | Initialize MDM service                               | 150     |
| 7   | Initialize i18n                                      | 153     |
| 8   | Initialize terminal shell handlers                   | 156     |
| 9   | Initialize code index managers                       | 172     |
| 10  | **Create `ClineProvider`**                           | **195** |
| 11  | Initialize Roo Code Cloud service                    | 300     |
| 12  | **Register `ClineProvider` as sidebar webview**      | **332** |
| 13  | **Register all commands**                            | **353** |
| 14  | Register diff content provider                       | 371     |
| 15  | Register URI handler, code actions, terminal actions | 381–391 |
| 16  | Return `API` instance for external consumers         | 455     |

**Key line — provider creation:**

```typescript
// Line 195
const provider = new ClineProvider(context, outputChannel, "sidebar", contextProxy, mdmService)
```

**Key line — webview registration:**

```typescript
// Line 332
vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider, {
	webviewOptions: { retainContextWhenHidden: true },
})
```

**Key line — command registration:**

```typescript
// Line 353
registerCommands({ context, outputChannel, provider })
```

---

## 2. Command Registration

|              |                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| **File**     | [`registerCommands.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/activate/registerCommands.ts) |
| **Function** | `registerCommands(options)` — line 64                                                                            |

`registerCommands()` calls `getCommandsMap()` which returns a map of `CommandId` → handler function. Key commands:

| Command ID              | What it does                                  |
| ----------------------- | --------------------------------------------- |
| `plusButtonClicked`     | Clears current task, opens fresh chat         |
| `settingsButtonClicked` | Opens settings view                           |
| `historyButtonClicked`  | Opens history view                            |
| `openInNewTab`          | Opens Roo in an editor tab (not sidebar)      |
| `focusInput`            | Focuses the chat input                        |
| `acceptInput`           | Submits current input programmatically        |
| `toggleAutoApprove`     | Toggles auto-approval mode                    |
| `activationCompleted`   | Signals to other extensions that Roo is ready |

All commands are registered via `vscode.commands.registerCommand()` and added to `context.subscriptions` for cleanup.

---

## 3. Webview → Extension Host Communication

|                     |                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Bridge class**    | [`ClineProvider.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/webview/ClineProvider.ts)                 |
| **Message handler** | [`webviewMessageHandler.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/webview/webviewMessageHandler.ts) |

### How it works:

1. **`resolveWebviewView()`** (ClineProvider.ts, line 787) is called by VS Code when the sidebar becomes visible. It:

    - Sets webview HTML content
    - Calls `setWebviewMessageListener()` (line 845) to wire up message handling

2. **`setWebviewMessageListener()`** (line 1326) connects the webview's `onDidReceiveMessage` to `webviewMessageHandler()`:

    ```typescript
    private setWebviewMessageListener(webview: vscode.Webview) {
        const onReceiveMessage = async (message: WebviewMessage) =>
            webviewMessageHandler(this, message, this.marketplaceManager)
        const messageDisposable = webview.onDidReceiveMessage(onReceiveMessage)
    }
    ```

3. **`webviewMessageHandler()`** (webviewMessageHandler.ts, line 468) has a large `switch(message.type)` that handles all message types from the React UI:

**Pseudocode of key message flows:**

```
webviewMessageHandler(provider, message):
    switch (message.type):

        case "newTask":                          ← User sends first message
            provider.createTask(text, images)
            → new Task({...})
            → task.recursivelyMakeClineRequests()  ← Enters the main loop

        case "askResponse":                      ← User approves/rejects tool call
            provider.getCurrentTask()
                .handleWebviewAskResponse(response, text, images)
            → unblocks the waiting askApproval() promise
            → tool execution proceeds or aborts

        case "clearTask":                        ← User clicks "New Chat"
            provider.clearTask()

        case "updateSettings":                   ← User changes a setting
            for each key/value:
                contextProxy.setValue(key, value)
            provider.postStateToWebview()
```

### Communication directions:

| Direction          | Method                                         | Example                                          |
| ------------------ | ---------------------------------------------- | ------------------------------------------------ |
| **Webview → Host** | `vscodeApi.postMessage({ type, ... })`         | `{ type: "newTask", text: "Fix the bug" }`       |
| **Host → Webview** | `provider.postMessageToWebview({ type, ... })` | `{ type: "action", action: "didBecomeVisible" }` |

---

## 4. How UI Messages Reach the Task Loop

Here's the complete trace from user typing to task execution:

```
User types "Fix the bug" and presses Enter
    │
    ▼
Webview (React): vscodeApi.postMessage({ type: "newTask", text: "Fix the bug" })
    │
    ▼
ClineProvider.setWebviewMessageListener → webview.onDidReceiveMessage
    │
    ▼
webviewMessageHandler(provider, { type: "newTask", text: "Fix the bug" })
    │
    ▼
case "newTask" → provider.createTask("Fix the bug")
    │
    ▼
ClineProvider.createTask()                          ← ClineProvider.ts:2914
    ├── Validates org allow-list
    ├── Creates: new Task({ provider, apiConfiguration, ... })
    └── Pushes task onto clineStack
            │
            ▼
Task constructor
    └── this.recursivelyMakeClineRequests("Fix the bug")
            │
            ▼
        The main LLM loop begins (see Section 6)
```

---

## 5. The Tool Execution Loop

### 5.1 Parsing — `NativeToolCallParser`

|          |                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **File** | [`NativeToolCallParser.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/assistant-message/NativeToolCallParser.ts) |
| **Role** | Converts raw OpenAI-style `tool_call` stream chunks into typed `ToolUse` objects                                                       |

Key methods:

- `processRawChunk()` — receives individual stream chunks, buffers arguments
- `processStreamingChunk()` — incrementally parses JSON via `partial-json`
- `finalizeStreamingToolCall()` — produces the final `ToolUse` block with complete, typed `nativeArgs`

Output is pushed into `Task.assistantMessageContent[]`.

**Pseudocode of the parsing pipeline:**

```
for each chunk from LLM stream:
    events = parser.processRawChunk(chunk)
    for each event in events:
        if event.type == "start":
            parser.startStreamingToolCall(id, name)
        if event.type == "delta":
            toolUse = parser.processStreamingChunk(id, argumentsChunk)
            → task.assistantMessageContent[index] = toolUse  (partial)
            → presentAssistantMessage(task)                  (shows streaming UI)
        if event.type == "end":
            toolUse = parser.finalizeStreamingToolCall(id)
            → task.assistantMessageContent[index] = toolUse  (complete, partial=false)
            → presentAssistantMessage(task)                  (triggers execution)
```

---

### 5.2 Dispatch — `presentAssistantMessage()`

|              |                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **File**     | [`presentAssistantMessage.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/assistant-message/presentAssistantMessage.ts) |
| **Function** | `presentAssistantMessage(cline: Task)`                                                                                                       |

This function processes each content block sequentially. For `tool_use` blocks:

1. **Validates** the tool is allowed for the current mode (`validateToolUse()`, line 597)
2. **Checks** for repetitive tool calls (`toolRepetitionDetector.check()`, line 630)
3. **Dispatches** via a `switch (block.name)` at **line 678**

The `execute_command` dispatch (line 764):

```typescript
case "execute_command":
    await executeCommandTool.handle(cline, block as ToolUse<"execute_command">, {
        askApproval, handleError, pushToolResult,
    })
```

The `write_to_file` dispatch (line 679):

```typescript
case "write_to_file":
    await checkpointSaveAndMark(cline)
    await writeToFileTool.handle(cline, block as ToolUse<"write_to_file">, {
        askApproval, handleError, pushToolResult,
    })
```

Every tool receives three callbacks:

- **`askApproval`** — pauses for user confirmation (or auto-approves)
- **`handleError`** — formats errors and feeds them back to the LLM
- **`pushToolResult`** — sends the `tool_result` into conversation history

**Pseudocode of the full dispatch flow:**

```
presentAssistantMessage(task):
    block = task.assistantMessageContent[currentIndex]

    if block.type == "text":
        display text to user
        return

    if block.type == "tool_use":
        // ── Gate 1: Validation ──
        validateToolUse(block.name, mode, customModes)

        // ── Gate 2: Repetition ──
        repetitionCheck = toolRepetitionDetector.check(block)
        if repetitionCheck.blocked → ask user, return error

        // ── Gate 3: Dispatch ──
        switch (block.name):
            "execute_command" → executeCommandTool.handle(...)
            "write_to_file"  → writeToFileTool.handle(...)
            "read_file"      → readFileTool.handle(...)
            ...etc

        // After tool completes:
        pushToolResult(result)  → added to userMessageContent
        task advances to next block
```

---

### 5.3 Base Handler — `BaseTool.handle()`

|            |                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------- |
| **File**   | [`BaseTool.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/tools/BaseTool.ts) |
| **Class**  | `BaseTool<TName>` (abstract)                                                                       |
| **Method** | `handle()` — lines 101–161                                                                         |

All tool classes extend `BaseTool`. The `handle()` method is the single entry point:

1. If the block is **partial** (still streaming), calls `handlePartial()` for UI updates and returns
2. Extracts typed parameters from `block.nativeArgs`
3. Calls the abstract `execute(params, task, callbacks)` on the concrete subclass

**Pseudocode:**

```
BaseTool.handle(task, block, callbacks):
    if block.partial:
        this.handlePartial(task, block)   // streaming UI only
        return

    params = block.nativeArgs             // typed parameters from parser
    this.execute(params, task, callbacks)  // concrete tool logic
```

---

### 5.4 Concrete Tools — `execute_command` and `write_to_file`

#### `ExecuteCommandTool`

|           |                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| **File**  | [`ExecuteCommandTool.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/tools/ExecuteCommandTool.ts) |
| **Class** | `ExecuteCommandTool extends BaseTool<"execute_command">`                                                               |

**Pseudocode of `execute()`:**

```
ExecuteCommandTool.execute(params, task, callbacks):
    if !params.command:
        return error("Missing required parameter: command")

    // Ask user for approval (shows the command in UI)
    approved = await askApproval("command", formatCommandPreview(params))
    if !approved → return "Tool denied"

    // Run in VS Code terminal
    [completed, output] = await executeCommandInTerminal(task, {
        command: params.command,
        cwd: params.cwd ?? task.cwd
    })

    pushToolResult(output)
```

#### `WriteToFileTool`

|           |                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| **File**  | [`WriteToFileTool.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/tools/WriteToFileTool.ts) |
| **Class** | `WriteToFileTool extends BaseTool<"write_to_file">`                                                              |

**Pseudocode of `execute()`:**

```
WriteToFileTool.execute(params, task, callbacks):
    if !params.path or !params.content:
        return error("Missing required parameter: path or content")

    // Show diff preview and ask user for approval
    approved = await askApproval("tool", formatDiffPreview(params))
    if !approved → return "Tool denied"

    // Write file to disk
    await fs.writeFile(absolutePath, params.content)

    pushToolResult("File written successfully")
```

---

## 6. The Prompt Builder

|                     |                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Entry point**     | [`Task.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/task/Task.ts) — `getSystemPrompt()` at line 3745     |
| **Builder**         | [`system.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/prompts/system.ts) — `SYSTEM_PROMPT()` at line 112 |
| **Section modules** | [`src/core/prompts/sections/`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/prompts/sections)                 |

The system prompt is regenerated on **every API request** via `Task.attemptApiRequest()`.

### Assembly Order

`generatePrompt()` (system.ts, line 41) concatenates these sections in order:

| #   | Section             | Source                          | Purpose                                  |
| --- | ------------------- | ------------------------------- | ---------------------------------------- |
| 1   | Role definition     | Mode config                     | Defines persona (coder, architect, etc.) |
| 2   | Markdown formatting | `markdownFormattingSection()`   | Output format rules                      |
| 3   | Shared tool use     | `getSharedToolUseSection()`     | General tool calling instructions        |
| 4   | Tool use guidelines | `getToolUseGuidelinesSection()` | Detailed tool constraints                |
| 5   | Capabilities        | `getCapabilitiesSection()`      | What the agent can do                    |
| 6   | Modes               | `getModesSection()`             | Available modes                          |
| 7   | Skills              | `getSkillsSection()`            | Available skills                         |
| 8   | Rules               | `getRulesSection()`             | Behavioral rules                         |
| 9   | System info         | `getSystemInfoSection()`        | OS, shell, cwd                           |
| 10  | Objective           | `getObjectiveSection()`         | High-level goal framing                  |
| 11  | Custom instructions | `addCustomInstructions()`       | User-defined rules                       |

### Call Chain

```
Task.attemptApiRequest()                    ← Task.ts:3988
    └── this.getSystemPrompt()              ← Task.ts:4020
            └── SYSTEM_PROMPT()             ← system.ts:112
                    └── generatePrompt()    ← system.ts:41
                            ├── getRulesSection()
                            ├── getCapabilitiesSection()
                            ├── getToolUseGuidelinesSection()
                            └── ...etc
```

---

## 7. Identified Interception Points (Mapping Only)

> [!NOTE]
> This section identifies potential middleware boundaries discovered during Phase 0 system mapping.
> No implementation decisions are made here. Detailed hook design and enforcement logic will be addressed in **Phase 1**.

During system mapping, the following interception points were identified:

- **`BaseTool.handle()`** — single funnel for all native tool executions (`BaseTool.ts`, lines 101–161). Fires after the LLM has chosen a tool and parameters, but before any side effects occur.
- **`presentAssistantMessage()`** — central dispatch for all tool blocks including custom and MCP tools (`presentAssistantMessage.ts`, lines 556–920). Contains validation and repetition gates before the dispatch switch.

---

## 8. Key Files Reference

| Component                  | File                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension entry point      | [`src/extension.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/extension.ts)                                                                           |
| Command registration       | [`src/activate/registerCommands.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/activate/registerCommands.ts)                                           |
| Webview bridge             | [`src/core/webview/ClineProvider.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/webview/ClineProvider.ts)                                         |
| Webview message handler    | [`src/core/webview/webviewMessageHandler.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/webview/webviewMessageHandler.ts)                         |
| Main task loop             | [`src/core/task/Task.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/task/Task.ts)                                                                 |
| System prompt builder      | [`src/core/prompts/system.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/prompts/system.ts)                                                       |
| Prompt sections            | [`src/core/prompts/sections/*.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/prompts/sections)                                                    |
| Tool definitions (for LLM) | [`src/core/prompts/tools/native-tools/*.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/prompts/tools/native-tools)                                |
| Stream parser              | [`src/core/assistant-message/NativeToolCallParser.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/assistant-message/NativeToolCallParser.ts)       |
| Tool dispatcher            | [`src/core/assistant-message/presentAssistantMessage.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/assistant-message/presentAssistantMessage.ts) |
| Base tool class            | [`src/core/tools/BaseTool.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/tools/BaseTool.ts)                                                       |
| ExecuteCommandTool         | [`src/core/tools/ExecuteCommandTool.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/tools/ExecuteCommandTool.ts)                                   |
| WriteToFileTool            | [`src/core/tools/WriteToFileTool.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/tools/WriteToFileTool.ts)                                         |
| Auto-approval handler      | [`src/core/auto-approval/AutoApprovalHandler.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/auto-approval/AutoApprovalHandler.ts)                 |
| Tool type definitions      | [`src/shared/tools.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/shared/tools.ts)                                                                     |
| Tool validation            | [`src/core/tools/validateToolUse.ts`](file:///Users/aman/Desktop/projects/10academy/Roo-Code/src/core/tools/validateToolUse.ts)                                         |
