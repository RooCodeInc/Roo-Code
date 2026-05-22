import { buildSubtaskSummary, formatSubtaskSummaryForApi, type SubtaskContext } from "../buildSubtaskSummary"

function createContext(overrides: Partial<SubtaskContext> = {}): SubtaskContext {
	return {
		apiConversationHistory: [],
		toolUsage: {},
		todoList: undefined,
		taskMode: "code",
		...overrides,
	}
}

describe("buildSubtaskSummary", () => {
	it("should return a minimal summary with just result and mode", () => {
		const context = createContext()
		const summary = buildSubtaskSummary(context, "Task completed successfully")

		expect(summary.result).toBe("Task completed successfully")
		expect(summary.mode).toBe("code")
		expect(summary.filesModified).toBeUndefined()
		expect(summary.filesRead).toBeUndefined()
		expect(summary.commandsExecuted).toBeUndefined()
		expect(summary.toolUsageSummary).toBeUndefined()
		expect(summary.todoStats).toBeUndefined()
	})

	it("should extract files modified from write_to_file tool_use blocks", () => {
		const context = createContext({
			apiConversationHistory: [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_1",
							name: "write_to_file",
							input: { path: "src/index.ts", content: "hello" },
						},
					],
				},
				{
					role: "user",
					content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "ok" }],
				},
			],
		})

		const summary = buildSubtaskSummary(context, "Done")
		expect(summary.filesModified).toEqual(["src/index.ts"])
	})

	it("should extract files modified from apply_diff tool_use blocks", () => {
		const context = createContext({
			apiConversationHistory: [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_2",
							name: "apply_diff",
							input: { path: "src/utils.ts", diff: "--- a\n+++ b" },
						},
					],
				},
			],
		})

		const summary = buildSubtaskSummary(context, "Done")
		expect(summary.filesModified).toEqual(["src/utils.ts"])
	})

	it("should extract files read from read_file tool_use blocks", () => {
		const context = createContext({
			apiConversationHistory: [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_3",
							name: "read_file",
							input: { path: "package.json" },
						},
					],
				},
			],
		})

		const summary = buildSubtaskSummary(context, "Done")
		expect(summary.filesRead).toEqual(["package.json"])
	})

	it("should extract commands from execute_command tool_use blocks", () => {
		const context = createContext({
			apiConversationHistory: [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_4",
							name: "execute_command",
							input: { command: "npm test" },
						},
					],
				},
			],
		})

		const summary = buildSubtaskSummary(context, "Done")
		expect(summary.commandsExecuted).toEqual(["npm test"])
	})

	it("should truncate very long commands", () => {
		const longCmd = "a".repeat(200)
		const context = createContext({
			apiConversationHistory: [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_5",
							name: "execute_command",
							input: { command: longCmd },
						},
					],
				},
			],
		})

		const summary = buildSubtaskSummary(context, "Done")
		expect(summary.commandsExecuted![0].length).toBeLessThanOrEqual(120)
		expect(summary.commandsExecuted![0].endsWith("...")).toBe(true)
	})

	it("should deduplicate modified files", () => {
		const context = createContext({
			apiConversationHistory: [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_6",
							name: "write_to_file",
							input: { path: "src/index.ts", content: "v1" },
						},
					],
				},
				{ role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_6", content: "ok" }] },
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_7",
							name: "apply_diff",
							input: { path: "src/index.ts", diff: "diff" },
						},
					],
				},
			],
		})

		const summary = buildSubtaskSummary(context, "Done")
		expect(summary.filesModified).toEqual(["src/index.ts"])
	})

	it("should include tool usage summary from toolUsage", () => {
		const context = createContext({
			toolUsage: {
				write_to_file: { attempts: 3, failures: 0 },
				read_file: { attempts: 5, failures: 1 },
			} as any,
		})

		const summary = buildSubtaskSummary(context, "Done")
		expect(summary.toolUsageSummary).toEqual({
			write_to_file: 3,
			read_file: 5,
		})
	})

	it("should include todo stats when todoList is present", () => {
		const context = createContext({
			todoList: [
				{ id: "1", task: "Do A", status: "completed" },
				{ id: "2", task: "Do B", status: "completed" },
				{ id: "3", task: "Do C", status: "pending" },
			] as any,
		})

		const summary = buildSubtaskSummary(context, "Done")
		expect(summary.todoStats).toEqual({ completed: 2, total: 3 })
	})

	it("should skip user messages when scanning for tool_use blocks", () => {
		const context = createContext({
			apiConversationHistory: [
				{
					role: "user",
					content: [
						{
							type: "tool_result" as any,
							tool_use_id: "toolu_x",
							content: "ok",
						},
					],
				},
			],
		})

		const summary = buildSubtaskSummary(context, "Done")
		expect(summary.filesModified).toBeUndefined()
		expect(summary.commandsExecuted).toBeUndefined()
	})

	it("should handle empty conversation history", () => {
		const context = createContext({ apiConversationHistory: [] })
		const summary = buildSubtaskSummary(context, "Nothing happened")

		expect(summary.result).toBe("Nothing happened")
		expect(summary.mode).toBe("code")
	})

	it("should handle messages with non-array content (string content)", () => {
		const context = createContext({
			apiConversationHistory: [
				{
					role: "assistant",
					content: "Just text response",
				},
			],
		})

		const summary = buildSubtaskSummary(context, "Done")
		expect(summary.filesModified).toBeUndefined()
	})
})

describe("formatSubtaskSummaryForApi", () => {
	it("should format a minimal summary", () => {
		const text = formatSubtaskSummaryForApi({ result: "All done" })
		expect(text).toContain("## Result\nAll done")
	})

	it("should include mode section", () => {
		const text = formatSubtaskSummaryForApi({ result: "Done", mode: "architect" })
		expect(text).toContain("## Mode\narchitect")
	})

	it("should include files modified section", () => {
		const text = formatSubtaskSummaryForApi({
			result: "Done",
			filesModified: ["src/a.ts", "src/b.ts"],
		})
		expect(text).toContain("## Files Modified")
		expect(text).toContain("- src/a.ts")
		expect(text).toContain("- src/b.ts")
	})

	it("should include files read section", () => {
		const text = formatSubtaskSummaryForApi({
			result: "Done",
			filesRead: ["package.json"],
		})
		expect(text).toContain("## Files Read")
		expect(text).toContain("- package.json")
	})

	it("should include commands section", () => {
		const text = formatSubtaskSummaryForApi({
			result: "Done",
			commandsExecuted: ["npm test", "npm build"],
		})
		expect(text).toContain("## Commands Executed")
		expect(text).toContain("- `npm test`")
		expect(text).toContain("- `npm build`")
	})

	it("should include todo stats", () => {
		const text = formatSubtaskSummaryForApi({
			result: "Done",
			todoStats: { completed: 3, total: 5 },
		})
		expect(text).toContain("## Todos\n3/5 completed")
	})

	it("should format a comprehensive summary with all sections", () => {
		const text = formatSubtaskSummaryForApi({
			result: "Implemented the feature",
			mode: "code",
			filesModified: ["src/feature.ts"],
			filesRead: ["src/config.ts"],
			commandsExecuted: ["npm test"],
			todoStats: { completed: 2, total: 2 },
		})

		expect(text).toContain("## Result")
		expect(text).toContain("## Mode")
		expect(text).toContain("## Files Modified")
		expect(text).toContain("## Files Read")
		expect(text).toContain("## Commands Executed")
		expect(text).toContain("## Todos")
	})
})
