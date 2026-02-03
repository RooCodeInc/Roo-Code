---
name: "step-03-scaffold-framework"
description: "Create directory structure, config, fixtures, factories, and sample tests"
nextStepFile: "./step-04-docs-and-scripts.md"
knowledgeIndex: "{project-root}/_bmad/tea/testarch/tea-index.csv"
---

# Step 3: Scaffold Framework

## STEP GOAL

Generate the test directory structure, configuration files, fixtures, factories, helpers, and sample tests.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- ✅ Apply knowledge base patterns where required

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

## 1. Create Directory Structure

Create:

- `{test_dir}/e2e/`
- `{test_dir}/support/fixtures/`
- `{test_dir}/support/helpers/`
- `{test_dir}/support/page-objects/` (optional)

---

## 2. Generate Framework Config

Create `playwright.config.ts` or `cypress.config.ts` with:

- **Timeouts**: action 15s, navigation 30s, test 60s
- **Base URL**: env fallback (`BASE_URL`)
- **Artifacts**: retain-on-failure (trace/screenshot/video)
- **Reporters**: HTML + JUnit + console
- **Parallelism**: enabled (CI tuned)

Use TypeScript if `use_typescript: true`.

---

## 3. Environment & Node

Create:

- `.env.example` with `TEST_ENV`, `BASE_URL`, `API_URL`
- `.nvmrc` using current LTS Node (prefer Node 24+)

---

## 4. Fixtures & Factories

Read `{config_source}` and use `{knowledgeIndex}` to load fragments based on `config.tea_use_playwright_utils`:

**If Playwright Utils enabled:**

- `overview.md`, `fixtures-composition.md`, `auth-session.md`, `api-request.md`, `burn-in.md`, `network-error-monitor.md`, `data-factories.md`
- Recommend installing `@seontechnologies/playwright-utils`

**If disabled:**

- `fixture-architecture.md`, `data-factories.md`, `network-first.md`, `playwright-config.md`, `test-quality.md`

Implement:

- Fixture index with `mergeTests`
- Auto-cleanup hooks
- Faker-based data factories with overrides

---

## 5. Sample Tests & Helpers

Create example tests in `{test_dir}/e2e/` demonstrating:

- Given/When/Then format
- data-testid selector strategy
- Factory usage
- Network interception pattern (if applicable)

Create helpers for:

- API clients (if needed)
- Network utilities
- Auth helpers

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
