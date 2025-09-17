// npx vitest run src/api/providers/__tests__/gemini-rate-limit.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GeminiHandler, GeminiError } from "../gemini"
import { t } from "i18next"

describe("GeminiHandler Rate Limit Handling", () => {
	let handler: GeminiHandler

	beforeEach(() => {
		handler = new GeminiHandler({
			apiModelId: "gemini-1.5-flash",
			geminiApiKey: "test-key",
		})
	})

	describe("GeminiError", () => {
		it("should properly construct error with RetryInfo", () => {
			const error = new GeminiError("Rate limit exceeded", {
				status: 429,
				error: {
					status: "RESOURCE_EXHAUSTED",
					message: "Too many requests",
					details: [
						{
							"@type": "type.googleapis.com/google.rpc.RetryInfo",
							retryDelay: "59s",
						},
					],
				},
			})

			expect(error.status).toBe(429)
			expect(error.errorStatus).toBe("RESOURCE_EXHAUSTED")
			expect(error.errorDetails).toHaveLength(1)
			expect(error.errorDetails?.[0]).toEqual({
				"@type": "type.googleapis.com/google.rpc.RetryInfo",
				retryDelay: "59s",
			})
		})

		it("should properly construct error with QuotaFailure", () => {
			const error = new GeminiError("Quota exceeded", {
				status: 429,
				error: {
					status: "RESOURCE_EXHAUSTED",
					message: "Quota exceeded",
					details: [
						{
							"@type": "type.googleapis.com/google.rpc.QuotaFailure",
							violations: [
								{
									subject: "tokens_per_minute",
									description: "Token limit exceeded for model",
								},
							],
						},
					],
				},
			})

			expect(error.status).toBe(429)
			expect(error.errorStatus).toBe("RESOURCE_EXHAUSTED")
			expect(error.errorDetails).toHaveLength(1)
			expect(error.errorDetails?.[0]).toEqual({
				"@type": "type.googleapis.com/google.rpc.QuotaFailure",
				violations: [
					{
						subject: "tokens_per_minute",
						description: "Token limit exceeded for model",
					},
				],
			})
		})

		it("should handle both RetryInfo and QuotaFailure in same error", () => {
			const error = new GeminiError("Rate limit with retry", {
				status: 429,
				error: {
					status: "RESOURCE_EXHAUSTED",
					message: "Rate limit exceeded",
					details: [
						{
							"@type": "type.googleapis.com/google.rpc.RetryInfo",
							retryDelay: "30s",
						},
						{
							"@type": "type.googleapis.com/google.rpc.QuotaFailure",
							violations: [
								{
									subject: "requests_per_minute",
									description: "Request limit exceeded",
								},
							],
						},
					],
				},
			})

			expect(error.status).toBe(429)
			expect(error.errorDetails).toHaveLength(2)

			const retryInfo = error.errorDetails?.find(
				(d: any) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
			)
			expect(retryInfo?.retryDelay).toBe("30s")

			const quotaFailure = error.errorDetails?.find(
				(d: any) => d["@type"] === "type.googleapis.com/google.rpc.QuotaFailure",
			)
			expect(quotaFailure?.violations?.[0]?.subject).toBe("requests_per_minute")
		})

		it("should handle error details in errorDetails field (alternative format)", () => {
			const error = new GeminiError("Rate limit", {
				status: 429,
				errorDetails: [
					{
						"@type": "type.googleapis.com/google.rpc.RetryInfo",
						retryDelay: "45s",
					},
				],
			})

			expect(error.status).toBe(429)
			expect(error.errorDetails).toHaveLength(1)
			expect(error.errorDetails?.[0].retryDelay).toBe("45s")
		})
	})

	describe("Error transformation in createMessage", () => {
		it("should transform 429 errors with proper structure", async () => {
			// Mock the GoogleGenAI client to throw an error
			const mockError = {
				status: 429,
				message: "Resource exhausted",
				error: {
					status: "RESOURCE_EXHAUSTED",
					details: [
						{
							"@type": "type.googleapis.com/google.rpc.RetryInfo",
							retryDelay: "60s",
						},
					],
				},
			}

			// Mock the client's generateContentStream method
			const mockClient = {
				models: {
					generateContentStream: vi.fn().mockRejectedValue(mockError),
				},
			}
			;(handler as any).client = mockClient

			// Attempt to create a message and expect it to throw GeminiError
			try {
				const stream = handler.createMessage("system", [{ role: "user", content: "test" }])
				// Consume the stream to trigger the error
				for await (const chunk of stream) {
					// This should not be reached
				}
				expect.fail("Should have thrown an error")
			} catch (error) {
				expect(error).toBeInstanceOf(GeminiError)
				const geminiError = error as GeminiError
				expect(geminiError.status).toBe(429)
				expect(geminiError.errorDetails?.[0]).toEqual({
					"@type": "type.googleapis.com/google.rpc.RetryInfo",
					retryDelay: "60s",
				})
			}
		})

		it("should handle quota exhaustion errors", async () => {
			const mockError = {
				status: 429,
				message: "Daily quota exceeded",
				error: {
					status: "RESOURCE_EXHAUSTED",
					details: [
						{
							"@type": "type.googleapis.com/google.rpc.QuotaFailure",
							violations: [
								{
									subject: "daily_quota",
									description: "Daily quota has been exhausted",
								},
							],
						},
					],
				},
			}

			const mockClient = {
				models: {
					generateContentStream: vi.fn().mockRejectedValue(mockError),
				},
			}
			;(handler as any).client = mockClient

			try {
				const stream = handler.createMessage("system", [{ role: "user", content: "test" }])
				for await (const chunk of stream) {
					// Should not reach here
				}
				expect.fail("Should have thrown an error")
			} catch (error) {
				expect(error).toBeInstanceOf(GeminiError)
				const geminiError = error as GeminiError
				expect(geminiError.status).toBe(429)

				const quotaFailure = geminiError.errorDetails?.find(
					(d: any) => d["@type"] === "type.googleapis.com/google.rpc.QuotaFailure",
				)
				expect(quotaFailure?.violations?.[0]?.description).toBe("Daily quota has been exhausted")
			}
		})

		it("should handle generic errors without status", async () => {
			const mockError = new Error("Network error")

			const mockClient = {
				models: {
					generateContentStream: vi.fn().mockRejectedValue(mockError),
				},
			}
			;(handler as any).client = mockClient

			try {
				const stream = handler.createMessage("system", [{ role: "user", content: "test" }])
				for await (const chunk of stream) {
					// Should not reach here
				}
				expect.fail("Should have thrown an error")
			} catch (error) {
				expect(error).toBeInstanceOf(GeminiError)
				const geminiError = error as GeminiError
				// The message will be the translated error message
				expect(geminiError.message).toBeDefined()
				expect(geminiError.status).toBeUndefined()
				expect(geminiError.errorDetails).toBeUndefined()
			}
		})
	})

	describe("Error transformation in completePrompt", () => {
		it("should transform 429 errors in completePrompt", async () => {
			const mockError = {
				status: 429,
				message: "Rate limit",
				error: {
					status: "RESOURCE_EXHAUSTED",
					details: [
						{
							"@type": "type.googleapis.com/google.rpc.RetryInfo",
							retryDelay: "30s",
						},
					],
				},
			}

			const mockClient = {
				models: {
					generateContent: vi.fn().mockRejectedValue(mockError),
				},
			}
			;(handler as any).client = mockClient

			try {
				await handler.completePrompt("test prompt")
				expect.fail("Should have thrown an error")
			} catch (error) {
				expect(error).toBeInstanceOf(GeminiError)
				const geminiError = error as GeminiError
				expect(geminiError.status).toBe(429)
				expect(geminiError.errorDetails?.[0].retryDelay).toBe("30s")
			}
		})
	})

	describe("Retry delay parsing", () => {
		it("should correctly parse various delay formats", () => {
			const testCases = [
				{ input: "59s", expected: 59 },
				{ input: "120s", expected: 120 },
				{ input: "1s", expected: 1 },
				{ input: "0s", expected: 0 },
			]

			testCases.forEach(({ input, expected }) => {
				const match = input.match(/^(\d+)s$/)
				expect(match).toBeTruthy()
				expect(Number(match![1])).toBe(expected)
			})
		})

		it("should not match invalid delay formats", () => {
			const invalidFormats = ["59", "s59", "59m", "59.5s", ""]

			invalidFormats.forEach((format) => {
				const match = format.match(/^(\d+)s$/)
				expect(match).toBeFalsy()
			})
		})
	})
})
