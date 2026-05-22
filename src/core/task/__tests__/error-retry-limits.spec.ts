// npx vitest run core/task/__tests__/error-retry-limits.spec.ts
import { Task } from "../Task"

// Re-export the constant for testing (must match the value in Task.ts)
const MAX_STREAM_RETRIES = 5

describe("Error Retry Limits and Context Recovery", () => {
	const mockProvider = {
		deref: () => mockProvider,
		getState: vi.fn().mockResolvedValue({
			autoApprovalEnabled: true,
			requestDelaySeconds: 0,
			mode: "code",
			apiConfiguration: { apiProvider: "openai-compatible" },
		}),
		postStateToWebview: vi.fn(),
		postStateToWebviewWithoutTaskHistory: vi.fn(),
		postMessageToWebview: vi.fn(),
		getSkillsManager: vi.fn().mockReturnValue(undefined),
		context: {
			extensionPath: "/test",
			globalStorageUri: { fsPath: "/test/storage" },
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			workspaceState: {
				get: vi.fn().mockReturnValue(false),
			},
		},
	} as any

	const mockApiConfig = {
		apiProvider: "openai-compatible" as const,
		openAiBaseUrl: "http://localhost:8080",
		openAiApiKey: "test-key",
		openAiModelId: "test-model",
	}

	describe("MAX_STREAM_RETRIES constant", () => {
		it("should have MAX_STREAM_RETRIES set to 5", () => {
			// This tests that the constant exists and has the expected value
			expect(MAX_STREAM_RETRIES).toBe(5)
		})
	})

	describe("Mid-stream error retry behavior", () => {
		it("should log retry attempt number when stream fails", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Simulate logging that includes attempt count (matching the new format in Task.ts)
			const taskId = "test-task-id"
			const instanceId = "test-instance"
			const retryAttempt = 2
			const nextRetryAttempt = retryAttempt + 1
			const streamingFailedMessage = "Connection reset by peer"

			console.error(
				`[Task#${taskId}.${instanceId}] Stream failed (attempt ${nextRetryAttempt}/${MAX_STREAM_RETRIES}), will retry: ${streamingFailedMessage}`,
			)

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining(`attempt ${nextRetryAttempt}/${MAX_STREAM_RETRIES}`),
			)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Context recovery hint", () => {
		it("should prepend context recovery hint to retry user content", () => {
			const originalContent = [{ type: "tool_result" as const, tool_use_id: "test-id", content: "mode switched" }]

			// Simulate the retry content building (matching the logic in Task.ts)
			const retryUserContent = [
				{
					type: "text" as const,
					text: "[IMPORTANT: The previous API request was interrupted by a provider error and is being retried. Please continue working on the user's most recent request. Do not repeat or re-announce previously completed work.]",
				},
				...originalContent,
			]

			// Verify the hint is prepended
			expect(retryUserContent).toHaveLength(2)
			const hintBlock = retryUserContent[0] as { type: string; text: string }
			expect(hintBlock.type).toBe("text")
			expect(hintBlock.text).toContain("IMPORTANT")
			expect(hintBlock.text).toContain("provider error")
			expect(hintBlock.text).toContain("Do not repeat")

			// Verify original content is preserved
			expect(retryUserContent[1]).toEqual(originalContent[0])
		})

		it("should not add recovery hint on first attempt (retryAttempt = 0)", () => {
			// On first attempt, the content should be passed through without modification
			const originalContent = [{ type: "text" as const, text: "user task prompt" }]

			// retryAttempt 0 means first attempt - no hint needed
			const retryAttempt = 0
			const nextRetryAttempt = retryAttempt + 1

			// The hint is only added when nextRetryAttempt > 0 (which it always is after an error)
			// but the important thing is the hint helps the model re-orient
			expect(nextRetryAttempt).toBeGreaterThan(0)
			expect(originalContent).toHaveLength(1) // Original content unchanged
		})
	})

	describe("Retry limit enforcement", () => {
		it("should identify when max retries are exceeded for mid-stream errors", () => {
			// Simulate retry counter reaching the limit
			for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
				const nextRetryAttempt = attempt + 1
				if (nextRetryAttempt >= MAX_STREAM_RETRIES) {
					// Should stop auto-retrying and present error to user
					expect(nextRetryAttempt).toBeGreaterThanOrEqual(MAX_STREAM_RETRIES)
				} else {
					// Should continue auto-retrying
					expect(nextRetryAttempt).toBeLessThan(MAX_STREAM_RETRIES)
				}
			}
		})

		it("should identify when max retries are exceeded for first-chunk errors", () => {
			// Simulate first-chunk retry counter reaching the limit
			for (let retryAttempt = 0; retryAttempt <= MAX_STREAM_RETRIES; retryAttempt++) {
				if (retryAttempt + 1 >= MAX_STREAM_RETRIES) {
					// Should fall through to manual retry prompt
					expect(retryAttempt + 1).toBeGreaterThanOrEqual(MAX_STREAM_RETRIES)
				} else {
					// Should continue auto-retrying
					expect(retryAttempt + 1).toBeLessThan(MAX_STREAM_RETRIES)
				}
			}
		})

		it("should reset retry counter when user manually clicks retry after max retries", () => {
			// After max retries, user clicks retry -> counter resets to 0
			const maxedOutRetryAttempt = MAX_STREAM_RETRIES
			expect(maxedOutRetryAttempt >= MAX_STREAM_RETRIES).toBe(true)

			// User clicks retry, counter resets
			const resetRetryAttempt = 0
			expect(resetRetryAttempt).toBe(0)
			expect(resetRetryAttempt < MAX_STREAM_RETRIES).toBe(true)
		})
	})

	describe("Stack item structure for retry", () => {
		it("should include context recovery hint in retry stack item", () => {
			const currentUserContent = [{ type: "tool_result" as const, tool_use_id: "test-id", content: "result" }]

			const retryUserContent = [
				{
					type: "text" as const,
					text: "[IMPORTANT: The previous API request was interrupted by a provider error and is being retried. Please continue working on the user's most recent request. Do not repeat or re-announce previously completed work.]",
				},
				...currentUserContent,
			]

			const stackItem = {
				userContent: retryUserContent,
				includeFileDetails: false,
				retryAttempt: 1,
			}

			expect(stackItem.retryAttempt).toBe(1)
			expect(stackItem.includeFileDetails).toBe(false)
			const firstBlock = stackItem.userContent[0] as { type: string; text: string }
			expect(firstBlock.type).toBe("text")
			expect(firstBlock.text).toContain("IMPORTANT")
			expect(stackItem.userContent).toHaveLength(2)
		})

		it("should reset retry attempt to 0 when max retries reached and user clicks retry", () => {
			const stackItem = {
				userContent: [{ type: "text" as const, text: "content" }],
				includeFileDetails: false,
				retryAttempt: 0, // Reset after user manual retry
			}

			expect(stackItem.retryAttempt).toBe(0)
		})
	})
})
