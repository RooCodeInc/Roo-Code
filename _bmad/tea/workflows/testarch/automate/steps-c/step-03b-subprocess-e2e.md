---
name: "step-03b-subprocess-e2e"
description: "Subprocess: Generate E2E tests only"
subprocess: true
outputFile: "/tmp/tea-automate-e2e-tests-{{timestamp}}.json"
---

# Subprocess 3B: Generate E2E Tests

## SUBPROCESS CONTEXT

This is an **isolated subprocess** running in parallel with API test generation.

**What you have from parent workflow:**

- Target features/user journeys identified in Step 2
- Knowledge fragments loaded: fixture-architecture, network-first, selector-resilience
- Config: test framework, Playwright Utils enabled/disabled
- Coverage plan: which user journeys need E2E testing

**Your task:** Generate E2E tests ONLY (not API, not fixtures, not other test types).

---

## MANDATORY EXECUTION RULES

- 📖 Read this entire subprocess file before acting
- ✅ Generate E2E tests ONLY
- ✅ Output structured JSON to temp file
- ✅ Follow knowledge fragment patterns
- ❌ Do NOT generate API tests (that's subprocess 3A)
- ❌ Do NOT run tests (that's step 4)
- ❌ Do NOT generate fixtures yet (that's step 3C aggregation)

---

## SUBPROCESS TASK

### 1. Identify User Journeys

From the coverage plan (Step 2 output), identify:

- Which user journeys need E2E coverage
- Critical user paths (authentication, checkout, profile, etc.)
- UI interactions required
- Expected visual states

### 2. Generate E2E Test Files

For each user journey, create test file in `tests/e2e/[feature].spec.ts`:

**Test Structure:**

```typescript
import { test, expect } from "@playwright/test"

test.describe("[Feature] E2E User Journey", () => {
	test("[P0] should complete [user journey]", async ({ page }) => {
		// Navigate to starting point
		await page.goto("/feature")

		// Interact with UI
		await page.getByRole("button", { name: "Submit" }).click()

		// Assert expected state
		await expect(page.getByText("Success")).toBeVisible()
	})

	test("[P1] should handle [edge case]", async ({ page }) => {
		// Test edge case scenario
	})
})
```

**Requirements:**

- ✅ Follow fixture architecture patterns (from fixture-architecture fragment)
- ✅ Use network-first patterns: intercept before navigate (from network-first fragment)
- ✅ Use resilient selectors: getByRole, getByText, getByLabel (from selector-resilience fragment)
- ✅ Include priority tags [P0], [P1], [P2], [P3]
- ✅ Test complete user journeys (not isolated clicks)
- ✅ Use proper TypeScript types
- ✅ Deterministic waits (no hard sleeps, use expect().toBeVisible())

### 3. Track Fixture Needs

Identify fixtures needed for E2E tests:

- Page object models (if complex)
- Authentication fixtures (logged-in user state)
- Network mocks/intercepts
- Test data fixtures

**Do NOT create fixtures yet** - just track what's needed for aggregation step.

---

## OUTPUT FORMAT

Write JSON to temp file: `/tmp/tea-automate-e2e-tests-{{timestamp}}.json`

```json
{
	"success": true,
	"subprocess": "e2e-tests",
	"tests": [
		{
			"file": "tests/e2e/authentication.spec.ts",
			"content": "[full TypeScript test file content]",
			"description": "E2E tests for user authentication journey",
			"priority_coverage": {
				"P0": 2,
				"P1": 3,
				"P2": 2,
				"P3": 0
			}
		},
		{
			"file": "tests/e2e/checkout.spec.ts",
			"content": "[full TypeScript test file content]",
			"description": "E2E tests for checkout journey",
			"priority_coverage": {
				"P0": 3,
				"P1": 2,
				"P2": 1,
				"P3": 0
			}
		}
	],
	"fixture_needs": ["authenticatedUserFixture", "paymentMockFixture", "checkoutDataFixture"],
	"knowledge_fragments_used": ["fixture-architecture", "network-first", "selector-resilience"],
	"test_count": 15,
	"summary": "Generated 15 E2E test cases covering 5 user journeys"
}
```

**On Error:**

```json
{
	"success": false,
	"subprocess": "e2e-tests",
	"error": "Error message describing what went wrong",
	"partial_output": {
		/* any tests generated before error */
	}
}
```

---

## EXIT CONDITION

Subprocess completes when:

- ✅ All user journeys have E2E test files generated
- ✅ All tests follow knowledge fragment patterns
- ✅ JSON output written to temp file
- ✅ Fixture needs tracked

**Subprocess terminates here.** Parent workflow will read output and proceed to aggregation.

---

## 🚨 SUBPROCESS SUCCESS METRICS

### ✅ SUCCESS:

- All E2E tests generated following patterns
- JSON output valid and complete
- No API/component/unit tests included (out of scope)
- Resilient selectors used (getByRole, getByText)
- Network-first patterns applied (intercept before navigate)

### ❌ FAILURE:

- Generated tests other than E2E tests
- Did not follow knowledge fragment patterns
- Invalid or missing JSON output
- Ran tests (not subprocess responsibility)
- Used brittle selectors (CSS classes, XPath)
