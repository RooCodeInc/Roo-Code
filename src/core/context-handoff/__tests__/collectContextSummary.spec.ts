import type { ClineMessage } from "@roo-code/types"
import { collectContextSummary, formatContextSummaryForParent } from "../collectContextSummary"

describe("collectContextSummary", () => {
	it("extracts files modified from tool messages", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "editedExistingFile", path: "src/app.ts" }),
			},
			{
				ts: 2,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "newFileCreated", path: "src/utils.ts" }),
			},
		]

		const summary = collectContextSummary(messages, "code", "Done")
		expect(summary.filesModified).toEqual(["src/app.ts", "src/utils.ts"])
		expect(summary.mode).toBe("code")
		expect(summary.result).toBe("Done")
	})

	it("extracts files read from tool messages", () => {
		const messages: ClineMessage[] = [
			{ ts: 1, type: "ask", ask: "tool", text: JSON.stringify({ tool: "readFile", path: "src/config.ts" }) },
		]

		const summary = collectContextSummary(messages, "code", "Done")
		expect(summary.filesRead).toEqual(["src/config.ts"])
	})

	it("removes files from filesRead if they were also modified", () => {
		const messages: ClineMessage[] = [
			{ ts: 1, type: "ask", ask: "tool", text: JSON.stringify({ tool: "readFile", path: "src/app.ts" }) },
			{
				ts: 2,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "editedExistingFile", path: "src/app.ts" }),
			},
		]

		const summary = collectContextSummary(messages, "code", "Done")
		expect(summary.filesModified).toEqual(["src/app.ts"])
		expect(summary.filesRead).toEqual([])
	})

	it("extracts executed commands", () => {
		const messages: ClineMessage[] = [
			{ ts: 1, type: "ask", ask: "command", text: "npm test" },
			{ ts: 2, type: "ask", ask: "command", text: "npm run build" },
		]

		const summary = collectContextSummary(messages, "code", "Done")
		expect(summary.commandsExecuted).toEqual(["npm test", "npm run build"])
		expect(summary.toolUsageCounts["execute_command"]).toBe(2)
	})

	it("counts API requests", () => {
		const messages: ClineMessage[] = [
			{ ts: 1, type: "say", say: "api_req_started" },
			{ ts: 2, type: "say", say: "api_req_started" },
			{ ts: 3, type: "say", say: "api_req_started" },
		]

		const summary = collectContextSummary(messages, "debug", "Fixed it")
		expect(summary.apiRequestCount).toBe(3)
	})

	it("counts tool usage correctly", () => {
		const messages: ClineMessage[] = [
			{ ts: 1, type: "ask", ask: "tool", text: JSON.stringify({ tool: "readFile", path: "a.ts" }) },
			{ ts: 2, type: "ask", ask: "tool", text: JSON.stringify({ tool: "readFile", path: "b.ts" }) },
			{
				ts: 3,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "editedExistingFile", path: "c.ts" }),
			},
			{ ts: 4, type: "ask", ask: "tool", text: JSON.stringify({ tool: "searchFiles" }) },
		]

		const summary = collectContextSummary(messages, "code", "Done")
		expect(summary.toolUsageCounts["read_file"]).toBe(2)
		expect(summary.toolUsageCounts["write_to_file"]).toBe(1)
		expect(summary.toolUsageCounts["search_files"]).toBe(1)
	})

	it("deduplicates modified files", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "editedExistingFile", path: "src/app.ts" }),
			},
			{
				ts: 2,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "editedExistingFile", path: "src/app.ts" }),
			},
		]

		const summary = collectContextSummary(messages, "code", "Done")
		expect(summary.filesModified).toEqual(["src/app.ts"])
	})

	it("handles empty messages array", () => {
		const summary = collectContextSummary([], "code", "Nothing done")
		expect(summary.filesModified).toEqual([])
		expect(summary.filesRead).toEqual([])
		expect(summary.commandsExecuted).toEqual([])
		expect(summary.apiRequestCount).toBe(0)
		expect(summary.result).toBe("Nothing done")
	})

	it("handles malformed tool JSON gracefully", () => {
		const messages: ClineMessage[] = [
			{ ts: 1, type: "ask", ask: "tool", text: "not valid json" },
			{ ts: 2, type: "ask", ask: "tool", text: undefined },
		]

		// Should not throw
		const summary = collectContextSummary(messages, "code", "Done")
		expect(summary.filesModified).toEqual([])
	})

	it("sorts files alphabetically", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "editedExistingFile", path: "z-file.ts" }),
			},
			{
				ts: 2,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "editedExistingFile", path: "a-file.ts" }),
			},
		]

		const summary = collectContextSummary(messages, "code", "Done")
		expect(summary.filesModified).toEqual(["a-file.ts", "z-file.ts"])
	})
})

describe("formatContextSummaryForParent", () => {
	it("formats a complete summary into readable text", () => {
		const summary = {
			mode: "code",
			filesModified: ["src/app.ts"],
			filesRead: ["src/config.ts"],
			commandsExecuted: ["npm test"],
			toolUsageCounts: { write_to_file: 1, read_file: 1 },
			apiRequestCount: 3,
			result: "Task completed",
		}

		const formatted = formatContextSummaryForParent(summary)
		expect(formatted).toContain("Result:\nTask completed")
		expect(formatted).toContain("Mode: code")
		expect(formatted).toContain("Files Modified:")
		expect(formatted).toContain("src/app.ts")
		expect(formatted).toContain("Files Read:")
		expect(formatted).toContain("src/config.ts")
		expect(formatted).toContain("Commands Executed:")
		expect(formatted).toContain("npm test")
		expect(formatted).toContain("Tool Usage:")
		expect(formatted).toContain("API Requests: 3")
	})

	it("omits empty sections", () => {
		const summary = {
			mode: undefined,
			filesModified: [],
			filesRead: [],
			commandsExecuted: [],
			toolUsageCounts: {},
			apiRequestCount: 0,
			result: "Done",
		}

		const formatted = formatContextSummaryForParent(summary)
		expect(formatted).toContain("Result:\nDone")
		expect(formatted).not.toContain("Files Modified:")
		expect(formatted).not.toContain("Files Read:")
		expect(formatted).not.toContain("Commands Executed:")
		expect(formatted).not.toContain("Tool Usage:")
		expect(formatted).toContain("API Requests: 0")
	})
})
