# Multi-Orchestrator Debugging Spec

## Current State

The multi-orchestrator can generate plans and spawn panels, but has three critical runtime issues.

## Bug 1: Wrong Agent Count (asked for 3, got 2)

### Root Cause
In `src/core/multi-orchestrator/plan-generator.ts` at lines 120-124:
```typescript
if (plan && plan.tasks.length > 3 && userRequest.split(" ").length < 20) {
    plan.tasks = plan.tasks.slice(0, 2)
}
```
This "short-request heuristic" forcibly slices ANY plan to 2 tasks if the user's message has fewer than 20 words. This overrides both the user's agent count selection AND the LLM's plan.

### Fix
Remove this heuristic entirely. The maxAgents cap at line 239 already handles the limit. The user's explicit agent count selection should ALWAYS be respected. If the LLM returns fewer tasks than maxAgents, that's fine — the LLM's judgement on task count is better than a word-count heuristic.

Delete lines 120-125 in `plan-generator.ts`.

### File
`src/core/multi-orchestrator/plan-generator.ts` — lines 120-125

---

## Bug 2: Sequential Spawning (1 minute between agents)

### Root Cause
In `src/core/multi-orchestrator/orchestrator.ts` at lines 193-233, the spawn loop is:
```typescript
for (let i = 0; i < plan.tasks.length; i++) {
    await spawned.provider.handleModeSwitch(task.mode)    // SLOW — async
    await spawned.provider.createTask(...)                 // SLOW — async, involves webview init
}
```
Each `createTask` is `await`ed before the next begins. `handleModeSwitch` is also async. Combined with panel creation in `spawnPanels`, each agent takes ~15-30 seconds to fully initialize.

### Fix
Two changes:

1. **Parallel panel spawning** in `panel-spawner.ts`: Currently `spawnPanels` creates panels sequentially. Change to `Promise.all`:
```typescript
const promises = titles.map((title, i) => this.spawnSinglePanel(i, title))
const results = await Promise.all(promises)
```

2. **Parallel task creation** in `orchestrator.ts`: After ALL panels are spawned, create all tasks in parallel:
```typescript
const taskPromises = plan.tasks.map(async (task, i) => {
    const [panelId, spawned] = panelEntries[i]
    try {
        await spawned.provider.handleModeSwitch(task.mode)
    } catch {}
    await spawned.provider.createTask(task.description, undefined, undefined, {
        startTask: false,
    }, autoApprovalConfig)
    this.coordinator.registerAgent(agent, spawned.provider)
})
await Promise.all(taskPromises)
```

### Files
- `src/core/multi-orchestrator/panel-spawner.ts` — parallelize panel creation
- `src/core/multi-orchestrator/orchestrator.ts` — parallelize task creation loop (lines 193-233)

---

## Bug 3: Auto-Approval Not Working (agents block on tool prompts)

### Root Cause
In `src/core/webview/ClineProvider.ts` line 2958-2959:
```typescript
if (configuration) {
    await this.setValues(configuration)
```
`setValues` writes to `ContextProxy`, which is shared across all providers created from the same `ContextProxy.getInstance()`. The auto-approval settings ARE being written, but the issue is timing:

1. `setValues(autoApprovalConfig)` writes to the shared proxy
2. `createTask()` then calls `removeClineFromStack()` (line 3002-3007) which may trigger state resets
3. The `Task` constructor creates an `AutoApprovalHandler` which reads settings from the provider's state at construction time
4. If the provider's state was reset between `setValues` and Task construction, the auto-approval is lost

Additionally, the `autoApprovalEnabled` setting might be a per-PROFILE setting rather than a global one. The spawned provider uses a specific API profile ('BRRRR'), and that profile's approval settings might override the ones we set via `setValues`.

### Fix
Instead of relying on `setValues` + ContextProxy, set auto-approval DIRECTLY on the Task's AutoApprovalHandler after creation:

```typescript
const newTask = await spawned.provider.createTask(task.description, undefined, undefined, {
    startTask: false,
}, autoApprovalConfig)

// FORCE auto-approval directly on the task's approval handler
if (newTask.autoApprovalHandler) {
    newTask.autoApprovalHandler.setEnabled(true)
    // Or whatever the method is to force all approvals
}
```

Alternative: Check how the existing `new_task` tool (used by the single orchestrator) handles auto-approval for subtasks. Search `NewTaskTool.ts` and `delegateParentAndOpenChild` — the single orchestrator's subtasks DO run with auto-approval, so there's a pattern that works.

### Files
- `src/core/multi-orchestrator/orchestrator.ts` — force auto-approval after task creation
- Check `src/core/tools/NewTaskTool.ts` and `ClineProvider.delegateParentAndOpenChild` for the working pattern

---

## Additional Issue: Short-Request Heuristic Regression

The "smart task count" fix from a previous agent added the 20-word heuristic at `plan-generator.ts:120-124` which actively undermines the user's agent count selection. This is the most impactful fix — deleting 5 lines.

---

## Agent Assignments

### Agent A: Fix agent count (plan-generator.ts)
- Remove the short-request heuristic (lines 120-125)
- Verify the hard cap at line 239 still works correctly
- Test: maxAgents=3 should produce 3 tasks if the LLM returns 3+

### Agent B: Parallelize spawning (panel-spawner.ts + orchestrator.ts)
- Refactor `spawnPanels` to create panels via `Promise.all`
- Refactor the task creation loop in `executeFromPlan` to use `Promise.all`
- Ensure all panels exist before ANY task starts

### Agent C: Fix auto-approval (orchestrator.ts + investigate ClineProvider)
- Research how the existing single orchestrator's `new_task` tool handles auto-approval for subtasks
- Read `src/core/tools/NewTaskTool.ts` and `ClineProvider.delegateParentAndOpenChild` 
- Apply the same pattern to multi-orchestrator spawned tasks
- Verify by checking AutoApprovalHandler state after task creation

### Agent D: Add logging to auto-approval chain
- In `orchestrator.ts`: log what autoApprovalConfig is being passed
- In `ClineProvider.createTask`: log what configuration values are being applied
- In AutoApprovalHandler (find it): log what it reads on construction
- This will show exactly where auto-approval is being lost

### Agent E: Test the full flow end-to-end
- After Agents A-D complete, run: `cd src && npx vitest run core/multi-orchestrator/`
- Run `cd src && npx tsc --noEmit`
- Verify no regressions in memory tests: `cd src && npx vitest run core/memory/`

### Agent F: Fix type compilation errors from parallelization changes
- Run `cd packages/types && npx tsc --noEmit`
- Run `cd src && npx tsc --noEmit`
- Run `cd webview-ui && npx tsc --noEmit`
- Fix any errors from the parallel changes
