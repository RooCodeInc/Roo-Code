import { describe, it, expect } from "vitest"
import {
	CONTEXT_MANAGEMENT_EVENTS,
	isContextManagementEvent,
	assertNever,
	type ContextManagementEvent,
} from "../context-management.js"

describe("context-management", () => {
	describe("CONTEXT_MANAGEMENT_EVENTS", () => {
		it("should be a readonly array", () => {
			expect(Array.isArray(CONTEXT_MANAGEMENT_EVENTS)).toBe(true)
		})

		it("should contain condense_context", () => {
			expect(CONTEXT_MANAGEMENT_EVENTS).toContain("condense_context")
		})

		it("should contain condense_context_error", () => {
			expect(CONTEXT_MANAGEMENT_EVENTS).toContain("condense_context_error")
		})

		it("should contain sliding_window_truncation", () => {
			expect(CONTEXT_MANAGEMENT_EVENTS).toContain("sliding_window_truncation")
		})

		it("should have exactly 3 events", () => {
			expect(CONTEXT_MANAGEMENT_EVENTS).toHaveLength(3)
		})
	})

	describe("isContextManagementEvent", () => {
		describe("valid events", () => {
			it("should return true for condense_context", () => {
				expect(isContextManagementEvent("condense_context")).toBe(true)
			})

			it("should return true for condense_context_error", () => {
				expect(isContextManagementEvent("condense_context_error")).toBe(true)
			})

			it("should return true for sliding_window_truncation", () => {
				expect(isContextManagementEvent("sliding_window_truncation")).toBe(true)
			})
		})

		describe("invalid events", () => {
			it("should return false for empty string", () => {
				expect(isContextManagementEvent("")).toBe(false)
			})

			it("should return false for null", () => {
				expect(isContextManagementEvent(null)).toBe(false)
			})

			it("should return false for undefined", () => {
				expect(isContextManagementEvent(undefined)).toBe(false)
			})

			it("should return false for numbers", () => {
				expect(isContextManagementEvent(0)).toBe(false)
				expect(isContextManagementEvent(123)).toBe(false)
			})

			it("should return false for objects", () => {
				expect(isContextManagementEvent({})).toBe(false)
				expect(isContextManagementEvent({ type: "condense_context" })).toBe(false)
			})

			it("should return false for arrays", () => {
				expect(isContextManagementEvent([])).toBe(false)
				expect(isContextManagementEvent(["condense_context"])).toBe(false)
			})

			it("should return false for other event types", () => {
				expect(isContextManagementEvent("text")).toBe(false)
				expect(isContextManagementEvent("error")).toBe(false)
				expect(isContextManagementEvent("api_req_started")).toBe(false)
				expect(isContextManagementEvent("user_feedback")).toBe(false)
				expect(isContextManagementEvent("completion_result")).toBe(false)
			})

			it("should return false for similar but incorrect event names", () => {
				expect(isContextManagementEvent("condense_context_")).toBe(false)
				expect(isContextManagementEvent("CONDENSE_CONTEXT")).toBe(false)
				expect(isContextManagementEvent("Condense_Context")).toBe(false)
				expect(isContextManagementEvent("condense context")).toBe(false)
				expect(isContextManagementEvent("sliding_window")).toBe(false)
				expect(isContextManagementEvent("truncation")).toBe(false)
			})
		})

		describe("type narrowing", () => {
			it("should narrow type to ContextManagementEvent", () => {
				const value: unknown = "condense_context"
				if (isContextManagementEvent(value)) {
					// TypeScript should now know value is ContextManagementEvent
					const event: ContextManagementEvent = value
					expect(event).toBe("condense_context")
				}
			})
		})
	})

	describe("assertNever", () => {
		it("should throw an error with the value in the message", () => {
			const testValue = "unexpected_event" as never
			expect(() => assertNever(testValue)).toThrow('Unhandled context management event: "unexpected_event"')
		})

		it("should throw an error for any value", () => {
			expect(() => assertNever("test" as never)).toThrow('Unhandled context management event: "test"')
		})
	})

	describe("ContextManagementEvent type", () => {
		it("should work with switch exhaustiveness", () => {
			// This test verifies that the type system enforces exhaustiveness
			const handleEvent = (event: ContextManagementEvent): string => {
				switch (event) {
					case "condense_context":
						return "condensing"
					case "condense_context_error":
						return "error"
					case "sliding_window_truncation":
						return "truncating"
					default:
						// If we miss a case, TypeScript would error here
						// The assertNever ensures runtime exhaustiveness
						return assertNever(event)
				}
			}

			expect(handleEvent("condense_context")).toBe("condensing")
			expect(handleEvent("condense_context_error")).toBe("error")
			expect(handleEvent("sliding_window_truncation")).toBe("truncating")
		})
	})
})
