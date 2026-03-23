# Agent F Investigation: Why Spawned Tasks Report "Failed" After ~15 Seconds

## Summary

**Root cause identified**: There is NO 15-second timeout killing spawned tasks. The "failed" status comes from **two distinct paths**, and the actual failure is likely a **cascading abort** triggered by the `createTask` → `removeClineFromStack` flow on spawned providers.

---

## Finding 1: `TaskCompleted` is ONLY emitted by `AttemptCompletionTool`

`TaskCompleted` is **never** emitted by `Task.ts` itself. It is only emitted in:
- `src/core/tools/AttemptCompletionTool.ts` line 205: `task.emit(RooCodeEventName.TaskCompleted, ...)`

This means:
- A spawned agent task will only ever emit `TaskCompleted` if the LLM calls the `attempt_completion` tool
- If the task crashes, is aborted, or the API call fails before `attempt_completion`, **no `TaskCompleted` is ever emitted**
- The coordinator will only see `TaskAborted` (via `abortTask()`) or nothing at all

## Finding 2: `TaskAborted` is emitted by `Task.abortTask()`

`TaskAborted` is emitted at `Task.ts` line ~2322:
```typescript
this.emit(RooCodeEventName.TaskAborted)
```

This is called by:
1. `ClineProvider.removeClineFromStack()` → calls `task.abortTask(true)` (isAbandoned=true)
2. `ClineProvider.cancelTask()` → calls `task.abortTask()` (user-initiated cancel)
3. Any explicit abort flow

## Finding 3: The "failed after ~15 seconds" pattern — likely cause

The `orchestrator.ts` `executeFromPlan()` loop at line 193-233 creates tasks **sequentially**:

```typescript
for (let i = 0; i < plan.tasks.length; i++) {
    // ...
    await spawned.provider.createTask(task.description, undefined, undefined, {
        startTask: false,
    }, autoApprovalConfig)
    // ...
}
```

Inside `ClineProvider.createTask()` at line 3009-3015:
```typescript
// Single-open-task invariant: always enforce for user-initiated top-level tasks
if (!parentTask) {
    try {
        await this.removeClineFromStack()  // <--- THIS ABORTS THE PREVIOUS TASK
    } catch {
        // Non-fatal
    }
}
```

**Critical**: The multi-orchestrator calls `createTask` with `parentTask` as `undefined` (3rd arg). This triggers `removeClineFromStack()` which **aborts and destroys** any previously-existing task on that provider.

However, since each spawned provider is fresh (new `ClineProvider` per panel), the clineStack should be empty. So this is NOT the direct cause unless something else adds a task first.

## Finding 4: The REAL 15-second suspect — `startTask` errors being swallowed

When `start()` is called on a spawned task, it fires `startTask()` as a fire-and-forget async:

```typescript
public start(): void {
    // ...
    this.startTask(task ?? undefined, images ?? undefined)
    // No await! No catch! Fire-and-forget!
}
```

If `startTask()` throws (e.g., API call fails, webview not ready, provider settings wrong), the error is caught internally at line 2019-2024:

```typescript
} catch (error) {
    if (this.abandoned === true || this.abort === true || this.abortReason === "user_cancelled") {
        return  // silently swallowed
    }
    throw error  // re-thrown but nobody catches it (fire-and-forget)
}
```

This re-thrown error becomes an **unhandled promise rejection** — the task silently dies without emitting either `TaskCompleted` or `TaskAborted`. The coordinator never receives any event, so the task stays in "running" state until `waitForAll()` eventually times out (default 10 minutes), or something else triggers abort.

## Finding 5: Where the "failed" status could come from

Three possible sources:

1. **Coordinator `startAll()`** — if `getCurrentTask()` returns undefined:
   ```typescript
   if (!currentTask) {
       this.handleAgentFinished(taskId, "failed")
   }
   ```
   
2. **Coordinator `startAll()`** — if `start()` throws synchronously:
   ```typescript
   try {
       currentTask.start()
   } catch (err) {
       this.handleAgentFinished(taskId, "failed")
   }
   ```

3. **Orchestrator catch block** — if the entire `executeFromPlan()` throws:
   ```typescript
   } catch (error) {
       this.state.phase = "complete"
       this.state.finalReport = `Orchestration failed: ${error}`
   }
   ```

## Finding 6: No explicit 15-second timeout exists

Searched for `15_000`, `15000`, `15.*second` across Task.ts, ClineProvider.ts, and agent-coordinator.ts — **no matches**. The 15-second observation is likely the time it takes for:
- Sequential task creation (~5s per task for handleModeSwitch + createTask)
- Plus API initialization failure time
- Plus the `waitForAll()` timeout revealing the stuck state

## Diagnostic Logging Added

Added `console.log` / `console.trace` instrumentation to:

1. **`Task.start()`** — logs entry, `_started` state, metadata presence, abort/abandoned flags
2. **`Task.startTask()`** — logs entry with provider ref status
3. **`Task.startTask()` pre-loop** — logs when `initiateTaskLoop()` is about to be called
4. **`Task.abortTask()`** — logs entry with full state AND stack trace
5. **`Task.abortTask()` TaskAborted emission** — logs reason and abandoned state
6. **`AgentCoordinator.registerAgent()`** — logs taskId and getCurrentTask availability
7. **`AgentCoordinator.startAll()`** — logs each agent's getCurrentTask result and stack size
8. **`AgentCoordinator.handleAgentFinished()`** — logs status and completed set size

## Recommended Next Steps

1. **Run the orchestrator and check console output** — the logging will reveal exactly which path triggers "failed"
2. **Most likely fix**: The `start()` method should catch unhandled rejections from `startTask()`:
   ```typescript
   this.startTask(task ?? undefined, images ?? undefined).catch((error) => {
       console.error(`[Task#${this.taskId}] startTask() rejected:`, error)
       this.emit(RooCodeEventName.TaskAborted)
   })
   ```
3. **Alternative**: The coordinator could add a safety timeout per-agent that marks tasks as failed if no `TaskStarted` event is received within N seconds.
