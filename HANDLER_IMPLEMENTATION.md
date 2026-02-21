# Select Active Intent Handler Implementation

## ✅ Implementation Complete

The `handleSelectActiveIntent` function has been successfully implemented in `src/core/tools/SelectActiveIntentTool.ts`.

---

## 📋 Handler Function Signature

```typescript
async function handleSelectActiveIntent(
	intent_id: string,
	sessionId: string,
	cwd: string = process.cwd(),
): Promise<string>
```

---

## 🔄 Handler Flow

### Step-by-Step Execution

1. **Read Active Intents**

    - Loads `.orchestration/active_intents.yaml` using `readActiveIntents(cwd)`
    - Validates that intents exist
    - Returns error if file is empty or missing

2. **Find Matching Intent**

    - Uses `findIntentById(intent_id, cwd)` to locate the specific intent
    - Returns error with list of available intents if not found

3. **Format as XML**

    - Calls `formatIntentAsXml(intent)` to create XML block
    - Includes: owned_scope, constraints, acceptance_criteria
    - Ready for LLM prompt injection

4. **Store in Session State**

    - Calls `setSessionIntent(sessionId, intent_id)`
    - Maps session ID to active intent ID
    - Enables later validation in PreToolUse hooks

5. **Return XML Context**
    - Returns formatted XML string on success
    - Returns `<error>` tagged message on failure

---

## 🔧 Session State Management

### Functions Implemented

```typescript
// Store intent for a session
export async function setSessionIntent(sessionId: string, intentId: string): Promise<void>

// Retrieve active intent for a session
export function getSessionIntent(sessionId: string): string | undefined

// Clear intent when session ends
export function clearSessionIntent(sessionId: string): void
```

### Storage Mechanism

- **Current:** In-memory `Map<string, string>` (sessionId → intentId)
- **Future Enhancement:** Persist to VSCode extension state or disk
- **Scope:** Per-task isolation (each task has its own intent)

---

## 🎯 Integration with Tool Executor

The `SelectActiveIntentTool.execute()` method:

1. Validates `intent_id` parameter (non-empty)
2. Calls `handleSelectActiveIntent(intent_id, sessionId, cwd)`
3. Checks for `<error>` tags in response
4. Stores intent in Task state via `task.setActiveIntentId(intent_id)`
5. Returns formatted success message with intent details

---

## 📊 Error Handling

### Error Scenarios Covered

| Scenario         | Error Response                                           |
| ---------------- | -------------------------------------------------------- |
| Empty intent_id  | "Error: intent_id cannot be empty"                       |
| No intents file  | "No intents found in .orchestration/active_intents.yaml" |
| Intent not found | "Intent not found: {id}. Available intents: {list}"      |
| YAML parse error | "Failed to load intent: {error.message}"                 |
| File read error  | "Failed to load intent: {error.message}"                 |

All errors are returned as `<error>...</error>` XML tags for consistent parsing.

---

## 🧪 Testing Recommendations

### Unit Test Cases

```typescript
describe("handleSelectActiveIntent", () => {
	test("should return XML context for valid intent", async () => {
		const result = await handleSelectActiveIntent("INT-001", "session-1", "/workspace")
		expect(result).toContain("<intent_context")
		expect(result).toContain("INT-001")
	})

	test("should return error for missing intent", async () => {
		const result = await handleSelectActiveIntent("INVALID", "session-1", "/workspace")
		expect(result).toContain("<error>")
		expect(result).toContain("Intent not found")
	})

	test("should store intent in session state", async () => {
		await handleSelectActiveIntent("INT-001", "session-1", "/workspace")
		const stored = getSessionIntent("session-1")
		expect(stored).toBe("INT-001")
	})

	test("should list available intents on error", async () => {
		const result = await handleSelectActiveIntent("BAD-ID", "session-1", "/workspace")
		expect(result).toContain("Available intents:")
	})
})
```

### Integration Test

```typescript
// Create test active_intents.yaml
const testYaml = `
- id: INT-001
  name: Test Intent
  status: active
  owned_scope:
    - "src/**/*.ts"
  constraints:
    - "Must use TypeScript strict mode"
  acceptance_criteria:
    - "All tests pass"
`

// Test full flow
const result = await handleSelectActiveIntent("INT-001", "test-session", testDir)
expect(result).toContain("owned_scope")
expect(result).toContain("src/**/*.ts")
```

---

## 🔗 Related Files Modified

1. **`src/core/tools/SelectActiveIntentTool.ts`**

    - Added `handleSelectActiveIntent()` function
    - Added session state management functions
    - Updated `execute()` method to use handler

2. **`packages/types/src/tool.ts`**

    - Added `"select_active_intent"` to toolNames array

3. **`src/core/prompts/tools/native-tools/index.ts`**

    - Imported and registered the tool

4. **`src/core/assistant-message/presentAssistantMessage.ts`**

    - Added case handler for tool execution

5. **`src/core/task/Task.ts`**

    - Added `activeIntentId` property
    - Added `getActiveIntentId()`, `setActiveIntentId()`, `clearActiveIntentId()` methods

6. **`src/shared/tools.ts`**
    - Added `select_active_intent` to NativeToolArgs type
    - Added display name mapping

---

## 🚀 Next Steps

### For PreToolUse Hook Integration

```typescript
// In executePreToolUseHooks()
const activeIntentId = task.getActiveIntentId()
const sessionIntent = getSessionIntent(sessionId)

if (!activeIntentId || !sessionIntent) {
	return {
		continue: false,
		reason: "Must select an active intent before write operations",
	}
}

// Validate file scope
const intent = await findIntentById(activeIntentId, task.cwd)
const isInScope = validateIntentScope(filePath, intent)

if (!isInScope) {
	return {
		continue: false,
		reason: `File ${filePath} is outside intent scope: ${intent.owned_scope}`,
	}
}
```

### For PostToolUse Hook Integration

```typescript
// In executePostToolUseHooks()
const activeIntentId = task.getActiveIntentId()

if (activeIntentId) {
	const traceRecord = buildTraceRecord(filePath, codeContent, activeIntentId, modelId)
	await appendTraceRecord(traceRecord)
}
```

---

## 📝 Summary

✅ **Handler Function:** Fully implemented with 5-step flow  
✅ **Session State:** In-memory Map with get/set/clear functions  
✅ **Error Handling:** Comprehensive coverage with XML error tags  
✅ **Integration:** Wired into tool executor and task state  
✅ **Documentation:** Complete with test recommendations

The `select_active_intent` tool is now ready for use in the LLM tool execution loop!

---

**Generated:** 2026-02-18  
**Author:** Roo Dev  
**Status:** Implementation Complete
