import {
	sanitizeMcpName,
	buildMcpToolName,
	parseMcpToolName,
	decodeMcpName,
	normalizeMcpToolName,
	isMcpTool,
	MCP_TOOL_SEPARATOR,
	MCP_TOOL_PREFIX,
	HYPHEN_ENCODING,
	MAX_TOOL_NAME_LENGTH,
	HASH_SUFFIX_LENGTH,
	clearEncodedNameCache,
	computeHashSuffix,
	findToolByEncodedMcpName,
	hasHashSuffix,
} from "../mcp-name"

describe("mcp-name utilities", () => {
	// Clear the cache before each test to ensure isolation
	beforeEach(() => {
		clearEncodedNameCache()
	})

	describe("constants", () => {
		it("should have correct separator and prefix", () => {
			expect(MCP_TOOL_SEPARATOR).toBe("--")
			expect(MCP_TOOL_PREFIX).toBe("mcp")
		})

		it("should have correct hyphen encoding", () => {
			expect(HYPHEN_ENCODING).toBe("___")
		})

		it("should have correct max tool name length", () => {
			expect(MAX_TOOL_NAME_LENGTH).toBe(64)
		})

		it("should have correct hash suffix length", () => {
			expect(HASH_SUFFIX_LENGTH).toBe(8)
		})
	})

	describe("isMcpTool", () => {
		it("should return true for valid MCP tool names", () => {
			expect(isMcpTool("mcp--server--tool")).toBe(true)
			expect(isMcpTool("mcp--my_server--get_forecast")).toBe(true)
		})

		it("should return false for non-MCP tool names", () => {
			expect(isMcpTool("server--tool")).toBe(false)
			expect(isMcpTool("tool")).toBe(false)
			expect(isMcpTool("read_file")).toBe(false)
			expect(isMcpTool("")).toBe(false)
		})

		it("should return false for old underscore format", () => {
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

		it("should keep alphanumeric and underscores, but encode hyphens", () => {
			expect(sanitizeMcpName("server_name")).toBe("server_name")
			// Hyphens are now encoded as triple underscores
			expect(sanitizeMcpName("server-name")).toBe("server___name")
			expect(sanitizeMcpName("Server123")).toBe("Server123")
		})

		it("should remove dots and colons for AWS Bedrock compatibility", () => {
			// Dots and colons are NOT allowed due to AWS Bedrock restrictions
			expect(sanitizeMcpName("server.name")).toBe("servername")
			expect(sanitizeMcpName("server:name")).toBe("servername")
			// Hyphens are encoded as triple underscores
			expect(sanitizeMcpName("awslabs.aws-documentation-mcp-server")).toBe(
				"awslabsaws___documentation___mcp___server",
			)
		})

		it("should prepend underscore if name starts with non-letter/underscore", () => {
			expect(sanitizeMcpName("123server")).toBe("_123server")
			// Hyphen at start is encoded to ___, which starts with underscore (valid)
			expect(sanitizeMcpName("-server")).toBe("___server")
			// Dots are removed, so ".server" becomes "server" which starts with a letter
			expect(sanitizeMcpName(".server")).toBe("server")
		})

		it("should not modify names that start with letter or underscore", () => {
			expect(sanitizeMcpName("server")).toBe("server")
			expect(sanitizeMcpName("_server")).toBe("_server")
			expect(sanitizeMcpName("Server")).toBe("Server")
		})

		it("should replace double-hyphen sequences with single hyphen then encode", () => {
			// Double hyphens become single hyphen, then encoded as ___
			expect(sanitizeMcpName("server--name")).toBe("server___name")
			expect(sanitizeMcpName("test---server")).toBe("test___server")
			expect(sanitizeMcpName("my----tool")).toBe("my___tool")
		})

		it("should handle complex names with multiple issues", () => {
			expect(sanitizeMcpName("My Server @ Home!")).toBe("My_Server__Home")
			// Hyphen is encoded as ___
			expect(sanitizeMcpName("123-test server")).toBe("_123___test_server")
		})

		it("should return placeholder for names that become empty after sanitization", () => {
			expect(sanitizeMcpName("@#$%")).toBe("_unnamed")
			// Spaces become underscores, which is a valid character, so it returns "_"
			expect(sanitizeMcpName("   ")).toBe("_")
		})

		it("should encode hyphens as triple underscores for model compatibility", () => {
			// This is the key feature: hyphens are encoded so they survive model tool calling
			expect(sanitizeMcpName("atlassian-jira_search")).toBe("atlassian___jira_search")
			expect(sanitizeMcpName("atlassian-confluence_search")).toBe("atlassian___confluence_search")
		})
	})

	describe("decodeMcpName", () => {
		it("should decode triple underscores back to hyphens", () => {
			expect(decodeMcpName("server___name")).toBe("server-name")
			expect(decodeMcpName("atlassian___jira_search")).toBe("atlassian-jira_search")
		})

		it("should not modify names without triple underscores", () => {
			expect(decodeMcpName("server_name")).toBe("server_name")
			expect(decodeMcpName("tool")).toBe("tool")
		})

		it("should handle multiple encoded hyphens", () => {
			expect(decodeMcpName("a___b___c")).toBe("a-b-c")
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

		it("should truncate long names to 64 characters with hash suffix", () => {
			const longServer = "a".repeat(50)
			const longTool = "b".repeat(50)
			const result = buildMcpToolName(longServer, longTool)
			expect(result.length).toBeLessThanOrEqual(64)
			expect(result.length).toBe(64)
			expect(result.startsWith("mcp--")).toBe(true)
			// Should end with underscore + 8 char hash suffix
			expect(result).toMatch(/_[a-f0-9]{8}$/)
		})

		it("should use hash suffix for long names and cache them", () => {
			const longServer = "a".repeat(50)
			const longTool = "b".repeat(50)
			const result = buildMcpToolName(longServer, longTool)

			// The shortened name should be deterministic
			expect(result.length).toBe(64)
			expect(result).toMatch(/_[a-f0-9]{8}$/)

			// Building again should return the same result (from cache)
			const result2 = buildMcpToolName(longServer, longTool)
			expect(result2).toBe(result)
		})

		it("should produce deterministic hash suffixes", () => {
			const longServer = "a".repeat(50)
			const longTool = "b".repeat(50)
			// Build the same name twice with cache cleared between
			clearEncodedNameCache()
			const result1 = buildMcpToolName(longServer, longTool)
			clearEncodedNameCache()
			const result2 = buildMcpToolName(longServer, longTool)
			// Should produce identical results
			expect(result1).toBe(result2)
		})

		it("should produce unique hash suffixes for different tools", () => {
			const longServer = "a".repeat(50)
			const result1 = buildMcpToolName(longServer, "tool1_" + "x".repeat(40))
			const result2 = buildMcpToolName(longServer, "tool2_" + "y".repeat(40))
			// Both should be truncated
			expect(result1.length).toBe(64)
			expect(result2.length).toBe(64)
			// Should have different hash suffixes
			expect(result1).not.toBe(result2)
		})

		it("should handle names starting with numbers", () => {
			expect(buildMcpToolName("123server", "456tool")).toBe("mcp--_123server--_456tool")
		})

		it("should preserve underscores in server and tool names", () => {
			expect(buildMcpToolName("my_server", "my_tool")).toBe("mcp--my_server--my_tool")
		})

		it("should encode hyphens in tool names", () => {
			// Hyphens are encoded as triple underscores
			expect(buildMcpToolName("onellm", "atlassian-jira_search")).toBe("mcp--onellm--atlassian___jira_search")
		})
	})

	describe("parseMcpToolName", () => {
		it("should parse valid mcp tool names", () => {
			expect(parseMcpToolName("mcp--server--tool")).toEqual({
				serverName: "server",
				toolName: "tool",
			})
		})

		it("should return null for non-mcp tool names", () => {
			expect(parseMcpToolName("server--tool")).toBeNull()
			expect(parseMcpToolName("tool")).toBeNull()
		})

		it("should return null for old underscore format", () => {
			expect(parseMcpToolName("mcp_server_tool")).toBeNull()
		})

		it("should handle tool names with underscores", () => {
			expect(parseMcpToolName("mcp--server--tool_name")).toEqual({
				serverName: "server",
				toolName: "tool_name",
			})
		})

		it("should correctly handle server names with underscores", () => {
			expect(parseMcpToolName("mcp--my_server--tool")).toEqual({
				serverName: "my_server",
				toolName: "tool",
			})
		})

		it("should handle both server and tool names with underscores", () => {
			expect(parseMcpToolName("mcp--my_server--get_forecast")).toEqual({
				serverName: "my_server",
				toolName: "get_forecast",
			})
		})

		it("should decode triple underscores back to hyphens", () => {
			// This is the key feature: encoded hyphens are decoded back
			expect(parseMcpToolName("mcp--onellm--atlassian___jira_search")).toEqual({
				serverName: "onellm",
				toolName: "atlassian-jira_search",
			})
		})

		it("should return null for malformed names", () => {
			expect(parseMcpToolName("mcp--")).toBeNull()
			expect(parseMcpToolName("mcp--server")).toBeNull()
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

		it("should preserve sanitized names through roundtrip with underscores", () => {
			const toolName = buildMcpToolName("my_server", "my_tool")
			const parsed = parseMcpToolName(toolName)
			expect(parsed).toEqual({
				serverName: "my_server",
				toolName: "my_tool",
			})
		})

		it("should handle spaces that get converted to underscores", () => {
			const toolName = buildMcpToolName("my server", "get tool")
			const parsed = parseMcpToolName(toolName)
			expect(parsed).toEqual({
				serverName: "my_server",
				toolName: "get_tool",
			})
		})

		it("should handle complex server and tool names", () => {
			const toolName = buildMcpToolName("Weather API", "get_current_forecast")
			const parsed = parseMcpToolName(toolName)
			expect(parsed).toEqual({
				serverName: "Weather_API",
				toolName: "get_current_forecast",
			})
		})

		it("should preserve hyphens through roundtrip via encoding/decoding", () => {
			// This is the key test: hyphens survive the roundtrip
			const toolName = buildMcpToolName("onellm", "atlassian-jira_search")
			expect(toolName).toBe("mcp--onellm--atlassian___jira_search")

			const parsed = parseMcpToolName(toolName)
			expect(parsed).toEqual({
				serverName: "onellm",
				toolName: "atlassian-jira_search", // Hyphen is preserved!
			})
		})

		it("should handle tool names with multiple hyphens", () => {
			const toolName = buildMcpToolName("server", "get-user-profile")
			const parsed = parseMcpToolName(toolName)
			expect(parsed).toEqual({
				serverName: "server",
				toolName: "get-user-profile",
			})
		})
	})

	describe("normalizeMcpToolName", () => {
		it("should convert underscore separators to hyphen separators", () => {
			expect(normalizeMcpToolName("mcp__server__tool")).toBe("mcp--server--tool")
		})

		it("should not modify names that already have hyphen separators", () => {
			expect(normalizeMcpToolName("mcp--server--tool")).toBe("mcp--server--tool")
		})

		it("should not modify non-MCP tool names", () => {
			expect(normalizeMcpToolName("read_file")).toBe("read_file")
			expect(normalizeMcpToolName("some__tool")).toBe("some__tool")
		})

		it("should preserve triple underscores (encoded hyphens) while normalizing separators", () => {
			// Model outputs: mcp__onellm__atlassian___jira_search
			// Should become: mcp--onellm--atlassian___jira_search
			expect(normalizeMcpToolName("mcp__onellm__atlassian___jira_search")).toBe(
				"mcp--onellm--atlassian___jira_search",
			)
		})

		it("should handle multiple encoded hyphens", () => {
			expect(normalizeMcpToolName("mcp__server__get___user___profile")).toBe("mcp--server--get___user___profile")
		})
	})

	describe("model compatibility - full flow", () => {
		it("should handle the complete flow: build -> model mangles -> normalize -> parse", () => {
			// Step 1: Build the tool name (hyphens encoded as ___)
			const builtName = buildMcpToolName("onellm", "atlassian-jira_search")
			expect(builtName).toBe("mcp--onellm--atlassian___jira_search")

			// Step 2: Model mangles the separators (-- becomes __)
			const mangledName = "mcp__onellm__atlassian___jira_search"

			// Step 3: Normalize the separators back (__ becomes --)
			const normalizedName = normalizeMcpToolName(mangledName)
			expect(normalizedName).toBe("mcp--onellm--atlassian___jira_search")

			// Step 4: Parse the normalized name (decodes ___ back to -)
			const parsed = parseMcpToolName(normalizedName)
			expect(parsed).toEqual({
				serverName: "onellm",
				toolName: "atlassian-jira_search", // Original hyphen is preserved!
			})
		})

		it("should handle tool names with multiple hyphens through the full flow", () => {
			// Build
			const builtName = buildMcpToolName("server", "get-user-profile")
			expect(builtName).toBe("mcp--server--get___user___profile")

			// Model mangles
			const mangledName = "mcp__server__get___user___profile"

			// Normalize
			const normalizedName = normalizeMcpToolName(mangledName)
			expect(normalizedName).toBe("mcp--server--get___user___profile")

			// Parse
			const parsed = parseMcpToolName(normalizedName)
			expect(parsed).toEqual({
				serverName: "server",
				toolName: "get-user-profile",
			})
		})
	})

	describe("computeHashSuffix", () => {
		it("should compute deterministic hash for the same inputs", () => {
			const hash1 = computeHashSuffix("server", "tool")
			const hash2 = computeHashSuffix("server", "tool")
			expect(hash1).toBe(hash2)
		})

		it("should return 8-character hex string", () => {
			const hash = computeHashSuffix("server", "tool")
			expect(hash).toHaveLength(8)
			expect(hash).toMatch(/^[a-f0-9]{8}$/)
		})

		it("should produce different hashes for different inputs", () => {
			const hash1 = computeHashSuffix("server1", "tool")
			const hash2 = computeHashSuffix("server2", "tool")
			expect(hash1).not.toBe(hash2)
		})
	})

	describe("hash suffix roundtrip - fixes issue #10766", () => {
		it("should work correctly when names do not need truncation", () => {
			// Short names that don't need truncation
			const serverName = "server"
			const toolName = "get-data"

			const builtName = buildMcpToolName(serverName, toolName)

			// Should NOT have hash suffix
			expect(builtName).toBe("mcp--server--get___data")
			expect(builtName.length).toBeLessThan(64)

			// Normal decode path should work
			const parsed = parseMcpToolName(builtName)
			expect(parsed).toEqual({
				serverName: "server",
				toolName: "get-data", // Hyphen decoded from ___
			})
		})

		it("should find tool by encoded name comparison for shortened names", () => {
			// This is the new approach: instead of registry, compare encoded names
			const serverName = "abcdefghij-kl-mnop-qrs-tuv-with-extra-long-suffix-to-exceed-limit"
			const toolName = "wxyz-abcd-efghijk-lmno-plus-additional-long-suffix-here"

			// Build the encoded tool name
			const encodedName = buildMcpToolName(serverName, toolName)

			// Should be truncated to 128 chars with hash suffix
			expect(encodedName.length).toBe(64)
			expect(encodedName).toMatch(/_[a-f0-9]{8}$/)

			// The new approach: use findToolByEncodedMcpName to find the matching tool
			const availableTools = [toolName, "other-tool", "another-tool"]
			const foundTool = findToolByEncodedMcpName(serverName, encodedName, availableTools)
			expect(foundTool).toBe(toolName)
		})

		it("should not find tool when none matches the encoded name", () => {
			const serverName = "server"
			const encodedName = "mcp--server--nonexistent_tool_a1b2c3d4"

			const availableTools = ["tool1", "tool2", "tool3"]
			const foundTool = findToolByEncodedMcpName(serverName, encodedName, availableTools)
			expect(foundTool).toBeNull()
		})
	})

	describe("findToolByEncodedMcpName", () => {
		it("should find tool by exact encoded name match", () => {
			const serverName = "myserver"
			const toolName = "get-data"
			const encodedName = buildMcpToolName(serverName, toolName)

			const availableTools = ["other-tool", "get-data", "another-tool"]
			const foundTool = findToolByEncodedMcpName(serverName, encodedName, availableTools)
			expect(foundTool).toBe("get-data")
		})

		it("should find tool for shortened names with hash suffix", () => {
			const serverName = "a".repeat(50)
			const toolName = "b".repeat(50) + "-hyphen"
			const encodedName = buildMcpToolName(serverName, toolName)

			// The encoded name should have a hash suffix
			expect(hasHashSuffix(encodedName)).toBe(true)

			const availableTools = ["other-tool", toolName, "another-tool"]
			const foundTool = findToolByEncodedMcpName(serverName, encodedName, availableTools)
			expect(foundTool).toBe(toolName)
		})

		it("should return null when no tool matches", () => {
			const serverName = "server"
			const encodedName = buildMcpToolName(serverName, "nonexistent")

			const availableTools = ["tool1", "tool2"]
			const foundTool = findToolByEncodedMcpName(serverName, encodedName, availableTools)
			expect(foundTool).toBeNull()
		})

		it("should handle empty available tools list", () => {
			const serverName = "server"
			const encodedName = buildMcpToolName(serverName, "tool")

			const foundTool = findToolByEncodedMcpName(serverName, encodedName, [])
			expect(foundTool).toBeNull()
		})
	})

	describe("hasHashSuffix", () => {
		it("should return true for names with hash suffix", () => {
			expect(hasHashSuffix("mcp--server--tool_a1b2c3d4")).toBe(true)
			expect(hasHashSuffix("mcp--server--tool_12345678")).toBe(true)
			expect(hasHashSuffix("mcp--server--tool_abcdef00")).toBe(true)
		})

		it("should return false for names without hash suffix", () => {
			expect(hasHashSuffix("mcp--server--tool")).toBe(false)
			expect(hasHashSuffix("mcp--server--tool_name")).toBe(false)
			expect(hasHashSuffix("mcp--server--tool___name")).toBe(false)
		})

		it("should return false for names with partial hash patterns", () => {
			// Not enough hex chars
			expect(hasHashSuffix("mcp--server--tool_abc")).toBe(false)
			// No underscore before hash
			expect(hasHashSuffix("mcp--server--toola1b2c3d4")).toBe(false)
		})
	})

	describe("clearEncodedNameCache", () => {
		it("should clear the encoded name cache", () => {
			// Build some names to populate cache
			const longServer = "a".repeat(50)
			const longTool = "b".repeat(50)
			buildMcpToolName(longServer, longTool)
			buildMcpToolName("server", "tool")

			// Clear the cache
			clearEncodedNameCache()

			// Verify cache is cleared by checking that rebuilding takes the same path
			// (we can't directly access the cache, but the function should work)
			const result = buildMcpToolName(longServer, longTool)
			expect(result.length).toBe(64)
			expect(result).toMatch(/_[a-f0-9]{8}$/)
		})
	})
})
