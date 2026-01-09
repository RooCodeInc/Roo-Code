import { describe, it, expect, beforeEach } from "vitest"
import { BaseTool, ToolCallbacks } from "../BaseTool"
import type { ToolUse } from "../../../shared/tools"
import type { Task } from "../../task/Task"

/**
 * Concrete implementation of BaseTool for testing purposes.
 * Exposes protected methods for testing.
 */
class TestTool extends BaseTool<"edit_file"> {
	readonly name = "edit_file" as const

	parseLegacy(params: Partial<Record<string, string>>) {
		return {
			file_path: params.file_path || "",
			old_string: params.old_string || "",
			new_string: params.new_string || "",
		}
	}

	async execute(params: any, task: Task, callbacks: ToolCallbacks): Promise<void> {
		// No-op for testing
	}

	// Expose protected methods for testing
	public testHasPathStabilized(path: string | undefined): boolean {
		return this.hasPathStabilized(path)
	}

	public testResetPartialState(): void {
		this.resetPartialState()
	}
}

describe("BaseTool", () => {
	describe("hasPathStabilized", () => {
		let tool: TestTool

		beforeEach(() => {
			tool = new TestTool()
		})

		describe("with Gemini-style providers (complete args in one chunk)", () => {
			it("should return true when transitioning from undefined to a valid path", () => {
				// Gemini sends name first (no args), then all args at once
				// Simulate: First partial has undefined path
				const result1 = tool.testHasPathStabilized(undefined)
				expect(result1).toBe(false) // No path yet

				// Second partial has the complete path
				const result2 = tool.testHasPathStabilized("src/file.ts")
				expect(result2).toBe(true) // First valid path after undefined = stable
			})

			it("should handle empty string as falsy (not a valid path)", () => {
				const result1 = tool.testHasPathStabilized(undefined)
				expect(result1).toBe(false)

				const result2 = tool.testHasPathStabilized("")
				expect(result2).toBe(false) // Empty string is not a valid path
			})
		})

		describe("with incremental streaming providers (char-by-char)", () => {
			it("should return true when the same path is seen twice", () => {
				// Simulate incremental streaming where path grows
				tool.testHasPathStabilized(undefined) // Initial state
				tool.testHasPathStabilized("s") // First char
				tool.testHasPathStabilized("sr") // Growing
				tool.testHasPathStabilized("src") // Growing
				tool.testHasPathStabilized("src/") // Growing
				tool.testHasPathStabilized("src/file") // Growing
				tool.testHasPathStabilized("src/file.ts") // Complete

				// Path repeats when streaming moves past the path field
				const result = tool.testHasPathStabilized("src/file.ts")
				expect(result).toBe(true) // Same value twice = stable
			})

			it("should return true on first valid path after undefined (may show truncated)", () => {
				// This is acceptable behavior - briefly showing truncated paths
				// is better than showing nothing or wrong paths
				tool.testHasPathStabilized(undefined)

				const result = tool.testHasPathStabilized("s")
				expect(result).toBe(true) // First valid after undefined

				// Subsequent different values won't trigger until stable
				const result2 = tool.testHasPathStabilized("sr")
				expect(result2).toBe(false) // Different from previous

				const result3 = tool.testHasPathStabilized("src")
				expect(result3).toBe(false) // Different from previous
			})
		})

		describe("state management", () => {
			it("should reset state with resetPartialState", () => {
				// Build up some state
				tool.testHasPathStabilized("src/file.ts")
				tool.testHasPathStabilized("src/file.ts")

				// Reset
				tool.testResetPartialState()

				// After reset, transitioning to a path should work
				const result1 = tool.testHasPathStabilized(undefined)
				expect(result1).toBe(false)

				const result2 = tool.testHasPathStabilized("new/path.ts")
				expect(result2).toBe(true) // First valid after undefined
			})

			it("should handle state bleeding between tool calls (stale state cleared by undefined)", () => {
				// Simulate: Tool A completes with a path
				tool.testHasPathStabilized("old/path.ts")
				tool.testHasPathStabilized("old/path.ts")

				// Simulate: Tool A is rejected, resetPartialState never called
				// State is now "old/path.ts"

				// Simulate: Tool B starts (Gemini-style - undefined first)
				const result1 = tool.testHasPathStabilized(undefined)
				expect(result1).toBe(false) // Clears stale state

				// Tool B's actual path
				const result2 = tool.testHasPathStabilized("new/path.ts")
				expect(result2).toBe(true) // Works because previous was undefined
			})

			it("should handle state bleeding with non-Gemini providers", () => {
				// Simulate: Tool A completes with a path
				tool.testHasPathStabilized("old/path.ts")
				tool.testHasPathStabilized("old/path.ts")

				// Simulate: Tool A is rejected, state is "old/path.ts"

				// Simulate: Tool B starts (incremental - undefined first)
				tool.testHasPathStabilized(undefined) // Clears stale state

				// Tool B's path grows incrementally
				const result1 = tool.testHasPathStabilized("n")
				expect(result1).toBe(true) // First valid after undefined

				// Grows but different from previous
				const result2 = tool.testHasPathStabilized("ne")
				expect(result2).toBe(false)

				// Eventually stabilizes
				tool.testHasPathStabilized("new")
				tool.testHasPathStabilized("new/")
				tool.testHasPathStabilized("new/path")
				tool.testHasPathStabilized("new/path.ts")
				const result3 = tool.testHasPathStabilized("new/path.ts")
				expect(result3).toBe(true) // Same value twice
			})
		})

		describe("edge cases", () => {
			it("should return false when path is undefined", () => {
				expect(tool.testHasPathStabilized(undefined)).toBe(false)
			})

			it("should return false when path is empty string", () => {
				tool.testHasPathStabilized(undefined)
				expect(tool.testHasPathStabilized("")).toBe(false)
			})

			it("should return true when same valid path is provided on first call (fresh state)", () => {
				// Fresh tool state means lastSeenPartialPath is undefined
				// First valid path = first valid after undefined
				const result = tool.testHasPathStabilized("src/file.ts")
				expect(result).toBe(true)
			})

			it("should handle multiple sequential undefined values", () => {
				expect(tool.testHasPathStabilized(undefined)).toBe(false)
				expect(tool.testHasPathStabilized(undefined)).toBe(false)
				expect(tool.testHasPathStabilized(undefined)).toBe(false)

				// Then valid path
				const result = tool.testHasPathStabilized("path.ts")
				expect(result).toBe(true)
			})
		})
	})
})
