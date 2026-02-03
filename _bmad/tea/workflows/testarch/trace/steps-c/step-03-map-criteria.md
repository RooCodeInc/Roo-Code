---
name: "step-03-map-criteria"
description: "Map acceptance criteria to tests and build traceability matrix"
nextStepFile: "./step-04-analyze-gaps.md"
---

# Step 3: Map Criteria to Tests

## STEP GOAL

Create the traceability matrix linking requirements to tests.

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

## 1. Build Matrix

For each acceptance criterion:

- Map to matching tests
- Mark coverage status: FULL / PARTIAL / NONE / UNIT-ONLY / INTEGRATION-ONLY
- Record test level and priority

---

## 2. Validate Coverage Logic

Ensure:

- P0/P1 criteria have coverage
- No duplicate coverage across levels without justification

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
