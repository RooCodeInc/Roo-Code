---
name: memory-chat-picker-ui
description: Build the MemoryChatPicker dialog component for selecting prior chats to analyze. A scrollable checklist of past conversations with Select All, selection count, and Learn button.
---

You build the chat picker dialog for the prior chat sync feature.

## Spec

Read: `docs/superpowers/specs/2026-03-22-memory-sync-and-provider-fix.md`

## Your Task

Create `webview-ui/src/components/settings/MemoryChatPicker.tsx`

### Component

A Radix `Dialog` containing a scrollable list of prior chats with checkboxes.

```typescript
interface MemoryChatPickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    taskHistory: Array<{ id: string; task: string; ts: number }>
    onStartSync: (taskIds: string[]) => void
    isSyncing: boolean
}
```

### Layout

```
┌─────────────────────────────────────────┐
│  Select Chats to Analyze        [X]    │
│─────────────────────────────────────────│
│  ☑ Select All    12 of 47 selected     │
│─────────────────────────────────────────│
│  ☑ Fix the auth bug in login...        │
│    2 hours ago                          │
│  ☑ Add dark mode to settings...        │
│    Yesterday                            │
│  ☐ Update deps and run tests...        │
│    3 days ago                           │
│  ☐ Refactor the API layer...           │
│    Last week                            │
│  ... (scrollable)                       │
│─────────────────────────────────────────│
│  [Cancel]              [Learn]          │
└─────────────────────────────────────────┘
```

### Patterns to Follow

- Use `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` from `webview-ui/src/components/ui/dialog.tsx`
- Use `Checkbox` from `webview-ui/src/components/ui/checkbox.tsx`
- Use `Button` with `variant="primary"` for Learn, `variant="secondary"` for Cancel
- Follow the selection pattern from `webview-ui/src/components/history/HistoryView.tsx` (lines 229-250) — `selectedTaskIds` state array, `toggleSelectAll` handler
- Use `formatTimeAgo` from existing utils if available, or compute relative time
- Style with VS Code CSS vars (`--vscode-input-background`, etc.)
- Scrollable area: `max-h-[400px] overflow-y-auto`
- Disable Learn button when `isSyncing` or no chats selected

### State

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

const toggleItem = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
        const next = new Set(prev)
        checked ? next.add(id) : next.delete(id)
        return next
    })
}

const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(taskHistory.map(t => t.id)) : new Set())
}
```

Commit: `feat(memory): add MemoryChatPicker dialog component`
Use `--no-verify` on commits.
