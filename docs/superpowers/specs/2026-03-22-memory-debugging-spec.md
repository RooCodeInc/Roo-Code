# Memory System Debugging Spec

## Confirmed: Memory Pipeline Works

The memory database has **38 entries, 41 analysis runs, 137 reinforcements**. The prompt compiler generates a 4,519-char user profile. The data is real and rich.

## Bug 1: System Prompt Not Showing Memory Profile

**Symptom:** The compiled USER PROFILE & PREFERENCES section is not appearing in the system prompt even though the database has entries and the compiler generates valid output.

**Investigation areas:**
1. `Task.ts:3955-3957`: Does `provider.getMemoryOrchestrator()` return a valid orchestrator?
2. Does `memoryOrchestrator.getUserProfileSection()` return non-empty string?
3. Is the `userProfileSection` parameter actually being passed to `SYSTEM_PROMPT()`?
4. In `system.ts:96`: Is `${userProfileSection || ""}` rendering correctly?
5. Is `generatePrompt()` being called with the right number of arguments (the new parameter at the end)?
6. Is the system prompt regenerated after memory is populated, or is it cached?
7. Is there a timing issue — the prompt is generated before the memory DB is loaded?
8. Check `generateSystemPrompt.ts` (the preview function) — it does NOT pass userProfileSection, so the preview will never show it. But the live chat should via Task.ts.

## Bug 2: Progress Bar Resets When Leaving Memory Tab

**Symptom:** Navigating away from the Memory settings tab and back causes the progress to disappear. Starting a new sync while the old one runs causes the two to fight.

**Root cause:** React state (`isSyncing`, `syncProgress`) lives in the SettingsView component which unmounts when switching tabs. The backend continues running but the frontend loses track.

**Fix approach:**
1. Move sync state to the extension host (globalState or a dedicated state object)
2. On webview mount, request current sync status from extension host
3. Extension host tracks: `memorySyncInProgress`, `memorySyncProgress`, `memorySyncTotal`
4. When SettingsView mounts, it requests status and restores the progress bar
5. Guard against concurrent syncs — if a sync is running, reject new startMemorySync requests

**New message types needed:**
- WebviewMessage: `"getMemorySyncStatus"` — request current sync state
- ExtensionMessage: `"memorySyncStatus"` — response with `{ inProgress, completed, total }`

## Bug 3: Concurrent Sync Conflict

**Symptom:** Starting a second sync while the first is running causes interleaved progress updates.

**Fix:** Add a `syncInProgress` flag to the orchestrator. If `batchAnalyzeHistory` is called while one is already running, either:
- Option A: Reject with a status message ("Sync already in progress")
- Option B: Queue the new task IDs and process them after the current batch

Option A is simpler and correct — the user should wait for the current sync to finish.

## Files to Modify

| File | Changes |
|---|---|
| `src/core/memory/orchestrator.ts` | Add `syncInProgress` guard, `getSyncStatus()` method |
| `src/core/task/Task.ts` | Debug/verify the `userProfileSection` flow |
| `src/core/prompts/system.ts` | Verify the template injection |
| `src/core/webview/webviewMessageHandler.ts` | Add `getMemorySyncStatus` handler, guard concurrent syncs |
| `packages/types/src/vscode-extension-host.ts` | Add `getMemorySyncStatus`, `memorySyncStatus` message types |
| `webview-ui/src/components/settings/SettingsView.tsx` | Request sync status on mount, show persistent progress |
| `src/core/webview/generateSystemPrompt.ts` | Add userProfileSection for preview |
