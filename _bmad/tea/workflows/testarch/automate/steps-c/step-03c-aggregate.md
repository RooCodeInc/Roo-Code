---
name: "step-03c-aggregate"
description: "Aggregate subprocess outputs and complete test infrastructure"
nextStepFile: "./step-04-validate-and-summarize.md"
---

# Step 3C: Aggregate Test Generation Results

## STEP GOAL

Read outputs from parallel subprocesses (API + E2E test generation), aggregate results, and create supporting infrastructure (fixtures, helpers).

---

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- ✅ Read subprocess outputs from temp files
- ✅ Generate shared fixtures based on fixture needs from both subprocesses
- ✅ Write all generated test files to disk
- ❌ Do NOT regenerate tests (use subprocess outputs)
- ❌ Do NOT run tests yet (that's step 4)

---

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Record outputs before proceeding
- 📖 Load the next step only when instructed

## CONTEXT BOUNDARIES:

- Available context: config, subprocess outputs from temp files
- Focus: aggregation and fixture generation only
- Limits: do not execute future steps
- Dependencies: Step 3A and 3B subprocess outputs

---

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

### 1. Read Subprocess Outputs

**Read API test subprocess output:**

```javascript
const apiTestsPath = "/tmp/tea-automate-api-tests-{{timestamp}}.json"
const apiTestsOutput = JSON.parse(fs.readFileSync(apiTestsPath, "utf8"))
```

**Read E2E test subprocess output:**

```javascript
const e2eTestsPath = "/tmp/tea-automate-e2e-tests-{{timestamp}}.json"
const e2eTestsOutput = JSON.parse(fs.readFileSync(e2eTestsPath, "utf8"))
```

**Verify both subprocesses succeeded:**

- Check `apiTestsOutput.success === true`
- Check `e2eTestsOutput.success === true`
- If either failed, report error and stop (don't proceed)

---

### 2. Write All Test Files to Disk

**Write API test files:**

```javascript
apiTestsOutput.tests.forEach((test) => {
	fs.writeFileSync(test.file, test.content, "utf8")
	console.log(`✅ Created: ${test.file}`)
})
```

**Write E2E test files:**

```javascript
e2eTestsOutput.tests.forEach((test) => {
	fs.writeFileSync(test.file, test.content, "utf8")
	console.log(`✅ Created: ${test.file}`)
})
```

---

### 3. Aggregate Fixture Needs

**Collect all fixture needs from both subprocesses:**

```javascript
const allFixtureNeeds = [...apiTestsOutput.fixture_needs, ...e2eTestsOutput.fixture_needs]

// Remove duplicates
const uniqueFixtures = [...new Set(allFixtureNeeds)]
```

**Categorize fixtures:**

- **Authentication fixtures:** authToken, authenticatedUserFixture, etc.
- **Data factories:** userDataFactory, productDataFactory, etc.
- **Network mocks:** paymentMockFixture, apiResponseMocks, etc.
- **Test helpers:** wait/retry/assertion helpers

---

### 4. Generate Fixture Infrastructure

**Create or update fixture files based on needs:**

**A) Authentication Fixtures** (`tests/fixtures/auth.ts`):

```typescript
import { test as base } from "@playwright/test"

export const test = base.extend({
	authenticatedUser: async ({ page }, use) => {
		// Login logic
		await page.goto("/login")
		await page.fill('[name="email"]', "test@example.com")
		await page.fill('[name="password"]', "password")
		await page.click('button[type="submit"]')
		await page.waitForURL("/dashboard")

		await use(page)
	},

	authToken: async ({ request }, use) => {
		// Get auth token for API tests
		const response = await request.post("/api/auth/login", {
			data: { email: "test@example.com", password: "password" },
		})
		const { token } = await response.json()

		await use(token)
	},
})
```

**B) Data Factories** (`tests/fixtures/data-factories.ts`):

```typescript
import { faker } from "@faker-js/faker"

export const createUserData = (overrides = {}) => ({
	name: faker.person.fullName(),
	email: faker.internet.email(),
	...overrides,
})

export const createProductData = (overrides = {}) => ({
	name: faker.commerce.productName(),
	price: faker.number.int({ min: 10, max: 1000 }),
	...overrides,
})
```

**C) Network Mocks** (`tests/fixtures/network-mocks.ts`):

```typescript
import { Page } from "@playwright/test"

export const mockPaymentSuccess = async (page: Page) => {
	await page.route("/api/payment/**", (route) => {
		route.fulfill({
			status: 200,
			body: JSON.stringify({ success: true, transactionId: "12345" }),
		})
	})
}
```

**D) Helper Utilities** (`tests/fixtures/helpers.ts`):

```typescript
import { expect, Page } from "@playwright/test"

export const waitForApiResponse = async (page: Page, urlPattern: string) => {
	return page.waitForResponse((response) => response.url().includes(urlPattern) && response.ok())
}
```

---

### 5. Calculate Summary Statistics

**Aggregate test counts:**

```javascript
const summary = {
  total_tests: apiTestsOutput.test_count + e2eTestsOutput.test_count,
  api_tests: apiTestsOutput.test_count,
  e2e_tests: e2eTestsOutput.test_count,
  fixtures_created: uniqueFixtures.length,
  api_test_files: apiTestsOutput.tests.length,
  e2e_test_files: e2eTestsOutput.tests.length,
  priority_coverage: {
    P0: /* sum P0 tests from both */,
    P1: /* sum P1 tests from both */,
    P2: /* sum P2 tests from both */,
    P3: /* sum P3 tests from both */
  },
  knowledge_fragments_used: [
    ...apiTestsOutput.knowledge_fragments_used,
    ...e2eTestsOutput.knowledge_fragments_used
  ],
  subprocess_execution: 'PARALLEL (API + E2E)',
  performance_gain: '~50% faster than sequential'
};
```

**Store summary for Step 4:**
Save summary to temp file for validation step:

```javascript
fs.writeFileSync("/tmp/tea-automate-summary-{{timestamp}}.json", JSON.stringify(summary, null, 2), "utf8")
```

---

### 6. Optional Cleanup

**Clean up subprocess temp files** (optional - can keep for debugging):

```javascript
fs.unlinkSync(apiTestsPath)
fs.unlinkSync(e2eTestsPath)
console.log("✅ Subprocess temp files cleaned up")
```

---

## OUTPUT SUMMARY

Display to user:

```
✅ Test Generation Complete (Parallel Execution)

📊 Summary:
- Total Tests: {total_tests}
  - API Tests: {api_tests} ({api_test_files} files)
  - E2E Tests: {e2e_tests} ({e2e_test_files} files)
- Fixtures Created: {fixtures_created}
- Priority Coverage:
  - P0 (Critical): {P0} tests
  - P1 (High): {P1} tests
  - P2 (Medium): {P2} tests
  - P3 (Low): {P3} tests

🚀 Performance: Parallel execution ~50% faster than sequential

📂 Generated Files:
- tests/api/[feature].spec.ts
- tests/e2e/[feature].spec.ts
- tests/fixtures/auth.ts
- tests/fixtures/data-factories.ts
- tests/fixtures/network-mocks.ts
- tests/fixtures/helpers.ts

✅ Ready for validation (Step 4)
```

---

## EXIT CONDITION

Proceed to Step 4 when:

- ✅ All test files written to disk (API + E2E)
- ✅ All fixtures and helpers created
- ✅ Summary statistics calculated and saved
- ✅ Output displayed to user

Load next step: `{nextStepFile}`

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Both subprocesses succeeded
- All test files written to disk
- Fixtures generated based on subprocess needs
- Summary complete and accurate

### ❌ SYSTEM FAILURE:

- One or both subprocesses failed
- Test files not written to disk
- Fixtures missing or incomplete
- Summary missing or inaccurate

**Master Rule:** Do NOT proceed to Step 4 if aggregation incomplete.
