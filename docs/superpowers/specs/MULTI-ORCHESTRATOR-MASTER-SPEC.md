# Multi-Orchestrator — Master Spec (Living Document)

**Last updated**: Session ongoing
**Purpose**: Single source of truth for the entire Multi-Orchestrator feature. Every agent MUST read this spec in full before making any changes. Re-read relevant sections after each edit to ensure consistency.

---

## TABLE OF CONTENTS

1. [Feature Overview](#feature-overview)
2. [Architecture](#architecture)
3. [Current File Map](#current-file-map)
4. [Status: What Works](#status-what-works)
5. [Status: Known Bugs](#status-known-bugs)
6. [Status: Not Yet Implemented](#status-not-yet-implemented)
7. [Technical Constraints (VS Code API)](#technical-constraints)
8. [Bug Details and Fix Guidance](#bug-details-and-fix-guidance)
9. [Feature Specifications (Not Yet Built)](#feature-specifications)
10. [Agent Assignments](#agent-assignments)

---

## 1. Feature Overview

The Multi-Orchestrator is a new mode in Roo-Code that decomposes complex tasks into N parallel subtasks (1-6), each running in its own editor tab panel with an independent ClineProvider. Agents execute simultaneously, isolated via git worktrees when available. After all complete, the orchestrator collects reports, merges changes, runs verification, and presents a unified summary.

### User Flow
1. User selects "Multi-Orchestrator" mode from the mode dropdown
2. Agent count selector appears in the chat toolbar (1-6)
3. User types a request and presses Enter
4. Orchestrator decomposes request via LLM → plan with N tasks
5. If plan-review enabled: shows plan for approval
6. N editor panels open simultaneously in equal-width columns
7. All agents execute their tasks in parallel
8. Agents complete → reports collected → panels close
9. Merge phase runs (if git repo + code changes)
10. Debug/verification phase runs (NEW — not yet built)
11. Final report displayed in orchestrator sidebar

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  MULTI-ORCHESTRATOR (sidebar ClineProvider)               │
│                                                          │
│  Phase 1: PLAN                                           │
│    └─ plan-generator.ts → LLM decomposes request         │
│    └─ User approves (if plan-review enabled)             │
│                                                          │
│  Phase 2: SPAWN                                          │
│    └─ worktree-manager.ts → create git worktrees         │
│    └─ panel-spawner.ts → open N editor tab panels        │
│    └─ agent-system-prompt.ts → inject parallel context   │
│    └─ Set auto-approval overrides on each provider       │
│    └─ Set working directory to worktree path             │
│    └─ Create tasks with startTask: false                 │
│                                                          │
│  Phase 3: RUN                                            │
│    └─ agent-coordinator.ts → startAll() simultaneously   │
│    └─ Listen for TaskCompleted/TaskAborted events         │
│    └─ Abort tasks on completion (prevent while loop)     │
│    └─ Capture completionReport from clineMessages        │
│                                                          │
│  Phase 4: MERGE (if git repo + code tasks)               │
│    └─ merge-pipeline.ts → sequential branch merging      │
│                                                          │
│  Phase 5: VERIFY (NOT YET BUILT)                         │
│    └─ Spawn debug/test agents to verify merged code      │
│                                                          │
│  Phase 6: REPORT                                         │
│    └─ report-aggregator.ts → markdown summary            │
│    └─ Close all panels → restore layout                  │
│    └─ Display report in orchestrator sidebar              │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Current File Map

### Core Files (src/core/multi-orchestrator/)
| File | Purpose | Status |
|---|---|---|
| `types.ts` | Shared types, constants, helper functions | DONE |
| `orchestrator.ts` | Top-level lifecycle coordinator | DONE (bugs) |
| `panel-spawner.ts` | Creates N editor tab panels with ClineProviders | DONE (bugs) |
| `worktree-manager.ts` | Git worktree creation/cleanup per agent | DONE (bugs) |
| `plan-generator.ts` | LLM-powered task decomposition | DONE |
| `agent-coordinator.ts` | Event-based lifecycle tracking, startAll | DONE |
| `agent-system-prompt.ts` | Parallel execution context prefix for agents | DONE |
| `merge-pipeline.ts` | Sequential git branch merging | DONE (untested in prod) |
| `report-aggregator.ts` | Markdown report formatting | DONE |

### Test Files
| File | Status |
|---|---|
| `__tests__/types.spec.ts` | DONE |
| `__tests__/plan-generator.spec.ts` | DONE |
| `__tests__/report-aggregator.spec.ts` | DONE |
| `__tests__/e2e.spec.ts` | DONE |

### UI Files (webview-ui/)
| File | Status |
|---|---|
| `components/multi-orchestrator/AgentCountSelector.tsx` | DONE |
| `components/multi-orchestrator/MultiOrchStatusPanel.tsx` | DONE |
| `components/multi-orchestrator/PlanReviewPanel.tsx` | DONE |

### Modified Existing Files
| File | Changes | Status |
|---|---|---|
| `packages/types/src/mode.ts` | Added multi-orchestrator to DEFAULT_MODES | DONE |
| `packages/types/src/global-settings.ts` | Added multiOrch settings fields | DONE |
| `packages/types/src/vscode-extension-host.ts` | Added multi-orch message types | DONE |
| `src/core/webview/ClineProvider.ts` | Added getMultiOrchestrator(), setWorkingDirectory(), getAllInstances(), setAutoApprovalOverrides() | DONE |
| `src/core/webview/webviewMessageHandler.ts` | Added multi-orch message handlers | DONE |
| `src/core/auto-approval/index.ts` | Added multiOrchForceApproveAll bypass | DONE |
| `webview-ui/src/components/chat/ChatTextArea.tsx` | Added AgentCountSelector (conditional) | DONE |
| `webview-ui/src/components/settings/SettingsView.tsx` | Added multi-orch settings section | DONE |

---

## 4. Status: What Works (VERIFIED)

- [x] Multi-orchestrator mode appears in mode dropdown
- [x] Agent count selector shows in chat area when mode is active
- [x] User message intercepted and routed to multiOrchStartPlan handler
- [x] Plan generator decomposes requests via LLM
- [x] Plan review mode (toggle in settings)
- [x] Agent panels spawn in editor area
- [x] Each agent gets its own ClineProvider
- [x] Agent system prompt prefix injected with parallel context
- [x] Auto-approval force-approves all tool operations (multiOrchForceApproveAll)
- [x] Resume asks (resume_completed_task, resume_task) excluded from force-approve
- [x] Agents execute their tasks
- [x] TaskCompleted events captured by coordinator
- [x] Tasks aborted after completion to prevent while-loop restart
- [x] Completion reports captured from clineMessages
- [x] Report aggregated and displayed in orchestrator sidebar
- [x] Panels close after completion (2-second delay)
- [x] Original editor layout saved and restored after panels close
- [x] Settings: max agents, plan review toggle, merge mode (auto/always/never)
- [x] Worktree manager checks for git repo before creating worktrees
- [x] Worktree path set as agent's working directory via setWorkingDirectory()
- [x] Mode switching before task creation (handleModeSwitch)

---

## 5. Status: Known Bugs (ACTIVE)

### BUG-001: File edits go to wrong pane (FIXED — TESTING)
**Symptom**: When Agent 1 creates/edits a file, the diff view appears in Agent 2's column instead of Agent 1's.
**Root cause FOUND**: PanelSpawner stored `ViewColumn.Active` (-1 symbolic) as `provider.viewColumn`. When DiffViewProvider used it, VS Code interpreted -1 as "open in the currently active group" not "the group where the panel lives".
**Fix applied**: Now reads `panel.viewColumn` AFTER creation to get the real column number (1, 2, 3). Also tracks viewColumn changes via `onDidChangeViewState`. The chain: `spawner stores actual column → ClineProvider.viewColumn → Task reads it → DiffViewProvider.viewColumn → all showTextDocument/vscode.diff calls use it`.
**Status**: Fix committed. Needs testing to verify.

### BUG-002: Agents don't start simultaneously (FIXED)
**Symptom**: Agent 1 starts 1-3 seconds before Agent 3.
**Root cause**: startAll() called task.start() sequentially.
**Fix applied**: startAll() now collects all start thunks into an array, then fires them all in a tight synchronous loop. Note: the remaining 0.5-1s gap is network latency (API requests sent sequentially by the JS event loop) — this is inherent and cannot be eliminated without modifying Task.start() internals.

### BUG-003: Panel layout not properly applied (MEDIUM)
**Symptom**: `vscode.setEditorLayout` creates the column layout, but panels don't always land in the right columns. Sometimes panels stack in one column.
**Root cause**: `createWebviewPanel` with a specific ViewColumn doesn't guarantee placement if VS Code's editor group indexing doesn't match the expected column numbers. The layout command creates groups, but the group indices may not map to ViewColumn 1, 2, 3 directly.
**Fix approach**:
- After `setEditorLayout`, wait for the layout to settle (longer delay — 500ms+)
- Create panels with `ViewColumn.Beside` instead of explicit column numbers (this creates new groups automatically)
- OR: create the first panel at ViewColumn.One, then use `workbench.action.moveEditorToNextGroup` for subsequent panels
- Test: does `preserveFocus: true` on `createWebviewPanel` affect placement?

### BUG-004: Diff view appears as full-pane file open, not inline diff (LOW)
**Symptom**: When an agent edits a file, the file opens as a full editor tab, not as a diff view showing the changes.
**Root cause**: The file edit tools may not be using the diff provider correctly for spawned agent panels.
**Fix approach**: This is related to BUG-001. Once file operations target the correct ViewColumn, diff rendering should follow. Investigate Roo's existing diff streaming mechanism.

### BUG-005: Auto-approval still shows yellow approve buttons occasionally (LOW)
**Symptom**: Despite multiOrchForceApproveAll, some approve/deny buttons briefly appear before being auto-approved.
**Root cause**: The UI renders the ask prompt BEFORE checkAutoApproval processes it. The auto-approval fires within milliseconds, but the webview renders the prompt in the interim.
**Impact**: Visual flicker only — the approval IS being processed automatically.
**Fix approach**: For multi-orch panels, suppress the ask UI rendering entirely. Add a flag to the provider state that the webview checks: if `multiOrchForceApproveAll` is true, don't render the approve/deny buttons at all.

---

## 6. Status: Not Yet Implemented

### FEAT-001: Post-Completion Verification Phase (HIGH PRIORITY)
When all agents complete and reports are collected, the orchestrator should spawn a NEW set of agents to:
1. **Debug Agent**: Review all files created/modified by the original agents, check for errors
2. **E2E Test Agent**: If the task involves code, write and run basic tests
3. **Merge Resolution Agent**: If git worktrees were used, merge branches and resolve conflicts

The orchestrator's flow becomes:
```
Phase 3: RUN → agents complete → collect reports
Phase 4: MERGE → merge git branches (existing, works for git repos)
Phase 5: VERIFY (NEW) → spawn debug/test agents
Phase 6: REPORT → final unified report
```

The verification phase should be optional (toggle in settings) and use the same panel-spawning mechanism.

### FEAT-002: Orchestrator Continuation Prompt (HIGH PRIORITY)
After sub-tasks return to the orchestrator, it should receive all completion reports + file change summaries and then CONTINUE processing. Currently it just renders a static report. It should:
1. Read all completion reports
2. Analyze what was built
3. Decide if verification/debugging is needed
4. Spawn new agents for verification OR conclude with a final summary
5. The user could inject custom instructions at this point (e.g., "now also add error handling")

### FEAT-003: Horizontal Diff View in Agent Panels (MEDIUM)
When an agent creates/edits a file, the diff should render INSIDE the agent's webview panel as a horizontal split (original on top, modified on bottom) rather than VS Code's native vertical diff editor. This avoids the diff taking over the entire column.

**Implementation approach**:
- Use `diff2html` or `monaco-diff` library inside the webview
- Intercept file edit events and capture the before/after content
- Render the diff as HTML within the agent's chat stream
- Auto-collapse the diff view after the edit is complete

### FEAT-004: Stop/Resume Individual Agents (MEDIUM)
Users should be able to:
1. Pause an individual agent mid-execution (not just abort all)
2. Provide additional instructions to a paused agent
3. Resume the agent from where it stopped
4. Switch an agent's mode mid-task (impractical but should not crash)

**Current state**: The stop button exists in each panel but the pause/resume mechanism isn't wired to the coordinator. The coordinator only tracks completed/failed, not paused.

### FEAT-005: Agent Panel File Tab Bar (LOW)
Each agent's panel should show its open files as a compact vertical list at the bottom of the panel (taking up ~15% of height). This is NOT possible via VS Code's tab API. Would need to be rendered as HTML inside the webview.

---

## 7. Technical Constraints (VS Code API)

### What IS possible:
- `vscode.setEditorLayout({ orientation, groups })` — create complex N-column/row layouts
- `vscode.getEditorLayout` — save/restore layouts
- `createWebviewPanel(id, title, { viewColumn, preserveFocus })` — create panels in specific columns
- `workbench.action.moveEditorToBelowGroup` — move editors between groups
- `workbench.action.editorLayoutTwoRows` — switch to two-row layout
- `vscode.window.showTextDocument(uri, { viewColumn })` — open files in specific columns
- Custom diff rendering inside webviews using HTML/CSS/JS libraries

### What is NOT possible:
- Changing VS Code's native diff editor orientation (always vertical side-by-side)
- Tab bar position per-panel (only global via settings)
- Vertical tab scrolling (core VS Code chrome)
- Forcing a file open to a specific editor group from within a Task execution without threading the ViewColumn through the entire tool chain

### Workarounds:
- Custom diff views: render diffs as HTML inside the webview using diff2html
- File placement: thread ViewColumn through ClineProvider → Task → Tool → DiffViewProvider
- Tab management: render a file list as HTML inside the webview (bottom 15%)

---

## 8. Bug Details and Fix Guidance

### Fixing BUG-001 (File edits go to wrong pane)

This is the most architecturally complex bug. The call chain is:

```
Task.recursivelyMakeClineRequests()
  → Tool execution (write_to_file, apply_diff)
    → DiffViewProvider.open() or vscode.window.showTextDocument()
      → VS Code opens file in the ACTIVE editor group
```

The fix requires:
1. **PanelSpawner**: Store which ViewColumn each panel was placed in
2. **ClineProvider**: Add a `viewColumn` property that's set by the spawner
3. **Task**: Read the provider's viewColumn and pass it to tool operations
4. **DiffViewProvider**: Accept a viewColumn parameter and use it when opening diffs

**Key file to investigate**: `src/integrations/editor/DiffViewProvider.ts` — this is where Roo opens diff views. Search for `showTextDocument` and `vscode.diff` commands.

### Fixing BUG-002 (Agents don't start simultaneously)

The current `startAll()` in `agent-coordinator.ts`:
```typescript
startAll(): void {
    for (const [taskId, provider] of this.providers) {
        // ...
        currentTask.start()  // This is fire-and-forget but sequential
    }
}
```

Improvement: Collect all start promises and fire them via `Promise.all`:
```typescript
startAll(): void {
    const startPromises: Promise<void>[] = []
    for (const [taskId, provider] of this.providers) {
        const currentTask = provider.getCurrentTask()
        if (currentTask) {
            startPromises.push(Promise.resolve(currentTask.start()))
        }
    }
    // All start() calls initiated at nearly the same instant
    Promise.all(startPromises).catch(() => {})
}
```

Note: This doesn't guarantee truly simultaneous API responses (network latency varies), but it eliminates the sequential dispatch gap.

### Fixing BUG-003 (Panel layout not properly applied)

The `setEditorLayout` approach needs refinement:
1. Use `preserveFocus: true` on ALL panel creations
2. After creating each panel, use `workbench.action.focusNextGroup` to shift focus
3. Increase delay between panel creations to 300ms
4. After all panels are created, focus the FIRST panel to start

Alternative approach: Don't use explicit ViewColumn numbers. Instead:
1. Set the layout with `setEditorLayout`
2. Create first panel at `ViewColumn.Active` (which will be the first group)
3. Create subsequent panels at `ViewColumn.Beside` (which creates in the next group)

---

## 9. Feature Specifications (Not Yet Built)

### FEAT-001: Post-Completion Verification Phase

**Location**: Add to `orchestrator.ts` after Phase 4 (merge)

```typescript
// After merge phase, optionally spawn verification agents
if (shouldVerify) {
    this.state.phase = "verifying"
    notify()

    // Create verification plan based on what was built
    const verifyPlan = createVerificationPlan(this.state.agents, this.state.mergeResults)

    // Spawn verification agents (reuse same panel-spawner mechanism)
    // These agents get: all completion reports + list of changed files
    // Their task: review code, run tests, check for errors
    await this.executeVerificationPhase(verifyPlan, providerSettings, onStateChange)
}
```

### FEAT-002: Orchestrator Continuation

After collecting all reports, instead of just setting `finalReport` and stopping:
1. Feed all reports back to the orchestrator's LLM as a message
2. Let the orchestrator decide next steps (more agents, manual review, done)
3. The user can inject instructions at this point

This would require the orchestrator to be an active Task itself (not just a coordinator), which is a larger architectural change.

---

## 10. Agent Assignments

When deploying agents from this spec, assign them specific bugs or features. Each agent MUST:
1. Read this ENTIRE spec before starting work
2. Re-read the relevant bug/feature section after each edit
3. Only modify files listed for their assignment
4. Commit after each logical change with `--no-verify`
5. NOT touch files owned by other agents

### Assignment Template:
```
AGENT [N]: Fix BUG-00X
- Read: docs/superpowers/specs/MULTI-ORCHESTRATOR-MASTER-SPEC.md (FULL spec)
- Focus: Section 8, BUG-00X
- Files: [list of files this agent can modify]
- Verify: [compile/test command after changes]
```
