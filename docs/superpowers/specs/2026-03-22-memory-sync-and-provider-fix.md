# Memory System: Provider Fix & Prior Chat Sync — Design Spec

## Problem 1: Wrong Provider Settings (Bug)

The memory orchestrator receives the main chat provider's settings instead of the memory-specific profile. In `Task.ts:2700-2701`, `contextProxy.getProviderSettings()` returns the active chat profile, but the user configures a separate `memoryApiConfigId` in Settings > Memory.

### Fix

Follow the `enhancementApiConfigId` precedent from `messageEnhancer.ts:47-59`:

```typescript
// In Task.ts, where onUserMessage/onSessionEnd are called:
const memoryConfigId = provider.contextProxy.getValue("memoryApiConfigId")
let memoryProviderSettings: ProviderSettings | null = null

if (memoryConfigId) {
    try {
        const { name: _, ...settings } = await provider.providerSettingsManager.getProfile({
            id: memoryConfigId,
        })
        if (settings.apiProvider) {
            memoryProviderSettings = settings
        }
    } catch {
        // Profile not found — skip
    }
}

memOrch.onUserMessage(this.apiConversationHistory, this.taskId, memoryProviderSettings)
```

Same pattern for the `onSessionEnd` call.

---

## Problem 2: Cold-Start — No Data Until 8+ Messages

Users enable memory but see nothing in the system prompt because the database is empty. They need a way to bootstrap from existing chat history.

---

## Feature: Prior Chat Sync

### User Flow

1. User goes to Settings > Memory
2. Clicks "Browse Chats" — opens a dialog with all prior conversations listed
3. Each chat shows the first message text + date, with a checkbox
4. "Select All" / "Deselect All" toggle
5. Selection count: "12 of 47 selected"
6. Clicks "Learn" button to start batch analysis
7. Progress bar fills: "8 of 12 chats analyzed"
8. While running: spinner/loading icon. When done: green circle (matches chat toggle design)
9. System prompt now has USER PROFILE section immediately

### Clear Memory

A "Clear Memory" button with AlertDialog confirmation ("This will reset all learned preferences. Are you sure?") that wipes the SQLite database.

---

## Backend: Batch Analysis Pipeline

### New method on MemoryOrchestrator

```typescript
async batchAnalyzeHistory(
    taskIds: string[],
    globalStoragePath: string,
    providerSettings: ProviderSettings,
    onProgress: (completed: number, total: number) => void,
): Promise<{ totalAnalyzed: number; entriesCreated: number; entriesReinforced: number }>
```

For each task ID:
1. Read `api_conversation_history.json` via `readApiMessages({ taskId, globalStoragePath })`
2. `preprocessMessages(messages)` — strip noise
3. `runAnalysis(providerSettings, cleaned, existingReport)` — extract observations
4. `processObservations(store, observations, workspaceId, taskId)` — write to SQLite
5. Call `onProgress(i + 1, taskIds.length)`
6. Run garbage collection after all tasks

Sequential processing (one task at a time) to avoid API rate limits.

### New method: clearAllMemory()

```typescript
clearAllMemory(): void {
    this.store.deleteAllEntries()
    this.store.persist()
}
```

### New message types

WebviewMessage additions:
- `"startMemorySync"` — payload: `{ taskIds: string[] }` via `text` (JSON)
- `"clearMemory"` — no payload

ExtensionMessage additions:
- `"memorySyncProgress"` — payload: `{ completed: number, total: number }` via `text` (JSON)
- `"memorySyncComplete"` — payload: `{ entriesCreated: number, entriesReinforced: number }` via `text` (JSON)
- `"memoryCleared"` — no payload

### Message handlers

In `webviewMessageHandler.ts`:

```typescript
case "startMemorySync": {
    const { taskIds } = JSON.parse(message.text || "{}") as { taskIds: string[] }
    const orchestrator = provider.getMemoryOrchestrator()
    if (!orchestrator) break

    // Resolve memory provider settings (same pattern as enhancementApiConfigId)
    const memoryConfigId = provider.getValue("memoryApiConfigId")
    if (!memoryConfigId) break

    const { name: _, ...memSettings } = await provider.providerSettingsManager.getProfile({
        id: memoryConfigId,
    })

    const globalStoragePath = provider.contextProxy.globalStorageUri.fsPath

    // Run in background, post progress
    orchestrator.batchAnalyzeHistory(
        taskIds,
        globalStoragePath,
        memSettings,
        (completed, total) => {
            provider.postMessageToWebview({
                type: "memorySyncProgress",
                text: JSON.stringify({ completed, total }),
            })
        },
    ).then((result) => {
        provider.postMessageToWebview({
            type: "memorySyncComplete",
            text: JSON.stringify(result),
        })
    }).catch(() => {
        provider.postMessageToWebview({
            type: "memorySyncComplete",
            text: JSON.stringify({ totalAnalyzed: 0, entriesCreated: 0, entriesReinforced: 0 }),
        })
    })
    break
}

case "clearMemory": {
    const orchestrator = provider.getMemoryOrchestrator()
    if (orchestrator) {
        orchestrator.clearAllMemory()
        provider.postMessageToWebview({ type: "memoryCleared" })
    }
    break
}
```

---

## Frontend: Settings UI Enhancement

### MemoryChatPicker Component

New file: `webview-ui/src/components/settings/MemoryChatPicker.tsx`

A Dialog containing:
- Scrollable list of `HistoryItem[]` with Checkbox per item
- Shows `item.task` (first message text) + `formatTimeAgo(item.ts)`
- "Select All" / "Deselect All" at top
- Selection count
- "Learn" button at bottom

Props:
```typescript
interface MemoryChatPickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    taskHistory: HistoryItem[]
    onStartSync: (taskIds: string[]) => void
}
```

### Extended Memory Settings Section

In SettingsView.tsx, below existing config:

```
Prior Chat Analysis
├── [Browse Chats] → opens MemoryChatPicker
├── Progress: [■■■■■■░░░░] 8 of 12 analyzed
├── Status: ⟳ syncing... | ● done
└── [Clear Memory] → AlertDialog confirmation
```

State management:
```typescript
const [isSyncing, setIsSyncing] = useState(false)
const [syncProgress, setSyncProgress] = useState({ completed: 0, total: 0 })
const [syncDone, setSyncDone] = useState(false)
const [pickerOpen, setPickerOpen] = useState(false)
const [clearDialogOpen, setClearDialogOpen] = useState(false)
```

Message listener:
```typescript
useEffect(() => {
    const handler = (event: MessageEvent) => {
        if (event.data.type === "memorySyncProgress") {
            const { completed, total } = JSON.parse(event.data.text)
            setSyncProgress({ completed, total })
        }
        if (event.data.type === "memorySyncComplete") {
            setIsSyncing(false)
            setSyncDone(true)
        }
        if (event.data.type === "memoryCleared") {
            setSyncDone(false)
            setSyncProgress({ completed: 0, total: 0 })
        }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
}, [])
```

---

## Files Changed

### New
- `webview-ui/src/components/settings/MemoryChatPicker.tsx`

### Modified
- `src/core/task/Task.ts` — fix provider resolution (2 locations)
- `src/core/memory/orchestrator.ts` — add `batchAnalyzeHistory()`, `clearAllMemory()`
- `src/core/memory/memory-store.ts` — add `deleteAllEntries()` method
- `packages/types/src/vscode-extension-host.ts` — add 5 new message types
- `src/core/webview/webviewMessageHandler.ts` — add `startMemorySync`, `clearMemory` handlers
- `webview-ui/src/components/settings/SettingsView.tsx` — extend Memory section
