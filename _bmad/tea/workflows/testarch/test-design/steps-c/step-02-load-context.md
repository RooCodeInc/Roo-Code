---
name: "step-02-load-context"
description: "Load documents, configuration, and knowledge fragments for the chosen mode"
nextStepFile: "./step-03-risk-and-testability.md"
knowledgeIndex: "{project-root}/_bmad/tea/testarch/tea-index.csv"
---

# Step 2: Load Context & Knowledge Base

## STEP GOAL

Load the required documents, config flags, and knowledge fragments needed to produce accurate test design outputs.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- 🎯 Only load artifacts required for the selected mode

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

## 1. Load Configuration

From `{config_source}`:

- Read `tea_use_playwright_utils`
- Note `output_folder`

---

## 2. Load Project Artifacts (Mode-Specific)

### System-Level Mode (Phase 3)

Load:

- PRD (FRs + NFRs)
- ADRs or architecture decisions
- Architecture / tech-spec document
- Epics (for scope)

Extract:

- Tech stack & dependencies
- Integration points
- NFRs (performance, security, reliability, compliance)

### Epic-Level Mode (Phase 4)

Load:

- Epic and story docs with acceptance criteria
- PRD (if available)
- Architecture / tech-spec (if available)
- Prior system-level test-design outputs (if available)

Extract:

- Testable requirements
- Integration points
- Known coverage gaps

---

## 3. Analyze Existing Test Coverage (Epic-Level)

If epic-level:

- Scan the repository for existing tests (search for `tests/`, `spec`, `e2e`, `api` folders)
- Identify coverage gaps and flaky areas
- Note existing fixture and test patterns

---

## 4. Load Knowledge Base Fragments

Use `{knowledgeIndex}` to select and load only relevant fragments.

### System-Level Mode (Required)

- `adr-quality-readiness-checklist.md`
- `test-levels-framework.md`
- `risk-governance.md`
- `test-quality.md`

### Epic-Level Mode (Required)

- `risk-governance.md`
- `probability-impact.md`
- `test-levels-framework.md`
- `test-priorities-matrix.md`

---

## 5. Confirm Loaded Inputs

Summarize what was loaded and confirm with the user if anything is missing.

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
