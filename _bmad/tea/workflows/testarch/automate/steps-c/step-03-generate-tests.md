---
name: "step-03-generate-tests"
description: "Orchestrate parallel test generation via subprocesses"
nextStepFile: "./step-03c-aggregate.md"
---

# Step 3: Orchestrate Parallel Test Generation

## STEP GOAL

Launch parallel subprocesses to generate API and E2E tests simultaneously for maximum performance.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- ✅ Launch TWO subprocesses in PARALLEL
- ✅ Wait for BOTH subprocesses to complete
- ❌ Do NOT generate tests sequentially (use subprocesses)
- ❌ Do NOT proceed until both subprocesses finish

---

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Wait for subprocess outputs
- 📖 Load the next step only when instructed

## CONTEXT BOUNDARIES:

- Available context: config, coverage plan from Step 2, knowledge fragments
- Focus: subprocess orchestration only
- Limits: do not generate tests directly (delegate to subprocesses)
- Dependencies: Step 2 outputs (coverage plan, target features)

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
  features: /* from Step 2 coverage plan */,
  knowledge_fragments_loaded: /* list of fragments */,
  config: {
    test_framework: config.test_framework,
    use_playwright_utils: config.tea_use_playwright_utils,
    use_mcp_enhancements: config.tea_use_mcp_enhancements
  },
  timestamp: timestamp
};
```

---

### 2. Launch Subprocess A: API Test Generation

**Launch subprocess in parallel:**

- **Subprocess File:** `./step-03a-subprocess-api.md`
- **Output File:** `/tmp/tea-automate-api-tests-${timestamp}.json`
- **Context:** Pass `subprocessContext`
- **Execution:** PARALLEL (non-blocking)

**System Action:**

```
🚀 Launching Subprocess A: API Test Generation
📝 Output: /tmp/tea-automate-api-tests-${timestamp}.json
⏳ Status: Running in parallel...
```

---

### 3. Launch Subprocess B: E2E Test Generation

**Launch subprocess in parallel:**

- **Subprocess File:** `./step-03b-subprocess-e2e.md`
- **Output File:** `/tmp/tea-automate-e2e-tests-${timestamp}.json`
- **Context:** Pass `subprocessContext`
- **Execution:** PARALLEL (non-blocking)

**System Action:**

```
🚀 Launching Subprocess B: E2E Test Generation
📝 Output: /tmp/tea-automate-e2e-tests-${timestamp}.json
⏳ Status: Running in parallel...
```

---

### 4. Wait for Both Subprocesses to Complete

**Monitor subprocess execution:**

```
⏳ Waiting for subprocesses to complete...
  ├── Subprocess A (API): Running... ⟳
  └── Subprocess B (E2E): Running... ⟳

[... time passes ...]

  ├── Subprocess A (API): Complete ✅
  └── Subprocess B (E2E): Complete ✅

✅ All subprocesses completed successfully!
```

**Verify both outputs exist:**

```javascript
const apiOutputExists = fs.existsSync(`/tmp/tea-automate-api-tests-${timestamp}.json`)
const e2eOutputExists = fs.existsSync(`/tmp/tea-automate-e2e-tests-${timestamp}.json`)

if (!apiOutputExists || !e2eOutputExists) {
	throw new Error("One or both subprocess outputs missing!")
}
```

---

### 5. Performance Report

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

### 6. Proceed to Aggregation

**Load aggregation step:**
Load next step: `{nextStepFile}`

The aggregation step (3C) will:

- Read both subprocess outputs
- Write all test files to disk
- Generate shared fixtures and helpers
- Calculate summary statistics

---

## EXIT CONDITION

Proceed to Step 3C (Aggregation) when:

- ✅ Subprocess A (API tests) completed successfully
- ✅ Subprocess B (E2E tests) completed successfully
- ✅ Both output files exist and are valid JSON
- ✅ Performance metrics displayed

**Do NOT proceed if:**

- ❌ One or both subprocesses failed
- ❌ Output files missing or corrupted
- ❌ Timeout occurred (subprocesses took too long)

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Both subprocesses launched successfully
- Both subprocesses completed without errors
- Output files generated and valid
- Parallel execution achieved ~50% performance gain

### ❌ SYSTEM FAILURE:

- Failed to launch subprocesses
- One or both subprocesses failed
- Output files missing or invalid
- Attempted sequential generation instead of parallel

**Master Rule:** Parallel subprocess execution is MANDATORY for performance.
