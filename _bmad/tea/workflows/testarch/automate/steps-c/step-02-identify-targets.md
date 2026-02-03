---
name: "step-02-identify-targets"
description: "Identify automation targets and create coverage plan"
nextStepFile: "./step-03-generate-tests.md"
---

# Step 2: Identify Automation Targets

## STEP GOAL

Determine what needs to be tested and select appropriate test levels and priorities.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- 🚫 Avoid duplicate coverage across test levels

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

## 1. Determine Targets

**BMad-Integrated:**

- Map acceptance criteria to test scenarios
- Check for existing ATDD outputs to avoid duplication
- Expand coverage with edge cases and negative paths

**Standalone:**

- If specific target feature/files are provided, focus there
- Otherwise auto-discover features in `{source_dir}`
- Prioritize critical paths, integrations, and untested logic

---

## 2. Choose Test Levels

Use `test-levels-framework.md` to select:

- **E2E** for critical user journeys
- **API** for business logic and service contracts
- **Component** for UI behavior
- **Unit** for pure logic and edge cases

---

## 3. Assign Priorities

Use `test-priorities-matrix.md`:

- P0: Critical path + high risk
- P1: Important flows + medium/high risk
- P2: Secondary + edge cases
- P3: Optional/rare scenarios

---

## 4. Coverage Plan

Produce a concise coverage plan:

- Targets by test level
- Priority assignments
- Justification for coverage scope (critical-paths/comprehensive/selective)

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
