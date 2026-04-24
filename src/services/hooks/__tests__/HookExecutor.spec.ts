import { buildHookPrompt, executeHook, executeHooks, formatHookResults } from "../HookExecutor"
import type { HookDefinition, HookContext, HookResult } from "../../../shared/hooks"

// Mock the singleCompletionHandler
vi.mock("../../../utils/single-completion-handler", () => ({
	singleCompletionHandler: vi.fn(),
}))

import { singleCompletionHandler } from "../../../utils/single-completion-handler"

const mockSingleCompletionHandler = vi.mocked(singleCompletionHandler)

describe("buildHookPrompt", () => {
	it("should build a prompt with PreToolUse context", () => {
		const hook: HookDefinition = { prompt: "Check for security issues" }
		const context: HookContext = {
			event: "PreToolUse",
			toolName: "write_to_file",
			toolInput: { path: "src/main.ts", content: "console.log('test')" },
		}

		const result = buildHookPrompt(hook, context)

		expect(result).toContain("Event: PreToolUse")
		expect(result).toContain("**Tool:** write_to_file")
		expect(result).toContain("**Tool Input:**")
		expect(result).toContain("src/main.ts")
		expect(result).toContain("Check for security issues")
	})

	it("should build a prompt with PostToolUse context", () => {
		const hook: HookDefinition = { prompt: "Summarize what happened" }
		const context: HookContext = {
			event: "PostToolUse",
			toolName: "execute_command",
			toolResult: "Command completed successfully",
		}

		const result = buildHookPrompt(hook, context)

		expect(result).toContain("Event: PostToolUse")
		expect(result).toContain("**Tool:** execute_command")
		expect(result).toContain("**Tool Result:**")
		expect(result).toContain("Command completed successfully")
		expect(result).toContain("Summarize what happened")
	})

	it("should build a prompt with Stop context", () => {
		const hook: HookDefinition = { prompt: "Review the result" }
		const context: HookContext = {
			event: "Stop",
			completionResult: "Task completed successfully",
		}

		const result = buildHookPrompt(hook, context)

		expect(result).toContain("Event: Stop")
		expect(result).toContain("**Completion Result:**")
		expect(result).toContain("Task completed successfully")
		expect(result).toContain("Review the result")
	})

	it("should truncate long tool results", () => {
		const hook: HookDefinition = { prompt: "Summarize" }
		const longResult = "x".repeat(3000)
		const context: HookContext = {
			event: "PostToolUse",
			toolName: "read_file",
			toolResult: longResult,
		}

		const result = buildHookPrompt(hook, context)

		expect(result).toContain("... (truncated)")
		expect(result.length).toBeLessThan(longResult.length)
	})

	it("should truncate long conversation summaries", () => {
		const hook: HookDefinition = { prompt: "Analyze" }
		const longSummary = "y".repeat(5000)
		const context: HookContext = {
			event: "PreToolUse",
			conversationSummary: longSummary,
		}

		const result = buildHookPrompt(hook, context)

		expect(result).toContain("... (truncated)")
	})

	it("should include advisory-only role description", () => {
		const hook: HookDefinition = { prompt: "test" }
		const context: HookContext = { event: "PreToolUse" }

		const result = buildHookPrompt(hook, context)

		expect(result).toContain("advisory only")
		expect(result).toContain("cannot use tools")
	})
})

describe("executeHook", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should execute a hook and return the result", async () => {
		mockSingleCompletionHandler.mockResolvedValue("This looks safe to proceed.")

		const hook: HookDefinition = { prompt: "Check security" }
		const context: HookContext = { event: "PreToolUse", toolName: "write_to_file" }
		const mockConfig = { apiProvider: "anthropic" } as any

		const result = await executeHook(hook, context, mockConfig, 0)

		expect(result).not.toBeNull()
		expect(result!.output).toBe("This looks safe to proceed.")
		expect(result!.event).toBe("PreToolUse")
		expect(result!.hookIndex).toBe(0)
		expect(mockSingleCompletionHandler).toHaveBeenCalledWith(mockConfig, expect.any(String))
	})

	it("should return null for empty output", async () => {
		mockSingleCompletionHandler.mockResolvedValue("")

		const hook: HookDefinition = { prompt: "Check" }
		const context: HookContext = { event: "PreToolUse" }

		const result = await executeHook(hook, context, {} as any, 0)

		expect(result).toBeNull()
	})

	it("should return null on error", async () => {
		mockSingleCompletionHandler.mockRejectedValue(new Error("API Error"))

		const hook: HookDefinition = { prompt: "Check" }
		const context: HookContext = { event: "PreToolUse" }

		const result = await executeHook(hook, context, {} as any, 0)

		expect(result).toBeNull()
	})
})

describe("executeHooks", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should execute multiple hooks sequentially", async () => {
		mockSingleCompletionHandler.mockResolvedValueOnce("Result 1").mockResolvedValueOnce("Result 2")

		const hooks: HookDefinition[] = [{ prompt: "Hook 1" }, { prompt: "Hook 2" }]
		const context: HookContext = { event: "PreToolUse", toolName: "write_to_file" }

		const results = await executeHooks(hooks, context, {} as any)

		expect(results).toHaveLength(2)
		expect(results[0].output).toBe("Result 1")
		expect(results[1].output).toBe("Result 2")
		expect(mockSingleCompletionHandler).toHaveBeenCalledTimes(2)
	})

	it("should skip hooks that return null", async () => {
		mockSingleCompletionHandler
			.mockResolvedValueOnce("Result 1")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("Result 3")

		const hooks: HookDefinition[] = [{ prompt: "Hook 1" }, { prompt: "Hook 2" }, { prompt: "Hook 3" }]
		const context: HookContext = { event: "PreToolUse" }

		const results = await executeHooks(hooks, context, {} as any)

		expect(results).toHaveLength(2)
		expect(results[0].output).toBe("Result 1")
		expect(results[1].output).toBe("Result 3")
	})

	it("should return empty array for no hooks", async () => {
		const results = await executeHooks([], { event: "PreToolUse" }, {} as any)
		expect(results).toHaveLength(0)
		expect(mockSingleCompletionHandler).not.toHaveBeenCalled()
	})
})

describe("formatHookResults", () => {
	it("should return empty string for no results", () => {
		expect(formatHookResults([])).toBe("")
	})

	it("should format single result", () => {
		const results: HookResult[] = [{ output: "Advisory: looks good", event: "PreToolUse", hookIndex: 0 }]

		const formatted = formatHookResults(results)

		expect(formatted).toContain("[Hook Advisory Output]")
		expect(formatted).toContain("Advisory: looks good")
		expect(formatted).toContain("[End Hook Advisory Output]")
	})

	it("should format multiple results", () => {
		const results: HookResult[] = [
			{ output: "Result 1", event: "PreToolUse", hookIndex: 0 },
			{ output: "Result 2", event: "PreToolUse", hookIndex: 1 },
		]

		const formatted = formatHookResults(results)

		expect(formatted).toContain("Result 1")
		expect(formatted).toContain("Result 2")
	})
})
