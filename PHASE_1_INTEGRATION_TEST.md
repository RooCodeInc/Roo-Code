# Phase 1 Complete Integration Test

## Test Environment Setup

**Prerequisites:**

- Extension built and ready (`pnpm install && pnpm build`)
- Test workspace with `.orchestration/active_intents.yaml` file
- Developer Console open (Ctrl+Shift+I in extension host)
- Branch: `feature/intent-traceability-system`

**Quick Setup:**

```bash
cd Roo-Code
pnpm install
pnpm build
# Press F5 to launch extension
```

## Test Scenarios

### Test 0: System Prompt Verification (NEW - Phase 1 Final)

**Goal:** Verify Intent-Driven protocol is in system prompt

**Steps:**

1. Launch extension (F5)
2. Open Roo Code chat
3. Click "View System Prompt" (if available) OR check console logs
4. Search for: "Intent-Driven Architect"

**Expected Output:**

```
You are an Intent-Driven Architect...
IMPORTANT: Before performing ANY write operations (write_to_file, apply_diff, edit, search_and_replace),
you MUST first call select_active_intent to load the necessary context and scope constraints.
```

**Success Criteria:**

- ✅ System prompt contains "Intent-Driven Architect"
- ✅ System prompt mentions `select_active_intent` requirement
- ✅ Protocol enforces intent selection before writes

---

### Test 1: select_active_intent Tool (NEW - Phase 1 Final)

**Goal:** Verify select_active_intent tool loads intent context

**Setup:**
Create `.orchestration/active_intents.yaml` in your test workspace:

```yaml
- id: "test-intent-001"
  description: "Test intent for Phase 1"
  scope:
      - "src/hooks/"
      - "src/test/"
```

**Steps:**

1. Launch extension
2. Open test workspace
3. Ask Roo Code: "Call select_active_intent with intent_id test-intent-001"
4. Check console for: `[SelectActiveIntentTool] Loading intent: test-intent-001`
5. Verify agent receives XML context block

**Expected Output:**

```xml
<intent_context>
  <intent_id>test-intent-001</intent_id>
  <description>Test intent for Phase 1</description>
  <scope>
    - src/hooks/
    - src/test/
  </scope>
</intent_context>
```

**Success Criteria:**

- ✅ Tool loads intent from YAML
- ✅ Returns XML context block
- ✅ Stores selectedIntentId in task object
- ✅ Agent can proceed with writes after selection

---

### Test 2: Gatekeeper Logic (NEW - Phase 1 Final)

**Goal:** Verify PreToolHook blocks writes without intent selection

**Steps:**

1. Launch extension with fresh workspace (no intent selected)
2. Ask Roo Code: "Create a file test.txt with hello"
3. Check console for: `[PreToolHook] No intent selected - blocking write operation`
4. Verify agent receives error: "You must call select_active_intent first"
5. Verify file is NOT created

**Expected Behavior:**

- ❌ Write operation BLOCKED
- ✅ Error message displayed to agent
- ✅ Agent prompted to select intent first

**Success Criteria:**

- ✅ Gatekeeper blocks writes without intent
- ✅ Clear error message returned
- ✅ Two-stage state machine enforced

---

### Test 3: Full Intent Workflow (NEW - Phase 1 Final)

**Goal:** Verify complete intent selection → write workflow

**Steps:**

1. Launch extension
2. Ask: "Select intent test-intent-001 and create file src/hooks/demo.ts"
3. Verify agent calls `select_active_intent` FIRST
4. Check console for intent loading
5. Verify agent then calls `write_to_file`
6. Check file is created in allowed scope

**Expected Flow:**

```
1. Agent calls select_active_intent("test-intent-001")
2. [SelectActiveIntentTool] Loading intent: test-intent-001
3. Agent receives <intent_context> XML
4. Agent calls write_to_file("src/hooks/demo.ts")
5. [PreToolHook] Tool: write_to_file
6. [PreToolHook] File in scope - allowing
7. [PostToolHook] Tool: write_to_file completed
8. File created successfully
```

**Success Criteria:**

- ✅ Agent follows two-stage protocol
- ✅ Intent selected before write
- ✅ Write succeeds within scope
- ✅ Trace logged to agent_trace.jsonl

---

### Test 4: Hook Execution (Phase 1.1)

**Goal:** Verify hooks are called during tool execution

**Steps:**

1. Press F5 to launch extension
2. Open Developer Console
3. Filter console for: `Hook`
4. Ask Roo Code: "Create a file called demo.txt with Hello World"

**Expected Output:**

```
[PreToolHook] Tool: write_to_file
[PostToolHook] Tool: write_to_file completed
```

**Success Criteria:**

- ✅ Pre-hook logs appear BEFORE file creation
- ✅ Post-hook logs appear AFTER file creation
- ✅ File is created successfully
- ✅ No crashes or errors

---

### Test 5: Scope Validation (Phase 1.2)

**Goal:** Verify PreToolHook blocks out-of-scope writes

**Setup:**
Current intent scope: `src/hooks/`, `src/core/assistant-message/`

**Test 2A: In-Scope Write (Should Allow)**

1. Ask: "Create a file src/hooks/test-file.ts with export const test = true"
2. Check console for: `[PreToolHook] Tool: write_to_file`
3. Verify file is created

**Expected:** ✅ File created successfully

**Test 2B: Out-of-Scope Write (Should Block)**

1. Ask: "Create a file src/other/test.ts with export const test = true"
2. Check console for: `[PreToolHook] File src/other/test.ts out of scope - blocking`
3. Check console for: `[PreHook] Tool write_to_file blocked by pre-hook`
4. Verify file is NOT created
5. Verify agent receives error message about scope violation

**Expected:** ✅ Hook blocks the write, file is not created, agent receives error feedback

---

### Test 6: Traceability (Phase 1.2)

**Goal:** Verify PostToolHook logs to agent_trace.jsonl

**Steps:**

1. Ask: "Create a file src/hooks/trace-test.ts with a comment"
2. Wait for completion
3. Check file: `.orchestration/agent_trace.jsonl`

**Expected Content:**

```json
{
	"timestamp": "2026-02-18T...",
	"toolName": "write_to_file",
	"filePath": "src/hooks/trace-test.ts",
	"result": "success"
}
```

**Success Criteria:**

- ✅ Trace file exists
- ✅ Entry has timestamp
- ✅ Entry has tool name
- ✅ Entry has file path
- ✅ JSON format is valid

---

### Test 7: Intent Loading (Phase 1.2)

**Goal:** Verify IntentManager loads active_intents.yaml

**Steps:**

1. Check console on extension startup
2. Look for: `[PreToolHook] No active intent - allowing` OR intent loading logs
3. Modify `.orchestration/active_intents.yaml`
4. Restart extension
5. Verify new intent is loaded

**Success Criteria:**

- ✅ Intent file is read
- ✅ Scope patterns are applied
- ✅ No crashes on invalid YAML (fail-safe)

---

### Test 8: Fail-Safe Behavior

**Goal:** Verify hooks never crash the agent

**Test 5A: Missing Intent File**

1. Rename `.orchestration/active_intents.yaml` to `.bak`
2. Ask Roo Code to create a file
3. Check console for: `[PreToolHook] No active intent - allowing`

**Expected:** ✅ Tool executes normally (fail-safe)

**Test 5B: Invalid YAML**

1. Add invalid YAML to active_intents.yaml: `{{{invalid`
2. Ask Roo Code to create a file
3. Check console for error log (not crash)

**Expected:** ✅ Extension continues working (fail-safe)

---

## Quick Test Checklist

Run through these quickly:

**Phase 1 Final (Intent-Driven Protocol):**

- [ ] System prompt contains "Intent-Driven Architect"
- [ ] select_active_intent tool exists and works
- [ ] Gatekeeper blocks writes without intent
- [ ] Agent can select intent and then write
- [ ] Full workflow: select → write → trace

**Phase 1.1 (Hook Infrastructure):**

- [ ] Extension launches without errors
- [ ] Pre-hook logs appear in console
- [ ] Post-hook logs appear in console

**Phase 1.2 (Intent Management & Traceability):**

- [ ] Trace file is created
- [ ] Trace file has valid JSON
- [ ] In-scope files are allowed
- [ ] Out-of-scope files are blocked
- [ ] Missing intent file doesn't crash
- [ ] Invalid YAML doesn't crash
- [ ] All tools still work normally

---

## Console Filter Commands

Use these in Developer Console filter box:

```
Hook          # Show all hook logs
PreToolHook   # Show only pre-hook logs
PostToolHook  # Show only post-hook logs
Error         # Show errors (should be none from hooks)
```

---

## Expected Console Output (Full Flow)

**Without Intent (Blocked):**

```
[PreToolHook] Tool: write_to_file
[PreToolHook] No intent selected - blocking write operation
[PreHook] Tool write_to_file blocked by pre-hook
```

**With Intent Selection (Success):**

```
[SelectActiveIntentTool] Loading intent: test-intent-001
[PreToolHook] Tool: write_to_file
[PostToolHook] Tool: write_to_file completed
```

**Legacy Mode (No Intent File):**

```
[PreToolHook] Tool: write_to_file
[PreToolHook] No active intent - allowing
[PostToolHook] Tool: write_to_file completed
```

---

## Troubleshooting

**No hook logs appear:**

- Check if extension is running from correct branch
- Verify build completed successfully
- Check if hooks are imported in presentAssistantMessage.ts

**Extension crashes:**

- Check console for stack trace
- Verify TypeScript compilation passed
- Check if fail-safe try-catch is present

**Trace file not created:**

- Check if .orchestration/ directory exists
- Verify write permissions
- Check PostToolHook error logs

---

## Success Criteria Summary

**Phase 1 Final (Intent-Driven Protocol):**

- ✅ System prompt enforces Intent-Driven protocol
- ✅ select_active_intent tool implemented
- ✅ Gatekeeper blocks writes without intent
- ✅ Two-stage state machine working
- ✅ Context injection via XML block

**Phase 1.1 (Hook Infrastructure):**

- ✅ Hooks execute without crashing
- ✅ Pre-hook logs appear before tool execution
- ✅ Post-hook logs appear after tool execution

**Phase 1.2 (Intent Management):**

- ✅ IntentManager loads YAML file
- ✅ Scope validation works
- ✅ TraceLogger creates JSONL file
- ✅ Fail-safe behavior on errors

**Overall:**

- ✅ Extension works normally
- ✅ No performance degradation
- ✅ No breaking changes
- ✅ All 5 TRP1 Phase 1 requirements met

---

## Test Results Template

**Date:** **\*\***\_\_\_**\*\***
**Tester:** **\*\***\_\_\_**\*\***

### Phase 1 Final Results

- System prompt protocol: ☐ PASS ☐ FAIL
- select_active_intent tool: ☐ PASS ☐ FAIL
- Gatekeeper logic: ☐ PASS ☐ FAIL
- Full intent workflow: ☐ PASS ☐ FAIL

### Phase 1.1 Results

- Hook execution: ☐ PASS ☐ FAIL
- Pre-hook logs: ☐ PASS ☐ FAIL
- Post-hook logs: ☐ PASS ☐ FAIL

### Phase 1.2 Results

- Intent loading: ☐ PASS ☐ FAIL
- Scope validation: ☐ PASS ☐ FAIL
- Trace logging: ☐ PASS ☐ FAIL
- Fail-safe behavior: ☐ PASS ☐ FAIL

### Overall Status

☐ ALL TESTS PASS - Phase 1 Complete ✅
☐ SOME FAILURES - Debug Required ⚠️

**Notes:**

---

---

---
