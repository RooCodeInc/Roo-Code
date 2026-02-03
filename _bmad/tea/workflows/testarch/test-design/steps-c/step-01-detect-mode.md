---
name: "step-01-detect-mode"
description: "Determine system-level vs epic-level mode and validate prerequisites"
nextStepFile: "./step-02-load-context.md"
---

# Step 1: Detect Mode & Prerequisites

## STEP GOAL

Determine whether to run **System-Level** or **Epic-Level** test design, and confirm required inputs are available.

## MANDATORY EXECUTION RULES

### Universal Rules

- 📖 Read this entire step file before taking any action
- ✅ Speak in `{communication_language}`
- 🚫 Do not load the next step until this step is complete

### Role Reinforcement

- ✅ You are the **Master Test Architect**
- ✅ You prioritize risk-based, evidence-backed decisions

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

## 1. Mode Detection (Priority Order)

### A) User Intent (Highest Priority)

Use explicit intent if the user already indicates scope:

- **PRD + ADR (no epic/stories)** → **System-Level Mode**
- **Epic + Stories (no PRD/ADR)** → **Epic-Level Mode**
- **Both PRD/ADR + Epic/Stories** → Prefer **System-Level Mode** first

If intent is unclear, ask:

> "Should I create (A) **System-level** test design (PRD + ADR → Architecture + QA docs), or (B) **Epic-level** test design (Epic → single test plan)?"

### B) File-Based Detection (BMad-Integrated)

If user intent is unclear:

- If `{implementation_artifacts}/sprint-status.yaml` exists → **Epic-Level Mode**
- Otherwise → **System-Level Mode**

### C) Ambiguous → Ask

If mode still unclear, ask the user to choose (A) or (B) and **halt** until they respond.

---

## 2. Prerequisite Check (Mode-Specific)

### System-Level Mode Requires:

- PRD (functional + non-functional requirements)
- ADR or architecture decision records
- Architecture or tech-spec document

### Epic-Level Mode Requires:

- Epic and/or story requirements with acceptance criteria
- Architecture context (if available)

### HALT CONDITIONS

If required inputs are missing **and** the user cannot provide them:

- **System-Level**: "Please provide PRD + ADR/architecture docs to proceed."
- **Epic-Level**: "Please provide epic/story requirements or acceptance criteria to proceed."

---

## 3. Confirm Mode

State which mode you will use and why. Then proceed.

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
