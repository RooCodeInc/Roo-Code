---
name: "step-02-select-framework"
description: "Select Playwright or Cypress and justify choice"
nextStepFile: "./step-03-scaffold-framework.md"
---

# Step 2: Framework Selection

## STEP GOAL

Choose the most appropriate framework and document the rationale.

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

## 1. Selection Logic

Default to **Playwright** unless strong reasons suggest Cypress.

**Playwright recommended when:**

- Large or complex repo
- Multi-browser support needed
- Heavy API + UI integration
- CI speed/parallelism is important

**Cypress recommended when:**

- Small team prioritizes DX
- Component testing focus
- Simpler setup needed

Respect `framework_preference` if explicitly set.

---

## 2. Announce Decision

State the selected framework and reasoning.

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
