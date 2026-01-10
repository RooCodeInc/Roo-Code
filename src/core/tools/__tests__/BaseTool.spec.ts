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

		describe("path stabilization requires same value twice (safe for file operations)", () => {
			it("should return false on first valid path (not yet stable)", () => {
				// First call with undefined
				const result1 = tool.testHasPathStabilized(undefined)
				expect(result1).toBe(false) // No path yet

				// Second call with valid path - NOT stable yet (need same value twice)
				const result2 = tool.testHasPathStabilized("src/file.ts")
				expect(result2).toBe(false) // First time seeing this path
			})

			it("should return true when same path is seen twice consecutively", () => {
				tool.testHasPathStabilized(undefined)
				tool.testHasPathStabilized("src/file.ts") // First time - not stable

				// Same path seen again - NOW stable
				const result = tool.testHasPathStabilized("src/file.ts")
				expect(result).toBe(true) // Same value twice = stable
			})

			it("should handle empty string as falsy (not a valid path)", () => {
				const result1 = tool.testHasPathStabilized(undefined)
				expect(result1).toBe(false)

				const result2 = tool.testHasPathStabilized("")
				expect(result2).toBe(false) // Empty string is not a valid path
			})

			it("should return false when path changes (not stable)", () => {
				tool.testHasPathStabilized("src/file.ts")
				tool.testHasPathStabilized("src/file.ts") // Stable

				// Path changes
				const result = tool.testHasPathStabilized("src/other.ts")
				expect(result).toBe(false) // Different path = not stable
			})
		})

		describe("with incremental streaming providers (char-by-char)", () => {
			it("should only return true when path stops changing", () => {
				// Simulate incremental streaming where path grows
				tool.testHasPathStabilized(undefined) // Initial state
				expect(tool.testHasPathStabilized("s")).toBe(false) // First char - not stable
				expect(tool.testHasPathStabilized("sr")).toBe(false) // Growing - not stable
				expect(tool.testHasPathStabilized("src")).toBe(false) // Growing - not stable
				expect(tool.testHasPathStabilized("src/")).toBe(false) // Growing - not stable
				expect(tool.testHasPathStabilized("src/file")).toBe(false) // Growing - not stable
				expect(tool.testHasPathStabilized("src/file.ts")).toBe(false) // Complete but first time

				// Path repeats when streaming moves past the path field
				const result = tool.testHasPathStabilized("src/file.ts")
				expect(result).toBe(true) // Same value twice = stable
			})

			it("should NOT return true on first valid path after undefined (prevents truncated paths)", () => {
				// This is the critical safety behavior - we do NOT accept first valid after undefined
				// because it could be a truncated path for incremental streaming providers
				tool.testHasPathStabilized(undefined)

				const result = tool.testHasPathStabilized("s")
				expect(result).toBe(false) // First valid after undefined - NOT stable (could be truncated)

				// Still not stable as path keeps changing
				expect(tool.testHasPathStabilized("sr")).toBe(false)
				expect(tool.testHasPathStabilized("src")).toBe(false)

				// Eventually stabilizes when same value seen twice
				expect(tool.testHasPathStabilized("src/file.ts")).toBe(false)
				expect(tool.testHasPathStabilized("src/file.ts")).toBe(true) // Now stable
			})
		})

		describe("with Gemini-style providers (complete args in one chunk)", () => {
			it("should stabilize when path appears twice", () => {
				// Gemini sends name first (no args), then all args at once
				// First partial has undefined path
				const result1 = tool.testHasPathStabilized(undefined)
				expect(result1).toBe(false) // No path yet

				// Second partial has the complete path - but need to see it twice
				const result2 = tool.testHasPathStabilized("src/file.ts")
				expect(result2).toBe(false) // First time seeing path

				// Third call with same path - NOW stable
				const result3 = tool.testHasPathStabilized("src/file.ts")
				expect(result3).toBe(true) // Same value twice = stable
			})
		})

		describe("state management", () => {
			it("should reset state with resetPartialState", () => {
				// Build up some state
				tool.testHasPathStabilized("src/file.ts")
				tool.testHasPathStabilized("src/file.ts")

				// Reset
				tool.testResetPartialState()

				// After reset, need to see path twice again
				const result1 = tool.testHasPathStabilized(undefined)
				expect(result1).toBe(false)

				const result2 = tool.testHasPathStabilized("new/path.ts")
				expect(result2).toBe(false) // First time after reset

				const result3 = tool.testHasPathStabilized("new/path.ts")
				expect(result3).toBe(true) // Same value twice
			})

			it("should handle state bleeding between tool calls (requires same value twice)", () => {
				// Simulate: Tool A completes with a path
				tool.testHasPathStabilized("old/path.ts")
				tool.testHasPathStabilized("old/path.ts") // Stable

				// Simulate: Tool A is rejected, resetPartialState never called
				// State is now "old/path.ts"

				// Simulate: Tool B starts (undefined first)
				const result1 = tool.testHasPathStabilized(undefined)
				expect(result1).toBe(false) // Clears stale state

				// Tool B's actual path - need to see twice
				const result2 = tool.testHasPathStabilized("new/path.ts")
				expect(result2).toBe(false) // First time

				const result3 = tool.testHasPathStabilized("new/path.ts")
				expect(result3).toBe(true) // Same value twice
			})

			it("should handle incremental streaming after stale state", () => {
				// Simulate: Tool A completes with a path
				tool.testHasPathStabilized("old/path.ts")
				tool.testHasPathStabilized("old/path.ts")

				// Simulate: Tool A is rejected, state is "old/path.ts"

				// Simulate: Tool B starts (incremental - undefined first)
				tool.testHasPathStabilized(undefined) // Clears stale state

				// Tool B's path grows incrementally - none should be stable until same twice
				expect(tool.testHasPathStabilized("n")).toBe(false)
				expect(tool.testHasPathStabilized("ne")).toBe(false)
				expect(tool.testHasPathStabilized("new")).toBe(false)
				expect(tool.testHasPathStabilized("new/")).toBe(false)
				expect(tool.testHasPathStabilized("new/path")).toBe(false)
				expect(tool.testHasPathStabilized("new/path.ts")).toBe(false)

				// Eventually stabilizes
				const result = tool.testHasPathStabilized("new/path.ts")
				expect(result).toBe(true) // Same value twice
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

			it("should return false on first call with valid path (fresh state)", () => {
				// Fresh tool state means lastSeenPartialPath is undefined
				// First valid path should NOT be stable (need same value twice)
				const result = tool.testHasPathStabilized("src/file.ts")
				expect(result).toBe(false) // Not stable - need same value twice
			})

			it("should return true when same valid path is provided twice starting from fresh state", () => {
				// First call
				tool.testHasPathStabilized("src/file.ts")
				// Second call with same path
				const result = tool.testHasPathStabilized("src/file.ts")
				expect(result).toBe(true) // Same value twice = stable
			})

			it("should handle multiple sequential undefined values", () => {
				expect(tool.testHasPathStabilized(undefined)).toBe(false)
				expect(tool.testHasPathStabilized(undefined)).toBe(false)
				expect(tool.testHasPathStabilized(undefined)).toBe(false)

				// Then valid path - still need twice
				expect(tool.testHasPathStabilized("path.ts")).toBe(false)
				expect(tool.testHasPathStabilized("path.ts")).toBe(true)
			})
		})
	})
})
