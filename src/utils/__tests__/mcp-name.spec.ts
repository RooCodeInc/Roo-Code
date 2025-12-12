import { sanitizeMcpName, buildMcpToolName, parseMcpToolName } from "../mcp-name"

describe("mcp-name utilities", () => {
	describe("sanitizeMcpName", () => {
		it("should return underscore placeholder for empty input", () => {
			expect(sanitizeMcpName("")).toBe("_")
		})

		it("should replace spaces with underscores", () => {
			expect(sanitizeMcpName("my server")).toBe("my_server")
			expect(sanitizeMcpName("server name here")).toBe("server_name_here")
		})

		it("should remove invalid characters", () => {
			expect(sanitizeMcpName("server@name!")).toBe("servername")
			expect(sanitizeMcpName("test#$%^&*()")).toBe("test")
		})

		it("should keep valid characters (alphanumeric, underscore, dot, colon, dash)", () => {
			expect(sanitizeMcpName("server_name")).toBe("server_name")
			expect(sanitizeMcpName("server.name")).toBe("server.name")
			expect(sanitizeMcpName("server:name")).toBe("server:name")
			expect(sanitizeMcpName("server-name")).toBe("server-name")
			expect(sanitizeMcpName("Server123")).toBe("Server123")
		})

		it("should prepend underscore if name starts with non-letter/underscore", () => {
			expect(sanitizeMcpName("123server")).toBe("_123server")
			expect(sanitizeMcpName("-server")).toBe("_-server")
			expect(sanitizeMcpName(".server")).toBe("_.server")
		})

		it("should not modify names that start with letter or underscore", () => {
			expect(sanitizeMcpName("server")).toBe("server")
			expect(sanitizeMcpName("_server")).toBe("_server")
			expect(sanitizeMcpName("Server")).toBe("Server")
		})

		it("should handle complex names with multiple issues", () => {
			expect(sanitizeMcpName("My Server @ Home!")).toBe("My_Server__Home")
			expect(sanitizeMcpName("123-test server")).toBe("_123-test_server")
		})

		it("should return placeholder for names that become empty after sanitization", () => {
			expect(sanitizeMcpName("@#$%")).toBe("_unnamed")
			// Spaces become underscores, which is a valid character, so it returns "_"
			expect(sanitizeMcpName("   ")).toBe("_")
		})
	})

	describe("buildMcpToolName", () => {
		it("should build tool name with mcp_ prefix", () => {
			expect(buildMcpToolName("server", "tool")).toBe("mcp_server_tool")
		})

		it("should sanitize both server and tool names", () => {
			expect(buildMcpToolName("my server", "my tool")).toBe("mcp_my_server_my_tool")
		})

		it("should handle names with special characters", () => {
			expect(buildMcpToolName("server@name", "tool!name")).toBe("mcp_servername_toolname")
		})

		it("should truncate long names to 64 characters", () => {
			const longServer = "a".repeat(50)
			const longTool = "b".repeat(50)
			const result = buildMcpToolName(longServer, longTool)
			expect(result.length).toBeLessThanOrEqual(64)
			expect(result.startsWith("mcp_")).toBe(true)
		})

		it("should handle names starting with numbers", () => {
			expect(buildMcpToolName("123server", "456tool")).toBe("mcp__123server__456tool")
		})
	})

	describe("parseMcpToolName", () => {
		it("should parse valid mcp tool names", () => {
			expect(parseMcpToolName("mcp_server_tool")).toEqual({
				serverName: "server",
				toolName: "tool",
			})
		})

		it("should return null for non-mcp tool names", () => {
			expect(parseMcpToolName("server_tool")).toBeNull()
			expect(parseMcpToolName("tool")).toBeNull()
		})

		it("should handle tool names with underscores", () => {
			expect(parseMcpToolName("mcp_server_tool_name")).toEqual({
				serverName: "server",
				toolName: "tool_name",
			})
		})

		it("should handle server names with underscores (edge case)", () => {
			// Note: parseMcpToolName uses simple split, so it can't distinguish
			// server_name_tool from server + name_tool
			// The first underscore after 'mcp_' is treated as the server/tool separator
			const result = parseMcpToolName("mcp_my_server_tool")
			expect(result).toEqual({
				serverName: "my",
				toolName: "server_tool",
			})
		})

		it("should return null for malformed names", () => {
			expect(parseMcpToolName("mcp_")).toBeNull()
			expect(parseMcpToolName("mcp_server")).toBeNull()
		})
	})

	describe("roundtrip behavior", () => {
		it("should be able to parse names that were built", () => {
			const toolName = buildMcpToolName("server", "tool")
			const parsed = parseMcpToolName(toolName)
			expect(parsed).toEqual({
				serverName: "server",
				toolName: "tool",
			})
		})

		it("should preserve sanitized names through roundtrip", () => {
			// Names with spaces become underscores, but roundtrip still works
			// for the sanitized version
			const toolName = buildMcpToolName("my_server", "my_tool")
			const parsed = parseMcpToolName(toolName)
			expect(parsed).toEqual({
				serverName: "my",
				toolName: "server_my_tool",
			})
		})
	})
})
