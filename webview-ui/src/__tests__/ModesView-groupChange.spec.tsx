import type { GroupEntry } from "@roo-code/types"

import { syncCacheFromGroups, removeGroupWithCache, addGroupWithCache } from "../components/modes/groupOptionsCache"

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mcpOptions = {
	mcpServers: {
		"my-server": { disabled: false, allowedTools: ["tool-a"] },
	},
	mcpDefaultPolicy: "deny" as const,
}

const mcpTuple: GroupEntry = ["mcp", mcpOptions]

const readGroup: GroupEntry = "read"
const editGroup: GroupEntry = "edit"

const groupsWithMcpTuple: GroupEntry[] = [readGroup, editGroup, mcpTuple]
const groupsPlainOnly: GroupEntry[] = [readGroup, editGroup, "mcp"]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("groupOptionsCache", () => {
	describe("removeGroupWithCache — caching tuple options", () => {
		it("caches options when removing a group with tuple entry", () => {
			const cache = new Map<string, object>()
			const result = removeGroupWithCache(cache, groupsWithMcpTuple, "mcp")

			// The mcp group should be removed
			expect(result).toEqual([readGroup, editGroup])

			// The cache should contain the mcp options
			expect(cache.get("mcp")).toEqual(mcpOptions)
		})

		it("does not cache anything for a plain string group", () => {
			const cache = new Map<string, object>()
			const result = removeGroupWithCache(cache, groupsPlainOnly, "mcp")

			expect(result).toEqual([readGroup, editGroup])

			// Cache should NOT have an entry for mcp
			expect(cache.has("mcp")).toBe(false)
		})
	})

	describe("addGroupWithCache — restoring cached options", () => {
		it("restores cached tuple options when re-adding a group", () => {
			const cache = new Map<string, object>()

			// First remove to populate cache
			const afterRemove = removeGroupWithCache(cache, groupsWithMcpTuple, "mcp")

			// Now re-add
			const afterAdd = addGroupWithCache(cache, afterRemove, "mcp")

			// Should restore as tuple with cached options
			const mcpEntry = afterAdd.find((g) => (Array.isArray(g) ? g[0] === "mcp" : g === "mcp"))
			expect(Array.isArray(mcpEntry)).toBe(true)
			expect(mcpEntry).toEqual(["mcp", mcpOptions])
		})

		it("adds as plain string when no cached options exist", () => {
			const cache = new Map<string, object>()

			// Remove plain 'mcp' — nothing to cache
			const afterRemove = removeGroupWithCache(cache, groupsPlainOnly, "mcp")

			// Re-add — should be plain string since no cache
			const afterAdd = addGroupWithCache(cache, afterRemove, "mcp")

			const mcpEntry = afterAdd.find((g) => (Array.isArray(g) ? g[0] === "mcp" : g === "mcp"))
			expect(mcpEntry).toBe("mcp")
		})
	})

	describe("syncCacheFromGroups — external state sync", () => {
		it("populates cache from groups containing tuples", () => {
			const cache = new Map<string, object>()

			syncCacheFromGroups(cache, groupsWithMcpTuple)

			expect(cache.get("mcp")).toEqual(mcpOptions)
		})

		it("does not populate cache from plain string groups", () => {
			const cache = new Map<string, object>()

			syncCacheFromGroups(cache, groupsPlainOnly)

			expect(cache.has("mcp")).toBe(false)
		})

		it("updates cache when called with new tuple data", () => {
			const cache = new Map<string, object>()
			const updatedOptions = {
				mcpServers: {
					"new-server": { disabled: false },
				},
				mcpDefaultPolicy: "allow" as const,
			}
			const updatedTuple: GroupEntry = ["mcp", updatedOptions]

			// First sync with original data
			syncCacheFromGroups(cache, groupsWithMcpTuple)
			expect(cache.get("mcp")).toEqual(mcpOptions)

			// Sync again with updated data
			syncCacheFromGroups(cache, [readGroup, editGroup, updatedTuple])
			expect(cache.get("mcp")).toEqual(updatedOptions)
		})
	})

	describe("MCP round-trip — toggle off then on preserves config", () => {
		it("MCP group with mcpServers config survives toggle off/on", () => {
			const cache = new Map<string, object>()

			// Sync cache from initial state (simulates useEffect)
			syncCacheFromGroups(cache, groupsWithMcpTuple)

			// Toggle off (uncheck)
			const afterUncheck = removeGroupWithCache(cache, groupsWithMcpTuple, "mcp")

			// Verify mcp is removed
			expect(afterUncheck.some((g) => (Array.isArray(g) ? g[0] === "mcp" : g === "mcp"))).toBe(false)

			// Toggle on (re-check)
			const afterRecheck = addGroupWithCache(cache, afterUncheck, "mcp")

			// Verify mcp is restored with full config
			const restored = afterRecheck.find((g) => (Array.isArray(g) ? g[0] === "mcp" : g === "mcp"))
			expect(restored).toEqual(["mcp", mcpOptions])

			// Specifically check mcpServers survived
			expect((restored as [string, typeof mcpOptions])[1].mcpServers).toEqual({
				"my-server": {
					disabled: false,
					allowedTools: ["tool-a"],
				},
			})
		})
	})
})
