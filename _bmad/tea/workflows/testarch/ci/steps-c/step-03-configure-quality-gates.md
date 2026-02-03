---
name: "step-03-configure-quality-gates"
description: "Configure burn-in, quality gates, and notifications"
nextStepFile: "./step-04-validate-and-summary.md"
knowledgeIndex: "{project-root}/_bmad/tea/testarch/tea-index.csv"
---

# Step 3: Quality Gates & Notifications

## STEP GOAL

Configure burn-in loops, quality thresholds, and notification hooks.

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

## 1. Burn-In Configuration

Use `{knowledgeIndex}` to load `ci-burn-in.md` guidance:

- Run N-iteration burn-in for flaky detection
- Gate promotion based on burn-in stability

---

## 2. Quality Gates

Define:

- Minimum pass rates (P0 = 100%, P1 ≥ 95%)
- Fail CI on critical test failures
- Optional: require traceability or nfr-assess output before release

---

## 3. Notifications

Configure:

- Failure notifications (Slack/email)
- Artifact links

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
