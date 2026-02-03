---
name: "step-05-generate-report"
description: "Create NFR report and validation summary"
outputFile: "{output_folder}/nfr-assessment.md"
---

# Step 5: Generate Report & Validate

## STEP GOAL

Produce the NFR assessment report and validate completeness.

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

Use `nfr-report-template.md` to produce `{outputFile}` containing:

- Category results (PASS/CONCERNS/FAIL)
- Evidence summary
- Remediation actions
- Gate-ready YAML snippet (if applicable)

---

## 2. Validation

Validate against `checklist.md` and fix gaps.

---

## 3. Completion Summary

Report:

- Overall NFR status
- Critical blockers or waivers needed
- Next recommended workflow (`trace` or release gate)

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
