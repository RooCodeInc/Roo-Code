---
name: "step-03f-aggregate-scores"
description: "Aggregate quality dimension scores into overall 0-100 score"
nextStepFile: "./step-04-generate-report.md"
---

# Step 3F: Aggregate Quality Scores

## STEP GOAL

Read outputs from 5 parallel quality subprocesses, calculate weighted overall score (0-100), and aggregate violations for report generation.

---

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- ✅ Read all 5 subprocess outputs
- ✅ Calculate weighted overall score
- ✅ Aggregate violations by severity
- ❌ Do NOT re-evaluate quality (use subprocess outputs)

---

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Record outputs before proceeding
- 📖 Load the next step only when instructed

---

## MANDATORY SEQUENCE

### 1. Read All Subprocess Outputs

```javascript
const dimensions = ["determinism", "isolation", "maintainability", "coverage", "performance"]
const results = {}

dimensions.forEach((dim) => {
	const outputPath = `/tmp/tea-test-review-${dim}-{{timestamp}}.json`
	results[dim] = JSON.parse(fs.readFileSync(outputPath, "utf8"))
})
```

**Verify all succeeded:**

```javascript
const allSucceeded = dimensions.every((dim) => results[dim].score !== undefined)
if (!allSucceeded) {
	throw new Error("One or more quality subprocesses failed!")
}
```

---

### 2. Calculate Weighted Overall Score

**Dimension Weights** (based on TEA quality priorities):

```javascript
const weights = {
	determinism: 0.25, // 25% - Most critical for reliability
	isolation: 0.25, // 25% - Critical for parallel execution
	maintainability: 0.2, // 20% - Important for long-term health
	coverage: 0.15, // 15% - Important but can be improved iteratively
	performance: 0.15, // 15% - Important but less critical than correctness
}
```

**Calculate overall score:**

```javascript
const overallScore = dimensions.reduce((sum, dim) => {
	return sum + results[dim].score * weights[dim]
}, 0)

const roundedScore = Math.round(overallScore)
```

**Determine grade:**

```javascript
const getGrade = (score) => {
	if (score >= 90) return "A"
	if (score >= 80) return "B"
	if (score >= 70) return "C"
	if (score >= 60) return "D"
	return "F"
}

const overallGrade = getGrade(roundedScore)
```

---

### 3. Aggregate Violations by Severity

**Collect all violations from all dimensions:**

```javascript
const allViolations = dimensions.flatMap((dim) =>
	results[dim].violations.map((v) => ({
		...v,
		dimension: dim,
	})),
)

// Group by severity
const highSeverity = allViolations.filter((v) => v.severity === "HIGH")
const mediumSeverity = allViolations.filter((v) => v.severity === "MEDIUM")
const lowSeverity = allViolations.filter((v) => v.severity === "LOW")

const violationSummary = {
	total: allViolations.length,
	HIGH: highSeverity.length,
	MEDIUM: mediumSeverity.length,
	LOW: lowSeverity.length,
}
```

---

### 4. Prioritize Recommendations

**Extract recommendations from all dimensions:**

```javascript
const allRecommendations = dimensions.flatMap((dim) =>
	results[dim].recommendations.map((rec) => ({
		dimension: dim,
		recommendation: rec,
		impact: results[dim].score < 70 ? "HIGH" : "MEDIUM",
	})),
)

// Sort by impact (HIGH first)
const prioritizedRecommendations = allRecommendations.sort((a, b) => (a.impact === "HIGH" ? -1 : 1)).slice(0, 10) // Top 10 recommendations
```

---

### 5. Create Review Summary Object

**Aggregate all results:**

```javascript
const reviewSummary = {
	overall_score: roundedScore,
	overall_grade: overallGrade,
	quality_assessment: getQualityAssessment(roundedScore),

	dimension_scores: {
		determinism: results.determinism.score,
		isolation: results.isolation.score,
		maintainability: results.maintainability.score,
		coverage: results.coverage.score,
		performance: results.performance.score,
	},

	dimension_grades: {
		determinism: results.determinism.grade,
		isolation: results.isolation.grade,
		maintainability: results.maintainability.grade,
		coverage: results.coverage.grade,
		performance: results.performance.grade,
	},

	violations_summary: violationSummary,

	all_violations: allViolations,

	high_severity_violations: highSeverity,

	top_10_recommendations: prioritizedRecommendations,

	subprocess_execution: "PARALLEL (5 quality dimensions)",
	performance_gain: "~60% faster than sequential",
}

// Save for Step 4 (report generation)
fs.writeFileSync("/tmp/tea-test-review-summary-{{timestamp}}.json", JSON.stringify(reviewSummary, null, 2), "utf8")
```

---

### 6. Display Summary to User

```
✅ Quality Evaluation Complete (Parallel Execution)

📊 Overall Quality Score: {roundedScore}/100 (Grade: {overallGrade})

📈 Dimension Scores:
- Determinism:      {determinism_score}/100 ({determinism_grade})
- Isolation:        {isolation_score}/100 ({isolation_grade})
- Maintainability:  {maintainability_score}/100 ({maintainability_grade})
- Coverage:         {coverage_score}/100 ({coverage_grade})
- Performance:      {performance_score}/100 ({performance_grade})

⚠️ Violations Found:
- HIGH:   {high_count} violations
- MEDIUM: {medium_count} violations
- LOW:    {low_count} violations
- TOTAL:  {total_count} violations

🚀 Performance: Parallel execution ~60% faster than sequential

✅ Ready for report generation (Step 4)
```

---

## EXIT CONDITION

Proceed to Step 4 when:

- ✅ All subprocess outputs read successfully
- ✅ Overall score calculated
- ✅ Violations aggregated
- ✅ Recommendations prioritized
- ✅ Summary saved to temp file
- ✅ Output displayed to user

Load next step: `{nextStepFile}`

---

## 🚨 SYSTEM SUCCESS METRICS

### ✅ SUCCESS:

- All 5 subprocess outputs read and parsed
- Overall score calculated with proper weights
- Violations aggregated correctly
- Summary complete and saved

### ❌ FAILURE:

- Failed to read one or more subprocess outputs
- Score calculation incorrect
- Summary missing or incomplete

**Master Rule:** All 5 quality dimensions MUST be aggregated for accurate overall score.
