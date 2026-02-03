---
name: "step-01-preflight"
description: "Verify prerequisites and detect CI platform"
nextStepFile: "./step-02-generate-pipeline.md"
---

# Step 1: Preflight Checks

## STEP GOAL

Verify CI prerequisites and determine target CI platform.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- 🚫 Halt if requirements fail

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

## 1. Verify Git Repository

- `.git/` exists
- Remote configured (if available)

If missing: **HALT** with "Git repository required for CI/CD setup."

---

## 2. Verify Test Framework

- `playwright.config.*` or `cypress.config.*` exists
- Framework installed in `package.json`

If missing: **HALT** with "Run `framework` workflow first."

---

## 3. Ensure Tests Pass Locally

- Run the main test command (e.g., `npm run test:e2e`)
- If failing: **HALT** and request fixes before CI setup

---

## 4. Detect CI Platform

- Check for existing CI config:
    - `.github/workflows/*.yml` (GitHub Actions)
    - `.gitlab-ci.yml` (GitLab CI)
    - `.circleci/config.yml` (Circle CI)
    - `Jenkinsfile`
- If found, ask whether to update or replace
- If not found, infer from git remote (github.com → GitHub Actions)
- Respect `ci_platform` if explicitly set

---

## 5. Read Environment Context

- Read `.nvmrc` if present (default to Node 24+ LTS if missing)
- Read `package.json` for dependency caching strategy

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
