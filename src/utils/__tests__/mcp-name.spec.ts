import {
	sanitizeMcpName,
	buildMcpToolName,
	parseMcpToolName,
	isMcpTool,
	MCP_TOOL_SEPARATOR,
	MCP_TOOL_SEPARATOR_MANGLED,
	MCP_TOOL_PREFIX,
	generatePossibleOriginalNames,
	findMatchingServerName,
	findMatchingToolName,
} from "../mcp-name"

describe("mcp-name utilities", () => {
	describe("constants", () => {
		it("should have correct separator and prefix", () => {
			expect(MCP_TOOL_SEPARATOR).toBe("--")
			expect(MCP_TOOL_SEPARATOR_MANGLED).toBe("__")
			expect(MCP_TOOL_PREFIX).toBe("mcp")
		})
	})

	describe("isMcpTool", () => {
		it("should return true for valid MCP tool names", () => {
			expect(isMcpTool("mcp--server--tool")).toBe(true)
			expect(isMcpTool("mcp--my_server--get_forecast")).toBe(true)
		})

		it("should return true for mangled MCP tool names (models convert -- to __)", () => {
			expect(isMcpTool("mcp__server__tool")).toBe(true)
			expect(isMcpTool("mcp__my_server__get_forecast")).toBe(true)
			expect(isMcpTool("mcp__atlassian_jira__search")).toBe(true)
		})

		it("should return false for non-MCP tool names", () => {
			expect(isMcpTool("server--tool")).toBe(false)
			expect(isMcpTool("tool")).toBe(false)
			expect(isMcpTool("read_file")).toBe(false)
			expect(isMcpTool("")).toBe(false)
		})

		it("should return false for old single underscore format", () => {
			expect(isMcpTool("mcp_server_tool")).toBe(false)
		})

		it("should return false for partial prefix", () => {
			expect(isMcpTool("mcp-server")).toBe(false)
			expect(isMcpTool("mcp")).toBe(false)
		})
	})

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

		it("should keep valid characters (alphanumeric, underscore, dash)", () => {
			expect(sanitizeMcpName("server_name")).toBe("server_name")
			expect(sanitizeMcpName("server-name")).toBe("server-name")
			expect(sanitizeMcpName("Server123")).toBe("Server123")
		})

		it("should remove dots and colons for AWS Bedrock compatibility", () => {
			// Dots and colons are NOT allowed due to AWS Bedrock restrictions
			expect(sanitizeMcpName("server.name")).toBe("servername")
			expect(sanitizeMcpName("server:name")).toBe("servername")
			expect(sanitizeMcpName("awslabs.aws-documentation-mcp-server")).toBe("awslabsaws-documentation-mcp-server")
		})

		it("should prepend underscore if name starts with non-letter/underscore", () => {
			expect(sanitizeMcpName("123server")).toBe("_123server")
			expect(sanitizeMcpName("-server")).toBe("_-server")
			// Dots are removed, so ".server" becomes "server" which starts with a letter
			expect(sanitizeMcpName(".server")).toBe("server")
		})

		it("should not modify names that start with letter or underscore", () => {
			expect(sanitizeMcpName("server")).toBe("server")
			expect(sanitizeMcpName("_server")).toBe("_server")
			expect(sanitizeMcpName("Server")).toBe("Server")
		})

		it("should replace double-hyphen sequences with single hyphen to avoid separator conflicts", () => {
			expect(sanitizeMcpName("server--name")).toBe("server-name")
			expect(sanitizeMcpName("test---server")).toBe("test-server")
			expect(sanitizeMcpName("my----tool")).toBe("my-tool")
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
		it("should build tool name with mcp-- prefix and -- separators", () => {
			expect(buildMcpToolName("server", "tool")).toBe("mcp--server--tool")
		})

		it("should sanitize both server and tool names", () => {
			expect(buildMcpToolName("my server", "my tool")).toBe("mcp--my_server--my_tool")
		})

		it("should handle names with special characters", () => {
			expect(buildMcpToolName("server@name", "tool!name")).toBe("mcp--servername--toolname")
		})

		it("should truncate long names to 64 characters", () => {
			const longServer = "a".repeat(50)
			const longTool = "b".repeat(50)
			const result = buildMcpToolName(longServer, longTool)
			expect(result.length).toBeLessThanOrEqual(64)
			expect(result.startsWith("mcp--")).toBe(true)
		})

		it("should handle names starting with numbers", () => {
			expect(buildMcpToolName("123server", "456tool")).toBe("mcp--_123server--_456tool")
		})

		it("should preserve underscores in server and tool names", () => {
			expect(buildMcpToolName("my_server", "my_tool")).toBe("mcp--my_server--my_tool")
		})
	})

	describe("parseMcpToolName", () => {
		it("should parse valid mcp tool names with wasMangled=false", () => {
			expect(parseMcpToolName("mcp--server--tool")).toEqual({
				serverName: "server",
				toolName: "tool",
				wasMangled: false,
			})
		})

		it("should parse mangled mcp tool names (__ separator) with wasMangled=true", () => {
			expect(parseMcpToolName("mcp__server__tool")).toEqual({
				serverName: "server",
				toolName: "tool",
				wasMangled: true,
			})
			// This is the key case from issue #10642 - atlassian-jira gets mangled to atlassian_jira
			expect(parseMcpToolName("mcp__atlassian_jira__search")).toEqual({
				serverName: "atlassian_jira",
				toolName: "search",
				wasMangled: true,
			})
		})

		it("should return null for non-mcp tool names", () => {
			expect(parseMcpToolName("server--tool")).toBeNull()
			expect(parseMcpToolName("tool")).toBeNull()
		})

		it("should return null for old single underscore format", () => {
			expect(parseMcpToolName("mcp_server_tool")).toBeNull()
		})

		it("should handle tool names with underscores", () => {
			expect(parseMcpToolName("mcp--server--tool_name")).toEqual({
				serverName: "server",
				toolName: "tool_name",
				wasMangled: false,
			})
		})

		it("should correctly handle server names with underscores (fixed from old behavior)", () => {
			// With the new -- separator, server names with underscores work correctly
			expect(parseMcpToolName("mcp--my_server--tool")).toEqual({
				serverName: "my_server",
				toolName: "tool",
				wasMangled: false,
			})
		})

		it("should handle both server and tool names with underscores", () => {
			expect(parseMcpToolName("mcp--my_server--get_forecast")).toEqual({
				serverName: "my_server",
				toolName: "get_forecast",
				wasMangled: false,
			})
		})

		it("should return null for malformed names", () => {
			expect(parseMcpToolName("mcp--")).toBeNull()
			expect(parseMcpToolName("mcp--server")).toBeNull()
			expect(parseMcpToolName("mcp__")).toBeNull()
			expect(parseMcpToolName("mcp__server")).toBeNull()
		})
	})

	describe("roundtrip behavior", () => {
		it("should be able to parse names that were built", () => {
			const toolName = buildMcpToolName("server", "tool")
			const parsed = parseMcpToolName(toolName)
			expect(parsed).toEqual({
				serverName: "server",
				toolName: "tool",
				wasMangled: false,
			})
		})

		it("should preserve sanitized names through roundtrip with underscores", () => {
			// Names with underscores now work correctly through roundtrip
			const toolName = buildMcpToolName("my_server", "my_tool")
			const parsed = parseMcpToolName(toolName)
			expect(parsed).toEqual({
				serverName: "my_server",
				toolName: "my_tool",
				wasMangled: false,
			})
		})

		it("should handle spaces that get converted to underscores", () => {
			// "my server" becomes "my_server" after sanitization
			const toolName = buildMcpToolName("my server", "get tool")
			const parsed = parseMcpToolName(toolName)
			expect(parsed).toEqual({
				serverName: "my_server",
				toolName: "get_tool",
				wasMangled: false,
			})
		})

		it("should handle complex server and tool names", () => {
			const toolName = buildMcpToolName("Weather API", "get_current_forecast")
			const parsed = parseMcpToolName(toolName)
			expect(parsed).toEqual({
				serverName: "Weather_API",
				toolName: "get_current_forecast",
				wasMangled: false,
			})
		})
	})

	describe("generatePossibleOriginalNames", () => {
		it("should include the original name in results", () => {
			const results = generatePossibleOriginalNames("server")
			expect(results).toContain("server")
		})

		it("should generate combinations with hyphens replacing underscores", () => {
			const results = generatePossibleOriginalNames("my_server")
			expect(results).toContain("my_server")
			expect(results).toContain("my-server")
		})

		it("should generate all combinations for multiple underscores", () => {
			// "a_b_c" has 2 underscores -> 2^2 = 4 combinations
			const results = generatePossibleOriginalNames("a_b_c")
			expect(results.length).toBe(4)
			expect(results).toContain("a_b_c")
			expect(results).toContain("a-b_c")
			expect(results).toContain("a_b-c")
			expect(results).toContain("a-b-c")
		})

		it("should generate 8 combinations for 3 underscores", () => {
			// "a_b_c_d" has 3 underscores -> 2^3 = 8 combinations
			const results = generatePossibleOriginalNames("a_b_c_d")
			expect(results.length).toBe(8)
			expect(results).toContain("a_b_c_d")
			expect(results).toContain("a-b_c_d")
			expect(results).toContain("a_b-c_d")
			expect(results).toContain("a_b_c-d")
			expect(results).toContain("a-b-c_d")
			expect(results).toContain("a-b_c-d")
			expect(results).toContain("a_b-c-d")
			expect(results).toContain("a-b-c-d")
		})

		it("should handle the key issue #10642 case - atlassian_jira", () => {
			const results = generatePossibleOriginalNames("atlassian_jira")
			expect(results).toContain("atlassian_jira")
			expect(results).toContain("atlassian-jira") // The original name
		})

		it("should handle names with no underscores", () => {
			const results = generatePossibleOriginalNames("server")
			expect(results).toEqual(["server"])
		})

		it("should limit combinations for too many underscores (> 8)", () => {
			const manyUnderscores = "a_b_c_d_e_f_g_h_i_j" // 9 underscores
			const results = generatePossibleOriginalNames(manyUnderscores)
			// Should only have 2 results: original and all-hyphens version
			expect(results.length).toBe(2)
			expect(results).toContain(manyUnderscores)
			expect(results).toContain("a-b-c-d-e-f-g-h-i-j")
		})

		it("should handle exactly 8 underscores (256 combinations)", () => {
			const eightUnderscores = "a_b_c_d_e_f_g_h_i" // 8 underscores
			const results = generatePossibleOriginalNames(eightUnderscores)
			// 2^8 = 256 combinations
			expect(results.length).toBe(256)
		})
	})

	describe("findMatchingServerName", () => {
		it("should return exact match first", () => {
			const servers = ["my-server", "other-server"]
			const result = findMatchingServerName("my-server", servers)
			expect(result).toBe("my-server")
		})

		it("should find original hyphenated name from mangled name", () => {
			const servers = ["atlassian-jira", "linear", "github"]
			const result = findMatchingServerName("atlassian_jira", servers)
			expect(result).toBe("atlassian-jira")
		})

		it("should return null if no match found", () => {
			const servers = ["server1", "server2"]
			const result = findMatchingServerName("unknown_server", servers)
			expect(result).toBeNull()
		})

		it("should handle server names with multiple hyphens", () => {
			const servers = ["my-cool-server", "another-server"]
			const result = findMatchingServerName("my_cool_server", servers)
			expect(result).toBe("my-cool-server")
		})

		it("should work with empty server list", () => {
			const result = findMatchingServerName("server", [])
			expect(result).toBeNull()
		})

		it("should match when original has underscores (not hyphens)", () => {
			const servers = ["my_real_server", "other"]
			const result = findMatchingServerName("my_real_server", servers)
			expect(result).toBe("my_real_server")
		})
	})

	describe("findMatchingToolName", () => {
		it("should return exact match first", () => {
			const tools = ["get-data", "set-data"]
			const result = findMatchingToolName("get-data", tools)
			expect(result).toBe("get-data")
		})

		it("should find original hyphenated name from mangled name", () => {
			const tools = ["get-user-info", "create-ticket", "search"]
			const result = findMatchingToolName("get_user_info", tools)
			expect(result).toBe("get-user-info")
		})

		it("should return null if no match found", () => {
			const tools = ["tool1", "tool2"]
			const result = findMatchingToolName("unknown_tool", tools)
			expect(result).toBeNull()
		})

		it("should handle tool names with multiple hyphens", () => {
			const tools = ["get-all-user-data", "search"]
			const result = findMatchingToolName("get_all_user_data", tools)
			expect(result).toBe("get-all-user-data")
		})

		it("should work with empty tool list", () => {
			const result = findMatchingToolName("tool", [])
			expect(result).toBeNull()
		})

		it("should match when original has underscores (not hyphens)", () => {
			const tools = ["get_user", "search"]
			const result = findMatchingToolName("get_user", tools)
			expect(result).toBe("get_user")
		})
	})

	describe("issue #10642 - MCP tool names with hyphens fail", () => {
		// End-to-end test for the specific bug reported in the issue
		it("should correctly handle atlassian-jira being mangled to atlassian_jira", () => {
			// The original MCP tool name as built by the system
			const originalToolName = buildMcpToolName("atlassian-jira", "search")
			expect(originalToolName).toBe("mcp--atlassian-jira--search")

			// What the model returns (hyphens converted to underscores)
			const mangledToolName = "mcp__atlassian_jira__search"

			// isMcpTool should recognize both
			expect(isMcpTool(originalToolName)).toBe(true)
			expect(isMcpTool(mangledToolName)).toBe(true)

			// parseMcpToolName should parse both
			const originalParsed = parseMcpToolName(originalToolName)
			expect(originalParsed).toEqual({
				serverName: "atlassian-jira",
				toolName: "search",
				wasMangled: false,
			})

			const mangledParsed = parseMcpToolName(mangledToolName)
			expect(mangledParsed).toEqual({
				serverName: "atlassian_jira", // Mangled name
				toolName: "search",
				wasMangled: true,
			})

			// findMatchingServerName should resolve mangled name back to original
			const availableServers = ["atlassian-jira", "linear", "github"]
			const resolvedServer = findMatchingServerName(mangledParsed!.serverName, availableServers)
			expect(resolvedServer).toBe("atlassian-jira")
		})

		it("should handle litellm server with atlassian-jira tool", () => {
			// From issue: mcp--litellm--atlassian-jira_search
			const originalToolName = buildMcpToolName("litellm", "atlassian-jira_search")
			expect(originalToolName).toBe("mcp--litellm--atlassian-jira_search")

			// Model might mangle it to: mcp__litellm__atlassian_jira_search
			const mangledToolName = "mcp__litellm__atlassian_jira_search"

			expect(isMcpTool(mangledToolName)).toBe(true)

			const parsed = parseMcpToolName(mangledToolName)
			expect(parsed).toEqual({
				serverName: "litellm",
				toolName: "atlassian_jira_search",
				wasMangled: true,
			})

			// Find matching tool
			const availableTools = ["atlassian-jira_search", "other_tool"]
			const resolvedTool = findMatchingToolName(parsed!.toolName, availableTools)
			expect(resolvedTool).toBe("atlassian-jira_search")
		})
	})
})
