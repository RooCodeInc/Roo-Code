import { describe, it, expect } from "vitest"

import {
	getErrorStatusCode,
	getOpenAISdkErrorMessage,
	shouldReportApiErrorToTelemetry,
	EXPECTED_API_ERROR_CODES,
} from "../telemetry.js"

describe("telemetry error utilities", () => {
	describe("getErrorStatusCode", () => {
		it("should return undefined for non-object errors", () => {
			expect(getErrorStatusCode(null)).toBeUndefined()
			expect(getErrorStatusCode(undefined)).toBeUndefined()
			expect(getErrorStatusCode("error string")).toBeUndefined()
			expect(getErrorStatusCode(42)).toBeUndefined()
		})

		it("should return undefined for objects without status property", () => {
			expect(getErrorStatusCode({})).toBeUndefined()
			expect(getErrorStatusCode({ message: "error" })).toBeUndefined()
			expect(getErrorStatusCode({ code: 500 })).toBeUndefined()
		})

		it("should return undefined for objects with non-numeric status", () => {
			expect(getErrorStatusCode({ status: "500" })).toBeUndefined()
			expect(getErrorStatusCode({ status: null })).toBeUndefined()
			expect(getErrorStatusCode({ status: undefined })).toBeUndefined()
		})

		it("should return status for OpenAI SDK-like errors", () => {
			const error = { status: 429, message: "Rate limit exceeded" }
			expect(getErrorStatusCode(error)).toBe(429)
		})

		it("should return status for errors with additional properties", () => {
			const error = {
				status: 500,
				code: "internal_error",
				message: "Internal server error",
				error: { message: "Upstream error" },
			}
			expect(getErrorStatusCode(error)).toBe(500)
		})
	})

	describe("getOpenAISdkErrorMessage", () => {
		it("should return undefined for non-OpenAI SDK errors", () => {
			expect(getOpenAISdkErrorMessage(null)).toBeUndefined()
			expect(getOpenAISdkErrorMessage(undefined)).toBeUndefined()
			expect(getOpenAISdkErrorMessage({ message: "error" })).toBeUndefined()
		})

		it("should return the primary message for simple OpenAI SDK errors", () => {
			const error = { status: 400, message: "Bad request" }
			expect(getOpenAISdkErrorMessage(error)).toBe("Bad request")
		})

		it("should prioritize nested error.message over primary message", () => {
			const error = {
				status: 500,
				message: "Request failed",
				error: { message: "Upstream provider error" },
			}
			expect(getOpenAISdkErrorMessage(error)).toBe("Upstream provider error")
		})

		it("should prioritize metadata.raw over other messages", () => {
			const error = {
				status: 429,
				message: "Request failed",
				error: {
					message: "Error details",
					metadata: { raw: "Rate limit exceeded: free-models-per-day" },
				},
			}
			expect(getOpenAISdkErrorMessage(error)).toBe("Rate limit exceeded: free-models-per-day")
		})

		it("should fallback to nested error.message when metadata.raw is undefined", () => {
			const error = {
				status: 400,
				message: "Request failed",
				error: {
					message: "Detailed error message",
					metadata: {},
				},
			}
			expect(getOpenAISdkErrorMessage(error)).toBe("Detailed error message")
		})

		it("should fallback to primary message when no nested messages exist", () => {
			const error = {
				status: 403,
				message: "Forbidden",
				error: {},
			}
			expect(getOpenAISdkErrorMessage(error)).toBe("Forbidden")
		})
	})

	describe("shouldReportApiErrorToTelemetry", () => {
		it("should return false for expected error codes", () => {
			for (const code of EXPECTED_API_ERROR_CODES) {
				expect(shouldReportApiErrorToTelemetry(code)).toBe(false)
			}
		})

		it("should return false for 429 rate limit errors", () => {
			expect(shouldReportApiErrorToTelemetry(429)).toBe(false)
			expect(shouldReportApiErrorToTelemetry(429, "Rate limit exceeded")).toBe(false)
		})

		it("should return false for messages starting with 429", () => {
			expect(shouldReportApiErrorToTelemetry(undefined, "429 Rate limit exceeded")).toBe(false)
			expect(shouldReportApiErrorToTelemetry(undefined, "429: Too many requests")).toBe(false)
		})

		it("should return false for messages containing 'rate limit' (case insensitive)", () => {
			expect(shouldReportApiErrorToTelemetry(undefined, "Rate limit exceeded")).toBe(false)
			expect(shouldReportApiErrorToTelemetry(undefined, "RATE LIMIT error")).toBe(false)
			expect(shouldReportApiErrorToTelemetry(undefined, "Request failed due to rate limit")).toBe(false)
		})

		it("should return true for non-rate-limit errors", () => {
			expect(shouldReportApiErrorToTelemetry(500)).toBe(true)
			expect(shouldReportApiErrorToTelemetry(400, "Bad request")).toBe(true)
			expect(shouldReportApiErrorToTelemetry(401, "Unauthorized")).toBe(true)
		})

		it("should return true when no error code or message is provided", () => {
			expect(shouldReportApiErrorToTelemetry()).toBe(true)
			expect(shouldReportApiErrorToTelemetry(undefined, undefined)).toBe(true)
		})

		it("should return true for regular error messages without rate limit keywords", () => {
			expect(shouldReportApiErrorToTelemetry(undefined, "Internal server error")).toBe(true)
			expect(shouldReportApiErrorToTelemetry(undefined, "Connection timeout")).toBe(true)
		})
	})
})
