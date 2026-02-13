---
"roo-cline": minor
---

Add per-workspace indexing opt-in and stop/cancel indexing controls

- **Per-workspace indexing opt-in**: Indexing no longer auto-starts on every workspace. A new `codeIndexWorkspaceEnabled` flag (stored in `workspaceState`, default: false) requires users to explicitly enable indexing per workspace via a toggle in the CodeIndex popover. The choice is remembered across sessions.
- **Stop/cancel indexing**: Users can stop an in-progress indexing operation via a "Stop Indexing" button. Uses `AbortController`/`AbortSignal` threaded through the orchestrator → scanner pipeline with graceful abort at file and batch boundaries.
- **Disable toggle bug fix**: Unchecking "Enable Codebase Indexing" during active indexing now properly stops the scan via `stopIndexing()` instead of only calling `stopWatcher()`, which left the scanner running asynchronously.
