---
name: "step-05-gate-decision"
description: "Phase 2: Apply gate decision logic and generate outputs"
outputFile: "{output_folder}/traceability-report.md"
---

# Step 5: Phase 2 - Gate Decision

## STEP GOAL

**Phase 2:** Read coverage matrix from Phase 1, apply deterministic gate decision logic, and generate traceability report.

---

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- ✅ Read coverage matrix from Phase 1 temp file
- ✅ Apply gate decision logic
- ❌ Do NOT regenerate coverage matrix (use Phase 1 output)

---

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Record outputs before proceeding
- 📖 This is the FINAL step

## CONTEXT BOUNDARIES:

- Available context: Coverage matrix from Phase 1 temp file
- Focus: gate decision logic only
- Dependencies: Phase 1 complete (coverage matrix exists)

---

## MANDATORY SEQUENCE

### 1. Read Phase 1 Coverage Matrix

```javascript
const matrixPath = "/tmp/tea-trace-coverage-matrix-{{timestamp}}.json"
const coverageMatrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"))

console.log("✅ Phase 1 coverage matrix loaded")
```

**Verify Phase 1 complete:**

```javascript
if (coverageMatrix.phase !== "PHASE_1_COMPLETE") {
	throw new Error("Phase 1 not complete - cannot proceed to gate decision")
}
```

---

### 2. Apply Gate Decision Logic

**Decision Tree:**

```javascript
const stats = coverageMatrix.coverage_statistics
const p0Coverage = stats.priority_breakdown.P0.percentage
const overallCoverage = stats.overall_coverage_percentage
const criticalGaps = coverageMatrix.gap_analysis.critical_gaps.length

let gateDecision
let rationale

// Rule 1: P0 coverage must be 100%
if (p0Coverage < 100) {
	gateDecision = "FAIL"
	rationale = `P0 coverage is ${p0Coverage}% (required: 100%). ${criticalGaps} critical requirements uncovered.`
}
// Rule 2: Overall coverage >= 90% with P0 at 100% → PASS
else if (overallCoverage >= 90) {
	gateDecision = "PASS"
	rationale = `P0 coverage is 100% and overall coverage is ${overallCoverage}% (target: 90%).`
}
// Rule 3: Overall coverage >= 75% with P0 at 100% → CONCERNS
else if (overallCoverage >= 75) {
	gateDecision = "CONCERNS"
	rationale = `P0 coverage is 100% but overall coverage is ${overallCoverage}% (target: 90%). Consider expanding coverage.`
}
// Rule 4: P0 at 100% but overall < 75% → FAIL
else {
	gateDecision = "FAIL"
	rationale = `Overall coverage is ${overallCoverage}% (minimum: 75%). Significant gaps exist.`
}

// Rule 5: Manual waiver option
const manualWaiver = false // Can be set via config or user input
if (manualWaiver) {
	gateDecision = "WAIVED"
	rationale += " Manual waiver applied by stakeholder."
}
```

---

### 3. Generate Gate Report

```javascript
const gateReport = {
	decision: gateDecision,
	rationale: rationale,
	decision_date: new Date().toISOString(),

	coverage_matrix: coverageMatrix,

	gate_criteria: {
		p0_coverage_required: "100%",
		p0_coverage_actual: `${p0Coverage}%`,
		p0_status: p0Coverage === 100 ? "MET" : "NOT MET",

		overall_coverage_target: "90%",
		overall_coverage_actual: `${overallCoverage}%`,
		overall_status: overallCoverage >= 90 ? "MET" : overallCoverage >= 75 ? "PARTIAL" : "NOT MET",
	},

	uncovered_requirements: coverageMatrix.gap_analysis.critical_gaps.concat(coverageMatrix.gap_analysis.high_gaps),

	recommendations: coverageMatrix.recommendations,
}
```

---

### 4. Generate Traceability Report

**Use trace-template.md to generate:**

```markdown
# Traceability Report

## Gate Decision: {gateDecision}

**Rationale:** {rationale}

## Coverage Summary

- Total Requirements: {totalRequirements}
- Covered: {fullyCovered} ({coveragePercentage}%)
- P0 Coverage: {p0CoveragePercentage}%

## Traceability Matrix

[Full matrix with requirement → test mappings]

## Gaps & Recommendations

[List of uncovered requirements with recommended actions]

## Next Actions

{recommendations}
```

**Save to:**

```javascript
fs.writeFileSync("{outputFile}", reportContent, "utf8")
```

---

### 5. Display Gate Decision

```
🚨 GATE DECISION: {gateDecision}

📊 Coverage Analysis:
- P0 Coverage: {p0Coverage}% (Required: 100%) → {p0_status}
- Overall Coverage: {overallCoverage}% (Target: 90%) → {overall_status}

✅ Decision Rationale:
{rationale}

⚠️ Critical Gaps: {criticalGaps.length}

📝 Recommended Actions:
{list top 3 recommendations}

📂 Full Report: {outputFile}

{if FAIL}
🚫 GATE: FAIL - Release BLOCKED until coverage improves
{endif}

{if CONCERNS}
⚠️ GATE: CONCERNS - Proceed with caution, address gaps soon
{endif}

{if PASS}
✅ GATE: PASS - Release approved, coverage meets standards
{endif}
```

---

## EXIT CONDITION

**WORKFLOW COMPLETE when:**

- ✅ Phase 1 coverage matrix read successfully
- ✅ Gate decision logic applied
- ✅ Traceability report generated
- ✅ Gate decision displayed

**Workflow terminates here.**

---

## 🚨 PHASE 2 SUCCESS METRICS

### ✅ SUCCESS:

- Coverage matrix read from Phase 1
- Gate decision made with clear rationale
- Report generated and saved
- Decision communicated clearly

### ❌ FAILURE:

- Could not read Phase 1 matrix
- Gate decision logic incorrect
- Report missing or incomplete

**Master Rule:** Gate decision MUST be deterministic based on clear criteria (P0 100%, overall 90/75%).
