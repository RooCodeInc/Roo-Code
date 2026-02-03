---
name: "step-02-generation-mode"
description: "Choose AI generation or recording mode"
nextStepFile: "./step-03-test-strategy.md"
---

# Step 2: Generation Mode Selection

## STEP GOAL

Choose the appropriate generation mode for ATDD tests.

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

## 1. Default Mode: AI Generation

Use AI generation when:

- Acceptance criteria are clear
- Scenarios are standard (CRUD, auth, API, navigation)

Proceed directly to test strategy if this applies.

---

## 2. Optional Mode: Recording (Complex UI)

Use recording only when:

- UI interactions are complex (drag/drop, multi-step wizards)
- `config.tea_use_mcp_enhancements` is true
- Playwright MCP tools are available

If recording mode is chosen:

- Confirm MCP availability
- Record selectors and interactions
- Capture outputs needed for test generation

---

## 3. Confirm Mode

State the chosen mode and why. Then proceed.

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
