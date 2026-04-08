import { normalizeForComparison } from "../../utils/mcp-name"

describe("normalizeForComparison", () => {
	it("converts to lowercase", () => {
		expect(normalizeForComparison("MyServer")).toBe("myserver")
	})

	it("replaces hyphens with underscores", () => {
		expect(normalizeForComparison("my-server")).toBe("my_server")
	})

	it("replaces spaces with underscores", () => {
		expect(normalizeForComparison("my server")).toBe("my_server")
	})

	it("handles multiple hyphens individually (not collapsed)", () => {
		expect(normalizeForComparison("my--server")).toBe("my__server")
	})

	it("handles mixed separators", () => {
		expect(normalizeForComparison("My-Cool Server")).toBe("my_cool_server")
	})

	it("preserves dots and colons (FLAG-D known limitation)", () => {
		expect(normalizeForComparison("server.v2:main")).toBe("server.v2:main")
	})

	it("returns empty string for empty input", () => {
		expect(normalizeForComparison("")).toBe("")
	})
})
