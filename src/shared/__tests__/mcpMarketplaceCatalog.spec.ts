import { mcpMarketplaceCatalog, type McpMarketplaceItem } from "../mcpMarketplaceCatalog"

describe("mcpMarketplaceCatalog", () => {
	it("should export a non-empty array of marketplace items", () => {
		expect(mcpMarketplaceCatalog).toBeInstanceOf(Array)
		expect(mcpMarketplaceCatalog.length).toBeGreaterThan(0)
	})

	it("should have unique names for each item", () => {
		const names = mcpMarketplaceCatalog.map((item) => item.name)
		const uniqueNames = new Set(names)
		expect(uniqueNames.size).toBe(names.length)
	})

	it("each item should have required fields", () => {
		for (const item of mcpMarketplaceCatalog) {
			expect(item.name).toBeTruthy()
			expect(item.displayName).toBeTruthy()
			expect(item.description).toBeTruthy()
			expect(item.category).toBeTruthy()
			expect(item.config).toBeDefined()
			expect(item.config.command).toBeTruthy()
			expect(item.config.args).toBeInstanceOf(Array)
		}
	})

	it("items with requiresSetup should have setupEnvKeys", () => {
		const setupItems = mcpMarketplaceCatalog.filter((item) => item.requiresSetup)
		for (const item of setupItems) {
			expect(item.setupEnvKeys).toBeDefined()
			expect(item.setupEnvKeys!.length).toBeGreaterThan(0)
		}
	})

	it("should include DuckDuckGo search server", () => {
		const ddg = mcpMarketplaceCatalog.find((item) => item.name === "ddg-search")
		expect(ddg).toBeDefined()
		expect(ddg!.config.command).toBe("uvx")
		expect(ddg!.config.args).toContain("duckduckgo-mcp-server")
		expect(ddg!.requiresSetup).toBeFalsy()
	})

	it("should include SearXNG server with setup required", () => {
		const searxng = mcpMarketplaceCatalog.find((item) => item.name === "searxng")
		expect(searxng).toBeDefined()
		expect(searxng!.requiresSetup).toBe(true)
		expect(searxng!.setupEnvKeys).toContain("SEARXNG_URL")
	})
})
