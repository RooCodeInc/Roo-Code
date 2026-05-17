# Phase 6: Background Task Visibility and Interaction

> Architectural design document for Issue #12330  
> Phase 6 of "Support parallel execution of specialized agents and improve context handoff between modes"

## 1. Context

Phase 5 (Background Tasks Panel UI) is complete. This document proposes the scope, priority, and architecture for Phase 6, which focuses on enabling better visibility and interaction with background tasks.

## 2. Current Architecture

### Task Lifecycle

`ClineProvider` maintains a `clineStack: Task[]` (LIFO). Only the top-of-stack task is "current" -- all state updates, webview messages, and user interactions route through `getCurrentTask()`.

```
ClineProvider
├── clineStack: Task[]          # LIFO stack, sequential execution
├── taskHistoryStore             # Per-task file persistence
├── getCurrentTask()             # Returns top of stack
├── addClineToStack(task)        # Push new task
└── removeClineFromStack()       # Pop completed task
```

### Task Persistence

| Layer | File | Purpose |
|-------|------|---------|
| Messages | `taskMessages.ts` | Save/load `ClineMessage[]` per task |
| API History | `apiMessages.ts` | Save/load API conversation history |
| History Items | `TaskHistoryStore.ts` | Per-task metadata files with in-memory cache |
| Metadata | `taskMetadata.ts` | Task metadata helpers |

### Webview Communication

The extension sends typed `ExtensionMessage` objects to the webview. Key message types:

- `state` -- Full state snapshot (includes `clineMessages`, `currentTaskId`)
- `taskHistoryUpdated` -- Full history list refresh
- `taskHistoryItemUpdated` -- Single history item update

Currently, `postStateToWebviewWithoutTaskHistory()` sends state for only the current task. There is no mechanism to send updates for background tasks.

### Subtask Support

Parent-child relationships exist via `parentTaskId` and `childIds` on `HistoryItem`. The `new_task` tool creates subtasks that push onto the stack. When a subtask completes, it pops and returns control to the parent.

## 3. Agreed Scope for Phase 6

**In scope (Items 1-3):**
1. Full conversation replay for completed background tasks
2. Tab switching / multi-task view
3. Real-time progress streaming for active background tasks

**Deferred to Phase 7 (Items 4-5):**
4. Write-capable background tasks + basic file locking
5. Persistent background task history across sessions

## 4. Feasibility Analysis

### Item 1: Full Conversation Replay

**Complexity: Medium | Risk: Low**

`readTaskMessages(taskId, globalStoragePath)` already loads the full `ClineMessage[]` array from disk for any task. The existing `ChatView` component renders these messages. The main work is creating a read-only wrapper that:

- Accepts a `taskId` prop instead of reading from global state
- Loads messages on mount via a new webview message
- Hides input controls (chat box, approval buttons)
- Renders tool calls, outputs, and assistant responses in the same format

**Why it's low risk:** No changes to task execution, persistence, or the foreground task flow. Purely additive UI + a new message handler.

### Item 2: Tab Switching / Multi-task View

**Complexity: Medium-High | Risk: Medium**

The webview already has a tab system in `App.tsx` (`tab === "history"`, `tab === "settings"`, `tab === "chat"`). Adding a background tasks view requires:

- A new tab or panel within the chat view
- A list of active/completed background tasks with status indicators
- Navigation to open a task's replay view or live view
- State management to track which background task is currently being viewed

**Key challenge:** The webview currently receives state for only one task. Viewing a background task must not disrupt the foreground task's state. This requires either:
  - (a) A separate message channel for background task data, or
  - (b) A secondary state context in the webview that can hold background task data alongside the primary task state

Option (a) is cleaner and avoids polluting the existing state management.

### Item 3: Real-time Progress Streaming

**Complexity: High | Risk: Medium-High**

Currently, `Task.ts` calls `provider.postStateToWebviewWithoutTaskHistory()` to update the UI. This method sends the full state for the current task only. For background tasks to stream progress:

1. `Task.ts` must emit incremental updates even when it is not the "current" task
2. A new message type (`backgroundTaskProgress`) must carry task-scoped updates
3. The webview must handle concurrent update streams without degrading performance
4. Throttling/batching is needed to prevent excessive re-renders

**Why it's harder:** Requires changes to the core task execution loop (`Task.ts`), not just additive UI. The task currently assumes it IS the visible task when posting updates.

## 5. Recommended Priority Order

```
Phase 6a: Conversation Replay         (Foundation -- standalone value)
    │
    ▼
Phase 6b: Tab/Panel Switching          (Navigation framework, depends on 6a)
    │
    ▼
Phase 6c: Real-time Progress Streaming (Highest complexity, builds on 6b)
```

Each sub-phase is independently shippable and testable.

## 6. Detailed Design

### 6a. Conversation Replay

#### New Message Types

```typescript
// Webview → Extension
interface RequestBackgroundTaskMessages {
  type: "requestBackgroundTaskMessages"
  taskId: string
}

// Extension → Webview
interface BackgroundTaskMessages {
  type: "backgroundTaskMessages"
  taskId: string
  messages: ClineMessage[]
}
```

#### Extension Handler (webviewMessageHandler.ts)

```typescript
case "requestBackgroundTaskMessages": {
  const taskId = message.taskId
  const globalStoragePath = provider.contextProxy.globalStorageUri.fsPath
  const messages = await readTaskMessages(taskId, globalStoragePath)
  provider.postMessageToWebview({
    type: "backgroundTaskMessages",
    taskId,
    messages: messages ?? [],
  })
  break
}
```

#### Webview Component

```
BackgroundTaskReplayView
├── Props: { taskId: string, onClose: () => void }
├── State: messages (ClineMessage[]), loading (boolean)
├── On mount: sends requestBackgroundTaskMessages
├── On message: receives backgroundTaskMessages, filters by taskId
├── Renders: read-only message list (reuses ChatRow components)
└── No input controls, no approval buttons
```

### 6b. Tab/Panel Switching

#### UI Structure

A new icon is added to the existing tab bar (alongside chat, history, settings) as the entry point. The background task view occupies the full tab area.

```
App.tsx
├── tab === "chat"     → ChatView (foreground task)
├── tab === "history"  → HistoryView
├── tab === "settings" → SettingsView
└── tab === "bgTask"   → BackgroundTaskView
    ├── BackgroundTasksList (task list with status badges + error badge on tab icon)
    │   ├── Active tasks
    │   └── Completed tasks
    └── BackgroundTaskReplayView (from 6a) OR BackgroundTaskLiveView (from 6c)
```

#### State Management

```typescript
// New webview state (in App.tsx or dedicated context)
interface BackgroundTaskViewState {
  selectedTaskId: string | null
  viewMode: "replay" | "live"
}
```

#### Navigation Flow

1. User clicks background tasks icon in the tab bar
2. App switches to `tab === "bgTask"`
3. BackgroundTasksList shows available tasks
4. User clicks a task → sets `selectedTaskId`
5. If task is completed → opens BackgroundTaskReplayView
6. If task is active → opens BackgroundTaskLiveView (Phase 6c)

### 6c. Real-time Progress Streaming (Minimal Viable Version)

> **Design principle:** Keep Phase 6c tightly scoped to avoid expanding the phase. Ship the simplest useful version first; richer detail can be added incrementally in later phases.

#### MVP Scope

The minimal viable version streams only:
- **Tool name + status** (started / completed / errored) -- not full parameters or output
- **Last N updates** (rolling window of ~20 items) -- older entries are discarded client-side
- **Status changes** (running, paused, completed, errored)

What is explicitly **out of scope** for the MVP:
- Full tool call parameters or output payloads
- Assistant text streaming
- Persistent storage of streamed updates (replay from disk covers completed tasks)

#### New Message Types

```typescript
// Extension → Webview (incremental updates)
interface BackgroundTaskProgress {
  type: "backgroundTaskProgress"
  taskId: string
  update: BackgroundTaskUpdate
}

interface BackgroundTaskUpdate {
  kind: "tool_call" | "tool_result" | "status_change" | "error"
  timestamp: number
  toolName?: string       // e.g. "read_file", "execute_command"
  status?: string         // e.g. "started", "completed", "errored"
  errorMessage?: string   // Only for kind === "error"
}
```

Note: `assistant_text` is excluded from the MVP. The update interface uses typed optional fields instead of `data: any` to keep the contract narrow and safe.

#### Task.ts Changes

Add a method that emits progress regardless of whether the task is "current":

```typescript
// In Task.ts
private emitBackgroundProgress(update: BackgroundTaskUpdate) {
  const provider = this.providerRef.deref()
  if (!provider) return
  
  // Only emit background updates when this task is NOT the current task
  if (provider.getCurrentTask()?.taskId === this.taskId) return
  
  provider.postMessageToWebview({
    type: "backgroundTaskProgress",
    taskId: this.taskId,
    update,
  })
}
```

The hook points in Task.ts should be minimal -- emit at tool call start and tool call end only. Avoid adding hooks inside the LLM streaming loop for the MVP.

#### Throttling Strategy

- Batch updates in 500ms windows (conservative default; can be tuned down later)
- Cap at 5 updates per batch per task
- Drop older updates if buffer exceeds threshold (keep last N = 20)
- Priority ordering: status_change > error > tool_result > tool_call

#### Webview: BackgroundTaskLiveView

```
BackgroundTaskLiveView
├── Props: { taskId: string }
├── State: updates (BackgroundTaskUpdate[], capped at last 20), status
├── Subscribes to backgroundTaskProgress messages filtered by taskId
├── Renders: compact list of recent tool calls with status icons
├── Auto-scrolls to latest update
└── Shows task status badge (running, paused, completed, errored)
```

The live view intentionally shows a compact summary, not a full chat transcript. Users who want full detail can wait for the task to complete and use the replay view (6a).

> **Confirmed:** Streaming is scoped to the currently selected background task only. The extension should not emit `backgroundTaskProgress` messages for tasks the user is not viewing. This keeps message traffic low and the implementation simple.

## 7. Testing Strategy

| Area | Test Type | Key Scenarios |
|------|-----------|---------------|
| Message handler | Unit (vitest) | Request/response for task messages, missing task, corrupt data |
| BackgroundTaskReplayView | Component (vitest + RTL) | Loading state, message rendering, empty state |
| Tab switching | Component (vitest + RTL) | Tab navigation, state preservation, back to foreground |
| Progress streaming | Unit (vitest) | Throttling, batching, concurrent tasks |
| Integration | E2E (if feasible) | Full flow: start bg task → view progress → replay after completion |

## 8. Confirmed Decisions

The following decisions were confirmed during design review and should guide implementation.

### UI Layout

1. **Background task view layout: Full tab** (`tab === "bgTask"`)

   Start with a full tab for simplicity in Phase 6. A sidebar/hybrid mode may be considered later based on user feedback.

2. **Entry point placement: New tab bar icon**

   Add a new icon in the existing tab bar (alongside chat, history, settings). This is the most discoverable location without cluttering the chat view.

3. **Replay view implementation: Thin wrapper around ChatRow components**

   Create a dedicated `BackgroundTaskReplayView` that wraps `ChatRow` components directly rather than reusing the full `ChatView`. This avoids inheriting input controls, scroll management, and approval button logic that don't apply to read-only replay.

### Progress Streaming (6c)

4. **Streaming granularity: Minimal level**

   Stream tool name + status only (started/completed/errored). This provides enough signal to know what the background task is doing without performance risk. Truncated arguments (medium level) can be added in a follow-up if users need more context.

5. **Streaming scope: Currently selected task only**

   Only stream updates for the background task the user is currently viewing. This avoids unnecessary message traffic and keeps the implementation simple.

6. **Error surfacing: Badge on the background tasks tab icon**

   Display a badge on the tab icon when a background task encounters an error. Toast notifications can be added later if users miss errors.
