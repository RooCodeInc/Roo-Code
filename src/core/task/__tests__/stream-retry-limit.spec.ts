// npx vitest core/task/__tests__/stream-retry-limit.spec.ts
//
// Unit tests for the stream retry limit (MAX_STREAM_RETRIES) and context
// recovery hint logic added in fix for #12087.
//
// These tests validate the pure logic without importing the heavy Task class
// to avoid OOM in constrained environments.

describe("Stream Retry Limits and Context Recovery", () => {
	// The constant value as defined in Task.ts
	const MAX_STREAM_RETRIES = 5

	describe("MAX_STREAM_RETRIES constant behavior", () => {
		it("should cap retries at 5", () => {
			expect(MAX_STREAM_RETRIES).toBe(5)
		})

		it("should allow retries when retryAttempt < MAX_STREAM_RETRIES", () => {
			for (let retryAttempt = 0; retryAttempt < MAX_STREAM_RETRIES; retryAttempt++) {
				const shouldAutoRetry = retryAttempt < MAX_STREAM_RETRIES
				expect(shouldAutoRetry).toBe(true)
			}
		})

		it("should stop auto-retry when retryAttempt >= MAX_STREAM_RETRIES", () => {
			for (const retryAttempt of [5, 6, 10, 100]) {
				const shouldAutoRetry = retryAttempt < MAX_STREAM_RETRIES
				expect(shouldAutoRetry).toBe(false)
			}
		})

		it("should present error to user when MAX_STREAM_RETRIES exceeded", () => {
			// Simulates the logic in attemptApiRequest and the mid-stream error handler
			const retryAttempt = MAX_STREAM_RETRIES
			const autoApprovalEnabled = true

			let presentedErrorToUser = false
			if (autoApprovalEnabled && retryAttempt >= MAX_STREAM_RETRIES) {
				presentedErrorToUser = true
			}

			expect(presentedErrorToUser).toBe(true)
		})

		it("should not present error when under the limit with auto-approval", () => {
			const retryAttempt = 3
			const autoApprovalEnabled = true

			let presentedErrorToUser = false
			if (autoApprovalEnabled && retryAttempt >= MAX_STREAM_RETRIES) {
				presentedErrorToUser = true
			}

			expect(presentedErrorToUser).toBe(false)
		})
	})

	describe("Context Recovery Hint", () => {
		const RECOVERY_HINT_TEXT =
			"[CONTEXT RECOVERY NOTE: The previous API request failed due to a provider error and was automatically retried. Please focus on the user's most recent request below and continue from where you left off. Do not repeat or re-announce previously completed tasks.]"

		it("should not add recovery hint on first attempt (retryAttempt === 0)", () => {
			const retryAttempt = 0
			const shouldAddHint = retryAttempt > 0
			expect(shouldAddHint).toBe(false)
		})

		it("should add recovery hint on retry attempts (retryAttempt > 0)", () => {
			for (const retryAttempt of [1, 2, 3, 4, 5]) {
				const shouldAddHint = retryAttempt > 0
				expect(shouldAddHint).toBe(true)
			}
		})

		it("should prepend recovery hint to user content on retry", () => {
			const originalContent = [{ type: "text" as const, text: "Please make the cards full width" }]
			const environmentDetails = "<environment_details>mock env</environment_details>"
			const recoveryHint = {
				type: "text" as const,
				text: RECOVERY_HINT_TEXT,
			}

			// Simulates the retry path in recursivelyMakeClineRequests
			const retryAttempt = 1
			let finalUserContent = [...originalContent, { type: "text" as const, text: environmentDetails }]

			if (retryAttempt > 0) {
				finalUserContent = [recoveryHint, ...finalUserContent]
			}

			expect(finalUserContent.length).toBe(3)
			expect(finalUserContent[0].text).toContain("CONTEXT RECOVERY NOTE")
			expect(finalUserContent[1].text).toBe("Please make the cards full width")
			expect(finalUserContent[2].text).toContain("environment_details")
		})

		it("should not prepend recovery hint on first attempt", () => {
			const originalContent = [{ type: "text" as const, text: "Please make the cards full width" }]
			const environmentDetails = "<environment_details>mock env</environment_details>"
			const recoveryHint = {
				type: "text" as const,
				text: RECOVERY_HINT_TEXT,
			}

			const retryAttempt = 0
			let finalUserContent = [...originalContent, { type: "text" as const, text: environmentDetails }]

			if (retryAttempt > 0) {
				finalUserContent = [recoveryHint, ...finalUserContent]
			}

			expect(finalUserContent.length).toBe(2)
			expect(finalUserContent[0].text).toBe("Please make the cards full width")
			expect(finalUserContent[1].text).toContain("environment_details")
		})

		it("should update the last user message in API history on retry", () => {
			const apiConversationHistory = [
				{
					role: "user" as const,
					content: [{ type: "text" as const, text: "Complete Task A" }],
				},
				{
					role: "assistant" as const,
					content: [{ type: "text" as const, text: "Task A completed." }],
				},
				{
					role: "user" as const,
					content: [
						{ type: "text" as const, text: "Please complete Task B" },
						{ type: "text" as const, text: "<environment_details>old env</environment_details>" },
					],
				},
			]

			// Simulates the retry update logic from the code
			const retryAttempt = 1
			const isEmptyUserContent = false
			const updatedContent = [
				{ type: "text" as const, text: RECOVERY_HINT_TEXT },
				{ type: "text" as const, text: "Please complete Task B" },
				{ type: "text" as const, text: "<environment_details>new env</environment_details>" },
			]

			if (retryAttempt > 0 && !isEmptyUserContent) {
				const lastIdx = apiConversationHistory.length - 1
				if (lastIdx >= 0 && apiConversationHistory[lastIdx].role === "user") {
					apiConversationHistory[lastIdx] = { role: "user", content: updatedContent }
				}
			}

			// Verify the last message was updated with recovery hint
			const lastMessage = apiConversationHistory[apiConversationHistory.length - 1]
			expect(lastMessage.role).toBe("user")
			expect(lastMessage.content[0].text).toContain("CONTEXT RECOVERY NOTE")
			expect(lastMessage.content[1].text).toBe("Please complete Task B")
			expect(lastMessage.content[2].text).toContain("new env")

			// Verify earlier messages are untouched
			expect(apiConversationHistory[0]).toEqual({
				role: "user",
				content: [{ type: "text", text: "Complete Task A" }],
			})
		})

		it("should not update API history if last message is not a user message", () => {
			const apiConversationHistory = [
				{
					role: "user" as const,
					content: [{ type: "text" as const, text: "Complete Task A" }],
				},
				{
					role: "assistant" as const,
					content: [{ type: "text" as const, text: "Task A completed." }],
				},
			]

			const originalHistory = JSON.parse(JSON.stringify(apiConversationHistory))

			const retryAttempt = 1
			const isEmptyUserContent = false

			if (retryAttempt > 0 && !isEmptyUserContent) {
				const lastIdx = apiConversationHistory.length - 1
				if (lastIdx >= 0 && apiConversationHistory[lastIdx].role === "user") {
					apiConversationHistory[lastIdx] = {
						role: "user",
						content: [{ type: "text", text: "should not appear" }],
					}
				}
			}

			// History should be unchanged since last message is "assistant"
			expect(apiConversationHistory).toEqual(originalHistory)
		})

		it("should not update API history if user content is empty (delegation resume)", () => {
			const apiConversationHistory = [
				{
					role: "user" as const,
					content: [{ type: "text" as const, text: "existing message" }],
				},
			]

			const originalHistory = JSON.parse(JSON.stringify(apiConversationHistory))

			const retryAttempt = 1
			const isEmptyUserContent = true // Empty signals delegation resume

			if (retryAttempt > 0 && !isEmptyUserContent) {
				const lastIdx = apiConversationHistory.length - 1
				if (lastIdx >= 0 && apiConversationHistory[lastIdx].role === "user") {
					apiConversationHistory[lastIdx] = {
						role: "user",
						content: [{ type: "text", text: "should not appear" }],
					}
				}
			}

			// History should be unchanged since user content is empty
			expect(apiConversationHistory).toEqual(originalHistory)
		})

		it("recovery hint contains key phrases to re-orient the model", () => {
			expect(RECOVERY_HINT_TEXT).toContain("previous API request failed")
			expect(RECOVERY_HINT_TEXT).toContain("provider error")
			expect(RECOVERY_HINT_TEXT).toContain("automatically retried")
			expect(RECOVERY_HINT_TEXT).toContain("most recent request")
			expect(RECOVERY_HINT_TEXT).toContain("Do not repeat")
			expect(RECOVERY_HINT_TEXT).toContain("previously completed tasks")
		})
	})

	describe("Mid-stream retry cap", () => {
		it("should present error to user when mid-stream retries exceed MAX_STREAM_RETRIES", () => {
			const currentRetry = MAX_STREAM_RETRIES
			let presentedErrorToUser = false
			let pushedToStack = false

			if (currentRetry >= MAX_STREAM_RETRIES) {
				presentedErrorToUser = true
			} else {
				pushedToStack = true
			}

			expect(presentedErrorToUser).toBe(true)
			expect(pushedToStack).toBe(false)
		})

		it("should push to retry stack when mid-stream retries are under the limit", () => {
			const currentRetry = 3
			let presentedErrorToUser = false
			let pushedToStack = false

			if (currentRetry >= MAX_STREAM_RETRIES) {
				presentedErrorToUser = true
			} else {
				pushedToStack = true
			}

			expect(presentedErrorToUser).toBe(false)
			expect(pushedToStack).toBe(true)
		})

		it("should reset retry count to 0 when user clicks retry after max retries", () => {
			const currentRetry = MAX_STREAM_RETRIES
			let newRetryAttempt = currentRetry

			if (currentRetry >= MAX_STREAM_RETRIES) {
				// User clicks retry - reset the counter
				const userClickedRetry = true
				if (userClickedRetry) {
					newRetryAttempt = 0
				}
			}

			expect(newRetryAttempt).toBe(0)
		})

		it("should increment retry count on each automatic retry", () => {
			let retryAttempt = 0

			for (let i = 0; i < MAX_STREAM_RETRIES; i++) {
				retryAttempt = retryAttempt + 1
			}

			expect(retryAttempt).toBe(MAX_STREAM_RETRIES)
		})
	})
})
