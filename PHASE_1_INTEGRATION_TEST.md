# Phase 1 Complete Integration Test

## Test Environment Setup

**Prerequisites:**

- Extension built and ready
- `.orchestration/active_intents.yaml` exists
- Developer Console open (Ctrl+Shift+I)

## Test Scenarios

### Test 1: Hook Execution (Phase 1.1)

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

### Test 2: Scope Validation (Phase 1.2)

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

### Test 3: Traceability (Phase 1.2)

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

### Test 4: Intent Loading (Phase 1.2)

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

### Test 5: Fail-Safe Behavior

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

- [ ] Extension launches without errors
- [ ] Pre-hook logs appear in console
- [ ] Post-hook logs appear in console
- [ ] Trace file is created
- [ ] Trace file has valid JSON
- [ ] In-scope files are allowed
- [ ] Out-of-scope files are handled
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

```
[PreToolHook] Tool: write_to_file
[PreToolHook] No active intent - allowing
[PostToolHook] Tool: write_to_file completed
```

OR (with active intent):

```
[PreToolHook] Tool: write_to_file
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

---

## Test Results Template

**Date:** **\*\***\_\_\_**\*\***
**Tester:** **\*\***\_\_\_**\*\***

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
