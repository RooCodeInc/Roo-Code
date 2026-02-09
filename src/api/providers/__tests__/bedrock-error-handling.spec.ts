// Mock TelemetryService - must come before other imports
const mockCaptureException = vi.hoisted(() => vi.fn())
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: mockCaptureException,
		},
	},
}))

// Mock AWS SDK credential providers
vi.mock("@aws-sdk/credential-providers", () => {
	return {
		fromIni: vi.fn().mockReturnValue({
			accessKeyId: "profile-access-key",
			secretAccessKey: "profile-secret-key",
		}),
	}
})

// Use vi.hoisted to define mock functions for AI SDK
const { mockStreamText, mockGenerateText } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/amazon-bedrock", () => ({
	createAmazonBedrock: vi.fn(() => vi.fn(() => ({ modelId: "test", provider: "bedrock" }))),
}))

import { AwsBedrockHandler } from "../bedrock"
import type { Anthropic } from "@anthropic-ai/sdk"

describe("AwsBedrockHandler Error Handling", () => {
	let handler: AwsBedrockHandler

	beforeEach(() => {
		vi.clearAllMocks()
		mockCaptureException.mockClear()
		handler = new AwsBedrockHandler({
			apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
			awsAccessKey: "test-access-key",
			awsSecretKey: "test-secret-key",
			awsRegion: "us-east-1",
		})
	})

	/**
	 * Helper: create an Error with optional extra properties that
	 * the production code inspects (status, name, $metadata, __type).
	 */
	const createMockError = (options: {
		message?: string
		name?: string
		status?: number
		__type?: string
		$metadata?: {
			httpStatusCode?: number
			requestId?: string
			extendedRequestId?: string
			cfId?: string
			[key: string]: unknown
		}
	}): Error => {
		const error = new Error(options.message || "Test error") as any
		if (options.name) error.name = options.name
		if (options.status !== undefined) error.status = options.status
		if (options.__type) error.__type = options.__type
		if (options.$metadata) error.$metadata = options.$metadata
		return error
	}

	// -----------------------------------------------------------------------
	// Throttling Detection — completePrompt path
	//
	// Production flow: generateText throws → catch → isThrottlingError() is
	// NOT called in completePrompt (only in createMessage), so it falls
	// through to handleAiSdkError which wraps with "Bedrock: <msg>".
	//
	// For createMessage: streamText throws → catch → isThrottlingError()
	// returns true → re-throws original error.
	// -----------------------------------------------------------------------

	describe("Throttling Error Detection (createMessage)", () => {
		it("should re-throw throttling errors with status 429 for retry", async () => {
			const throttleError = createMockError({
				message: "Request failed",
				status: 429,
			})

			mockStreamText.mockImplementation(() => {
				throw throttleError
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow("Request failed")
		})

		it("should re-throw throttling errors detected via $metadata.httpStatusCode", async () => {
			const throttleError = createMockError({
				message: "Request failed",
				$metadata: { httpStatusCode: 429 },
			})

			mockStreamText.mockImplementation(() => {
				throw throttleError
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow("Request failed")
		})

		it("should re-throw ThrottlingException by name", async () => {
			const throttleError = createMockError({
				message: "Request failed",
				name: "ThrottlingException",
			})

			mockStreamText.mockImplementation(() => {
				throw throttleError
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow("Request failed")
		})

		it("should re-throw 'Bedrock is unable to process your request' as throttling", async () => {
			const throttleError = createMockError({
				message: "Bedrock is unable to process your request",
			})

			mockStreamText.mockImplementation(() => {
				throw throttleError
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow("Bedrock is unable to process your request")
		})

		it("should detect throttling from various message patterns", async () => {
			const throttlingMessages = ["Request throttled", "Rate limit exceeded", "Too many requests"]

			for (const message of throttlingMessages) {
				vi.clearAllMocks()
				const throttleError = createMockError({ message })

				mockStreamText.mockImplementation(() => {
					throw throttleError
				})

				const localHandler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test-access-key",
					awsSecretKey: "test-secret-key",
					awsRegion: "us-east-1",
				})

				const generator = localHandler.createMessage("system", [{ role: "user", content: "test" }])

				// Throttling errors are re-thrown with original message for retry
				await expect(async () => {
					for await (const _chunk of generator) {
						// should throw
					}
				}).rejects.toThrow(message)
			}
		})

		it("should prioritize HTTP status 429 over message content for throttling", async () => {
			const mixedError = createMockError({
				message: "Some generic error message",
				status: 429,
			})

			mockStreamText.mockImplementation(() => {
				throw mixedError
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			// Because status=429, it's throttling → re-throws original error
			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow("Some generic error message")
		})

		it("should prioritize ThrottlingException name over message for throttling", async () => {
			const specificError = createMockError({
				message: "Some other error occurred",
				name: "ThrottlingException",
			})

			mockStreamText.mockImplementation(() => {
				throw specificError
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			// ThrottlingException → re-throws original for retry
			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow("Some other error occurred")
		})
	})

	// -----------------------------------------------------------------------
	// Non-throttling errors (createMessage) are wrapped by handleAiSdkError
	// -----------------------------------------------------------------------

	describe("Non-throttling errors (createMessage)", () => {
		it("should wrap non-throttling errors with provider name via handleAiSdkError", async () => {
			const genericError = createMockError({
				message: "Something completely unexpected happened",
			})

			mockStreamText.mockImplementation(() => {
				throw genericError
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow("Bedrock: Something completely unexpected happened")
		})

		it("should preserve status code from non-throttling API errors", async () => {
			const apiError = createMockError({
				message: "Internal server error occurred",
				status: 500,
			})

			mockStreamText.mockImplementation(() => {
				throw apiError
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			try {
				for await (const _chunk of generator) {
					// should throw
				}
				throw new Error("Expected error to be thrown")
			} catch (error: any) {
				expect(error.message).toContain("Bedrock:")
				expect(error.message).toContain("Internal server error occurred")
			}
		})

		it("should handle validation errors (token limits) as non-throttling", async () => {
			const tokenError = createMockError({
				message: "Too many tokens in request",
				name: "ValidationException",
			})

			mockStreamText.mockImplementation(() => {
				throw tokenError
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow("Bedrock: Too many tokens in request")
		})
	})

	// -----------------------------------------------------------------------
	// Streaming context: errors mid-stream
	// -----------------------------------------------------------------------

	describe("Streaming Context Error Handling", () => {
		it("should re-throw throttling errors that occur mid-stream", async () => {
			const throttleError = createMockError({
				message: "Bedrock is unable to process your request",
				status: 429,
			})

			// Mock streamText to return an object whose fullStream throws mid-iteration
			async function* failingStream() {
				yield { type: "text-delta" as const, textDelta: "partial" }
				throw throttleError
			}

			mockStreamText.mockReturnValue({
				fullStream: failingStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			await expect(async () => {
				for await (const _chunk of generator) {
					// may yield partial text before throwing
				}
			}).rejects.toThrow("Bedrock is unable to process your request")
		})

		it("should wrap non-throttling errors that occur mid-stream via handleAiSdkError", async () => {
			const genericError = createMockError({
				message: "Some other error",
				status: 500,
			})

			async function* failingStream() {
				yield { type: "text-delta" as const, textDelta: "partial" }
				throw genericError
			}

			mockStreamText.mockReturnValue({
				fullStream: failingStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow("Bedrock: Some other error")
		})
	})

	// -----------------------------------------------------------------------
	// completePrompt errors — all go through handleAiSdkError (no throttle check)
	// -----------------------------------------------------------------------

	describe("completePrompt error handling", () => {
		it("should wrap errors with provider name for completePrompt", async () => {
			mockGenerateText.mockRejectedValueOnce(new Error("Bedrock API failure"))

			await expect(handler.completePrompt("test")).rejects.toThrow("Bedrock: Bedrock API failure")
		})

		it("should wrap throttling-pattern errors with provider name for completePrompt", async () => {
			const throttleError = createMockError({
				message: "Bedrock is unable to process your request",
				status: 429,
			})

			mockGenerateText.mockRejectedValueOnce(throttleError)

			// completePrompt does NOT have the throttle-rethrow path; it always uses handleAiSdkError
			await expect(handler.completePrompt("test")).rejects.toThrow(
				"Bedrock: Bedrock is unable to process your request",
			)
		})

		it("should handle concurrent generateText failures", async () => {
			const error = new Error("API failure")
			mockGenerateText.mockRejectedValue(error)

			const promises = Array.from({ length: 5 }, () => handler.completePrompt("test"))
			const results = await Promise.allSettled(promises)

			results.forEach((result) => {
				expect(result.status).toBe("rejected")
				if (result.status === "rejected") {
					expect(result.reason.message).toContain("Bedrock:")
				}
			})
		})

		it("should preserve status code from API call errors in completePrompt", async () => {
			const apiError = createMockError({
				message: "Service unavailable",
				status: 503,
			})

			mockGenerateText.mockRejectedValueOnce(apiError)

			try {
				await handler.completePrompt("test")
				throw new Error("Expected error to be thrown")
			} catch (error: any) {
				expect(error.message).toContain("Bedrock:")
				expect(error.message).toContain("Service unavailable")
			}
		})
	})

	// -----------------------------------------------------------------------
	// Telemetry
	// -----------------------------------------------------------------------

	describe("Error telemetry", () => {
		it("should capture telemetry for createMessage errors", async () => {
			mockStreamText.mockImplementation(() => {
				throw new Error("Stream failure")
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow()

			expect(mockCaptureException).toHaveBeenCalled()
		})

		it("should capture telemetry for completePrompt errors", async () => {
			mockGenerateText.mockRejectedValueOnce(new Error("Generate failure"))

			await expect(handler.completePrompt("test")).rejects.toThrow()

			expect(mockCaptureException).toHaveBeenCalled()
		})

		it("should capture telemetry for throttling errors too", async () => {
			const throttleError = createMockError({
				message: "Rate limit exceeded",
				status: 429,
			})

			mockStreamText.mockImplementation(() => {
				throw throttleError
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow()

			// Telemetry is captured even for throttling errors
			expect(mockCaptureException).toHaveBeenCalled()
		})
	})

	// -----------------------------------------------------------------------
	// Edge cases
	// -----------------------------------------------------------------------

	describe("Edge Case Test Coverage", () => {
		it("should handle non-Error objects thrown by generateText", async () => {
			mockGenerateText.mockRejectedValueOnce("string error")

			await expect(handler.completePrompt("test")).rejects.toThrow("Bedrock: string error")
		})

		it("should handle non-Error objects thrown by streamText", async () => {
			mockStreamText.mockImplementation(() => {
				throw "string error"
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "test" }])

			// Non-Error values are not detected as throttling → handleAiSdkError path
			await expect(async () => {
				for await (const _chunk of generator) {
					// should throw
				}
			}).rejects.toThrow("Bedrock: string error")
		})

		it("should handle errors with unusual structure gracefully", async () => {
			const unusualError = { message: "Error with unusual structure" }
			mockGenerateText.mockRejectedValueOnce(unusualError)

			try {
				await handler.completePrompt("test")
				throw new Error("Expected error to be thrown")
			} catch (error: any) {
				// handleAiSdkError wraps with "Bedrock: ..."
				expect(error.message).toContain("Bedrock:")
				expect(error.message).not.toContain("undefined")
			}
		})

		it("should handle concurrent throttling errors in streaming context", async () => {
			const throttlingError = createMockError({
				message: "Bedrock is unable to process your request",
				status: 429,
			})

			mockStreamText.mockImplementation(() => {
				throw throttlingError
			})

			// Execute multiple concurrent streaming requests
			const promises = Array.from({ length: 3 }, async () => {
				const localHandler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test-access-key",
					awsSecretKey: "test-secret-key",
					awsRegion: "us-east-1",
				})
				const gen = localHandler.createMessage("system", [{ role: "user", content: "test" }])
				for await (const _chunk of gen) {
					// should throw
				}
			})

			const results = await Promise.allSettled(promises)
			results.forEach((result) => {
				expect(result.status).toBe("rejected")
				if (result.status === "rejected") {
					// Throttling errors are re-thrown with original message
					expect(result.reason.message).toBe("Bedrock is unable to process your request")
				}
			})
		})
	})
})
