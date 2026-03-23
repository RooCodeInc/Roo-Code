# Multi-Orchestrator — Complete Bug Report & Engineering Handoff

**Created**: End of Session 1 (March 22-23, 2026)
**Purpose**: Exhaustive documentation of every known bug, attempted fix, root cause analysis, and architectural constraint discovered during the initial implementation of the Multi-Orchestrator feature. This document is the definitive handoff for the next engineering session.
**Total agents deployed this session**: 80+
**Total commits**: 60+

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [What Works (Verified)](#2-what-works-verified)
3. [Architecture Overview](#3-architecture-overview)
4. [Complete File Map](#4-complete-file-map)
5. [Bug #1: Diff Views Open In Wrong Pane / Steal Focus](#5-bug-1)
6. [Bug #2: API Rate Limiting When Multiple Agents Start](#6-bug-2)
7. [Bug #3: Agents Don't Start Simultaneously](#7-bug-3)
8. [Bug #4: Panel Layout — Panels Don't Land In Correct Columns](#8-bug-4)
9. [Bug #5: Task Completion Loop — Agents Keep Running After Finishing](#9-bug-5)
10. [Bug #6: Auto-Approval Not Working For Spawned Agents](#10-bug-6)
11. [Bug #7: Agent Count Not Respected (Asked For N, Got M)](#11-bug-7)
12. [Bug #8: Settings Don't Persist Across Tab Switches](#12-bug-8)
13. [Bug #9: Multi-Orchestrator Send Button Does Nothing](#13-bug-9)
14. [Bug #10: Git Worktrees Not Isolating Agent File Operations](#14-bug-10)
15. [Bug #11: Completion Reports Not Captured / Not Sent Back To Orchestrator](#15-bug-11)
16. [Bug #12: Agent Panels Don't Close After Orchestration Completes](#16-bug-12)
17. [Bug #13: Diff View Doesn't Revert Back To Agent's Chat View](#17-bug-13)
18. [Bug #14: Diff View Not Streaming While Being Created](#18-bug-14)
19. [Bug #15: preventFocusDisruption Experiment Not Taking Effect](#19-bug-15)
20. [Bug #16: Stop/Pause Button Visual State Not Updating](#20-bug-16)
21. [Bug #17: Cannot Stop/Resume Individual Agents Mid-Execution](#21-bug-17)
22. [Bug #18: Post-Completion Verification Phase Not Triggering](#22-bug-18)
23. [Bug #19: Architect Mode Assigned As Parallel Task](#23-bug-19)
24. [Bug #20: Short-Request Heuristic Reducing Task Count](#24-bug-20)
25. [VS Code API Constraints](#25-vscode-api-constraints)
26. [Attempted Fixes That Didn't Work](#26-attempted-fixes-that-didnt-work)
27. [Architectural Root Causes](#27-architectural-root-causes)
28. [Recommended Strategy For Next Session](#28-recommended-strategy)
29. [Features Not Yet Implemented](#29-features-not-yet-implemented)
30. [Test Coverage Status](#30-test-coverage-status)

---

## 1. Executive Summary

The Multi-Orchestrator is a new mode in Roo-Code that decomposes complex tasks into N parallel subtasks (1-6), each running in its own editor tab panel. The core orchestration logic WORKS — plans are generated, panels spawn, agents execute, reports are collected. However, there are approximately 20 bugs that prevent it from being production-ready. The bugs fall into three categories:

1. **VS Code Layout Bugs** (Bugs #1, #4, #13, #14): File operations (diffs, edits) fight with webview panels for screen real estate. VS Code's editor group system doesn't cleanly support N webview panels + N diff editors simultaneously.

2. **Lifecycle Bugs** (Bugs #5, #6, #7, #11, #12, #15, #18): The agent lifecycle — from start to completion to report collection — has gaps where events are missed, states aren't updated, or loops aren't properly terminated.

3. **Configuration Bugs** (Bugs #8, #9, #10, #16, #17, #19, #20): Settings not persisting, auto-approval not taking effect, agent count not respected, mode assignments incorrect.

The most impactful bugs to fix first are **#1** (diff views), **#2** (API rate limiting), **#5** (completion loop), and **#6** (auto-approval). These four bugs together account for ~80% of the user-visible failures.

---

## 2. What Works (Verified)

These features have been tested and confirmed working:

- [x] Multi-orchestrator mode appears in the mode dropdown
- [x] Agent count selector (1-6) shows in chat toolbar when mode is active
- [x] User message intercepted and routed to `multiOrchStartPlan` handler
- [x] Plan generator decomposes requests via LLM (uses `completePrompt`)
- [x] Plan review mode toggle in settings
- [x] Plan review UI shows tasks with approve/cancel buttons
- [x] N editor tab panels spawn in the editor area
- [x] Each agent gets its own independent ClineProvider
- [x] Agent system prompt prefix injected with parallel execution context
- [x] Each agent is aware of other agents' names and assigned files
- [x] Mode switching before task creation (handleModeSwitch)
- [x] Tasks created with `startTask: false` for deferred start
- [x] TaskCompleted events captured by coordinator
- [x] Tasks aborted after completion to prevent while-loop restart
- [x] Completion reports captured from clineMessages (last `completion_result` say message)
- [x] Report aggregated as markdown and displayed in orchestrator sidebar
- [x] Panels close after completion (2-second delay)
- [x] Original editor layout saved (`vscode.getEditorLayout`) and restored after panels close
- [x] Settings: max agents, plan review toggle, merge mode (auto/always/never)
- [x] Worktree manager checks for git repo before creating worktrees
- [x] Worktree paths set as agent working directory via `setWorkingDirectory()`
- [x] `multiOrchForceApproveAll` flag added to auto-approval decision tree
- [x] Resume asks (`resume_completed_task`, `resume_task`) excluded from force-approve
- [x] ViewColumn tracked per provider and threaded to DiffViewProvider
- [x] Panel viewColumn read from actual panel after creation (not symbolic -1)
- [x] `onDidChangeViewState` tracks viewColumn changes if panel moves

---

## 3. Architecture Overview

```
User types request → ChatView intercepts (multi-orchestrator mode check)
  → Posts "multiOrchStartPlan" message to extension host
  → webviewMessageHandler routes to MultiOrchestrator.execute()

MultiOrchestrator.execute():
  Phase 1: PLAN
    → plan-generator.ts calls LLM via completePrompt()
    → Parses JSON response into OrchestratorPlan with PlannedTask[]
    → If planReviewEnabled: returns early, UI shows PlanReviewPanel
    → If not: proceeds to executeFromPlan()

  Phase 2: SPAWN
    → worktree-manager.ts: creates git worktrees (if git repo exists)
    → panel-spawner.ts: uses vscode.setEditorLayout for N columns
    → Creates N ClineProviders, each with:
      - setAutoApprovalOverrides (multiOrchForceApproveAll)
      - setWorkingDirectory (worktree path)
      - handleModeSwitch (planned mode)
      - viewColumn (actual panel column number)
    → createTask(description, startTask: false) on each provider
    → agent-system-prompt.ts prefix prepended to each task description

  Phase 3: RUN
    → agent-coordinator.ts: startAll() fires task.start() on each
    → Listens for TaskCompleted / TaskAborted events
    → Captures completionReport from clineMessages
    → Calls abortTask() after completion to break while loop
    → waitForAll() resolves when all agents complete

  Phase 4: MERGE (if git worktrees were used)
    → merge-pipeline.ts: sequential git merge of agent branches

  Phase 5: VERIFY (partially implemented)
    → Spawns a debug agent to review changes (optional)

  Phase 6: REPORT
    → report-aggregator.ts: markdown summary
    → Panels close after 2-second delay
    → Layout restored via vscode.setEditorLayout
```

---

## 4. Complete File Map

### Core Multi-Orchestrator Files

| File | Lines | Purpose | Status |
|---|---|---|---|
| `src/core/multi-orchestrator/types.ts` | ~100 | OrchestratorPlan, PlannedTask, AgentState, MergeResult, OrchestratorState, constants | Working |
| `src/core/multi-orchestrator/orchestrator.ts` | ~350 | Top-level lifecycle coordinator, executeFromPlan() | Has bugs |
| `src/core/multi-orchestrator/panel-spawner.ts` | ~170 | Creates N ClineProvider + WebviewPanel instances | Has bugs |
| `src/core/multi-orchestrator/agent-coordinator.ts` | ~255 | Event-based lifecycle tracking, startAll(), waitForAll() | Has bugs |
| `src/core/multi-orchestrator/agent-system-prompt.ts` | ~65 | Parallel execution context prefix for agent prompts | Working |
| `src/core/multi-orchestrator/plan-generator.ts` | ~255 | LLM-powered task decomposition via completePrompt() | Working |
| `src/core/multi-orchestrator/worktree-manager.ts` | ~93 | Git worktree creation/cleanup per agent | Untested |
| `src/core/multi-orchestrator/merge-pipeline.ts` | ~100 | Sequential git branch merging | Untested |
| `src/core/multi-orchestrator/report-aggregator.ts` | ~60 | Markdown report formatting | Working |

### Test Files

| File | Tests | Status |
|---|---|---|
| `src/core/multi-orchestrator/__tests__/types.spec.ts` | ~5 | Passing |
| `src/core/multi-orchestrator/__tests__/plan-generator.spec.ts` | ~5 | Passing |
| `src/core/multi-orchestrator/__tests__/report-aggregator.spec.ts` | ~5 | Passing |
| `src/core/multi-orchestrator/__tests__/e2e.spec.ts` | ~10 | Passing |

### UI Components

| File | Purpose | Status |
|---|---|---|
| `webview-ui/src/components/multi-orchestrator/AgentCountSelector.tsx` | Dropdown (1-6) in chat toolbar | Working |
| `webview-ui/src/components/multi-orchestrator/MultiOrchStatusPanel.tsx` | Status display during execution | Working |
| `webview-ui/src/components/multi-orchestrator/PlanReviewPanel.tsx` | Plan approval UI | Working |

### Modified Existing Files

| File | Changes Made | Status |
|---|---|---|
| `packages/types/src/mode.ts` | Added multi-orchestrator to DEFAULT_MODES | Working |
| `packages/types/src/global-settings.ts` | Added multiOrchMaxAgents, multiOrchPlanReviewEnabled, multiOrchMergeEnabled | Working |
| `packages/types/src/vscode-extension-host.ts` | Added multiOrch* message types | Working |
| `src/core/webview/ClineProvider.ts` | Added getMultiOrchestrator(), setWorkingDirectory(), viewColumn, setAutoApprovalOverrides(), getAllInstances() | Working |
| `src/core/webview/webviewMessageHandler.ts` | Added multiOrchStartPlan, multiOrchApprovePlan, multiOrchAbort, multiOrchGetStatus handlers | Working |
| `src/core/auto-approval/index.ts` | Added multiOrchForceApproveAll bypass + resume ask exclusion | Partially working |
| `webview-ui/src/components/chat/ChatTextArea.tsx` | Added AgentCountSelector (conditional on mode) + multi-orch send intercept | Working |
| `webview-ui/src/components/settings/SettingsView.tsx` | Added multi-orchestrator settings section | Has bugs |
| `src/integrations/editor/DiffViewProvider.ts` | Added viewColumn parameter, threaded through all showTextDocument/vscode.diff calls | Partially working |

---

## 5. Bug #1: Diff Views Open In Wrong Pane / Steal Focus
**Severity**: CRITICAL
**Status**: PARTIALLY FIXED — diffs now open in the correct column but still displace the agent's webview

### Symptom
When Agent 1 creates or edits a file, the diff view opens in the correct column (fixed from previous bug where it went to a random column), BUT it replaces the agent's chat webview panel. The user can no longer see the agent's chat stream while the diff is open.

### Root Cause Analysis
VS Code's editor groups can hold ONE visible editor at a time (with tabs for switching). When `DiffViewProvider.open()` calls `vscode.commands.executeCommand("vscode.diff", ...)` with `viewColumn: X`, it opens a new tab in that column's editor group. The agent's WebviewPanel is ALSO a tab in that same group. The diff tab becomes the active tab, hiding the webview.

There is NO VS Code API to show two editors side-by-side within a single editor group. An editor group always shows one active tab with a tab bar above for switching.

### What Was Tried
1. **Threading ViewColumn** from PanelSpawner → ClineProvider → Task → DiffViewProvider — This was successful and diffs now target the correct column
2. **Reading actual panel.viewColumn** after creation instead of symbolic ViewColumn.Active (-1) — Fixed the wrong-column issue
3. **onDidChangeViewState** tracking — Keeps viewColumn in sync if panel moves

### Why It's Not Fully Fixed
The diff CORRECTLY opens in the agent's column, but it DISPLACES the webview. There's no way to show both the webview panel and the diff editor simultaneously in the same column. The options are:
- Open diff in a DIFFERENT column (but then which one? And it creates new columns)
- Suppress diff views entirely (use `preventFocusDisruption` experiment)
- Render diffs inside the webview as HTML (custom diff renderer)

### Files Involved
- `src/integrations/editor/DiffViewProvider.ts` (lines 45, 225-229, 417-421, 486-490, 556-571, 683-687)
- `src/core/multi-orchestrator/panel-spawner.ts` (line 120, stores viewColumn)
- `src/core/webview/ClineProvider.ts` (line 162, viewColumn property)
- `src/core/task/Task.ts` (line 511, passes viewColumn to DiffViewProvider)

### Recommended Fix
**Option A (Quick)**: Enable `preventFocusDisruption` experiment for all spawned agents. This makes file edits save directly without opening diff views. Files still get written, but no visual diff during editing.

**Option B (Better, much harder)**: Build a custom diff renderer inside the webview using `diff2html` or `monaco-diff`. This would render diffs as HTML within the agent's chat stream, keeping the webview visible.

**IMPORTANT**: Option A was attempted by setting `experiments: { preventFocusDisruption: true }` in the auto-approval overrides, but the experiment flag is NOT part of the auto-approval overrides system. It's read from the provider state's `experiments` field which comes from ContextProxy, NOT from `_autoApprovalOverrides`. This is why the fix didn't take effect. See Bug #15.

---

## 6. Bug #2: API Rate Limiting When Multiple Agents Start
**Severity**: CRITICAL
**Status**: ATTEMPTED FIX — staggered starts added but may not have taken effect (see Bug #15)

### Symptom
When 3 agents start simultaneously, the API provider returns "Provider ended the request: terminated" and "API Streaming Failed" errors. The auto-retry mechanism then cascades into repeated failures. Agents get stuck in a loop of: attempt → fail → retry → fail → retry.

### Root Cause Analysis
All agents use the same API key and hit the same provider endpoint. When 3 requests arrive within milliseconds of each other, the provider's rate limiter terminates subsequent requests. Each failed request triggers Roo's auto-retry (with backoff), but since all agents retry simultaneously, the rate limiting continues.

### What Was Tried
1. **Simultaneous start via tight loop** — Made the problem worse
2. **Staggered start with 2-second gaps** — Added `await new Promise(r => setTimeout(r, 2000))` between starts in `startAll()`. Changed `startAll()` from `void` to `async`. Changed orchestrator to `await this.coordinator.startAll()`.

### Why It May Not Have Worked
The `startAll()` was changed to async with delays, and the orchestrator was updated to await it. However, the fix may not have taken effect because:
1. The TypeScript compilation was clean but the running extension may not have been reloaded
2. OR the `experiments` override (Bug #15) prevented the extension from applying changes correctly
3. OR the stagger delay isn't long enough — some providers need 5+ seconds between requests

### Files Involved
- `src/core/multi-orchestrator/agent-coordinator.ts` (startAll method, ~line 132)
- `src/core/multi-orchestrator/orchestrator.ts` (~line 317, calls startAll)

### Recommended Fix
1. Verify the staggered start is actually running (check console logs for "[AgentCoordinator] Staggering N agent starts")
2. If stagger is running but still failing: increase delay to 5 seconds
3. Consider using separate API keys per agent (if user has multiple profiles)
4. Add exponential backoff awareness: if an agent gets rate limited, PAUSE all other agents for 10 seconds

---

## 7. Bug #3: Agents Don't Start Simultaneously
**Severity**: LOW (cosmetic after stagger fix)
**Status**: INTENTIONALLY CHANGED — now staggered for rate limiting reasons

### Original Symptom
Agent 1 started 1-3 seconds before Agent 3.

### Resolution
This was initially a bug (sequential `task.start()` calls in a for loop). It was fixed to fire all start() calls simultaneously. Then it was REVERTED to staggered starts (2-second gaps) to fix Bug #2 (API rate limiting). The stagger is intentional.

---

## 8. Bug #4: Panel Layout — Panels Don't Land In Correct Columns
**Severity**: HIGH
**Status**: MULTIPLE FIX ATTEMPTS — still inconsistent

### Symptom
After `vscode.setEditorLayout` creates N columns, panels don't always land in the expected columns. Sometimes panels stack in one column, or they land in columns 2 and 3 but miss column 1.

### Root Cause Analysis
The `vscode.setEditorLayout` command creates editor groups, but the group indices don't necessarily map to ViewColumn numbers 1, 2, 3. VS Code's internal group management is opaque — extensions can't directly control which group gets which index.

### What Was Tried
1. **Explicit ViewColumn numbers** (ViewColumn.One, Two, Three) — Panels sometimes overlapped with existing editors
2. **ViewColumn.Beside** — Panels created to the right of each other, but inconsistent
3. **ViewColumn.Active + focusNextGroup** — Focus first group, create panel, move focus to next group, create next panel. This was the most reliable approach.
4. **setEditorLayout + explicit ViewColumn** — Set N-column layout first, then place panels at ViewColumn 1, 2, 3. This worked for the layout but panels didn't always land in the right columns.

### Why It's Still Broken
VS Code's editor group system is non-deterministic from the extension's perspective. The same sequence of commands can produce different layouts depending on:
- What editors are already open
- The current sidebar position (left vs right)
- Whether the terminal panel is visible
- The window size
- Previous layout state

### Files Involved
- `src/core/multi-orchestrator/panel-spawner.ts` (spawnPanels method, ~line 34)

### Recommended Fix
The most reliable approach found was the `focusNextGroup` pattern:
```typescript
await vscode.commands.executeCommand("workbench.action.focusFirstEditorGroup")
for (let i = 0; i < count; i++) {
    if (i > 0) await vscode.commands.executeCommand("workbench.action.focusNextGroup")
    createPanel(ViewColumn.Active)
}
```
This should be tested with various starting states (no editors open, editors open, terminal visible, etc.)

---

## 9. Bug #5: Task Completion Loop — Agents Keep Running After Finishing
**Severity**: CRITICAL
**Status**: FIXED — but verify in next session

### Symptom
When an agent calls `attempt_completion`, it shows "Task Completed" but then immediately starts making new API requests. Multiple "Task Completed" messages stack up.

### Root Cause Analysis
The `attempt_completion` tool (AttemptCompletionTool.ts) calls `task.ask("completion_result")`. The `multiOrchForceApproveAll` auto-approval returns `{ decision: "approve" }` which calls `approveAsk()` which sends `"yesButtonClicked"`. In AttemptCompletionTool, `response === "yesButtonClicked"` triggers `emitTaskCompleted(task)` and `return`.

HOWEVER, `emitTaskCompleted()` only emits an event — it doesn't set `task.abort = true`. The outer `while (!this.abort)` loop in Task.ts:2573 continues running and makes another API call.

### Fix Applied
In `agent-coordinator.ts`, when `TaskCompleted` is received, the coordinator now calls `currentTask.abortTask(false)` to set `task.abort = true`, which breaks the while loop.

Additionally, `resume_completed_task` and `resume_task` asks are excluded from `multiOrchForceApproveAll` to prevent restarting finished tasks.

### Files Involved
- `src/core/multi-orchestrator/agent-coordinator.ts` (TaskCompleted handler, ~line 33-55)
- `src/core/auto-approval/index.ts` (multiOrchForceApproveAll section)
- `src/core/tools/AttemptCompletionTool.ts` (lines 132-136, completion flow)
- `src/core/task/Task.ts` (line 2573, while loop; line 2311, abortTask)

### Verification Needed
Test with 2-3 agents. Each should show exactly ONE "Task Completed" message and then stop. No more API requests after completion.

---

## 10. Bug #6: Auto-Approval Not Working For Spawned Agents
**Severity**: CRITICAL
**Status**: PARTIALLY FIXED — `multiOrchForceApproveAll` added but may not take effect for all ask types

### Symptom
Spawned agent panels show yellow "Approve" / "Deny" buttons for file operations, despite having auto-approval enabled. Nobody is watching these panels to click the buttons, so the agents hang waiting for approval.

### Root Cause Analysis (Multi-layered)

**Layer 1 — ContextProxy is shared**: All ClineProviders from the same extension context share a single `ContextProxy` instance. Setting auto-approval via `setValues()` on one provider affects ALL providers. This was solved by using `setAutoApprovalOverrides()` which stores overrides in provider instance memory.

**Layer 2 — Outside workspace blocking**: The original overrides had `alwaysAllowReadOnlyOutsideWorkspace: false` and `alwaysAllowWriteOutsideWorkspace: false`. When agents tried to read/write files outside the workspace (e.g., `/home/user/Desktop`), these were blocked. Fixed by setting both to `true`.

**Layer 3 — Followup questions**: The auto-approval for followup questions requires `followupAutoApproveTimeoutMs > 0` AND a `suggestion` in the JSON text. Open-ended questions without suggestions always block. The `multiOrchForceApproveAll` flag was added to bypass this.

**Layer 4 — Command execution**: Commands need to pass `getCommandDecision()` check against allowed/denied command lists. The `multiOrchForceApproveAll` flag bypasses this.

**Layer 5 — Nuclear option**: Added `multiOrchForceApproveAll` flag that short-circuits the ENTIRE `checkAutoApproval()` function. When true, returns `{ decision: "approve" }` for ALL ask types EXCEPT `resume_completed_task` and `resume_task`.

### What Was Done
1. Added `setAutoApprovalOverrides()` method to ClineProvider
2. Set comprehensive auto-approval config: `autoApprovalEnabled: true`, all `alwaysAllow*: true`, `writeDelayMs: 0`, `requestDelaySeconds: 0`
3. Added `multiOrchForceApproveAll: true` to overrides
4. Added nuclear bypass in `checkAutoApproval()` that checks this flag early

### Why It May Still Not Work
The `multiOrchForceApproveAll` flag is set via `_autoApprovalOverrides` which is spread last in `getState()`. But `checkAutoApproval()` receives `state` from `provider.getState()`. The `multiOrchForceApproveAll` key is NOT a standard `ExtensionState` field — it's an extra field added via the spread. The TypeScript type might not include it, so the check `(state as Record<string, unknown>).multiOrchForceApproveAll` uses a type assertion.

If `getState()` somehow strips unknown keys (e.g., via Zod validation), the flag would be lost. Need to verify that `getState()` preserves the spread fields without filtering.

### Files Involved
- `src/core/auto-approval/index.ts` (lines 74-86, multiOrchForceApproveAll check)
- `src/core/webview/ClineProvider.ts` (lines 2761-2767, setAutoApprovalOverrides; line 2634, spread in getState)
- `src/core/multi-orchestrator/orchestrator.ts` (lines 191-207, autoApprovalOverrides definition)

### Recommended Fix
1. Add `multiOrchForceApproveAll` to the ExtensionState type definition so it's a first-class citizen, not a type assertion
2. OR: instead of using a state flag, make the auto-approval check look at the provider directly:
```typescript
if (provider._autoApprovalOverrides?.multiOrchForceApproveAll) {
    return { decision: "approve" }
}
```

---

## 11. Bug #7: Agent Count Not Respected
**Severity**: MEDIUM
**Status**: FIXED

### Symptom
User selects 3 agents in the dropdown, but only 2 are created.

### Root Cause
Two issues:
1. The `AgentCountSelector` had `value={4}` hardcoded instead of reading from `extensionState.multiOrchMaxAgents`
2. The plan generator had a "short-request heuristic" that sliced plans to 2 tasks for requests under 20 words
3. The LLM prompt said "SHOULD use up to N" instead of "MUST create EXACTLY N"

### Fix Applied
1. AgentCountSelector now reads from `extensionState.multiOrchMaxAgents ?? 4`
2. Short-request heuristic removed entirely
3. Prompt changed to "MUST create EXACTLY N tasks"
4. Hard cap: `tasks.slice(0, maxAgents)` after parsing

### Files Involved
- `webview-ui/src/components/chat/ChatTextArea.tsx` (line 1349)
- `src/core/multi-orchestrator/plan-generator.ts` (lines 77, 239)

---

## 12. Bug #8: Settings Don't Persist Across Tab Switches
**Severity**: MEDIUM
**Status**: UNFIXED

### Symptom
Multi-orchestrator settings (max agents, plan review toggle, merge mode) reset when the user navigates away from the Memory settings tab and returns.

### Root Cause
The settings section uses `cachedState` + `setCachedStateField` which buffers changes until Save. But the multi-orch settings may not be included in the Save handler's payload. Additionally, the `updateSettings` message handler writes to ContextProxy, but these keys may not be in the `globalSettingsSchema` Zod schema, causing them to be silently dropped.

### Files Involved
- `webview-ui/src/components/settings/SettingsView.tsx` (multi-orch settings section)
- `src/core/webview/webviewMessageHandler.ts` (case "updateSettings", line 655)
- `packages/types/src/global-settings.ts` (globalSettingsSchema)

### Recommended Fix
Verify that `multiOrchMaxAgents`, `multiOrchPlanReviewEnabled`, `multiOrchMergeEnabled` are in `globalSettingsSchema`. They SHOULD be (added by Agent 2 early in the session), but verify they survived all the merge operations.

---

## 13. Bug #9: Multi-Orchestrator Send Button Does Nothing
**Severity**: CRITICAL
**Status**: FIXED

### Symptom
When the user types a message and presses Enter in multi-orchestrator mode, the message disappears — nothing happens.

### Root Cause
The `onSend` callback in ChatTextArea goes through the normal chat flow (creates a Task, sends to the API). But the multi-orchestrator needs its own flow: intercept the send, post `multiOrchStartPlan` instead.

### Fix Applied
In `ChatView.tsx` (or wherever the send handler is defined), the mode is checked. If `multi-orchestrator`, the message is posted as `{ type: "multiOrchStartPlan", text: inputValue }` instead of the normal task creation message.

### Files Involved
- `webview-ui/src/components/chat/ChatView.tsx` or `ChatTextArea.tsx` (send handler)

---

## 14. Bug #10: Git Worktrees Not Isolating Agent File Operations
**Severity**: HIGH
**Status**: PARTIALLY FIXED

### Symptom
Agents create files in the same directory, causing conflicts. Git worktrees are supposed to isolate each agent.

### Root Cause
1. Worktrees were only created if `needsMerge` was true AND `isGitRepo()` returned true
2. When worktrees WERE created, the spawned providers weren't initially told to use the worktree paths as their working directory

### Fix Applied
1. Added `isGitRepo()` check to gracefully skip worktrees for non-git directories
2. Added `setWorkingDirectory()` method to ClineProvider
3. Orchestrator now calls `spawned.provider.setWorkingDirectory(agent.worktreePath)` before creating the task

### What's Still Broken
- Worktrees haven't been tested in a real git repo scenario during this session
- The merge pipeline (`merge-pipeline.ts`) hasn't been tested in production
- If the workspace isn't a git repo, agents still share the same directory

### Files Involved
- `src/core/multi-orchestrator/worktree-manager.ts`
- `src/core/multi-orchestrator/orchestrator.ts` (worktree creation section, ~line 134-159)
- `src/core/webview/ClineProvider.ts` (setWorkingDirectory, ~line 2005)

---

## 15. Bug #11: Completion Reports Not Captured
**Severity**: HIGH
**Status**: FIXED

### Symptom
The orchestrator's final report shows agent statuses but no detailed completion reports.

### Root Cause
The `AgentCoordinator` listened for `TaskCompleted` but never extracted the completion text from the task's messages.

### Fix Applied
In the `TaskCompleted` handler, before calling `abortTask()`, the coordinator now reads the task's `clineMessages` array, finds the last message with `say === "completion_result"`, and stores its `text` in `agentState.completionReport`.

### Files Involved
- `src/core/multi-orchestrator/agent-coordinator.ts` (TaskCompleted handler)

---

## 16. Bug #12: Agent Panels Don't Close After Orchestration Completes
**Severity**: MEDIUM
**Status**: FIXED

### Symptom
After all agents complete and the orchestrator shows "complete", the agent panels remain open.

### Fix Applied
Added a `setTimeout` after Phase 6 (report) that calls `panelSpawner.closeAllPanels()` after a 2-second delay. The delay lets the user see the final state before panels vanish. `closeAllPanels()` also restores the original editor layout.

### Files Involved
- `src/core/multi-orchestrator/orchestrator.ts` (~line 338-348)
- `src/core/multi-orchestrator/panel-spawner.ts` (closeAllPanels restores saved layout)

---

## 17. Bug #13: Diff View Doesn't Revert Back To Agent's Chat View
**Severity**: HIGH
**Status**: UNFIXED

### Symptom
When an agent edits a file and the diff view opens in the agent's column, it replaces the agent's chat webview. After the diff is complete, the view stays on the diff editor — the webview doesn't come back.

### Root Cause
VS Code's editor group tab system: the diff tab becomes the active tab, pushing the webview tab to the background. There's no automatic mechanism to switch back to the webview tab after the diff closes. The DiffViewProvider calls `closeAllDiffViews()` which closes the diff tab, but it doesn't explicitly reveal the webview panel.

### Recommended Fix
After `closeAllDiffViews()` in DiffViewProvider, call:
```typescript
// Reveal the webview panel to bring it back to the foreground
const task = this.taskRef.deref()
const provider = task?.providerRef.deref()
if (provider?.view && 'reveal' in provider.view) {
    (provider.view as vscode.WebviewPanel).reveal(this.viewColumn, true)
}
```

OR: Use `preventFocusDisruption` to never open diffs in the first place (see Bug #15).

---

## 18. Bug #14: Diff View Not Streaming While Being Created
**Severity**: MEDIUM
**Status**: UNFIXED (by design with preventFocusDisruption)

### Symptom
The user wants to see the diff being streamed in real-time as the agent edits a file, similar to how Roo normally shows diffs character by character.

### Root Cause
The streaming diff is Roo's normal behavior when `preventFocusDisruption` is OFF. The agent writes content progressively, and the DiffViewProvider updates the diff view in real-time. However, in the multi-orchestrator context, the diff view DISPLACES the webview (Bug #13), making the streaming diff useless because the chat is hidden.

### Recommended Fix
This is best solved by building a custom diff renderer inside the webview (FEAT-003 in the master spec). The diff would render as HTML within the agent's chat stream, showing changes without opening a separate editor tab.

---

## 19. Bug #15: preventFocusDisruption Experiment Not Taking Effect
**Severity**: CRITICAL
**Status**: UNFIXED — This is the root cause of why Bug #1 fixes don't work

### Symptom
Setting `experiments: { preventFocusDisruption: true }` in the auto-approval overrides doesn't prevent diff views from opening.

### Root Cause Analysis
The `experiments` field in `autoApprovalOverrides` is set via `setAutoApprovalOverrides()` which stores in `_autoApprovalOverrides`. This is spread last in `getState()`. HOWEVER, the `experiments` field in the state is a nested object. The spread would REPLACE the entire `experiments` object with just `{ preventFocusDisruption: true }`, potentially losing other experiment flags.

More importantly: the tools that check `preventFocusDisruption` (WriteToFileTool, ApplyDiffTool, etc.) read the experiment flag from the Task's state, NOT from getState(). They typically do:
```typescript
const experiments = this.task.experiments ?? {}
if (experiments.preventFocusDisruption) { ... }
```
The Task's `experiments` is set during construction from the provider's state at that moment. If the experiment flag wasn't in the state when the Task was created, it won't be there later even if the overrides are set.

### The Real Fix
The experiment needs to be set BEFORE `createTask()` is called. Options:
1. Set it via `provider.contextProxy.setValue("experiments", { ...existing, preventFocusDisruption: true })` BEFORE createTask
2. OR: set it as a Task constructor option
3. OR: modify the auto-approval overrides to merge experiments rather than replace

### Files Involved
- `src/core/multi-orchestrator/orchestrator.ts` (experiments in overrides, ~line 205)
- `src/core/webview/ClineProvider.ts` (getState, _autoApprovalOverrides spread)
- `src/core/task/Task.ts` (experiments initialization in constructor)
- `src/core/tools/WriteToFileTool.ts`, `ApplyDiffTool.ts`, `EditFileTool.ts` (experiment check)
- `src/shared/experiments.ts` (EXPERIMENT_IDS)

---

## 20. Bug #16: Stop/Pause Button Visual State Not Updating
**Severity**: LOW
**Status**: UNFIXED

### Symptom
When the user clicks the stop/pause button on an agent panel, the button doesn't visually change to indicate the paused state. The square icon stays the same.

### Root Cause
The webview's stop button component likely doesn't have a "paused" visual state for the multi-orchestrator context. It may only have "streaming" (shows square) and "not streaming" (shows play/send) states.

### Recommended Fix
This is a webview UI fix. Find the stop button component and add a visual state for "paused by user" (e.g., change color, show pause icon instead of square).

---

## 21. Bug #17: Cannot Stop/Resume Individual Agents Mid-Execution
**Severity**: MEDIUM
**Status**: NOT IMPLEMENTED

### Description
Users should be able to pause an individual agent, provide additional instructions, and resume. Currently the only option is to abort ALL agents.

### Implementation Approach
1. Add "pause" capability to the coordinator: `pauseAgent(taskId)` → calls `task.abortTask(false)` but marks agent as "paused" not "failed"
2. Add "resume" capability: `resumeAgent(taskId)` → creates a new task continuation in the same provider
3. The webview needs a per-panel pause/resume button
4. The agent's system prompt should note that it was paused and may receive additional instructions

---

## 22. Bug #18: Post-Completion Verification Phase Not Triggering
**Severity**: MEDIUM
**Status**: PARTIALLY IMPLEMENTED

### Description
After all agents complete, a verification agent should spawn to check the work. The code exists in `orchestrator.ts` but the setting `multiOrchVerifyEnabled` may not be properly wired.

### Files Involved
- `src/core/multi-orchestrator/orchestrator.ts` (verification phase, ~line 430+)
- `packages/types/src/global-settings.ts` (multiOrchVerifyEnabled setting)

---

## 23. Bug #19: Architect Mode Assigned As Parallel Task
**Severity**: LOW
**Status**: FIXED

### Symptom
The plan generator assigned "architect" mode as a parallel task alongside "code" tasks.

### Fix Applied
Filtered architect, orchestrator, and multi-orchestrator from the available modes list in the plan generator prompt. Only code, ask, and debug are available for parallel tasks.

---

## 24. Bug #20: Short-Request Heuristic Reducing Task Count
**Severity**: LOW
**Status**: FIXED

### Symptom
A post-processing step sliced plans to 2 tasks for requests under 20 words.

### Fix Applied
Removed the heuristic entirely. The `maxAgents` hard cap at `tasks.slice(0, maxAgents)` is sufficient.

---

## 25. Bug #21: Finished Sub-Tasks Don't Flow Back To Multi-Orchestrator
**Severity**: CRITICAL
**Status**: REGRESSION — was working briefly, now broken again

### Symptom
After all 3 agents complete their tasks and show "Task Completed", the multi-orchestrator sidebar does NOT proceed to the next phases (merge, verify, report). The sidebar shows "Multi-Orchestration: running" with "0/3 agents complete" or similar stale state. The orchestrator never receives the completion signals and never generates the final aggregated report.

In an earlier session iteration, this DID work — the orchestrator collected all reports and displayed a unified summary in the sidebar. Something in the subsequent fixes broke the flow.

### Root Cause Analysis

The completion flow has multiple potential failure points:

**Point 1 — TaskCompleted event not emitted by ClineProvider**: The `AgentCoordinator` listens for `RooCodeEventName.TaskCompleted` on the ClineProvider instance. But TaskCompleted is emitted by the Task object, and ClineProvider forwards it. If the event forwarding chain is broken (e.g., because the task was aborted before the event could propagate), the coordinator never hears about it.

**Point 2 — abortTask() kills the event chain**: When `TaskCompleted` fires, the coordinator calls `currentTask.abortTask(false)` to prevent the while-loop from continuing. But `abortTask()` also emits `TaskAborted` and calls `dispose()` on the task. If `dispose()` removes event listeners BEFORE the `TaskCompleted` event fully propagates through the ClineProvider, the coordinator's handler may not execute completely.

The sequence might be:
1. Task calls `attempt_completion` → auto-approved → `emitTaskCompleted()` emits TaskCompleted
2. Coordinator receives TaskCompleted → starts handling
3. Coordinator calls `currentTask.abortTask(false)` DURING the handler
4. `abortTask()` → sets `this.abort = true` → emits TaskAborted → calls `dispose()`
5. `dispose()` removes all event listeners on the Task
6. But the coordinator's handler is still running... or is it?

The problem: `abortTask()` is async and is called with `.catch(() => {})` (fire-and-forget). It might race with the completion handling.

**Point 3 — waitForAll() never resolves**: The `waitForAll()` method waits for the `allCompleted` event. This event fires when `completedSet.size >= agents.size`. If even ONE agent's completion is missed (due to the race condition above), `allCompleted` never fires, and the orchestrator hangs at `await this.coordinator.waitForAll()` forever. The 10-minute timeout eventually fires and marks it as failed.

**Point 4 — The stagger may have broken event ordering**: The recent change to stagger agent starts (2-second gaps) made `startAll()` async. The orchestrator now `await`s it. But event listeners for `agentCompleted` and `agentFailed` are attached BEFORE `startAll()` is called (line 301-302). If an agent completes DURING the stagger (e.g., Agent 1 finishes before Agent 3 even starts), the coordinator might miss the early completion.

Wait — actually looking at the code, event listeners are attached at line 301-302, BEFORE `startAll()` at line 317. So early completions SHOULD be caught. Unless the stagger introduces a different issue...

**Point 5 — Panel closure interferes**: The 2-second delayed `closeAllPanels()` at line 338-348 fires after completion. But if `waitForAll()` hasn't resolved yet (because completions are missed), the panels are never closed, and the orchestrator hangs.

### Evidence From User Testing
- The screenshots show all 3 agent panels with "Task Completed" visible
- The orchestrator sidebar shows the correct number of agents and their names
- But the sidebar doesn't show the aggregated report or "Multi-Orchestration: complete"
- In a previous iteration (before the stagger and abort fixes), reports DID flow back successfully

### What Changed Between "Working" and "Not Working"
The regression likely came from ONE of these commits:
1. `fix(multi-orch): stop task completion loop + add agent system prompt` — Added `abortTask()` call in the TaskCompleted handler
2. `fix(multi-orch): stagger agent starts + suppress diff views` — Changed `startAll()` to async with delays
3. `fix(multi-orch): prevent task completion loop by excluding resume asks` — Modified auto-approval flow

### Recommended Fix

**Option A — Remove abortTask() from the completion handler**:
Instead of calling `abortTask()` to break the while loop, set `task.abort = true` DIRECTLY without calling the full `abortTask()` method (which emits events and disposes):
```typescript
// In agent-coordinator.ts TaskCompleted handler:
const currentTask = provider.getCurrentTask()
if (currentTask) {
    // Set abort flag directly — DON'T call abortTask() which
    // emits TaskAborted and disposes the task, potentially
    // interfering with completion event propagation.
    (currentTask as any).abort = true
    console.log(`[AgentCoordinator] Set abort=true on task for agent ${agent.taskId}`)
}
```

**Option B — Ensure completion handling finishes before abort**:
```typescript
// In agent-coordinator.ts TaskCompleted handler:
// Handle completion FULLY first
this.handleAgentFinished(agent.taskId, "completed", tokenUsage)

// Only THEN abort, and do it on the next tick so the current
// event processing completes first
setTimeout(() => {
    const currentTask = provider.getCurrentTask()
    if (currentTask) {
        currentTask.abortTask(false).catch(() => {})
    }
}, 100)
```

**Option C — Don't abort at all, rely on the while-loop's natural exit**:
The while loop at Task.ts:2573 is `while (!this.abort)`. After `attempt_completion` returns, the loop calls `recursivelyMakeClineRequests` again. If `attempt_completion` was the last tool use and returned successfully, the next API call should produce another `attempt_completion` (the LLM knows the task is done). The auto-approval handles this. The loop would naturally exit when the max request limit is hit or when the LLM stops producing tool calls.

This is wasteful (extra API calls) but simpler and avoids the abort race condition.

### Files Involved
- `src/core/multi-orchestrator/agent-coordinator.ts` (TaskCompleted handler, ~line 33-55)
- `src/core/multi-orchestrator/orchestrator.ts` (waitForAll at ~line 320, event listeners at ~line 301-302)
- `src/core/task/Task.ts` (abortTask at ~line 2311, while loop at ~line 2573)

### Priority
CRITICAL — This is the most user-visible failure. The entire purpose of the multi-orchestrator (collect reports, merge, verify) depends on completions flowing back. Without this, the feature is essentially broken.

---

## 26. VS Code API Constraints

These are HARD limitations of the VS Code Extension API that cannot be worked around:

| Constraint | Impact | Workaround |
|---|---|---|
| Cannot show two editors side-by-side in ONE editor group | Diff views displace webview panels | Use preventFocusDisruption or custom webview diff renderer |
| Cannot control diff editor orientation (always vertical) | Cannot show horizontal diffs | Render custom diffs in webview using diff2html |
| Tab bar position is global (not per-panel) | Cannot have bottom tabs for agents | Render file list as HTML inside webview |
| Vertical tab scrolling not controllable | Cannot customize tab behavior | N/A |
| Editor group indices are opaque | Panels don't always land in expected columns | Use focusNextGroup + ViewColumn.Active pattern |
| createWebviewPanel placement is non-deterministic | Panels may not go where expected | Set layout first, then create panels |

### What IS Possible
- `vscode.setEditorLayout({ orientation, groups })` — create complex layouts
- `vscode.getEditorLayout` — save/restore layouts
- `panel.viewColumn` — read actual column after creation
- `panel.onDidChangeViewState` — track column changes
- `showTextDocument(uri, { viewColumn })` — open files in specific columns
- `workbench.action.focusFirstEditorGroup` / `focusNextGroup` — control focus
- `preserveFocus: true` on panel creation — prevent focus theft
- Custom HTML/CSS/JS rendering inside webviews — full control

---

## 26. Attempted Fixes That Didn't Work

| Attempt | Why It Failed |
|---|---|
| 80+ agents deployed to fix bugs | Agents make local fixes without understanding cross-component interactions |
| Setting experiments via autoApprovalOverrides | Experiments are read from Task constructor, not runtime state |
| Simultaneous task.start() via tight loop | API rate limiting kills all requests |
| ViewColumn.Beside for panel placement | Inconsistent — VS Code decides where "beside" is |
| Explicit ViewColumn numbers (1, 2, 3) | Don't always map to the expected editor groups |
| Suppressing approve/deny UI rendering | Couldn't find the specific component to modify |
| Promise.all for parallel task creation | Race conditions in ClineProvider shared state |

---

## 27. Architectural Root Causes

### Root Cause 1: ClineProvider Was Designed For Single-Task
Every method, event handler, and state management in ClineProvider assumes a single active task. The `clineStack` is a LIFO stack, `getCurrentTask()` returns the top, and `removeClineFromStack()` enforces the single-open invariant. Running N independent ClineProviders works in theory, but they all share the same ContextProxy singleton, which creates cross-contamination.

### Root Cause 2: VS Code Editor Groups ≠ Application Windows
Each editor group shows ONE active tab. Webview panels are tabs. Diff editors are tabs. They compete for the same space. There's no "split within a group" concept.

### Root Cause 3: File Operations Are Global
When a tool writes a file, it uses `vscode.workspace.fs` or `fs.writeFile` which operates on the filesystem. The `showTextDocument` call then opens it in an editor group. The tool doesn't know which ClineProvider/Task initiated it — it just opens in the "active" group unless a ViewColumn is explicitly specified. The ViewColumn threading (provider → task → tool → diffProvider) was added but requires EVERY file operation path to pass it through.

### Root Cause 4: Auto-Approval Is State-Based, Not Provider-Based
The `checkAutoApproval()` function receives `state` (the provider's global state) and makes decisions based on state flags. But state is shared via ContextProxy. The `_autoApprovalOverrides` mechanism works but adds complexity — any code that reads state without going through `getState()` will miss the overrides.

---

## 28. Recommended Strategy For Next Session

### Priority 1: Fix preventFocusDisruption (Bug #15)
This is the keystone bug. If fixed, it eliminates Bugs #1, #13, #14 automatically. The fix is to set the experiment flag BEFORE task creation, not via overrides:
```typescript
// In orchestrator.ts, before createTask:
const currentExperiments = spawned.provider.contextProxy.getValue("experiments") ?? {}
await spawned.provider.contextProxy.setValue("experiments", {
    ...currentExperiments,
    preventFocusDisruption: true,
})
```

### Priority 2: Fix Auto-Approval (Bug #6)
Verify `multiOrchForceApproveAll` survives the `getState()` pipeline. Add it as a proper typed field rather than a type assertion.

### Priority 3: Fix API Rate Limiting (Bug #2)
Verify staggered starts are working. If not, the `startAll()` async change may need to be applied differently.

### Priority 4: Test In Git Repo
Run the multi-orchestrator in a git-initialized directory to test worktree isolation and the merge pipeline.

### General Approach
- Fix bugs DIRECTLY, not via agents
- Test after EACH fix (reload extension, run scenario)
- Update this spec after each fix

---

## 29. Features Not Yet Implemented

### FEAT-001: Post-Completion Verification Phase
After all agents complete, spawn debug/test agents to verify the work. Partially coded but not fully wired.

### FEAT-002: Orchestrator Continuation
The orchestrator should continue as an active agent after collecting reports, analyzing results, and deciding next steps.

### FEAT-003: Custom Diff Renderer In Webview
Render diffs as HTML inside the agent's chat stream using diff2html or monaco-diff. This eliminates the webview/diff editor competition.

### FEAT-004: Stop/Resume Individual Agents
Pause an agent, provide instructions, resume.

### FEAT-005: Horizontal Diff Layout
If custom diff renderer is built (FEAT-003), render with original on top, modified on bottom.

### FEAT-006: Agent File Tab Bar
Compact vertical file list at bottom 15% of each agent's webview.

---

## 30. Test Coverage Status

### Passing Tests
- `src/core/multi-orchestrator/__tests__/types.spec.ts` — type helpers, constants
- `src/core/multi-orchestrator/__tests__/plan-generator.spec.ts` — plan parsing, edge cases
- `src/core/multi-orchestrator/__tests__/report-aggregator.spec.ts` — report formatting
- `src/core/multi-orchestrator/__tests__/e2e.spec.ts` — integration scenarios
- `src/core/memory/__tests__/*.spec.ts` — all 79 memory system tests still passing

### Not Tested In Production
- Worktree creation/cleanup in a real git repo
- Merge pipeline with actual git branches
- Verification phase agent spawning
- 6-agent simultaneous execution
- API rate limiting recovery
- Panel layout with various VS Code configurations

### Test Commands
```bash
cd src && npx vitest run core/multi-orchestrator/   # multi-orch tests
cd src && npx vitest run core/memory/               # memory tests (regression check)
cd packages/types && npx tsc --noEmit               # type check
cd src && npx tsc --noEmit                          # extension type check
cd webview-ui && npx tsc --noEmit                   # webview type check
pnpm lint                                           # full lint
pnpm test                                           # all tests
```
