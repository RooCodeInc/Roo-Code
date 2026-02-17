# HookEngine Architecture (IoC)

This document outlines a lightweight Inversion of Control (IoC) wrapper for governance hooks. It ensures actions run through `PreHook` intent validation and `PostHook` trace logging without coupling hook logic to tool implementations.

```mermaid
classDiagram
  class HookEngine {
    +executeWithHooks(fn, intentId, meta) Promise
  }
  class PreHook {
    +validate(activeIntentId) Intent
  }
  class PostHook {
    +log({filePath, content, intentId, mutationClass}) void
  }
  HookEngine --> PreHook : beforeExecute
  HookEngine --> PostHook : afterExecute
```

## Rationale
- Governance-first: Enforce intent selection and scope before any action.
- Decoupling: Tools remain focused on business logic; HookEngine handles governance.
- Composability: Future hooks (rate limits, approvals) can plug into the engine.

## Pseudocode

```ts
class HookEngine {
  static async executeWithHooks<T>(
    fn: () => Promise<T>,
    intentId: string,
    meta?: { filePath?: string; content?: string; mutationClass?: string }
  ): Promise<T> {
    await PreHook.validate(intentId) // throws on invalid or missing intent
    const result = await fn()
    if (meta?.filePath && meta?.content) {
      await PostHook.log({
        filePath: meta.filePath,
        content: meta.content,
        intentId,
        mutationClass: meta.mutationClass ?? "Write",
      })
    }
    return result
  }
}

// Usage (example)
await HookEngine.executeWithHooks(
  async () => writeToFileTool.execute(params, task, callbacks),
  activeIntentId,
  { filePath: params.path, content: params.content, mutationClass: "Write" }
)
```

## Integration Points
- Write path: see [src/core/tools/WriteToFileTool.ts](src/core/tools/WriteToFileTool.ts).
- Prompt assembly: see [src/core/webview/generateSystemPrompt.ts](src/core/webview/generateSystemPrompt.ts).
- Task runtime prompt: see [src/core/task/Task.ts](src/core/task/Task.ts).

## Governance Invariants
- Intent required: No action proceeds without an active intent.
- Scope enforcement: File targets must match intent-owned globs.
- Ledger logging: All mutations append to `.orchestration/agent_trace.jsonl` with a content hash.
