# Agent Loop State Detection in the Roo Code Webview Client

This document explains how the webview client detects when the agent loop has stopped and is waiting on the client to resume. This is essential knowledge for implementing an alternative client.

## Overview

The Roo Code extension uses a message-based architecture where the extension host (server) communicates with the webview client through typed messages. The agent loop state is determined by analyzing the `clineMessages` array in the extension state, specifically looking at the **last message's type and properties**.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Extension Host (Server)                              │
│                                                                              │
│  ┌─────────────┐         ┌──────────────────────────────────────────────┐  │
│  │   Task.ts   │────────▶│         RooCodeEventName events               │  │
│  └─────────────┘         │  • TaskActive    • TaskInteractive            │  │
│                          │  • TaskIdle      • TaskResumable              │  │
│                          └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ postMessage("state")
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Webview Client                                     │
│                                                                              │
│  ┌──────────────────────┐      ┌─────────────────────┐                     │
│  │ ExtensionStateContext│─────▶│    ChatView.tsx     │                     │
│  │   clineMessages[]    │      │                     │                     │
│  └──────────────────────┘      │  ┌───────────────┐  │                     │
│                                │  │lastMessage    │  │                     │
│                                │  │  .type        │  │                     │
│                                │  │  .ask / .say  │  │                     │
│                                │  │  .partial     │  │                     │
│                                │  └───────┬───────┘  │                     │
│                                │          │          │                     │
│                                │          ▼          │                     │
│                                │  ┌───────────────┐  │                     │
│                                │  │ State Detection│  │                     │
│                                │  │    Logic      │  │                     │
│                                │  └───────┬───────┘  │                     │
│                                │          │          │                     │
│                                │          ▼          │                     │
│                                │  ┌───────────────┐  │                     │
│                                │  │   UI State    │  │                     │
│                                │  │  • clineAsk   │  │                     │
│                                │  │  • buttons    │  │                     │
│                                │  └───────────────┘  │                     │
│                                └─────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Message Types

### ClineMessage Structure

Defined in [`packages/types/src/message.ts`](../packages/types/src/message.ts):

```typescript
interface ClineMessage {
	ts: number // Timestamp identifier
	type: "ask" | "say" // Message category
	ask?: ClineAsk // Ask type (when type="ask")
	say?: ClineSay // Say type (when type="say")
	text?: string // Message content
	partial?: boolean // Is streaming incomplete?
	// ... other fields
}
```

## Ask Type Categories

The `ClineAsk` types are categorized into four groups that determine when the agent is waiting. These are defined in [`packages/types/src/message.ts`](../packages/types/src/message.ts):

### 1. Idle Asks - Task effectively finished

These indicate the agent loop has stopped and the task is in a terminal or error state.

```typescript
const idleAsks = [
	"completion_result", // Task completed successfully
	"api_req_failed", // API request failed
	"resume_completed_task", // Resume a completed task
	"mistake_limit_reached", // Too many errors encountered
	"auto_approval_max_req_reached", // Auto-approval limit hit
] as const
```

**Helper function:** `isIdleAsk(ask: ClineAsk): boolean`

### 2. Interactive Asks - Approval needed

These indicate the agent is waiting for user approval or input to proceed.

```typescript
const interactiveAsks = [
	"followup", // Follow-up question asked
	"command", // Permission to execute command
	"tool", // Permission for file operations
	"browser_action_launch", // Permission to use browser
	"use_mcp_server", // Permission for MCP server
] as const
```

**Helper function:** `isInteractiveAsk(ask: ClineAsk): boolean`

### 3. Resumable Asks - Task paused

These indicate the task is paused and can be resumed.

```typescript
const resumableAsks = ["resume_task"] as const
```

**Helper function:** `isResumableAsk(ask: ClineAsk): boolean`

### 4. Non-Blocking Asks - No actual approval needed

These are informational and don't block the agent loop.

```typescript
const nonBlockingAsks = ["command_output"] as const
```

**Helper function:** `isNonBlockingAsk(ask: ClineAsk): boolean`

## Client-Side State Detection

### ChatView State Management

The [`ChatView`](../webview-ui/src/components/chat/ChatView.tsx) component maintains several state variables:

```typescript
const [clineAsk, setClineAsk] = useState<ClineAsk | undefined>(undefined)
const [enableButtons, setEnableButtons] = useState<boolean>(false)
const [primaryButtonText, setPrimaryButtonText] = useState<string | undefined>(undefined)
const [secondaryButtonText, setSecondaryButtonText] = useState<string | undefined>(undefined)
const [sendingDisabled, setSendingDisabled] = useState(false)
```

### Detection Logic

The state is determined by a `useDeepCompareEffect` that watches `lastMessage` and `secondLastMessage`:

```typescript
useDeepCompareEffect(() => {
	if (lastMessage) {
		switch (lastMessage.type) {
			case "ask":
				const isPartial = lastMessage.partial === true
				switch (lastMessage.ask) {
					case "api_req_failed":
						// Agent loop stopped - API failed, needs retry or new task
						setSendingDisabled(true)
						setClineAsk("api_req_failed")
						setEnableButtons(true)
						break

					case "mistake_limit_reached":
						// Agent loop stopped - too many errors
						setSendingDisabled(false)
						setClineAsk("mistake_limit_reached")
						setEnableButtons(true)
						break

					case "followup":
						// Agent loop stopped - waiting for user answer
						setSendingDisabled(isPartial)
						setClineAsk("followup")
						setEnableButtons(true)
						break

					case "tool":
					case "command":
					case "browser_action_launch":
					case "use_mcp_server":
						// Agent loop stopped - waiting for approval
						setSendingDisabled(isPartial)
						setClineAsk(lastMessage.ask)
						setEnableButtons(!isPartial)
						break

					case "completion_result":
						// Agent loop stopped - task complete
						setSendingDisabled(isPartial)
						setClineAsk("completion_result")
						setEnableButtons(!isPartial)
						break

					case "resume_task":
					case "resume_completed_task":
						// Agent loop stopped - task paused/completed
						setSendingDisabled(false)
						setClineAsk(lastMessage.ask)
						setEnableButtons(true)
						break
				}
				break
		}
	}
}, [lastMessage, secondLastMessage])
```

### Streaming Detection

To determine if the agent is still streaming a response:

```typescript
const isStreaming = useMemo(() => {
	// Check if current ask has buttons visible
	const isLastAsk = !!modifiedMessages.at(-1)?.ask
	const isToolCurrentlyAsking =
		isLastAsk && clineAsk !== undefined && enableButtons && primaryButtonText !== undefined

	if (isToolCurrentlyAsking) return false

	// Check if message is partial (still streaming)
	const isLastMessagePartial = modifiedMessages.at(-1)?.partial === true
	if (isLastMessagePartial) return true

	// Check if last API request finished (has cost)
	const lastApiReqStarted = findLast(modifiedMessages, (m) => m.say === "api_req_started")
	if (lastApiReqStarted?.text) {
		const cost = JSON.parse(lastApiReqStarted.text).cost
		if (cost === undefined) return true // Still streaming
	}

	return false
}, [modifiedMessages, clineAsk, enableButtons, primaryButtonText])
```

## Implementing State Detection in an Alternative Client

### Step 1: Subscribe to State Updates

```typescript
// Listen for state messages from extension
window.addEventListener("message", (event) => {
	const message = event.data
	if (message.type === "state") {
		const clineMessages = message.state.clineMessages
		detectAgentState(clineMessages)
	}
})
```

### Step 2: Detect Agent State

```typescript
type AgentLoopState =
	| "running" // Agent is actively processing
	| "streaming" // Agent is streaming a response
	| "interactive" // Waiting for tool/command approval
	| "followup" // Waiting for user to answer a question
	| "idle" // Task completed or errored out
	| "resumable" // Task paused, can be resumed

function detectAgentState(messages: ClineMessage[]): AgentLoopState {
	const lastMessage = messages.at(-1)
	if (!lastMessage) return "running"

	// Check if still streaming
	if (lastMessage.partial === true) {
		return "streaming"
	}

	// Check if it's an ask message
	if (lastMessage.type === "ask" && lastMessage.ask) {
		const ask = lastMessage.ask

		// Idle states - task effectively stopped
		if (
			[
				"completion_result",
				"api_req_failed",
				"resume_completed_task",
				"mistake_limit_reached",
				"auto_approval_max_req_reached",
			].includes(ask)
		) {
			return "idle"
		}

		// Resumable state
		if (ask === "resume_task") {
			return "resumable"
		}

		// Follow-up question
		if (ask === "followup") {
			return "followup"
		}

		// Interactive approval needed
		if (["command", "tool", "browser_action_launch", "use_mcp_server"].includes(ask)) {
			return "interactive"
		}

		// Non-blocking (command_output)
		if (ask === "command_output") {
			return "running" // Can proceed or interrupt
		}
	}

	// Check for API request in progress
	const lastApiReq = messages.findLast((m) => m.say === "api_req_started")
	if (lastApiReq?.text) {
		try {
			const data = JSON.parse(lastApiReq.text)
			if (data.cost === undefined) {
				return "streaming"
			}
		} catch {}
	}

	return "running"
}
```

### Step 3: Respond to Agent State

```typescript
// Send response back to extension
function respondToAsk(response: ClineAskResponse, text?: string, images?: string[]) {
	vscode.postMessage({
		type: "askResponse",
		askResponse: response, // "yesButtonClicked" | "noButtonClicked" | "messageResponse"
		text,
		images,
	})
}

// Start a new task
function startNewTask(text: string, images?: string[]) {
	vscode.postMessage({
		type: "newTask",
		text,
		images,
	})
}

// Clear current task
function clearTask() {
	vscode.postMessage({ type: "clearTask" })
}

// Cancel streaming task
function cancelTask() {
	vscode.postMessage({ type: "cancelTask" })
}

// Terminal operations for command_output
function terminalOperation(operation: "continue" | "abort") {
	vscode.postMessage({ type: "terminalOperation", terminalOperation: operation })
}
```

## Response Actions by State

| State                   | Primary Action               | Secondary Action           |
| ----------------------- | ---------------------------- | -------------------------- |
| `api_req_failed`        | Retry (`yesButtonClicked`)   | New Task (`clearTask`)     |
| `mistake_limit_reached` | Proceed (`yesButtonClicked`) | New Task (`clearTask`)     |
| `followup`              | Answer (`messageResponse`)   | -                          |
| `tool`                  | Approve (`yesButtonClicked`) | Reject (`noButtonClicked`) |
| `command`               | Run (`yesButtonClicked`)     | Reject (`noButtonClicked`) |
| `browser_action_launch` | Approve (`yesButtonClicked`) | Reject (`noButtonClicked`) |
| `use_mcp_server`        | Approve (`yesButtonClicked`) | Reject (`noButtonClicked`) |
| `completion_result`     | New Task (`clearTask`)       | -                          |
| `resume_task`           | Resume (`yesButtonClicked`)  | Terminate (`clearTask`)    |
| `resume_completed_task` | New Task (`clearTask`)       | -                          |
| `command_output`        | Proceed (`continue`)         | Kill (`abort`)             |

## Extension-Side Event Emission

The extension emits task state events from [`src/core/task/Task.ts`](../src/core/task/Task.ts):

```
                    ┌─────────────────┐
                    │  Task Started   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
              ┌────▶│   TaskActive    │◀────┐
              │     └────────┬────────┘     │
              │              │              │
              │    ┌─────────┼─────────┐    │
              │    │         │         │    │
              │    ▼         ▼         ▼    │
              │  ┌───┐   ┌───────┐  ┌─────┐ │
              │  │Idle│  │Interact│ │Resume│ │
              │  │Ask │  │iveAsk  │ │ableAsk│ │
              │  └─┬──┘  └───┬───┘  └──┬──┘ │
              │    │         │         │    │
              │    ▼         │         │    │
              │ ┌──────┐     │         │    │
              │ │TaskIdle│   │         │    │
              │ └──────┘     │         │    │
              │              ▼         │    │
              │      ┌───────────────┐ │    │
              │      │TaskInteractive│ │    │
              │      └───────┬───────┘ │    │
              │              │         │    │
              │              │ User    │    │
              │              │ approves│    │
              │              │         ▼    │
              │              │  ┌───────────┐
              │              │  │TaskResumable│
              │              │  └─────┬─────┘
              │              │        │
              │              │  User  │
              │              │ resumes│
              │              │        │
              └──────────────┴────────┘
```

The extension uses helper functions to categorize asks and emit the appropriate events:

- `isInteractiveAsk()` → emits `TaskInteractive`
- `isIdleAsk()` → emits `TaskIdle`
- `isResumableAsk()` → emits `TaskResumable`

## WebviewMessage Types for Responses

When responding to asks, use the appropriate `WebviewMessage` type (defined in [`packages/types/src/vscode-extension-host.ts`](../packages/types/src/vscode-extension-host.ts)):

```typescript
interface WebviewMessage {
	type:
		| "askResponse" // Respond to an ask
		| "newTask" // Start a new task
		| "clearTask" // Clear/end current task
		| "cancelTask" // Cancel running task
		| "terminalOperation" // Control terminal output
	// ... many other types

	askResponse?: ClineAskResponse // "yesButtonClicked" | "noButtonClicked" | "messageResponse" | "objectResponse"
	text?: string
	images?: string[]
	terminalOperation?: "continue" | "abort"
}
```

## Summary

To correctly detect when the agent loop has stopped in an alternative client:

1. **Monitor `clineMessages`** from state updates
2. **Check the last message's `type` and `ask`/`say` properties**
3. **Check `partial` flag** to detect streaming
4. **For API request status**, parse the `api_req_started` message's `text` field and check if `cost` is defined
5. **Use the ask category functions** (`isIdleAsk`, `isInteractiveAsk`, etc.) to determine the appropriate UI state
6. **Respond with the correct `askResponse` type** based on user action

The key insight is that the agent loop stops whenever a message with `type: "ask"` arrives, and the specific `ask` value determines what kind of response the agent is waiting for.
