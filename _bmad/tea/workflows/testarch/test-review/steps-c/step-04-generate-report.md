---
name: "step-04-generate-report"
description: "Create test-review report and validate"
outputFile: "{output_folder}/test-review.md"
---

# Step 4: Generate Report & Validate

## STEP GOAL

Produce the test-review report and validate against checklist.

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

## 1. Report Generation

Use `test-review-template.md` to produce `{outputFile}` including:

- Score summary
- Critical findings with fixes
- Warnings and recommendations
- Context references (story/test-design if available)

---

## 2. Validation

Validate against `checklist.md` and fix any gaps.

---

## 3. Completion Summary

Report:

- Scope reviewed
- Overall score
- Critical blockers
- Next recommended workflow (e.g., `automate` or `trace`)

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
