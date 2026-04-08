// npx vitest run src/__tests__/mcp-filter-schema.test.ts

import { mcpServerFilterSchema, groupEntryArraySchema } from "../mode.js"

describe("mcpServerFilterSchema", () => {
	it("validates a valid filter with disabled: true", () => {
		const result = mcpServerFilterSchema.safeParse({ disabled: true })
		expect(result.success).toBe(true)
	})

	it("validates a filter with allowedTools array", () => {
		const result = mcpServerFilterSchema.safeParse({
			allowedTools: ["tool-a", "tool-b"],
		})
		expect(result.success).toBe(true)
	})

	it("validates a filter with disabledTools array", () => {
		const result = mcpServerFilterSchema.safeParse({
			disabledTools: ["tool-x"],
		})
		expect(result.success).toBe(true)
	})

	it("rejects invalid shapes (wrong types)", () => {
		const result = mcpServerFilterSchema.safeParse({
			disabled: "yes",
		})
		expect(result.success).toBe(false)
	})

	it("rejects invalid shapes (allowedTools not array of strings)", () => {
		const result = mcpServerFilterSchema.safeParse({
			allowedTools: [123, true],
		})
		expect(result.success).toBe(false)
	})

	it("rejects completely invalid shape", () => {
		const result = mcpServerFilterSchema.safeParse("not-an-object")
		expect(result.success).toBe(false)
	})
})

describe("rawGroupEntryArraySchema with MCP filtering", () => {
	it("rejects mcpServers on non-mcp groups", () => {
		const result = groupEntryArraySchema.safeParse([["read", { mcpServers: {} }]])
		expect(result.success).toBe(false)
	})

	it("allows mcpServers on the mcp group", () => {
		const result = groupEntryArraySchema.safeParse([["mcp", { mcpServers: { "server-name": { disabled: true } } }]])
		expect(result.success).toBe(true)
	})

	it("allows mcpDefaultPolicy on the mcp group", () => {
		const result = groupEntryArraySchema.safeParse([["mcp", { mcpDefaultPolicy: "allow" }]])
		expect(result.success).toBe(true)
	})

	it("rejects mcpDefaultPolicy on non-mcp groups", () => {
		const result = groupEntryArraySchema.safeParse([["edit", { mcpDefaultPolicy: "allow" }]])
		expect(result.success).toBe(false)
	})

	it("mcpDefaultPolicy only accepts allow or deny", () => {
		const validAllow = groupEntryArraySchema.safeParse([["mcp", { mcpDefaultPolicy: "allow" }]])
		expect(validAllow.success).toBe(true)

		const validDeny = groupEntryArraySchema.safeParse([["mcp", { mcpDefaultPolicy: "deny" }]])
		expect(validDeny.success).toBe(true)

		const invalid = groupEntryArraySchema.safeParse([["mcp", { mcpDefaultPolicy: "block" }]])
		expect(invalid.success).toBe(false)
	})

	it("still allows plain string group entries", () => {
		const result = groupEntryArraySchema.safeParse(["read", "edit", "mcp"])
		expect(result.success).toBe(true)
	})

	it("still allows tuple entries with standard options", () => {
		const result = groupEntryArraySchema.safeParse([
			["edit", { fileRegex: "\\.md$", description: "Markdown only" }],
		])
		expect(result.success).toBe(true)
	})
})
