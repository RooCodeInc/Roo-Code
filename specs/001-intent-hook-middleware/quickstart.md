# Quickstart: Intent-Governed Hook Middleware

**Feature**: Intent-Governed Hook Middleware  
**Date**: 2026-02-16  
**Phase**: 1 - Design & Contracts

## Overview

This guide provides a quick introduction to using and developing the Intent-Governed Hook Middleware system in Roo Code.

## For Users

### Setting Up Intents

1. Create `.orchestration/active_intents.yaml` in your workspace root:

```yaml
intents:
    - id: INT-001
      name: "User Authentication Feature"
      description: "Implement user login and registration"
      status: IN_PROGRESS
      owned_scope:
          - "src/auth/**"
          - "src/components/LoginForm.tsx"
      constraints:
          - "Must use JWT tokens"
          - "Must support OAuth2"
      acceptance_criteria:
          - "User can log in with email/password"
          - "User can register new account"
          - "JWT tokens are validated on each request"
```

2. Select an active intent before making code changes:

```
AI: I'll help you implement the authentication feature.
    First, let me select the appropriate intent.

[AI calls select_active_intent tool with INT-001]

AI: Now I can make changes within the auth scope.
    Let me create the login component...
```

3. The system will automatically:
    - Validate file writes against intent scope
    - Log all operations to `.orchestration/agent_trace.jsonl`
    - Inject intent context into AI prompts
    - Prevent out-of-scope modifications

### Viewing Trace Logs

Check `.orchestration/agent_trace.jsonl` to see all file modifications:

```json
{"intent_id":"INT-001","content_hash":"abc123...","file_path":"src/auth/LoginForm.tsx","mutation_class":"CREATE","timestamp":"2026-02-16T10:30:00Z","tool_name":"write_to_file"}
{"intent_id":"INT-001","content_hash":"def456...","file_path":"src/auth/authService.ts","mutation_class":"CREATE","timestamp":"2026-02-16T10:31:00Z","tool_name":"write_to_file"}
```

## For Developers

### Architecture Overview

The hook system follows a middleware pattern:

```
Tool Call → Hook Engine → Pre-Hooks → Tool Execution → Post-Hooks → Result
```

### Key Components

1. **HookEngine** (`src/hooks/HookEngine.ts`)

    - Main coordinator for hook execution
    - Registers and executes pre/post hooks
    - Handles errors gracefully

2. **IntentManager** (`src/hooks/IntentManager.ts`)

    - Loads and manages active intents
    - Validates intent definitions
    - Tracks active intent per task

3. **ScopeValidator** (`src/hooks/ScopeValidator.ts`)

    - Validates file paths against scope patterns
    - Uses glob pattern matching
    - Returns clear error messages

4. **TraceManager** (`src/hooks/TraceManager.ts`)

    - Creates and appends trace log entries
    - Computes content hashes
    - Handles file I/O errors

5. **OptimisticLockManager** (`src/hooks/OptimisticLockManager.ts`)
    - Manages file state locks
    - Detects conflicts using content hashes
    - Prevents stale writes

### Integration Points

#### 1. BaseTool Integration

Modify `BaseTool.handle()` to integrate hooks:

```typescript
async handle(task: Task, block: ToolUse, callbacks: ToolCallbacks) {
  const context: ToolExecutionContext = {
    toolName: this.name,
    toolParams: block.nativeArgs,
    taskId: task.taskId,
    workspacePath: task.workspacePath,
    activeIntentId: task.activeIntentId,
  };

  // Pre-hook validation
  const preResult = await hookEngine.executePreHooks(context);
  if (!preResult.allowed) {
    throw new Error(preResult.error);
  }

  // Execute tool
  const result = await this.execute(preResult.modifiedParams || block.nativeArgs, task, callbacks);

  // Post-hook logging
  await hookEngine.executePostHooks(context, result);

  return result;
}
```

#### 2. System Prompt Integration

Modify `SYSTEM_PROMPT()` to inject intent context:

```typescript
async function SYSTEM_PROMPT(task: Task): Promise<string> {
	const basePrompt = await generatePrompt(task)

	// Load active intent
	const activeIntent = await intentManager.getActiveIntent(task.taskId)

	if (activeIntent) {
		const intentContext = formatIntentContext(activeIntent)
		return `${basePrompt}\n\n<intent_context>\n${intentContext}\n</intent_context>`
	}

	return basePrompt
}
```

#### 3. Select Active Intent Tool

Create new tool for intent selection:

```typescript
export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	async execute(params: { intent_id: string }, task: Task) {
		await intentManager.setActiveIntent(task.taskId, params.intent_id)
		return { success: true, intent_id: params.intent_id }
	}
}
```

### Testing

#### Unit Tests

```typescript
describe("ScopeValidator", () => {
	it("should validate path against glob patterns", async () => {
		const validator = new ScopeValidator()
		const patterns = ["src/components/**", "src/utils/helpers.ts"]

		expect(await validator.validatePath("src/components/Button.tsx", patterns)).toBe(true)
		expect(await validator.validatePath("src/auth/Login.tsx", patterns)).toBe(false)
	})
})
```

#### Integration Tests

```typescript
describe("Intent Flow", () => {
	it("should block file write without active intent", async () => {
		const task = createTestTask()
		const tool = new WriteToFileTool()

		await expect(
			tool.handle(task, createToolUse("write_to_file", { path: "test.ts", content: "test" }), callbacks),
		).rejects.toThrow("No active intent selected")
	})
})
```

### Error Handling

All hooks must handle errors gracefully:

```typescript
async function preHook(context: ToolExecutionContext): Promise<PreHookResult> {
	try {
		// Validation logic
		return { allowed: true }
	} catch (error) {
		// Log error but don't crash
		console.error("Pre-hook error:", error)
		return { allowed: false, error: "Validation failed" }
	}
}
```

### Performance Considerations

- Pre-hooks should complete in <100ms
- Scope validation should complete in <10ms
- Content hash computation should complete in <50ms for 1MB files
- Trace logging should be async and non-blocking

### Debugging

Enable debug logging:

```typescript
// In HookEngine.ts
const DEBUG = process.env.DEBUG_HOOKS === "true"

if (DEBUG) {
	console.log("[HookEngine] Pre-hook execution:", context)
}
```

## Common Patterns

### Adding a New Hook

1. Create hook function:

```typescript
async function myCustomHook(context: ToolExecutionContext): Promise<PreHookResult> {
	// Your validation logic
	return { allowed: true }
}
```

2. Register in HookEngine:

```typescript
hookEngine.registerPreHook(myCustomHook)
```

### Custom Scope Patterns

Use glob patterns in `owned_scope`:

- `src/components/**` - All files in components and subdirectories
- `src/**/*.ts` - All TypeScript files in src
- `src/utils/helpers.ts` - Specific file

### Handling Conflicts

When optimistic locking detects a conflict:

1. System returns error: "Stale File: File was modified..."
2. User/AI should re-read the file
3. Recalculate hash and retry operation

## Next Steps

- See [data-model.md](./data-model.md) for entity definitions
- See [contracts/hook-engine.ts](./contracts/hook-engine.ts) for API contracts
- See [plan.md](./plan.md) for implementation details
