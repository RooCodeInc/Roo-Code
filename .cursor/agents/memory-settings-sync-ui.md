---
name: memory-settings-sync-ui
description: Extend the Memory settings section in SettingsView with prior chat sync UI — Browse Chats button, progress bar, status indicator, and Clear Memory button. Wires up the MemoryChatPicker dialog and message listeners.
---

You extend the Memory settings section with the sync UI.

## Spec

Read: `docs/superpowers/specs/2026-03-22-memory-sync-and-provider-fix.md`

## Your Task

Modify `webview-ui/src/components/settings/SettingsView.tsx` — extend the `renderTab === "memory"` section.

### What to Add (below existing config)

```tsx
{/* Prior Chat Analysis */}
<div style={{ borderTop: "1px solid var(--vscode-input-border)", paddingTop: "16px" }}>
    <label style={{ fontSize: "13px", fontWeight: 500 }}>Prior Chat Analysis</label>
    <p style={{ fontSize: "11px", opacity: 0.6, marginBottom: "8px" }}>
        Analyze your existing conversations to build your profile instantly.
    </p>

    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
        <Button variant="secondary" onClick={() => setPickerOpen(true)} disabled={isSyncing}>
            Browse Chats
        </Button>
        {isSyncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
        ) : syncDone ? (
            <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
        ) : null}
        {isSyncing && (
            <span style={{ fontSize: "11px", opacity: 0.7 }}>
                {syncProgress.completed} of {syncProgress.total} analyzed
            </span>
        )}
    </div>

    {/* Progress bar — visible while syncing */}
    {isSyncing && syncProgress.total > 0 && (
        <div style={{ width: "100%", height: "6px", background: "var(--vscode-input-background)", borderRadius: "3px", overflow: "hidden", marginBottom: "12px" }}>
            <div style={{
                width: `${(syncProgress.completed / syncProgress.total) * 100}%`,
                height: "100%",
                background: "var(--vscode-button-background)",
                transition: "width 0.3s ease",
            }} />
        </div>
    )}
</div>

{/* Clear Memory */}
<div style={{ borderTop: "1px solid var(--vscode-input-border)", paddingTop: "16px" }}>
    <Button variant="destructive" onClick={() => setClearDialogOpen(true)} disabled={isSyncing}>
        Clear Memory
    </Button>
    <p style={{ fontSize: "11px", opacity: 0.5, marginTop: "4px" }}>
        Reset all learned preferences and start fresh.
    </p>
</div>
```

### State to Add

```typescript
const [isSyncing, setIsSyncing] = useState(false)
const [syncProgress, setSyncProgress] = useState({ completed: 0, total: 0 })
const [syncDone, setSyncDone] = useState(false)
const [pickerOpen, setPickerOpen] = useState(false)
const [clearDialogOpen, setClearDialogOpen] = useState(false)
```

### Message Listener

```typescript
useEffect(() => {
    const handler = (event: MessageEvent) => {
        const msg = event.data
        if (msg.type === "memorySyncProgress") {
            const data = JSON.parse(msg.text)
            setSyncProgress(data)
        }
        if (msg.type === "memorySyncComplete") {
            setIsSyncing(false)
            setSyncDone(true)
        }
        if (msg.type === "memoryCleared") {
            setSyncDone(false)
            setSyncProgress({ completed: 0, total: 0 })
        }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
}, [])
```

### Start Sync Handler

```typescript
const handleStartSync = (taskIds: string[]) => {
    setIsSyncing(true)
    setSyncDone(false)
    setSyncProgress({ completed: 0, total: taskIds.length })
    setPickerOpen(false)
    vscode.postMessage({ type: "startMemorySync", text: JSON.stringify({ taskIds }) })
}
```

### Clear Memory Handler

```typescript
const handleClearMemory = () => {
    vscode.postMessage({ type: "clearMemory" })
    setClearDialogOpen(false)
}
```

### Dialogs to Render

At the bottom of the memory section, render:
1. `<MemoryChatPicker>` dialog (import from `./MemoryChatPicker`)
2. `<AlertDialog>` for Clear Memory confirmation

### Important

- Import `Loader2` from `lucide-react`
- Import `Button` from UI components
- Import `AlertDialog` etc. from UI components
- `taskHistory` is available from `useExtensionState()`
- All existing config inputs still bind to `cachedState` (don't change them)
- Import `vscode` from `@src/utils/vscode`

Commit: `feat(memory): add prior chat sync UI with progress bar and clear memory`
Use `--no-verify` on commits.
