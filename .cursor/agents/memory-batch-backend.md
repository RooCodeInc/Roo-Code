---
name: memory-batch-backend
description: Add batch analysis pipeline for prior chat history sync. Implements batchAnalyzeHistory() on the orchestrator, clearAllMemory(), new message types, and message handlers. Use for the prior chat sync backend.
---

You build the backend for the prior chat sync feature.

## Spec

Read: `docs/superpowers/specs/2026-03-22-memory-sync-and-provider-fix.md`

## Your Tasks

### 1. Add `deleteAllEntries()` to MemoryStore

In `src/core/memory/memory-store.ts`, add:
```typescript
deleteAllEntries(): void {
    this.db!.run("DELETE FROM memory_entries")
    this.db!.run("DELETE FROM analysis_log")
    this.persist()
}
```

### 2. Add `batchAnalyzeHistory()` and `clearAllMemory()` to Orchestrator

In `src/core/memory/orchestrator.ts`, add:

```typescript
async batchAnalyzeHistory(
    taskIds: string[],
    globalStoragePath: string,
    providerSettings: ProviderSettings,
    onProgress: (completed: number, total: number) => void,
): Promise<{ totalAnalyzed: number; entriesCreated: number; entriesReinforced: number }> {
    // Import readApiMessages from task-persistence
    // For each taskId: read messages, preprocess, analyze, write
    // Call onProgress after each task
    // Run garbageCollect at the end
}

clearAllMemory(): void {
    this.store.deleteAllEntries()
}
```

You'll need to import `readApiMessages` from `../../core/task-persistence/apiMessages` (check the exact import path).

### 3. Add message types

In `packages/types/src/vscode-extension-host.ts`:

Add to WebviewMessage type union:
- `"startMemorySync"`
- `"clearMemory"`

Add to ExtensionMessage type union:
- `"memorySyncProgress"`
- `"memorySyncComplete"`
- `"memoryCleared"`

### 4. Add message handlers

In `src/core/webview/webviewMessageHandler.ts`, add before `default:`:

```typescript
case "startMemorySync": {
    const { taskIds } = JSON.parse(message.text || "{}") as { taskIds: string[] }
    const orchestrator = provider.getMemoryOrchestrator()
    if (!orchestrator) break

    const memoryConfigId = provider.getValue("memoryApiConfigId")
    if (!memoryConfigId) break

    try {
        const { name: _, ...memSettings } = await provider.providerSettingsManager.getProfile({
            id: memoryConfigId,
        })

        const globalStoragePath = provider.contextProxy.globalStorageUri.fsPath

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
    } catch {
        // Profile not found
    }
    break
}

case "clearMemory": {
    const orchestrator = provider.getMemoryOrchestrator()
    if (orchestrator) {
        orchestrator.clearAllMemory()
        await provider.postMessageToWebview({ type: "memoryCleared" })
    }
    break
}
```

## Key References

- `readApiMessages({ taskId, globalStoragePath })` — from `src/core/task-persistence/apiMessages.ts`
- `preprocessMessages()` — from `./preprocessor`
- `runAnalysis()` — from `./analysis-agent`
- `processObservations()` — from `./memory-writer`
- `compileMemoryForAgent()` — from `./prompt-compiler`

Commit after each sub-task. Use `--no-verify` on commits.
