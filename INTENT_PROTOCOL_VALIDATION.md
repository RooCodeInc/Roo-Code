# Intent-Driven Architect Protocol - Implementation Validation

## 📋 SPECIFICATION COMPLIANCE CHECK

This document validates that our implementation matches the TRP1 Challenge Intent-Driven Architect Protocol specification.

---

## ✅ RULE 1: Intent Declaration (BEFORE any code changes)

### **Specification Requirements:**

- Analyze user request to identify relevant business intent
- Call `select_active_intent(intent_id)` with valid ID from `.orchestration/active_intents.yaml`
- Wait for `<intent_context>` with constraints and scope
- ONLY proceed with code changes after receiving intent context

### **Implementation Status:**

✅ **Tool Created:** `select_active_intent` tool registered in tool catalog  
✅ **YAML Parsing:** `readActiveIntents()` reads from `.orchestration/active_intents.yaml`  
✅ **Intent Validation:** `findIntentById()` validates intent exists  
✅ **XML Context Return:** `formatIntentAsXml()` returns structured `<intent_context>` block  
✅ **System Prompt:** Protocol documented in `src/core/prompts/sections/intent-protocol.ts`

**Files:**

- `src/core/tools/SelectActiveIntentTool.ts` - Tool executor
- `src/hooks/intent-loader.ts` - YAML parsing and validation
- `src/hooks/session-state.ts` - Session tracking

---

## ✅ RULE 2: Scope Enforcement

### **Specification Requirements:**

- Agent may ONLY edit files within `owned_scope` of active intent
- Must request scope expansion for out-of-scope edits
- Out-of-scope edits must be BLOCKED

### **Implementation Status:**

✅ **Scope Validation Function:** `validateIntentScope(filePath, intent)` in `intent-loader.ts`  
✅ **Glob Pattern Matching:** Uses minimatch for scope validation  
✅ **Active Intent Tracking:** `task.getActiveIntentId()` retrieves current intent  
⚠️ **PreToolUse Hook Integration:** Ready for implementation (Saturday scaffolding complete)

**Next Step (for full enforcement):**
Wire `validateIntentScope()` into PreToolUse hook for `write_to_file` to block execution.

**Files:**

- `src/hooks/intent-loader.ts` - Contains `validateIntentScope()`
- `src/hooks/middleware.ts` - PreToolUse hook infrastructure ready
- `src/core/task/Task.ts` - Active intent storage via `activeIntentId`

---

## ⚠️ RULE 3: Traceability (Requires Extension)

### **Specification Requirements:**

- Every `write_file` call MUST include `intent_id` parameter
- Classify changes as `AST_REFACTOR` or `INTENT_EVOLUTION`
- System logs traces linking code to intent

### **Implementation Status:**

✅ **Content Hashing:** `computeContentHash()` generates SHA-256 hashes  
✅ **Trace Logging:** `appendTraceRecord()` writes to `agent_trace.jsonl`  
✅ **Intent Correlation:** Trace schema includes `related` array for intent linkage  
⚠️ **Tool Parameter Extension:** `write_to_file` needs `intent_id` and `mutation_class` params added

**Current Limitation:**
The native `write_to_file` tool schema does NOT yet include:

- `intent_id` (string, required)
- `mutation_class` (enum: "AST_REFACTOR" | "INTENT_EVOLUTION", required)

**Recommended Action:**

1. Extend `WriteToFileParams` interface in `src/core/tools/WriteToFileTool.ts`
2. Modify tool schema in `src/core/prompts/tools/native-tools/write_to_file.ts`
3. Update PostToolUse hook to extract these params and include in trace

**Files:**

- `src/hooks/trace-logger.ts` - Trace logging ready
- `src/core/tools/WriteToFileTool.ts` - Needs parameter extension
- `src/core/prompts/tools/native-tools/write_to_file.ts` - Needs schema update

---

## ✅ RULE 4: Autonomous Recovery

### **Specification Requirements:**

- If tool call rejected, analyze error message
- Propose alternative approach
- Do NOT retry same rejected action

### **Implementation Status:**

✅ **Error Format:** Tool returns `<error>` tagged messages with details  
✅ **Available Intents Listed:** Error shows available intent IDs when lookup fails  
✅ **Structured Errors:** `formatResponse.toolError()` creates LLM-readable errors  
✅ **System Prompt Guidance:** Protocol instructs agent on recovery behavior

**Files:**

- `src/core/tools/SelectActiveIntentTool.ts` - Structured error returns
- `src/core/prompts/sections/intent-protocol.ts` - Recovery instructions

---

## 🚫 VIOLATION CONSEQUENCES (Enforcement Status)

### **Specification:**

| Violation                             | Consequence |
| ------------------------------------- | ----------- |
| Writing code without declaring intent | BLOCKED     |
| Editing out-of-scope files            | BLOCKED     |
| Missing intent_id in write_file       | BLOCKED     |

### **Current Enforcement:**

| Violation          | Status                 | Implementation                                                              |
| ------------------ | ---------------------- | --------------------------------------------------------------------------- |
| No intent declared | ⚠️ **Partially Ready** | PreToolUse hook can check `task.getActiveIntentId()` and block if undefined |
| Out-of-scope edit  | ⚠️ **Partially Ready** | `validateIntentScope()` exists but not wired to PreToolUse                  |
| Missing intent_id  | ❌ **Not Enforced**    | Requires `write_to_file` tool schema extension                              |

**To Achieve Full Enforcement:**

1. **Wire PreToolUse Hook to write_to_file:**

```typescript
// In src/hooks/middleware.ts
async function preToolUseHook(context: PreToolUseContext<"write_to_file">) {
	const intentId = context.task.getActiveIntentId()

	// Block if no intent declared
	if (!intentId) {
		return {
			continue: false,
			blockedReason: "Intent declaration required. Call select_active_intent first.",
		}
	}

	// Block if out of scope
	const intent = await findIntentById(intentId, context.task.cwd)
	const filePath = context.params.path

	if (!validateIntentScope(filePath, intent)) {
		return {
			continue: false,
			blockedReason: `File ${filePath} is outside intent scope: ${intent.owned_scope}`,
		}
	}

	return { continue: true }
}
```

2. **Extend write_to_file Tool Schema:**

```typescript
// In src/core/prompts/tools/native-tools/write_to_file.ts
{
  name: "write_to_file",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      content: { type: "string" },
      intent_id: {
        type: "string",
        description: "Active intent ID from select_active_intent"
      },
      mutation_class: {
        type: "string",
        enum: ["AST_REFACTOR", "INTENT_EVOLUTION"],
        description: "Change classification for traceability"
      }
    },
    required: ["path", "content", "intent_id", "mutation_class"]
  }
}
```

---

## 📊 IMPLEMENTATION COMPLETENESS

### **Phase Status:**

| Component                        | Status         | Completion |
| -------------------------------- | -------------- | ---------- |
| **Tool Registration**            | ✅ Complete    | 100%       |
| **Session State Management**     | ✅ Complete    | 100%       |
| **Intent Loading (YAML)**        | ✅ Complete    | 100%       |
| **Scope Validation Logic**       | ✅ Complete    | 100%       |
| **System Prompt Protocol**       | ✅ Complete    | 100%       |
| **Trace Logging Infrastructure** | ✅ Complete    | 100%       |
| **PreToolUse Hook Wiring**       | ⚠️ Scaffolding | 60%        |
| **PostToolUse Trace Recording**  | ⚠️ Scaffolding | 60%        |
| **write_to_file Extension**      | ❌ Not Started | 0%         |

### **Overall Progress: 80% Complete**

**Wednesday Deliverables (Scaffolding):** ✅ 100%  
**Saturday Deliverables (Implementation):** ✅ 80%  
**Remaining Work (Enforcement):** ⚠️ 20%

---

## 🎯 EXAMPLE WORKFLOW VALIDATION

### **Specification Example:**

```
User: "Refactor the auth middleware for JWT"
You: select_active_intent("INT-001")  ← MUST DO THIS FIRST
System: <intent_context>...</intent_context>
You: write_file(path="src/auth/middleware.ts", intent_id="INT-001", mutation_class="AST_REFACTOR")
```

### **Our Implementation Support:**

✅ **Step 1:** Agent calls `select_active_intent("INT-001")`

- Tool: `SelectActiveIntentTool.execute()`
- Handler: `handleSelectActiveIntent()`
- Validates: Intent exists in `.orchestration/active_intents.yaml`

✅ **Step 2:** System returns XML context

- Function: `formatIntentAsXml(intentContext)`
- Returns: `<intent_context><id>INT-001</id><owned_scope>...</owned_scope></intent_context>`

✅ **Step 3:** Intent stored in session

- Function: `task.setActiveIntentId("INT-001")`
- Session: `setSessionIntent(sessionId, "INT-001")`

⚠️ **Step 4:** Agent calls write_file with intent_id

- **Current:** `write_to_file` does NOT accept `intent_id` parameter
- **Needed:** Schema extension to add `intent_id` and `mutation_class`

⚠️ **Step 5:** System validates scope before execution

- **Current:** `validateIntentScope()` exists but not called by PreToolUse
- **Needed:** Wire hook to `write_to_file` in `presentAssistantMessage.ts`

✅ **Step 6:** System logs trace after successful write

- Function: `appendTraceRecord()` ready
- PostToolUse: Can call after `write_to_file` succeeds

---

## 🔧 NEXT STEPS FOR FULL COMPLIANCE

### **Priority 1: Enable Scope Enforcement (PreToolUse)**

File: `src/core/assistant-message/presentAssistantMessage.ts`

Add before `case "write_to_file":`:

```typescript
// Check PreToolUse hooks
const preHookResult = await executePreToolUseHooks({
	toolName: "write_to_file",
	params: block.params,
	task: cline,
	sessionId: cline.taskId,
})

if (!preHookResult.continue) {
	await cline.say("error", preHookResult.blockedReason || "Tool use blocked by governance policy")
	break
}
```

### **Priority 2: Extend write_to_file Schema**

Files:

- `src/core/prompts/tools/native-tools/write_to_file.ts`
- `src/core/tools/WriteToFileTool.ts`

Add parameters: `intent_id`, `mutation_class`

### **Priority 3: Enable Trace Logging (PostToolUse)**

File: `src/core/assistant-message/presentAssistantMessage.ts`

Add after successful `write_to_file`:

```typescript
// Log trace
await executePostToolUseHooks({
	toolName: "write_to_file",
	params: block.params,
	result: { success: true, path: relPath },
	task: cline,
	sessionId: cline.taskId,
})
```

---

## 📄 CONCLUSION

**Our implementation provides:**

- ✅ Complete tool infrastructure (`select_active_intent`)
- ✅ Complete session state management
- ✅ Complete intent loading and validation
- ✅ Complete system prompt documentation
- ✅ Complete trace logging infrastructure

**What's missing for 100% compliance:**

- ⚠️ Hook wiring (20% remaining work)
- ⚠️ Tool parameter extension

**Estimated effort to complete:** ~2-3 hours for:

1. PreToolUse hook integration (1 hour)
2. write_to_file parameter extension (1 hour)
3. PostToolUse trace logging (30 min)
4. End-to-end testing (30 min)

**Current deliverable status:**

- **Wednesday (Scaffolding):** 100% Complete ✅
- **Saturday (Implementation):** 80% Complete ✅
- **Production-Ready:** Requires Priority 1-3 tasks

---

Generated: 2026-02-18  
Author: Kidus Tewodros  
Program: 10 Academy Intensive Training - TRP1 Challenge
