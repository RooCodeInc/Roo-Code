---
name: "step-03-test-strategy"
description: "Map acceptance criteria to test levels and priorities"
nextStepFile: "./step-04-generate-tests.md"
---

# Step 3: Test Strategy

## STEP GOAL

Translate acceptance criteria into a prioritized, level-appropriate test plan.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- 🚫 Avoid duplicate coverage across levels

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

## 1. Map Acceptance Criteria

- Convert each acceptance criterion into test scenarios
- Include negative and edge cases where risk is high

---

## 2. Select Test Levels

Choose the best level per scenario:

- **E2E** for critical user journeys
- **API** for business logic and service contracts
- **Component** for UI behavior

---

## 3. Prioritize Tests

Assign P0–P3 priorities using risk and business impact.

---

## 4. Confirm Red Phase Requirements

Ensure all tests are designed to **fail before implementation** (TDD red phase).

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
