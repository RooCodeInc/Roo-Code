---
name: "step-05-generate-output"
description: "Generate output documents and validate against checklist"
outputFile: "{output_folder}/test-design-epic-{epic_num}.md"
---

# Step 5: Generate Outputs & Validate

## STEP GOAL

Write the final test-design document(s) using the correct template(s), then validate against the checklist.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- ✅ Use the provided templates and output paths

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

## 1. Select Output Template(s)

### System-Level Mode (Phase 3)

Generate **two** documents:

- `{output_folder}/test-design-architecture.md` using `test-design-architecture-template.md`
- `{output_folder}/test-design-qa.md` using `test-design-qa-template.md`

### Epic-Level Mode (Phase 4)

Generate **one** document:

- `{outputFile}` using `test-design-template.md`
- If `epic_num` is unclear, ask the user

---

## 2. Populate Templates

Ensure the outputs include:

- Risk assessment matrix
- Coverage matrix and priorities
- Execution strategy
- Resource estimates (ranges)
- Quality gate criteria
- Any mode-specific sections required by the template

---

## 3. Validation

Validate the output(s) against:

- `checklist.md` in this workflow folder

If any checklist criteria are missing, fix before completion.

---

## 4. Completion Report

Summarize:

- Mode used
- Output file paths
- Key risks and gate thresholds
- Any open assumptions

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
