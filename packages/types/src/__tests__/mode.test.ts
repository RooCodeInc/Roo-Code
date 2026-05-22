import { modeConfigSchema } from "../mode.js"

describe("modeConfigSchema", () => {
	const validBase = {
		slug: "test-mode",
		name: "Test Mode",
		roleDefinition: "A test mode",
		groups: ["read", "edit"],
	}

	it("should accept a mode config without allowedMcpServers", () => {
		const result = modeConfigSchema.safeParse(validBase)
		expect(result.success).toBe(true)
	})

	it("should accept a mode config with allowedMcpServers as an array of strings", () => {
		const result = modeConfigSchema.safeParse({
			...validBase,
			groups: ["read", "edit", "mcp"],
			allowedMcpServers: ["postgres-mcp", "redis-mcp"],
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.allowedMcpServers).toEqual(["postgres-mcp", "redis-mcp"])
		}
	})

	it("should accept a mode config with empty allowedMcpServers array", () => {
		const result = modeConfigSchema.safeParse({
			...validBase,
			allowedMcpServers: [],
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.allowedMcpServers).toEqual([])
		}
	})

	it("should reject allowedMcpServers with non-string values", () => {
		const result = modeConfigSchema.safeParse({
			...validBase,
			allowedMcpServers: [123, true],
		})
		expect(result.success).toBe(false)
	})

	it("should accept allowedMcpServers as undefined (backward compatible)", () => {
		const result = modeConfigSchema.safeParse({
			...validBase,
			allowedMcpServers: undefined,
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.allowedMcpServers).toBeUndefined()
		}
	})
})
