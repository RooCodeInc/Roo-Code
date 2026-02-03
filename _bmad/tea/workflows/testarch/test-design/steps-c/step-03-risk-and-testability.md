---
name: "step-03-risk-and-testability"
description: "Perform testability review (system-level) and risk assessment"
nextStepFile: "./step-04-coverage-plan.md"
---

# Step 3: Testability & Risk Assessment

## STEP GOAL

Produce a defensible testability review (system-level) and a risk assessment matrix (all modes).

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- 🎯 Base conclusions on evidence from loaded artifacts

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

## 1. System-Level Mode: Testability Review

If **system-level**, evaluate architecture for:

- **Controllability** (state seeding, mockability, fault injection)
- **Observability** (logs, metrics, traces, deterministic assertions)
- **Reliability** (isolation, reproducibility, parallel safety)

**Structure output as:**

1. **🚨 Testability Concerns** (actionable issues first)
2. **✅ Testability Assessment Summary** (what is already strong)

Also identify **ASRs** (Architecturally Significant Requirements):

- Mark each as **ACTIONABLE** or **FYI**

---

## 2. All Modes: Risk Assessment

Using `risk-governance.md` and `probability-impact.md` (if loaded):

- Identify real risks (not just features)
- Classify by category: TECH / SEC / PERF / DATA / BUS / OPS
- Score Probability (1–3) and Impact (1–3)
- Calculate Risk Score (P × I)
- Flag high risks (score ≥ 6)
- Define mitigation, owner, and timeline

---

## 3. Summarize Risk Findings

Summarize the highest risks and their mitigation priorities.

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
