---
name: "step-01-load-context"
description: "Load knowledge base, determine scope, and gather context"
nextStepFile: "./step-02-discover-tests.md"
knowledgeIndex: "{project-root}/_bmad/tea/testarch/tea-index.csv"
---

# Step 1: Load Context & Knowledge Base

## STEP GOAL

Determine review scope, load required knowledge fragments, and gather related artifacts.

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

## 1. Determine Scope

Use `review_scope`:

- **single**: one file
- **directory**: all tests in folder
- **suite**: all tests in repo

If unclear, ask the user.

---

## 2. Load Knowledge Base

From `{knowledgeIndex}` load:

Read `{config_source}` and check `tea_use_playwright_utils` to select the correct fragment set.

**Core:**

- `test-quality.md`
- `data-factories.md`
- `test-levels-framework.md`
- `selective-testing.md`
- `test-healing-patterns.md`
- `selector-resilience.md`
- `timing-debugging.md`

**If Playwright Utils enabled:**

- `overview.md`, `api-request.md`, `network-recorder.md`, `auth-session.md`, `intercept-network-call.md`, `recurse.md`, `log.md`, `file-utils.md`, `burn-in.md`, `network-error-monitor.md`, `fixtures-composition.md`

**If disabled:**

- `fixture-architecture.md`
- `network-first.md`
- `playwright-config.md`
- `component-tdd.md`
- `ci-burn-in.md`

---

## 3. Gather Context Artifacts

If available:

- Story file (acceptance criteria)
- Test design doc (priorities)
- Framework config

Summarize what was found.

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
