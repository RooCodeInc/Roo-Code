---
name: "step-01-preflight-and-context"
description: "Verify prerequisites and load story, framework, and knowledge base"
nextStepFile: "./step-02-generation-mode.md"
knowledgeIndex: "{project-root}/_bmad/tea/testarch/tea-index.csv"
---

# Step 1: Preflight & Context Loading

## STEP GOAL

Verify prerequisites and load all required inputs before generating failing tests.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- 🚫 Halt if requirements are missing

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

## 1. Prerequisites (Hard Requirements)

- Story approved with **clear acceptance criteria**
- Test framework configured (`playwright.config.ts` or `cypress.config.ts`)
- Development environment available

If any are missing: **HALT** and notify the user.

---

## 2. Load Story Context

- Read story markdown from `{story_file}` (or ask user if not provided)
- Extract acceptance criteria and constraints
- Identify affected components and integrations

---

## 3. Load Framework & Existing Patterns

- Read framework config
- Inspect `{test_dir}` for existing test patterns, fixtures, helpers

## 3.5 Read TEA Config Flags

From `{config_source}`:

- `tea_use_playwright_utils`
- `tea_use_mcp_enhancements`

---

## 4. Load Knowledge Base Fragments

Use `{knowledgeIndex}` to load:

**Core (always):**

- `data-factories.md`
- `component-tdd.md`
- `test-quality.md`
- `test-healing-patterns.md`
- `selector-resilience.md`
- `timing-debugging.md`

**Playwright Utils (if enabled):**

- `overview.md`, `api-request.md`, `network-recorder.md`, `auth-session.md`, `intercept-network-call.md`, `recurse.md`, `log.md`, `file-utils.md`, `network-error-monitor.md`, `fixtures-composition.md`

**Traditional Patterns (if utils disabled):**

- `fixture-architecture.md`
- `network-first.md`

---

## 5. Confirm Inputs

Summarize loaded inputs and confirm with the user. Then proceed.

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
