---
name: "step-03d-subprocess-coverage"
description: "Subprocess: Check test coverage (completeness, edge cases)"
subprocess: true
outputFile: "/tmp/tea-test-review-coverage-{{timestamp}}.json"
---

# Subprocess 3D: Coverage Quality Check

## SUBPROCESS CONTEXT

This is an **isolated subprocess** running in parallel with other quality dimension checks.

**Your task:** Analyze test files for COVERAGE violations only.

---

## MANDATORY EXECUTION RULES

- ✅ Check COVERAGE only (not other quality dimensions)
- ✅ Output structured JSON to temp file
- ❌ Do NOT check determinism, isolation, maintainability, or performance

---

## SUBPROCESS TASK

### 1. Identify Coverage Violations

**HIGH SEVERITY Violations**:

- Critical user paths not tested (P0 functionality missing)
- API endpoints without tests
- Error handling not tested (no negative test cases)
- Missing authentication/authorization tests

**MEDIUM SEVERITY Violations**:

- Edge cases not covered (boundary values, null/empty inputs)
- Only happy path tested (no error scenarios)
- Missing integration tests (only unit or only E2E)
- Insufficient assertion coverage (tests don't verify important outcomes)

**LOW SEVERITY Violations**:

- Could benefit from additional test cases
- Minor edge cases not covered
- Documentation incomplete

### 2. Calculate Coverage Score

```javascript
const criticalGaps = violations.filter((v) => v.severity === "HIGH").length
const score = criticalGaps === 0 ? Math.max(0, 100 - violations.length * 5) : Math.max(0, 50 - criticalGaps * 10) // Heavy penalty for critical gaps
```

---

## OUTPUT FORMAT

```json
{
	"dimension": "coverage",
	"score": 70,
	"max_score": 100,
	"grade": "C",
	"violations": [
		{
			"file": "tests/api/",
			"severity": "HIGH",
			"category": "missing-endpoint-tests",
			"description": "API endpoint /api/users/delete not tested",
			"suggestion": "Add tests for user deletion including error scenarios"
		},
		{
			"file": "tests/e2e/checkout.spec.ts",
			"line": 25,
			"severity": "MEDIUM",
			"category": "missing-error-case",
			"description": "Only happy path tested - no error handling tests",
			"suggestion": "Add tests for payment failure, network errors, validation failures"
		}
	],
	"passed_checks": 8,
	"failed_checks": 4,
	"violation_summary": {
		"HIGH": 1,
		"MEDIUM": 2,
		"LOW": 1
	},
	"coverage_gaps": {
		"untested_endpoints": ["/api/users/delete", "/api/orders/cancel"],
		"untested_user_paths": ["Password reset flow"],
		"missing_error_scenarios": ["Payment failures", "Network timeouts"]
	},
	"recommendations": [
		"Add tests for all CRUD operations (especially DELETE)",
		"Test error scenarios for each user path",
		"Add integration tests between API and E2E layers"
	],
	"summary": "Coverage has critical gaps - 4 violations (1 HIGH critical endpoint missing)"
}
```

---

## EXIT CONDITION

Subprocess completes when JSON output written to temp file.

**Subprocess terminates here.**
