// pnpm --filter @roo-code/types test src/__tests__/telemetry.test.ts

import { describe, it, expect } from "vitest"
import { shouldReportApiErrorToTelemetry, EXPECTED_API_ERROR_CODES } from "../telemetry.js"

describe("shouldReportApiErrorToTelemetry", () => {
	it("should return true when errorCode is undefined", () => {
		expect(shouldReportApiErrorToTelemetry(undefined)).toBe(true)
	})

	it("should return false for 402 (payment required) errors", () => {
		expect(shouldReportApiErrorToTelemetry(402)).toBe(false)
	})

	it("should return false for 429 (rate limit) errors", () => {
		expect(shouldReportApiErrorToTelemetry(429)).toBe(false)
	})

	it("should return true for other error codes", () => {
		expect(shouldReportApiErrorToTelemetry(400)).toBe(true)
		expect(shouldReportApiErrorToTelemetry(401)).toBe(true)
		expect(shouldReportApiErrorToTelemetry(403)).toBe(true)
		expect(shouldReportApiErrorToTelemetry(404)).toBe(true)
		expect(shouldReportApiErrorToTelemetry(500)).toBe(true)
		expect(shouldReportApiErrorToTelemetry(502)).toBe(true)
		expect(shouldReportApiErrorToTelemetry(503)).toBe(true)
	})
})

describe("EXPECTED_API_ERROR_CODES", () => {
	it("should contain 402 (payment required)", () => {
		expect(EXPECTED_API_ERROR_CODES.has(402)).toBe(true)
	})

	it("should contain 429 (rate limit)", () => {
		expect(EXPECTED_API_ERROR_CODES.has(429)).toBe(true)
	})

	it("should only contain expected error codes", () => {
		expect(EXPECTED_API_ERROR_CODES.size).toBe(2)
	})
})
