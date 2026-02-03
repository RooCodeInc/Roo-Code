---
name: "step-04-docs-and-scripts"
description: "Document setup and add package.json scripts"
nextStepFile: "./step-05-validate-and-summary.md"
outputFile: "{test_dir}/README.md"
---

# Step 4: Documentation & Scripts

## STEP GOAL

Create `tests/README.md` and update `package.json` scripts.

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

## 1. tests/README.md

Create `{outputFile}` and include:

- Setup instructions
- Running tests (local/headed/debug)
- Architecture overview (fixtures, factories, helpers)
- Best practices (selectors, isolation, cleanup)
- CI integration notes
- Knowledge base references

---

## 2. package.json Scripts

Add at minimum:

- `test:e2e`: framework execution command

---

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
