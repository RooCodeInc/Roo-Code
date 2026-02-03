---
name: "step-01-preflight-and-context"
description: "Determine mode, verify framework, and load context and knowledge"
nextStepFile: "./step-02-identify-targets.md"
knowledgeIndex: "{project-root}/_bmad/tea/testarch/tea-index.csv"
---

# Step 1: Preflight & Context Loading

## STEP GOAL

Determine execution mode, verify framework readiness, and load the necessary artifacts and knowledge fragments.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- 🚫 Halt if framework scaffolding is missing

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

## 1. Verify Framework

Ensure a framework exists:

- `playwright.config.ts` or `cypress.config.ts`
- `package.json` includes test dependencies

If missing: **HALT** with message "Run `framework` workflow first."

---

## 2. Determine Execution Mode

- **BMad-Integrated** if story/tech-spec/test-design artifacts are provided or found
- **Standalone** if only source code is available
- If unclear, ask the user which mode to use

---

## 3. Load Context

### BMad-Integrated (if available)

- Story with acceptance criteria
- PRD and/or tech spec
- Test-design document (if exists)

### Standalone

- Skip artifacts; proceed to codebase analysis

### Always Load

- Test framework config
- Existing test structure in `{test_dir}`
- Existing tests (for coverage gaps)

### Read TEA Config Flags

- From `{config_source}` read `tea_use_playwright_utils`

---

## 4. Load Knowledge Base Fragments

Use `{knowledgeIndex}` and load only what is required.

**Core (always load):**

- `test-levels-framework.md`
- `test-priorities-matrix.md`
- `data-factories.md`
- `selective-testing.md`
- `ci-burn-in.md`
- `test-quality.md`

**Playwright Utils (if enabled):**

- `overview.md`, `api-request.md`, `network-recorder.md`, `auth-session.md`, `intercept-network-call.md`, `recurse.md`, `log.md`, `file-utils.md`, `burn-in.md`, `network-error-monitor.md`, `fixtures-composition.md`

**Traditional Patterns (if Playwright Utils disabled):**

- `fixture-architecture.md`
- `network-first.md`

**Healing (if auto-heal enabled):**

- `test-healing-patterns.md`
- `selector-resilience.md`
- `timing-debugging.md`

---

## 5. Confirm Inputs

Summarize loaded artifacts, framework, and knowledge fragments, then proceed.

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
