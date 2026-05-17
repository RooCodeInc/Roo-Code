import { contextHandoffSummarySchema } from "../context-handoff.js"

describe("ContextHandoffSummary schema", () => {
	it("validates a complete summary", () => {
		const summary = {
			mode: "code",
			filesModified: ["src/app.ts", "src/utils.ts"],
			filesRead: ["src/config.ts"],
			commandsExecuted: ["npm test"],
			toolUsageCounts: { write_to_file: 2, read_file: 1 },
			apiRequestCount: 5,
			result: "Task completed successfully",
		}
		const result = contextHandoffSummarySchema.safeParse(summary)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.filesModified).toEqual(["src/app.ts", "src/utils.ts"])
			expect(result.data.mode).toBe("code")
		}
	})

	it("accepts minimal summary with only result", () => {
		const summary = { result: "Done" }
		const result = contextHandoffSummarySchema.safeParse(summary)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.filesModified).toEqual([])
			expect(result.data.filesRead).toEqual([])
			expect(result.data.commandsExecuted).toEqual([])
			expect(result.data.toolUsageCounts).toEqual({})
			expect(result.data.apiRequestCount).toBe(0)
		}
	})

	it("rejects summary without result", () => {
		const summary = { mode: "code", filesModified: [] }
		const result = contextHandoffSummarySchema.safeParse(summary)
		expect(result.success).toBe(false)
	})

	it("applies defaults for optional array fields", () => {
		const summary = { result: "Done", mode: "debug" }
		const result = contextHandoffSummarySchema.safeParse(summary)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.mode).toBe("debug")
			expect(result.data.filesModified).toEqual([])
			expect(result.data.commandsExecuted).toEqual([])
		}
	})
})
