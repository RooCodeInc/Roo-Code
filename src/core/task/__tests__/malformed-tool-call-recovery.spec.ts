import { recoverMalformedToolCall, formatRecoveredToolCall } from "../malformed-tool-call-recovery"

describe("recoverMalformedToolCall", () => {
	describe("Pattern 1: <function=TOOL_NAME><parameter=PARAM_NAME>VALUE</parameter></function>", () => {
		it("should recover a basic function-style tool call", () => {
			const text = `<function=attempt_completion>
<parameter=result>
Task completed successfully.
</parameter>
</function>`

			const result = recoverMalformedToolCall(text)

			expect(result).not.toBeNull()
			expect(result!.toolName).toBe("attempt_completion")
			expect(result!.parameters.result).toBe("Task completed successfully.")
		})

		it("should recover a function-style tool call with trailing </tool_call>", () => {
			const text = `<function=attempt_completion>
<parameter=result>
LOREM IPSUM DOLOR SIT AMET, CONSECTETUR ADIPISICING ELIT...
</parameter>
</function>
</tool_call>`

			const result = recoverMalformedToolCall(text)

			expect(result).not.toBeNull()
			expect(result!.toolName).toBe("attempt_completion")
			expect(result!.parameters.result).toBe("LOREM IPSUM DOLOR SIT AMET, CONSECTETUR ADIPISICING ELIT...")
		})

		it("should recover a function-style tool call wrapped in <tool_call>", () => {
			const text = `<tool_call>
<function=read_file>
<parameter=path>/src/main.ts</parameter>
</function>
</tool_call>`

			const result = recoverMalformedToolCall(text)

			expect(result).not.toBeNull()
			expect(result!.toolName).toBe("read_file")
			expect(result!.parameters.path).toBe("/src/main.ts")
		})

		it("should recover multiple parameters", () => {
			const text = `<function=write_to_file>
<parameter=path>/src/test.ts</parameter>
<parameter=content>console.log("hello")</parameter>
</function>`

			const result = recoverMalformedToolCall(text)

			expect(result).not.toBeNull()
			expect(result!.toolName).toBe("write_to_file")
			expect(result!.parameters.path).toBe("/src/test.ts")
			expect(result!.parameters.content).toBe('console.log("hello")')
		})

		it("should recover tool call with surrounding text/reasoning", () => {
			const text = `I will now complete the task.

<function=attempt_completion>
<parameter=result>
Done!
</parameter>
</function>

That should do it.`

			const result = recoverMalformedToolCall(text)

			expect(result).not.toBeNull()
			expect(result!.toolName).toBe("attempt_completion")
			expect(result!.parameters.result).toBe("Done!")
		})
	})

	describe("Pattern 2: XML-style <tool_name><param>value</param></tool_name>", () => {
		it("should recover an XML-style tool call", () => {
			const text = `<read_file>
<path>/src/main.ts</path>
</read_file>`

			const result = recoverMalformedToolCall(text)

			expect(result).not.toBeNull()
			expect(result!.toolName).toBe("read_file")
			expect(result!.parameters.path).toBe("/src/main.ts")
		})

		it("should recover XML-style tool call with multiple parameters", () => {
			const text = `<execute_command>
<command>npm test</command>
</execute_command>`

			const result = recoverMalformedToolCall(text)

			expect(result).not.toBeNull()
			expect(result!.toolName).toBe("execute_command")
			expect(result!.parameters.command).toBe("npm test")
		})
	})

	describe("No match cases", () => {
		it("should return null for plain text without tool call patterns", () => {
			const text = "I need to think about this problem more carefully."
			const result = recoverMalformedToolCall(text)
			expect(result).toBeNull()
		})

		it("should return null for empty string", () => {
			const result = recoverMalformedToolCall("")
			expect(result).toBeNull()
		})

		it("should return null for random XML that does not look like a tool call", () => {
			const text = "<div><span>Hello</span></div>"
			const result = recoverMalformedToolCall(text)
			// This might match pattern 2, but div/span don't have underscore names
			// The regex requires [a-z_]+ which matches div, but the inner must also match
			expect(result).toBeNull()
		})
	})
})

describe("formatRecoveredToolCall", () => {
	it("should format a simple recovered tool call", () => {
		const recovered = {
			toolName: "attempt_completion",
			parameters: { result: "Task done" },
		}

		const formatted = formatRecoveredToolCall(recovered)

		expect(formatted).toContain("Tool: attempt_completion")
		expect(formatted).toContain("result")
		expect(formatted).toContain("Task done")
	})

	it("should truncate long parameter values", () => {
		const longValue = "x".repeat(200)
		const recovered = {
			toolName: "write_to_file",
			parameters: { content: longValue },
		}

		const formatted = formatRecoveredToolCall(recovered)

		expect(formatted).toContain("...")
		expect(formatted.length).toBeLessThan(longValue.length + 100)
	})

	it("should format multiple parameters", () => {
		const recovered = {
			toolName: "write_to_file",
			parameters: { path: "/src/test.ts", content: "hello world" },
		}

		const formatted = formatRecoveredToolCall(recovered)

		expect(formatted).toContain("path")
		expect(formatted).toContain("content")
		expect(formatted).toContain("/src/test.ts")
		expect(formatted).toContain("hello world")
	})
})
