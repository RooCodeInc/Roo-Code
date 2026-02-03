---
name: "step-04-analyze-gaps"
description: "Complete Phase 1: Generate coverage matrix with gap analysis"
nextStepFile: "./step-05-gate-decision.md"
outputFile: "/tmp/tea-trace-coverage-matrix-{{timestamp}}.json"
---

# Step 4: Complete Phase 1 - Coverage Matrix Generation

## STEP GOAL

**Phase 1 Final Step:** Analyze coverage gaps, generate recommendations, and output complete coverage matrix to temp file for Phase 2 (gate decision).

---

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- ✅ Output coverage matrix to temp file
- ❌ Do NOT make gate decision (that's Phase 2 - Step 5)

---

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Record outputs before proceeding
- 📖 Load the next step only when instructed

## CONTEXT BOUNDARIES:

- Available context: requirements from Step 1, tests from Step 2, traceability matrix from Step 3
- Focus: gap analysis and matrix completion
- Limits: do not make gate decision (Phase 2 responsibility)

---

## MANDATORY SEQUENCE

### 1. Gap Analysis

**Identify uncovered requirements:**

```javascript
const uncoveredRequirements = traceabilityMatrix.filter((req) => req.coverage === "NONE")
const partialCoverage = traceabilityMatrix.filter((req) => req.coverage === "PARTIAL")
const unitOnlyCoverage = traceabilityMatrix.filter((req) => req.coverage === "UNIT-ONLY")
```

**Prioritize gaps by risk:**

```javascript
const criticalGaps = uncoveredRequirements.filter((req) => req.priority === "P0")
const highGaps = uncoveredRequirements.filter((req) => req.priority === "P1")
const mediumGaps = uncoveredRequirements.filter((req) => req.priority === "P2")
const lowGaps = uncoveredRequirements.filter((req) => req.priority === "P3")
```

---

### 2. Generate Recommendations

**Based on gap analysis:**

```javascript
const recommendations = []

// Critical gaps (P0)
if (criticalGaps.length > 0) {
	recommendations.push({
		priority: "URGENT",
		action: `Run /bmad:tea:atdd for ${criticalGaps.length} P0 requirements`,
		requirements: criticalGaps.map((r) => r.id),
	})
}

// High priority gaps (P1)
if (highGaps.length > 0) {
	recommendations.push({
		priority: "HIGH",
		action: `Run /bmad:tea:automate to expand coverage for ${highGaps.length} P1 requirements`,
		requirements: highGaps.map((r) => r.id),
	})
}

// Partial coverage
if (partialCoverage.length > 0) {
	recommendations.push({
		priority: "MEDIUM",
		action: `Complete coverage for ${partialCoverage.length} partially covered requirements`,
		requirements: partialCoverage.map((r) => r.id),
	})
}

// Quality issues
recommendations.push({
	priority: "LOW",
	action: "Run /bmad:tea:test-review to assess test quality",
	requirements: [],
})
```

---

### 3. Calculate Coverage Statistics

```javascript
const totalRequirements = traceabilityMatrix.length
const coveredRequirements = traceabilityMatrix.filter((r) => r.coverage === "FULL" || r.coverage === "PARTIAL").length
const fullyCovered = traceabilityMatrix.filter((r) => r.coverage === "FULL").length

const coveragePercentage = Math.round((fullyCovered / totalRequirements) * 100)

// Priority-specific coverage
const p0Total = traceabilityMatrix.filter((r) => r.priority === "P0").length
const p0Covered = traceabilityMatrix.filter((r) => r.priority === "P0" && r.coverage === "FULL").length
const p0CoveragePercentage = Math.round((p0Covered / p0Total) * 100)
```

---

### 4. Generate Complete Coverage Matrix

**Compile all Phase 1 outputs:**

```javascript
const coverageMatrix = {
	phase: "PHASE_1_COMPLETE",
	generated_at: new Date().toISOString(),

	requirements: traceabilityMatrix, // Full matrix from Step 3

	coverage_statistics: {
		total_requirements: totalRequirements,
		fully_covered: fullyCovered,
		partially_covered: partialCoverage.length,
		uncovered: uncoveredRequirements.length,
		overall_coverage_percentage: coveragePercentage,

		priority_breakdown: {
			P0: { total: p0Total, covered: p0Covered, percentage: p0CoveragePercentage },
			P1: {
				/* calculate */
			},
			P2: {
				/* calculate */
			},
			P3: {
				/* calculate */
			},
		},
	},

	gap_analysis: {
		critical_gaps: criticalGaps,
		high_gaps: highGaps,
		medium_gaps: mediumGaps,
		low_gaps: lowGaps,
		partial_coverage_items: partialCoverage,
		unit_only_items: unitOnlyCoverage,
	},

	recommendations: recommendations,
}
```

---

### 5. Output Coverage Matrix to Temp File

**Write to temp file for Phase 2:**

```javascript
const outputPath = "/tmp/tea-trace-coverage-matrix-{{timestamp}}.json"
fs.writeFileSync(outputPath, JSON.stringify(coverageMatrix, null, 2), "utf8")

console.log(`✅ Phase 1 Complete: Coverage matrix saved to ${outputPath}`)
```

---

### 6. Display Phase 1 Summary

```
✅ Phase 1 Complete: Coverage Matrix Generated

📊 Coverage Statistics:
- Total Requirements: {totalRequirements}
- Fully Covered: {fullyCovered} ({coveragePercentage}%)
- Partially Covered: {partialCoverage.length}
- Uncovered: {uncoveredRequirements.length}

🎯 Priority Coverage:
- P0: {p0Covered}/{p0Total} ({p0CoveragePercentage}%)
- P1: {p1Coverage}%
- P2: {p2Coverage}%
- P3: {p3Coverage}%

⚠️ Gaps Identified:
- Critical (P0): {criticalGaps.length}
- High (P1): {highGaps.length}
- Medium (P2): {mediumGaps.length}
- Low (P3): {lowGaps.length}

📝 Recommendations: {recommendations.length}

🔄 Phase 2: Gate decision (next step)
```

---

## EXIT CONDITION

**PHASE 1 COMPLETE when:**

- ✅ Gap analysis complete
- ✅ Recommendations generated
- ✅ Coverage statistics calculated
- ✅ Coverage matrix saved to temp file
- ✅ Summary displayed

**Proceed to Phase 2 (Step 5: Gate Decision)**

Load next step: `{nextStepFile}`

---

## 🚨 PHASE 1 SUCCESS METRICS

### ✅ SUCCESS:

- Coverage matrix complete and accurate
- All gaps identified and prioritized
- Recommendations actionable
- Temp file output valid JSON

### ❌ FAILURE:

- Coverage matrix incomplete
- Gap analysis missing
- Invalid JSON output

**Master Rule:** Phase 1 MUST output complete coverage matrix to temp file before Phase 2 can proceed.
