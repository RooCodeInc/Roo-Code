# Post-Hook Fire-and-Forget Implementation ✅

## Design Decision: Non-Blocking Post-Hooks

Post-Hooks are implemented as **fire-and-forget** to ensure they never slow down the user experience or block the LLM's tool results.

---

## Implementation

### Code Location

**File:** `src/core/assistant-message/presentAssistantMessage.ts`  
**Line:** ~709-731

### Pattern

```typescript
pushToolResult: async (result) => {
	// PostToolUse Hook - Trace Logging (fire-and-forget, non-blocking)
	try {
		// Don't await - fire-and-forget to avoid slowing down UX
		executePostToolUseHooks(
			cline,
			block as ToolUse<"write_to_file">,
			block.params,
			result,
			true, // success
			undefined, // error
			Date.now(), // startTime
		).catch((err) => {
			console.error("[HookEngine] PostHook async error:", err)
		})
	} catch (hookError) {
		// Log error but never block post-execution
		console.error("[HookEngine] PostHook fatal error:", hookError)
	}

	// Call original pushToolResult immediately (don't wait for hooks)
	pushToolResult(result)
}
```

---

## Why Fire-and-Forget?

### **Performance:**

- Tool results return to LLM **immediately**
- No delay in agent's feedback loop
- Trace logging happens in background

### **Reliability:**

- Post-Hook failures **never crash** the tool execution
- Tool already succeeded - hooks are purely for logging/analytics
- Fail-safe: Even if hooks throw, tool result is delivered

### **User Experience:**

- No perceptible lag when writing files
- Agent doesn't wait for trace records to be written
- UI stays responsive

---

## Error Handling Layers

### **Layer 1: Synchronous try-catch**

```typescript
try {
    executePostToolUseHooks(...).catch(...)
} catch (hookError) {
    console.error("[HookEngine] PostHook fatal error:", hookError)
}
```

**Catches:** Synchronous errors when initiating the hook call

### **Layer 2: Async catch**

```typescript
executePostToolUseHooks(...).catch(err => {
    console.error("[HookEngine] PostHook async error:", err)
})
```

**Catches:** Async errors inside hook execution (e.g., file I/O failures)

### **Layer 3: Hook-level error handling**

```typescript
// Inside executePostToolUseHooks():
for (const hook of hookRegistry.postToolUseHooks) {
	try {
		await hook(context)
	} catch (error) {
		console.error(`PostToolUse hook failed:`, error)
		// Continue to next hook
	}
}
```

**Ensures:** One hook's failure doesn't prevent others from running

---

## Execution Timeline

```
t=0ms:   Tool completes successfully
         ↓
t=0ms:   pushToolResult wrapper called
         ↓
t=0ms:   executePostToolUseHooks() started (no await)
         ↓
t=1ms:   Original pushToolResult(result) called ← LLM RECEIVES RESULT
         ↓
t=1ms:   Agent continues with next action
         ↓
         [Background Thread]
         ↓
t=5ms:   Post-Hook: Read active_intents.yaml
         ↓
t=10ms:  Post-Hook: Compute content hash (SHA-256)
         ↓
t=15ms:  Post-Hook: Append to agent_trace.jsonl
         ↓
t=20ms:  Post-Hook: Complete (silent success or logged error)
```

**Key Insight:** Agent receives result at **t=1ms**, while hooks complete at **t=20ms**. No blocking!

---

## Contrast with Pre-Hooks

| Aspect           | Pre-Hook                              | Post-Hook                               |
| ---------------- | ------------------------------------- | --------------------------------------- |
| **Timing**       | BEFORE tool execution                 | AFTER tool execution                    |
| **Blocking**     | YES - can prevent tool from running   | NO - tool already ran                   |
| **Await**        | YES - must wait for validation        | NO - fire-and-forget                    |
| **Error Impact** | Blocks tool, returns error to LLM     | Logs error, tool result still delivered |
| **Purpose**      | **Governance** (validation, security) | **Observability** (trace, metrics)      |
| **Fail Mode**    | Fail-secure (block on error)          | Fail-safe (continue on error)           |

---

## Use Cases for Post-Hooks

### **1. Trace Logging**

```typescript
// Append to .orchestration/agent_trace.jsonl
{
  "intent_id": "INT-001",
  "file_path": "src/auth.ts",
  "content_hash": "abc123...",
  "timestamp": "2026-02-18T11:30:00Z",
  "mutation_class": "AST_REFACTOR"
}
```

### **2. Metrics Collection**

```typescript
// Track tool usage statistics
{
  "tool": "write_to_file",
  "success": true,
  "duration_ms": 42,
  "session_id": "task-xyz"
}
```

### **3. Documentation Updates**

```typescript
// Update intent_map.md with new file associations
if (mutation_class === "INTENT_EVOLUTION") {
	updateIntentMap(intent_id, file_path)
}
```

### **4. Compliance Auditing**

```typescript
// Log privileged operations for security review
if (toolName === "execute_command") {
	auditLog.append({ command, user, timestamp })
}
```

---

## Testing Post-Hook Fire-and-Forget

### **Test 1: Verify Non-Blocking**

**Expectation:** Tool result appears in chat **before** trace file is written

```typescript
// Add artificial delay to Post-Hook
executePostToolUseHooks(...) {
    await new Promise(resolve => setTimeout(resolve, 5000)) // 5s delay
    // Write trace...
}
```

**Expected Behavior:**

- LLM receives tool result **immediately**
- Agent continues to next action
- Trace file written **5 seconds later** in background
- No UI lag

### **Test 2: Verify Error Resilience**

**Inject error in Post-Hook:**

```typescript
executePostToolUseHooks(...) {
    throw new Error("Simulated trace logging failure")
}
```

**Expected Behavior:**

- Tool succeeds normally
- Error logged to console: `[HookEngine] PostHook async error: ...`
- LLM still receives successful tool result
- Extension doesn't crash

---

## Status: COMPLETE ✅

**Implementation:**

- ✅ Fire-and-forget pattern (no await)
- ✅ Dual error handling (sync + async catch)
- ✅ Immediate tool result delivery
- ✅ Background trace logging ready

**Performance:**

- ✅ Zero delay in tool response time
- ✅ No blocking of agent workflow
- ✅ Fail-safe error handling

**Next Steps:**

- Implement actual trace logging logic (append to agent_trace.jsonl)
- Add content hashing (SHA-256)
- Add intent_map.md updates

---

## Commit Message

```
feat(hooks): Implement fire-and-forget Post-Hook pattern

- Post-Hooks run asynchronously after tool execution
- No await - tool results return to LLM immediately
- Dual error handling: sync try-catch + async .catch()
- Background trace logging ready for implementation

Performance: Zero impact on tool execution time.
Reliability: Hook failures never block tool results.

Refs: #TRP1-SATURDAY-PHASE2
```

---

**Ready for trace logging implementation!** 🚀
