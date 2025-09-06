import { describe, it, expect } from "vitest"
import { formatResponse } from "../responses"

describe("formatResponse.toolError", () => {
	it("should format error without tool name when not provided", () => {
		const error = "Something went wrong"
		const result = formatResponse.toolError(error)

		expect(result).toBe("Tool Execution Error\n<error>\nSomething went wrong\n</error>")
	})

	it("should format error with tool name when provided", () => {
		const error = "Invalid mode: test_mode"
		const toolName = "switch_mode"
		const result = formatResponse.toolError(error, toolName)

		expect(result).toBe("Tool Call Error: switch_mode\n<error>\nInvalid mode: test_mode\n</error>")
	})

	it("should handle undefined error message", () => {
		const result = formatResponse.toolError(undefined, "new_task")

		expect(result).toBe("Tool Call Error: new_task\n<error>\nundefined\n</error>")
	})

	it("should work with various tool names", () => {
		const testCases = [
			{ toolName: "write_to_file", expected: "Tool Call Error: write_to_file" },
			{ toolName: "execute_command", expected: "Tool Call Error: execute_command" },
			{ toolName: "apply_diff", expected: "Tool Call Error: apply_diff" },
			{ toolName: "new_task", expected: "Tool Call Error: new_task" },
			{ toolName: "use_mcp_tool", expected: "Tool Call Error: use_mcp_tool" },
		]

		testCases.forEach(({ toolName, expected }) => {
			const result = formatResponse.toolError("Test error", toolName)
			expect(result).toContain(expected)
		})
	})

	it("should maintain backward compatibility when tool name is not provided", () => {
		// This ensures existing code that doesn't pass toolName still works
		const error = "Legacy error"
		const result = formatResponse.toolError(error)

		// Should not contain "Tool Call Error:" prefix
		expect(result).not.toContain("Tool Call Error:")
		// Should contain generic title
		expect(result).toContain("Tool Execution Error")
	})
})
