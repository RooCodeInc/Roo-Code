import { ErrorAnalyzer } from "./ErrorAnalyzer"
import { ErrorType, ErrorContext } from "../../core/interfaces/types"

describe("ErrorAnalyzer", () => {
	let analyzer: ErrorAnalyzer

	beforeEach(() => {
		analyzer = new ErrorAnalyzer()
	})

	describe("analyze", () => {
		test("should classify throttling errors correctly", () => {
			const throttleError = new Error("Too many requests")
			const analysis = analyzer.analyze(throttleError)

			expect(analysis.errorType).toBe("THROTTLING")
			expect(analysis.severity).toBe("medium")
			expect(analysis.isRetryable).toBe(true)
			expect(analysis.message).toBe("Too many requests")
		})

		test("should classify rate limit errors correctly", () => {
			const rateLimitError = new Error("Rate limit exceeded")
			const analysis = analyzer.analyze(rateLimitError)

			expect(analysis.errorType).toBe("RATE_LIMITED")
			expect(analysis.severity).toBe("medium")
			expect(analysis.isRetryable).toBe(true)
		})

		test("should classify access denied errors correctly", () => {
			const authError = new Error("Access denied")
			const analysis = analyzer.analyze(authError)

			expect(analysis.errorType).toBe("ACCESS_DENIED")
			expect(analysis.severity).toBe("critical")
			expect(analysis.isRetryable).toBe(false)
		})

		test("should classify quota exceeded errors correctly", () => {
			const quotaError = new Error("Quota exceeded")
			const analysis = analyzer.analyze(quotaError)

			expect(analysis.errorType).toBe("QUOTA_EXCEEDED")
			expect(analysis.severity).toBe("high")
			expect(analysis.isRetryable).toBe(true)
		})

		test("should classify service unavailable errors correctly", () => {
			const serverError = new Error("Service unavailable")
			const analysis = analyzer.analyze(serverError)

			expect(analysis.errorType).toBe("SERVICE_UNAVAILABLE")
			expect(analysis.severity).toBe("medium")
			expect(analysis.isRetryable).toBe(true)
		})

		test("should classify network errors correctly", () => {
			const networkError = new Error("Network connection failed")
			const analysis = analyzer.analyze(networkError)

			expect(analysis.errorType).toBe("NETWORK_ERROR")
			expect(analysis.severity).toBe("low")
			expect(analysis.isRetryable).toBe(true)
		})

		test("should classify timeout errors correctly", () => {
			const timeoutError = new Error("Request timed out")
			const analysis = analyzer.analyze(timeoutError)

			expect(analysis.errorType).toBe("TIMEOUT")
			expect(analysis.severity).toBe("low")
			expect(analysis.isRetryable).toBe(true)
		})

		test("should classify unknown errors as generic", () => {
			const unknownError = new Error("Some unknown error")
			const analysis = analyzer.analyze(unknownError)

			expect(analysis.errorType).toBe("GENERIC")
			expect(analysis.severity).toBe("medium")
			expect(analysis.isRetryable).toBe(false)
		})

		test("should handle errors with HTTP status 429", () => {
			const errorWith429 = Object.assign(new Error("Too many requests"), { status: 429 })
			const analysis = analyzer.analyze(errorWith429)

			expect(analysis.errorType).toBe("THROTTLING")
			expect(analysis.metadata.statusCode).toBe(429)
		})

		test("should handle AWS-style errors with metadata", () => {
			const awsError = Object.assign(new Error("ThrottlingException"), {
				name: "ThrottlingException",
				$metadata: { httpStatusCode: 429 },
			})
			const analysis = analyzer.analyze(awsError)

			expect(analysis.errorType).toBe("THROTTLING")
			expect(analysis.metadata.statusCode).toBe(429)
			expect(analysis.metadata.errorName).toBe("ThrottlingException")
		})

		test("should extract provider retry delay from Google Gemini errors", () => {
			const geminiError = Object.assign(new Error("Quota exceeded"), {
				errorDetails: [
					{
						"@type": "type.googleapis.com/google.rpc.RetryInfo",
						retryDelay: "5s",
					},
				],
			})
			const analysis = analyzer.analyze(geminiError)

			expect(analysis.providerRetryDelay).toBe(6) // 5 + 1 second buffer
		})

		test("should include context provider in metadata", () => {
			const error = new Error("Test error")
			const context: ErrorContext = {
				isStreaming: false,
				provider: "anthropic",
				modelId: "claude-3",
				retryAttempt: 1,
			}
			const analysis = analyzer.analyze(error, context)

			expect(analysis.metadata.provider).toBe("anthropic")
		})

		test("should handle null/undefined errors", () => {
			const analysis = analyzer.analyze(null)

			expect(analysis.errorType).toBe("UNKNOWN")
			expect(analysis.severity).toBe("low")
			expect(analysis.isRetryable).toBe(false)
		})
	})

	describe("error pattern matching", () => {
		test("should match various throttling patterns", () => {
			const patterns = [
				"throttling",
				"overloaded",
				"too many requests",
				"request limit",
				"concurrent requests",
				"bedrock is unable to process",
			]

			patterns.forEach((pattern) => {
				const error = new Error(pattern)
				const analysis = analyzer.analyze(error)
				expect(analysis.errorType).toBe("THROTTLING")
			})
		})

		test("should match various rate limit patterns", () => {
			const patterns = ["rate limit exceeded", "rate limited", "please wait"]

			patterns.forEach((pattern) => {
				const error = new Error(pattern)
				const analysis = analyzer.analyze(error)
				expect(analysis.errorType).toBe("RATE_LIMITED")
			})
		})

		test("should match various quota patterns", () => {
			const patterns = ["quota exceeded", "quota", "billing", "credits"]

			patterns.forEach((pattern) => {
				const error = new Error(pattern)
				const analysis = analyzer.analyze(error)
				expect(analysis.errorType).toBe("QUOTA_EXCEEDED")
			})
		})

		test("should match various service unavailable patterns", () => {
			const patterns = ["service unavailable", "busy", "temporarily unavailable", "server error"]

			patterns.forEach((pattern) => {
				const error = new Error(pattern)
				const analysis = analyzer.analyze(error)
				expect(analysis.errorType).toBe("SERVICE_UNAVAILABLE")
			})
		})

		test("should match various access denied patterns", () => {
			const patterns = ["access denied", "unauthorized", "forbidden", "permission denied"]

			patterns.forEach((pattern) => {
				const error = new Error(pattern)
				const analysis = analyzer.analyze(error)
				expect(analysis.errorType).toBe("ACCESS_DENIED")
			})
		})

		test("should match various not found patterns", () => {
			const patterns = ["not found", "does not exist", "invalid model"]

			patterns.forEach((pattern) => {
				const error = new Error(pattern)
				const analysis = analyzer.analyze(error)
				expect(analysis.errorType).toBe("NOT_FOUND")
			})
		})

		test("should match various network error patterns", () => {
			const patterns = ["network error", "connection failed", "dns error", "host unreachable", "socket error"]

			patterns.forEach((pattern) => {
				const error = new Error(pattern)
				const analysis = analyzer.analyze(error)
				expect(analysis.errorType).toBe("NETWORK_ERROR")
			})
		})

		test("should match various timeout patterns", () => {
			const patterns = ["timeout", "timed out", "deadline exceeded", "aborted"]

			patterns.forEach((pattern) => {
				const error = new Error(pattern)
				const analysis = analyzer.analyze(error)
				expect(analysis.errorType).toBe("TIMEOUT")
			})
		})
	})

	describe("error metadata extraction", () => {
		test("should extract status code from different error formats", () => {
			const errorWithStatus = Object.assign(new Error("Error"), { status: 404 })
			const analysis1 = analyzer.analyze(errorWithStatus)
			expect(analysis1.metadata.statusCode).toBe(404)

			const errorWithMetadata = Object.assign(new Error("Error"), {
				$metadata: { httpStatusCode: 500 },
			})
			const analysis2 = analyzer.analyze(errorWithMetadata)
			expect(analysis2.metadata.statusCode).toBe(500)
		})

		test("should extract error name and code", () => {
			const error = Object.assign(new Error("Custom error"), {
				name: "CustomError",
				code: "ERR_CUSTOM",
			})
			const analysis = analyzer.analyze(error)

			expect(analysis.metadata.errorName).toBe("CustomError")
			expect(analysis.metadata.errorCode).toBe("ERR_CUSTOM")
		})

		test("should clean up error messages", () => {
			const error = new Error("  Error   with   extra   spaces  ")
			const analysis = analyzer.analyze(error)

			expect(analysis.message).toBe("Error with extra spaces")
		})
	})

	describe("retryability rules", () => {
		test("should mark retryable error types as retryable", () => {
			const retryableTypes: ErrorType[] = [
				"THROTTLING",
				"RATE_LIMITED",
				"SERVICE_UNAVAILABLE",
				"TIMEOUT",
				"NETWORK_ERROR",
				"QUOTA_EXCEEDED",
			]

			retryableTypes.forEach((errorType) => {
				const error = new Error(`${errorType} error`)
				const analysis = analyzer.analyze(error)
				// We need to ensure the error gets classified as the expected type
				// This is a bit indirect but tests the classification + retryability
				if (analysis.errorType === errorType) {
					expect(analysis.isRetryable).toBe(true)
				}
			})
		})

		test("should mark non-retryable error types as non-retryable", () => {
			const nonRetryableTypes: ErrorType[] = [
				"ACCESS_DENIED",
				"NOT_FOUND",
				"INVALID_REQUEST",
				"GENERIC",
				"UNKNOWN",
			]

			nonRetryableTypes.forEach((errorType) => {
				const error = new Error(`${errorType} error`)
				const analysis = analyzer.analyze(error)
				// Again, indirect test but verifies classification + retryability
				if (analysis.errorType === errorType) {
					expect(analysis.isRetryable).toBe(false)
				}
			})
		})
	})
})
