---
name: "step-02-discover-tests"
description: "Find and parse test files"
nextStepFile: "./step-03-quality-evaluation.md"
---

# Step 2: Discover & Parse Tests

## STEP GOAL

Collect test files in scope and parse structure/metadata.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`

---

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Record outputs before proceeding
- 📖 Load the next step only when instructed

## CONTEXT BOUNDARIES:

- Available context: config, loaded artifacts, and knowledge fragments
- Focus: this step's goal only
- Limits: do not execute future steps
- Dependencies: prior steps' outputs (if any)

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

## 1. Discover Test Files

- **single**: use provided file path
- **directory**: glob under `{test_dir}` or selected folder
- **suite**: glob all tests in repo

Halt if no tests are found.

---

## 2. Parse Metadata (per file)

Collect:

- File size and line count
- Test framework detected
- Describe/test block counts
- Test IDs and priority markers
- Imports, fixtures, factories, network interception
- Waits/timeouts and control flow (if/try/catch)

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
