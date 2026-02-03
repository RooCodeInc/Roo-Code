---
name: "step-04-generate-tests"
description: "Orchestrate parallel FAILING test generation (TDD red phase)"
nextStepFile: "./step-04c-aggregate.md"
---

# Step 4: Orchestrate Parallel FAILING Test Generation

## STEP GOAL

Launch parallel subprocesses to generate FAILING API and E2E tests simultaneously (TDD RED PHASE) for maximum performance.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- ✅ Launch TWO subprocesses in PARALLEL
- ✅ Generate FAILING tests only (TDD red phase)
- ✅ Wait for BOTH subprocesses to complete
- ❌ Do NOT generate sequential tests (use subprocesses)
- ❌ Do NOT generate passing tests (this is red phase)
- ❌ Do NOT proceed until both subprocesses finish

---

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Wait for subprocess outputs
- 📖 Load the next step only when instructed

## CONTEXT BOUNDARIES:

- Available context: config, acceptance criteria from Step 1, test strategy from Step 3
- Focus: subprocess orchestration only
- Limits: do not generate tests directly (delegate to subprocesses)
- Dependencies: Steps 1-3 outputs

---

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

### 1. Prepare Subprocess Inputs

**Generate unique timestamp** for temp file naming:

```javascript
const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
```

**Prepare input context for both subprocesses:**

```javascript
const subprocessContext = {
  story_acceptance_criteria: /* from Step 1 */,
  test_strategy: /* from Step 3 */,
  knowledge_fragments_loaded: /* list of fragments */,
  config: {
    test_framework: config.test_framework,
    use_playwright_utils: config.tea_use_playwright_utils
  },
  timestamp: timestamp
};
```

---

### 2. Launch Subprocess A: Failing API Test Generation

**Launch subprocess in parallel:**

- **Subprocess File:** `./step-04a-subprocess-api-failing.md`
- **Output File:** `/tmp/tea-atdd-api-tests-${timestamp}.json`
- **Context:** Pass `subprocessContext`
- **Execution:** PARALLEL (non-blocking)
- **TDD Phase:** RED (failing tests)

**System Action:**

```
🚀 Launching Subprocess A: FAILING API Test Generation (RED PHASE)
📝 Output: /tmp/tea-atdd-api-tests-${timestamp}.json
🔴 TDD Phase: RED (tests will fail until feature implemented)
⏳ Status: Running in parallel...
```

---

### 3. Launch Subprocess B: Failing E2E Test Generation

**Launch subprocess in parallel:**

- **Subprocess File:** `./step-04b-subprocess-e2e-failing.md`
- **Output File:** `/tmp/tea-atdd-e2e-tests-${timestamp}.json`
- **Context:** Pass `subprocessContext`
- **Execution:** PARALLEL (non-blocking)
- **TDD Phase:** RED (failing tests)

**System Action:**

```
🚀 Launching Subprocess B: FAILING E2E Test Generation (RED PHASE)
📝 Output: /tmp/tea-atdd-e2e-tests-${timestamp}.json
🔴 TDD Phase: RED (tests will fail until feature implemented)
⏳ Status: Running in parallel...
```

---

### 4. Wait for Both Subprocesses to Complete

**Monitor subprocess execution:**

```
⏳ Waiting for subprocesses to complete...
  ├── Subprocess A (API RED): Running... ⟳
  └── Subprocess B (E2E RED): Running... ⟳

[... time passes ...]

  ├── Subprocess A (API RED): Complete ✅
  └── Subprocess B (E2E RED): Complete ✅

✅ All subprocesses completed successfully!
```

**Verify both outputs exist:**

```javascript
const apiOutputExists = fs.existsSync(`/tmp/tea-atdd-api-tests-${timestamp}.json`)
const e2eOutputExists = fs.existsSync(`/tmp/tea-atdd-e2e-tests-${timestamp}.json`)

if (!apiOutputExists || !e2eOutputExists) {
	throw new Error("One or both subprocess outputs missing!")
}
```

---

### 5. TDD Red Phase Report

**Display TDD status:**

```
🔴 TDD RED PHASE: Failing Tests Generated

✅ Both subprocesses completed:
- API Tests: Generated with test.skip()
- E2E Tests: Generated with test.skip()

📋 All tests assert EXPECTED behavior
📋 All tests will FAIL until feature implemented
📋 This is INTENTIONAL (TDD red phase)

Next: Aggregation will verify TDD compliance
```

---

### 6. Performance Report

**Display performance metrics:**

```
🚀 Performance Report:
- Execution Mode: PARALLEL (2 subprocesses)
- API Test Generation: ~X minutes
- E2E Test Generation: ~Y minutes
- Total Elapsed: ~max(X, Y) minutes
- Sequential Would Take: ~(X + Y) minutes
- Performance Gain: ~50% faster!
```

---

### 7. Proceed to Aggregation

**Load aggregation step:**
Load next step: `{nextStepFile}`

The aggregation step (4C) will:

- Read both subprocess outputs
- Verify TDD red phase compliance (all tests have test.skip())
- Write all test files to disk
- Generate ATDD checklist
- Calculate summary statistics

---

## EXIT CONDITION

Proceed to Step 4C (Aggregation) when:

- ✅ Subprocess A (API failing tests) completed successfully
- ✅ Subprocess B (E2E failing tests) completed successfully
- ✅ Both output files exist and are valid JSON
- ✅ TDD red phase status reported

**Do NOT proceed if:**

- ❌ One or both subprocesses failed
- ❌ Output files missing or corrupted
- ❌ Subprocess generated passing tests (wrong - must be failing)

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Both subprocesses launched successfully
- Both subprocesses completed without errors
- Output files generated and valid
- Tests generated with test.skip() (TDD red phase)
- Parallel execution achieved ~50% performance gain

### ❌ SYSTEM FAILURE:

- Failed to launch subprocesses
- One or both subprocesses failed
- Output files missing or invalid
- Tests generated without test.skip() (wrong phase)
- Attempted sequential generation instead of parallel

**Master Rule:** TDD RED PHASE requires FAILING tests (with test.skip()). Parallel subprocess execution is MANDATORY for performance.
