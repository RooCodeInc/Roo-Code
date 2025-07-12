// npx vitest run src/core/tools/__tests__/ToolRepetitionDetector.spec.ts

import type { ToolName } from "@roo-code/types"

import type { ToolUse } from "../../../shared/tools"

import { ToolRepetitionDetector } from "../ToolRepetitionDetector"

vitest.mock("../../../i18n", () => ({
	t: vitest.fn((key, options) => {
		// For toolRepetitionLimitReached key, return a message with the tool name.
		if (key === "tools:toolRepetitionLimitReached" && options?.toolName) {
			return `Roo appears to be stuck in a loop, attempting the same action (${options.toolName}) repeatedly. This might indicate a problem with its current strategy.`
		}
		return key
	}),
}))

function createToolUse(name: string, displayName?: string, params: Record<string, string> = {}): ToolUse {
	return {
		type: "tool_use",
		name: (displayName || name) as ToolName,
		params,
		partial: false,
	}
}

describe("ToolRepetitionDetector", () => {
	// ===== Initialization tests =====
	describe("initialization", () => {
		it("should default to a limit of 3 if no argument provided", () => {
			const detector = new ToolRepetitionDetector()
			// We'll verify this through behavior in subsequent tests

			// First call (counter = 1)
			const result1 = detector.check(createToolUse("test", "test-tool"))
			expect(result1.allowExecution).toBe(true)

			// Second identical call (counter = 2)
			const result2 = detector.check(createToolUse("test", "test-tool"))
			expect(result2.allowExecution).toBe(true)

			// Third identical call (counter = 3) reaches the default limit
			const result3 = detector.check(createToolUse("test", "test-tool"))
			expect(result3.allowExecution).toBe(false)
		})

		it("should use the custom limit when provided", () => {
			const customLimit = 2
			const detector = new ToolRepetitionDetector(customLimit)

			// First call (counter = 1)
			const result1 = detector.check(createToolUse("test", "test-tool"))
			expect(result1.allowExecution).toBe(true)

			// Second identical call (counter = 2) reaches the custom limit
			const result2 = detector.check(createToolUse("test", "test-tool"))
			expect(result2.allowExecution).toBe(false)
		})
	})

	// ===== No Repetition tests =====
	describe("no repetition", () => {
		it("should allow execution for different tool calls", () => {
			const detector = new ToolRepetitionDetector()

			const result1 = detector.check(createToolUse("first", "first-tool"))
			expect(result1.allowExecution).toBe(true)
			expect(result1.askUser).toBeUndefined()

			const result2 = detector.check(createToolUse("second", "second-tool"))
			expect(result2.allowExecution).toBe(true)
			expect(result2.askUser).toBeUndefined()

			const result3 = detector.check(createToolUse("third", "third-tool"))
			expect(result3.allowExecution).toBe(true)
			expect(result3.askUser).toBeUndefined()
		})

		it("should reset the counter when different tool calls are made", () => {
			const detector = new ToolRepetitionDetector(2)

			// First call
			detector.check(createToolUse("same", "same-tool"))

			// Second identical call would reach limit of 2, but we'll make a different call
			detector.check(createToolUse("different", "different-tool"))

			// Back to the first tool - should be allowed since counter was reset
			const result = detector.check(createToolUse("same", "same-tool"))
			expect(result.allowExecution).toBe(true)
		})
	})

	// ===== Repetition Below Limit tests =====
	describe("repetition below limit", () => {
		it("should allow execution when repetition is below limit and block when limit reached", () => {
			const detector = new ToolRepetitionDetector(3)

			// First call (counter = 1)
			const result1 = detector.check(createToolUse("repeat", "repeat-tool"))
			expect(result1.allowExecution).toBe(true)

			// Second identical call (counter = 2)
			const result2 = detector.check(createToolUse("repeat", "repeat-tool"))
			expect(result2.allowExecution).toBe(true)

			// Third identical call (counter = 3) reaches limit
			const result3 = detector.check(createToolUse("repeat", "repeat-tool"))
			expect(result3.allowExecution).toBe(false)
		})
	})

	// ===== Repetition Reaches Limit tests =====
	describe("repetition reaches limit", () => {
		it("should block execution when repetition reaches the limit", () => {
			const detector = new ToolRepetitionDetector(3)

			// First call (counter = 1)
			detector.check(createToolUse("repeat", "repeat-tool"))

			// Second identical call (counter = 2)
			detector.check(createToolUse("repeat", "repeat-tool"))

			// Third identical call (counter = 3) - should reach limit
			const result = detector.check(createToolUse("repeat", "repeat-tool"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
			expect(result.askUser?.messageKey).toBe("mistake_limit_reached")
			expect(result.askUser?.messageDetail).toContain("repeat-tool")
		})

		it("should reset internal state after limit is reached", () => {
			const detector = new ToolRepetitionDetector(2)

			// Reach the limit
			detector.check(createToolUse("repeat", "repeat-tool"))
			const limitResult = detector.check(createToolUse("repeat", "repeat-tool")) // This reaches limit
			expect(limitResult.allowExecution).toBe(false)

			// Use a new tool call - should be allowed since state was reset
			const result = detector.check(createToolUse("new", "new-tool"))
			expect(result.allowExecution).toBe(true)
		})
	})

	// ===== Repetition After Limit (Post-Reset) tests =====
	describe("repetition after limit", () => {
		it("should allow execution of previously problematic tool after reset", () => {
			const detector = new ToolRepetitionDetector(2)

			// Reach the limit with a specific tool
			detector.check(createToolUse("problem", "problem-tool"))
			const limitResult = detector.check(createToolUse("problem", "problem-tool")) // This reaches limit
			expect(limitResult.allowExecution).toBe(false)

			// The same tool that previously caused problems should now be allowed
			const result = detector.check(createToolUse("problem", "problem-tool"))
			expect(result.allowExecution).toBe(true)
		})

		it("should require reaching the limit again after reset", () => {
			const detector = new ToolRepetitionDetector(2)

			// Reach the limit
			detector.check(createToolUse("repeat", "repeat-tool"))
			const limitResult = detector.check(createToolUse("repeat", "repeat-tool")) // This reaches limit
			expect(limitResult.allowExecution).toBe(false)

			// First call after reset
			detector.check(createToolUse("repeat", "repeat-tool"))

			// Second identical call (counter = 2) should reach limit again
			const result = detector.check(createToolUse("repeat", "repeat-tool"))
			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})
	})

	// ===== Tool Name Interpolation tests =====
	describe("tool name interpolation", () => {
		it("should include tool name in the error message", () => {
			const detector = new ToolRepetitionDetector(2)
			const toolName = "special-tool-name"

			// Reach the limit
			detector.check(createToolUse("test", toolName))
			const result = detector.check(createToolUse("test", toolName))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser?.messageDetail).toContain(toolName)
		})
	})

	// ===== Edge Cases =====
	describe("edge cases", () => {
		it("should handle empty tool call", () => {
			const detector = new ToolRepetitionDetector(2)

			// Create an empty tool call - a tool with no parameters
			// Use the empty tool directly in the check calls
			detector.check(createToolUse("empty-tool", "empty-tool"))
			const result = detector.check(createToolUse("empty-tool"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should handle different tool names with identical serialized JSON", () => {
			const detector = new ToolRepetitionDetector(2)

			// First, call with tool-name-1 twice to set up the counter
			const toolUse1 = createToolUse("tool-name-1", "tool-name-1", { param: "value" })
			detector.check(toolUse1)

			// Create a tool that will serialize to the same JSON as toolUse1
			// We need to mock the serializeToolUse method to return the same value
			const toolUse2 = createToolUse("tool-name-2", "tool-name-2", { param: "value" })

			// Override the private method to force identical serialization
			const originalSerialize = (detector as any).serializeToolUse
			;(detector as any).serializeToolUse = (tool: ToolUse) => {
				// Use string comparison for the name since it's technically an enum
				if (String(tool.name) === "tool-name-2") {
					return (detector as any).serializeToolUse(toolUse1) // Return the same JSON as toolUse1
				}
				return originalSerialize(tool)
			}

			// This should detect as a repetition now
			const result = detector.check(toolUse2)

			// Restore the original method
			;(detector as any).serializeToolUse = originalSerialize

			// Since we're directly manipulating the internal state for testing,
			// we still expect it to consider this a repetition
			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should treat tools with same parameters in different order as identical", () => {
			const detector = new ToolRepetitionDetector(2)

			// First call with parameters in one order
			const toolUse1 = createToolUse("same-tool", "same-tool", { a: "1", b: "2", c: "3" })
			detector.check(toolUse1)

			// Create tool with same parameters but in different order
			const toolUse2 = createToolUse("same-tool", "same-tool", { c: "3", a: "1", b: "2" })

			// This should still detect as a repetition due to canonical JSON with sorted keys
			const result = detector.check(toolUse2)

			// Since parameters are sorted alphabetically in the serialized JSON,
			// these should be considered identical
			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})
	})

	// ===== Explicit Nth Call Blocking tests =====
	describe("explicit Nth call blocking behavior", () => {
		it("should block on the 1st call for limit 1", () => {
			const detector = new ToolRepetitionDetector(1)

			// First call (counter = 1) should be blocked
			const result = detector.check(createToolUse("tool", "tool-name"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should block on the 2nd call for limit 2", () => {
			const detector = new ToolRepetitionDetector(2)

			// First call (counter = 1)
			const result1 = detector.check(createToolUse("tool", "tool-name"))
			expect(result1.allowExecution).toBe(true)

			// Second call (counter = 2) should be blocked
			const result2 = detector.check(createToolUse("tool", "tool-name"))
			expect(result2.allowExecution).toBe(false)
			expect(result2.askUser).toBeDefined()
		})

		it("should block on the 3rd call for limit 3 (default)", () => {
			const detector = new ToolRepetitionDetector(3)

			// First call (counter = 1)
			const result1 = detector.check(createToolUse("tool", "tool-name"))
			expect(result1.allowExecution).toBe(true)

			// Second call (counter = 2)
			const result2 = detector.check(createToolUse("tool", "tool-name"))
			expect(result2.allowExecution).toBe(true)

			// Third call (counter = 3) should be blocked
			const result3 = detector.check(createToolUse("tool", "tool-name"))
			expect(result3.allowExecution).toBe(false)
			expect(result3.askUser).toBeDefined()
		})
	})

	// ===== Non-Continuous Pattern Detection tests =====
	describe("non-continuous pattern detection", () => {
		it("should detect ABAB pattern repetition", () => {
			const detector = new ToolRepetitionDetector(5) // Set high limit to focus on pattern detection

			// Create ABAB pattern
			detector.check(createToolUse("toolA", "toolA"))
			detector.check(createToolUse("toolB", "toolB"))
			detector.check(createToolUse("toolA", "toolA"))
			const result = detector.check(createToolUse("toolB", "toolB"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
			expect(result.askUser?.messageKey).toBe("mistake_limit_reached")
		})

		it("should detect ABCABC pattern repetition", () => {
			const detector = new ToolRepetitionDetector(10) // Set high limit to focus on pattern detection

			// Create ABCABC pattern
			detector.check(createToolUse("toolA", "toolA"))
			detector.check(createToolUse("toolB", "toolB"))
			detector.check(createToolUse("toolC", "toolC"))
			detector.check(createToolUse("toolA", "toolA"))
			detector.check(createToolUse("toolB", "toolB"))
			const result = detector.check(createToolUse("toolC", "toolC"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should detect ABAB pattern (2 repetitions)", () => {
			const detector = new ToolRepetitionDetector(10)

			// Create ABAB pattern (2 repetitions of AB)
			// First AB
			detector.check(createToolUse("toolA", "toolA"))
			detector.check(createToolUse("toolB", "toolB"))
			// Second AB - should trigger after completing the second repetition
			detector.check(createToolUse("toolA", "toolA"))
			const result = detector.check(createToolUse("toolB", "toolB"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should not detect pattern with insufficient repetitions", () => {
			const detector = new ToolRepetitionDetector(10)

			// Create AB pattern only once (not enough repetitions)
			const result1 = detector.check(createToolUse("toolA", "toolA"))
			const result2 = detector.check(createToolUse("toolB", "toolB"))

			expect(result1.allowExecution).toBe(true)
			expect(result2.allowExecution).toBe(true)
		})

		it("should allow different tools without pattern", () => {
			const detector = new ToolRepetitionDetector(10)

			// Create sequence without repetitive pattern
			const result1 = detector.check(createToolUse("toolA", "toolA"))
			const result2 = detector.check(createToolUse("toolB", "toolB"))
			const result3 = detector.check(createToolUse("toolC", "toolC"))
			const result4 = detector.check(createToolUse("toolD", "toolD"))

			expect(result1.allowExecution).toBe(true)
			expect(result2.allowExecution).toBe(true)
			expect(result3.allowExecution).toBe(true)
			expect(result4.allowExecution).toBe(true)
		})

		it("should detect pattern with different parameters", () => {
			const detector = new ToolRepetitionDetector(10)

			// Create ABAB pattern with different parameters
			detector.check(createToolUse("read_file", "read_file", { path: "file1.ts" }))
			detector.check(createToolUse("write_to_file", "write_to_file", { path: "file2.ts", content: "test" }))
			detector.check(createToolUse("read_file", "read_file", { path: "file1.ts" }))
			const result = detector.check(
				createToolUse("write_to_file", "write_to_file", { path: "file2.ts", content: "test" }),
			)

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should reset pattern detection after limit reached", () => {
			const detector = new ToolRepetitionDetector(10)

			// Create ABAB pattern to trigger detection
			detector.check(createToolUse("toolA", "toolA"))
			detector.check(createToolUse("toolB", "toolB"))
			detector.check(createToolUse("toolA", "toolA"))
			const limitResult = detector.check(createToolUse("toolB", "toolB"))
			expect(limitResult.allowExecution).toBe(false)

			// After reset, should allow new tools
			const result = detector.check(createToolUse("toolC", "toolC"))
			expect(result.allowExecution).toBe(true)
		})

		it("should handle complex patterns like ABCDEFABCDEF", () => {
			const detector = new ToolRepetitionDetector(15)

			// Create ABCDEFABCDEF pattern
			const tools = ["toolA", "toolB", "toolC", "toolD", "toolE", "toolF"]

			// First iteration
			for (const tool of tools) {
				detector.check(createToolUse(tool, tool))
			}

			// Second iteration - should trigger on the last tool
			for (let i = 0; i < tools.length - 1; i++) {
				detector.check(createToolUse(tools[i], tools[i]))
			}

			const result = detector.check(createToolUse(tools[tools.length - 1], tools[tools.length - 1]))
			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should not detect pattern when tools are similar but not identical", () => {
			const detector = new ToolRepetitionDetector(10)

			// Create similar but not identical pattern - different tools entirely
			detector.check(createToolUse("read_file", "read_file", { path: "file1.ts" }))
			detector.check(createToolUse("write_to_file", "write_to_file", { path: "file2.ts" })) // Different tool
			detector.check(createToolUse("read_file", "read_file", { path: "file1.ts" }))
			const result = detector.check(createToolUse("list_files", "list_files", { path: "." })) // Different tool

			expect(result.allowExecution).toBe(true) // Should allow since tools are different
		})

		it("should detect pattern when same tool has different parameters in repetitive sequence", () => {
			const detector = new ToolRepetitionDetector(10)

			// Create pattern with same tool but different parameters - this IS a repetitive pattern
			detector.check(createToolUse("read_file", "read_file", { path: "file1.ts" }))
			detector.check(createToolUse("read_file", "read_file", { path: "file2.ts" })) // Different parameter
			detector.check(createToolUse("read_file", "read_file", { path: "file1.ts" }))
			const result = detector.check(createToolUse("read_file", "read_file", { path: "file2.ts" }))

			expect(result.allowExecution).toBe(false) // Should detect pattern even with different parameters
			expect(result.askUser).toBeDefined()
		})

		it("should handle edge case with minimum pattern length", () => {
			const detector = new ToolRepetitionDetector(10)

			// Test minimum pattern length (2)
			detector.check(createToolUse("toolA", "toolA"))
			detector.check(createToolUse("toolB", "toolB"))
			detector.check(createToolUse("toolA", "toolA"))
			const result = detector.check(createToolUse("toolB", "toolB"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})
	})

	// ===== Integration tests for both consecutive and pattern detection =====
	describe("integration: consecutive and pattern detection", () => {
		it("should prioritize consecutive detection over pattern detection", () => {
			const detector = new ToolRepetitionDetector(2)

			// This should trigger consecutive detection before pattern detection
			detector.check(createToolUse("toolA", "toolA"))
			const result = detector.check(createToolUse("toolA", "toolA"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should detect patterns when consecutive limit is higher", () => {
			const detector = new ToolRepetitionDetector(10) // High consecutive limit

			// Create ABAB pattern - should be caught by pattern detection
			detector.check(createToolUse("toolA", "toolA"))
			detector.check(createToolUse("toolB", "toolB"))
			detector.check(createToolUse("toolA", "toolA"))
			const result = detector.check(createToolUse("toolB", "toolB"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should work correctly after multiple resets", () => {
			const detector = new ToolRepetitionDetector(2)

			// First reset via consecutive detection
			detector.check(createToolUse("toolA", "toolA"))
			const firstLimit = detector.check(createToolUse("toolA", "toolA"))
			expect(firstLimit.allowExecution).toBe(false)

			// Second reset via pattern detection
			detector.check(createToolUse("toolB", "toolB"))
			detector.check(createToolUse("toolC", "toolC"))
			detector.check(createToolUse("toolB", "toolB"))
			const secondLimit = detector.check(createToolUse("toolC", "toolC"))
			expect(secondLimit.allowExecution).toBe(false)

			// Should work normally after resets
			const result = detector.check(createToolUse("toolD", "toolD"))
			expect(result.allowExecution).toBe(true)
		})
	})
})
