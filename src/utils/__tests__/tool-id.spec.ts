import { sanitizeToolUseId } from "../tool-id"

describe("sanitizeToolUseId", () => {
	describe("valid IDs pass through unchanged", () => {
		it("should preserve alphanumeric IDs", () => {
			expect(sanitizeToolUseId("toolu_01AbC")).toBe("toolu_01AbC")
		})

		it("should preserve IDs with underscores", () => {
			expect(sanitizeToolUseId("tool_use_123")).toBe("tool_use_123")
		})

		it("should preserve IDs with hyphens", () => {
			expect(sanitizeToolUseId("tool-with-hyphens")).toBe("tool-with-hyphens")
		})

		it("should preserve mixed valid characters", () => {
			expect(sanitizeToolUseId("toolu_01AbC-xyz_789")).toBe("toolu_01AbC-xyz_789")
		})

		it("should handle empty string", () => {
			expect(sanitizeToolUseId("")).toBe("")
		})
	})

	describe("invalid characters get replaced with underscore", () => {
		it("should replace dots with underscores", () => {
			expect(sanitizeToolUseId("tool.with.dots")).toBe("tool_with_dots")
		})

		it("should replace colons with underscores", () => {
			expect(sanitizeToolUseId("tool:with:colons")).toBe("tool_with_colons")
		})

		it("should replace slashes with underscores", () => {
			expect(sanitizeToolUseId("tool/with/slashes")).toBe("tool_with_slashes")
		})

		it("should replace backslashes with underscores", () => {
			expect(sanitizeToolUseId("tool\\with\\backslashes")).toBe("tool_with_backslashes")
		})

		it("should replace spaces with underscores", () => {
			expect(sanitizeToolUseId("tool with spaces")).toBe("tool_with_spaces")
		})

		it("should replace multiple invalid characters", () => {
			expect(sanitizeToolUseId("mcp.server:tool/name")).toBe("mcp_server_tool_name")
		})
	})

	describe("real-world MCP tool use ID patterns", () => {
		it("should sanitize MCP server-prefixed IDs with dots", () => {
			// MCP tool names often include server names with dots
			expect(sanitizeToolUseId("toolu_mcp.linear.create_issue")).toBe("toolu_mcp_linear_create_issue")
		})

		it("should sanitize IDs with URL-like patterns", () => {
			expect(sanitizeToolUseId("toolu_https://api.example.com/tool")).toBe("toolu_https___api_example_com_tool")
		})

		it("should sanitize IDs with special characters from server names", () => {
			expect(sanitizeToolUseId("call_mcp--posthog--query-run")).toBe("call_mcp--posthog--query-run")
		})

		it("should preserve valid native tool call IDs", () => {
			// Standard Anthropic tool_use IDs
			expect(sanitizeToolUseId("toolu_01H2X3Y4Z5")).toBe("toolu_01H2X3Y4Z5")
		})
	})
})
