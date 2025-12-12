import { McpToolRegistry } from "../McpToolRegistry"

describe("McpToolRegistry", () => {
	beforeEach(() => {
		// Clear the registry before each test to ensure isolation
		McpToolRegistry.clear()
	})

	describe("register", () => {
		it("should register a tool and return an API-compatible name", () => {
			const apiName = McpToolRegistry.register("agent-block", "describe")

			expect(apiName).toBe("mcp_0")
		})

		it("should return different names for different tools", () => {
			const name1 = McpToolRegistry.register("agent-block", "describe")
			const name2 = McpToolRegistry.register("agent-block", "execute_task")
			const name3 = McpToolRegistry.register("debug", "state.get_full")

			expect(name1).toBe("mcp_0")
			expect(name2).toBe("mcp_1")
			expect(name3).toBe("mcp_2")
		})

		it("should be idempotent - return same name for same server/tool combination", () => {
			const name1 = McpToolRegistry.register("agent-block", "describe")
			const name2 = McpToolRegistry.register("agent-block", "describe")
			const name3 = McpToolRegistry.register("agent-block", "describe")

			expect(name1).toBe("mcp_0")
			expect(name2).toBe("mcp_0")
			expect(name3).toBe("mcp_0")

			// Should still be only 1 entry
			expect(McpToolRegistry.size()).toBe(1)
		})

		it("should handle tool names with dots (the original problem)", () => {
			// These names would fail Bedrock's [a-zA-Z0-9_-]+ constraint
			const name1 = McpToolRegistry.register("agent-block-debug", "state.get_full")
			const name2 = McpToolRegistry.register("agent-block-debug", "logs.query")
			const name3 = McpToolRegistry.register("agent-block-debug", "cdp.passthrough")

			// API names are simple numeric identifiers that pass the constraint
			expect(name1).toMatch(/^mcp_\d+$/)
			expect(name2).toMatch(/^mcp_\d+$/)
			expect(name3).toMatch(/^mcp_\d+$/)

			// All should be different
			expect(new Set([name1, name2, name3]).size).toBe(3)
		})

		it("should handle server names with special characters", () => {
			const name = McpToolRegistry.register("my-special_server", "tool.with.dots")

			expect(name).toBe("mcp_0")

			const entry = McpToolRegistry.lookup(name)
			expect(entry).toEqual({
				serverName: "my-special_server",
				toolName: "tool.with.dots",
			})
		})
	})

	describe("lookup", () => {
		it("should return the original server and tool names", () => {
			const apiName = McpToolRegistry.register("agent-block", "describe")

			const entry = McpToolRegistry.lookup(apiName)

			expect(entry).toEqual({
				serverName: "agent-block",
				toolName: "describe",
			})
		})

		it("should return undefined for unregistered names", () => {
			const entry = McpToolRegistry.lookup("mcp_999")

			expect(entry).toBeUndefined()
		})

		it("should return undefined for non-mcp names", () => {
			const entry = McpToolRegistry.lookup("read_file")

			expect(entry).toBeUndefined()
		})

		it("should preserve original tool name with dots", () => {
			const apiName = McpToolRegistry.register("debug", "state.get_full")

			const entry = McpToolRegistry.lookup(apiName)

			expect(entry?.toolName).toBe("state.get_full")
		})
	})

	describe("isRegistered", () => {
		it("should return true for registered names", () => {
			const apiName = McpToolRegistry.register("server", "tool")

			expect(McpToolRegistry.isRegistered(apiName)).toBe(true)
		})

		it("should return false for unregistered names", () => {
			expect(McpToolRegistry.isRegistered("mcp_0")).toBe(false)
			expect(McpToolRegistry.isRegistered("read_file")).toBe(false)
		})
	})

	describe("clear", () => {
		it("should remove all registrations", () => {
			McpToolRegistry.register("server1", "tool1")
			McpToolRegistry.register("server2", "tool2")
			expect(McpToolRegistry.size()).toBe(2)

			McpToolRegistry.clear()

			expect(McpToolRegistry.size()).toBe(0)
			expect(McpToolRegistry.lookup("mcp_0")).toBeUndefined()
			expect(McpToolRegistry.lookup("mcp_1")).toBeUndefined()
		})

		it("should reset the ID counter", () => {
			McpToolRegistry.register("server", "tool")
			expect(McpToolRegistry.lookup("mcp_0")).toBeDefined()

			McpToolRegistry.clear()

			// After clear, next registration should start from 0 again
			const apiName = McpToolRegistry.register("new-server", "new-tool")
			expect(apiName).toBe("mcp_0")
		})

		it("should allow re-registration with same names after clear", () => {
			const apiName1 = McpToolRegistry.register("server", "tool")
			expect(apiName1).toBe("mcp_0")

			McpToolRegistry.clear()

			// Same server/tool should get mcp_0 again after clear
			const apiName2 = McpToolRegistry.register("server", "tool")
			expect(apiName2).toBe("mcp_0")
		})
	})

	describe("size", () => {
		it("should return 0 for empty registry", () => {
			expect(McpToolRegistry.size()).toBe(0)
		})

		it("should return correct count", () => {
			McpToolRegistry.register("s1", "t1")
			expect(McpToolRegistry.size()).toBe(1)

			McpToolRegistry.register("s1", "t2")
			expect(McpToolRegistry.size()).toBe(2)

			// Idempotent - same registration shouldn't increase count
			McpToolRegistry.register("s1", "t1")
			expect(McpToolRegistry.size()).toBe(2)
		})
	})

	describe("getAll", () => {
		it("should return empty map for empty registry", () => {
			const all = McpToolRegistry.getAll()

			expect(all.size).toBe(0)
		})

		it("should return all registrations", () => {
			McpToolRegistry.register("server1", "tool1")
			McpToolRegistry.register("server2", "tool2")

			const all = McpToolRegistry.getAll()

			expect(all.size).toBe(2)
			expect(all.get("mcp_0")).toEqual({ serverName: "server1", toolName: "tool1" })
			expect(all.get("mcp_1")).toEqual({ serverName: "server2", toolName: "tool2" })
		})

		it("should return a copy that doesn't affect internal state", () => {
			McpToolRegistry.register("server", "tool")

			const all = McpToolRegistry.getAll()
			all.clear() // Modify the returned map

			// Internal state should be unaffected
			expect(McpToolRegistry.size()).toBe(1)
			expect(McpToolRegistry.lookup("mcp_0")).toBeDefined()
		})
	})

	describe("integration scenarios", () => {
		it("should handle typical request cycle", () => {
			// Simulate building tools for API request
			const tools = [
				{ server: "agent-block", tool: "agent-block.describe" },
				{ server: "agent-block", tool: "agent-block.execute_task" },
				{ server: "debug", tool: "debug.state.get_full" },
			]

			// Register tools (simulating getMcpServerTools)
			const registeredNames = tools.map((t) => McpToolRegistry.register(t.server, t.tool))

			expect(registeredNames).toEqual(["mcp_0", "mcp_1", "mcp_2"])

			// Simulate parsing tool response (simulating parseDynamicMcpTool)
			const entry = McpToolRegistry.lookup("mcp_1")
			expect(entry).toEqual({
				serverName: "agent-block",
				toolName: "agent-block.execute_task",
			})

			// Simulate new request cycle
			McpToolRegistry.clear()

			// Tools get re-registered (order might differ)
			const newTools = [
				{ server: "debug", tool: "debug.logs.query" },
				{ server: "agent-block", tool: "agent-block.describe" },
			]

			const newNames = newTools.map((t) => McpToolRegistry.register(t.server, t.tool))
			expect(newNames).toEqual(["mcp_0", "mcp_1"])

			// Lookup works with new mappings
			expect(McpToolRegistry.lookup("mcp_0")).toEqual({
				serverName: "debug",
				toolName: "debug.logs.query",
			})
		})

		it("should handle edge case of empty server or tool name", () => {
			// While unlikely, the registry should handle edge cases gracefully
			const apiName = McpToolRegistry.register("", "tool")
			expect(apiName).toBe("mcp_0")

			const entry = McpToolRegistry.lookup(apiName)
			expect(entry).toEqual({ serverName: "", toolName: "tool" })
		})
	})
})
