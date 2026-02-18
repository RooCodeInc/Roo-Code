# Phase 0: The Archaeological Dig - Architecture Notes

## 1. THE SYSTEM PROMPT

**Primary Location:** [src/core/prompts/system.ts](file:///home/nahom/Documents/Roo-Code/src/core/prompts/system.ts)

The system prompt is constructed via the `SYSTEM_PROMPT` exported constant, which calls the internal `generatePrompt` function.

- **Logic Start:** `src/core/prompts/system.ts` L41-110
- **Injection Points:**
    - **Rules Section:** L97 calls `getRulesSection(cwd, settings)`, which pulls from `src/core/prompts/sections/rules.ts`. This is ideal for global governance rules.
    - **Custom Instructions:** L103 calls `addCustomInstructions(...)`. This is where user-level or mode-level instructions are appended.
    - **Base Template:** The template literal starting at L85 assembles the disparate parts into the final massive string.

## 2. THE TOOL EXECUTION LOOP

**Primary Location:** [src/core/assistant-message/presentAssistantMessage.ts](file:///home/nahom/Documents/Roo-Code/src/core/assistant-message/presentAssistantMessage.ts)

While `src/core/task/Task.ts` manages the higher-level recursion (`recursivelyMakeClineRequests`), the actual tool selection and execution happen in `presentAssistantMessage`.

- **Function:** `presentAssistantMessage(cline: Task)` L61
- **Target Tools:**
    - `write_to_file`: L681 calls `writeToFileTool.handle(...)`
    - `execute_command`: L764 calls `executeCommandTool.handle(...)`
- **Hook Points:**
    - **Pre-Tool Hook:** L678 (inside the `case "tool_use"` block, before the `switch (block.name)`). This is the best point to intercept and validate ANY tool call before it hits the individual tool handlers.
    - **Post-Tool Hook:** Immediately after each `await XXXTool.handle(...)` call within the switch cases.

## 3. THE MESSAGE HANDLER

**Primary Location:** [src/core/webview/webviewMessageHandler.ts](file:///home/nahom/Documents/Roo-Code/src/core/webview/webviewMessageHandler.ts)

This file is the "border control" between the UI (React/Webview) and the VS Code Extension Host.

- **Function:** `webviewMessageHandler` L89
- **Intercept Points:**
    - **New Task (Initial Message):** `case "newTask"` (L549). Intercepting here allows us to wrap the user's initial request in governance context.
    - **Subsequent Feedback/Responses:** `case "askResponse"` (L571). This handles both direct user replies and button clicks (Yes/No approvals).
- **Mechanism:** User messages are passed to `provider.createTask` or `currentTask.handleWebviewAskResponse`. Middleware should be injected here to mutate or wrap the `message.text` before it enters the `Task` logic.
