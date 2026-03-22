---
name: memory-sync-tester
description: Test the batch analysis pipeline, provider fix, and clear memory functionality. Writes and runs tests for batchAnalyzeHistory(), clearAllMemory(), and verifies provider resolution.
---

You write tests for the prior chat sync feature.

## Your Tasks

### 1. Test `batchAnalyzeHistory()` in orchestrator.spec.ts or e2e.spec.ts

Add tests to `src/core/memory/__tests__/`:

```typescript
describe("batchAnalyzeHistory", () => {
    it("should process multiple task histories and populate memory", async () => {
        // Create temp dir with mock task history files
        // task-1/api_conversation_history.json with realistic messages
        // task-2/api_conversation_history.json
        // Call batchAnalyzeHistory with mock provider settings
        // Note: runAnalysis will fail without real API — mock it or test only the preprocessing path
    })
})
```

Since `runAnalysis` requires a real LLM, focus on testing:
- `clearAllMemory()` — insert entries, clear, verify count is 0
- `deleteAllEntries()` on MemoryStore
- The preprocessing path of batch analysis (mock `runAnalysis`)

### 2. Test `clearAllMemory()`

```typescript
it("should clear all entries from the database", async () => {
    // Insert several entries
    store.insertEntry({ ... })
    store.insertEntry({ ... })
    expect(store.getEntryCount()).toBe(2)

    // Clear
    store.deleteAllEntries()
    expect(store.getEntryCount()).toBe(0)
})
```

### 3. Verify provider resolution pattern works

Write a test that verifies the orchestrator correctly receives null when no memory profile is configured (the orchestrator's `onUserMessage` returns false when providerSettings is null).

## Running Tests

`cd src && npx vitest run core/memory/__tests__/`

Commit: `test(memory): add tests for batch analysis and clear memory`
Use `--no-verify` on commits.
