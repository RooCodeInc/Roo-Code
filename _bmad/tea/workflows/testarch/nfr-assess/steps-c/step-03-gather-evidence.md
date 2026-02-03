---
name: "step-03-gather-evidence"
description: "Collect evidence for each NFR category"
nextStepFile: "./step-04-evaluate-and-score.md"
---

# Step 3: Gather Evidence

## STEP GOAL

Collect measurable evidence to evaluate each NFR category.

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

## 1. Evidence Sources

Collect evidence for:

- **Performance**: load tests, metrics, response time data
- **Security**: scans, auth tests, vuln reports
- **Reliability**: error rates, burn-in runs, failover tests
- **Maintainability**: test quality, code health signals
- **Other categories**: logs, monitoring, DR drills, deployability checks

---

## 2. Evidence Gaps

If evidence is missing for a category, mark that category as **CONCERNS**.

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
