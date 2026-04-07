/**
 * SE-2: Tests for groupOptionsCache with mode-scoped keys.
 *
 * The updated functions accept an additional `modeSlug` parameter and
 * store / retrieve cache entries under composite keys of the form
 * 'modeSlug:groupName' so that options from different modes never
 * collide.
 */

import type { GroupEntry, ToolGroup } from "@roo-code/types"

import { syncCacheFromGroups, removeGroupWithCache, addGroupWithCache } from "../groupOptionsCache"

describe("groupOptionsCache mode-scoped keys", () => {
	it("syncCacheFromGroups stores options under mode-scoped key", () => {
		const cache = new Map<string, object>()
		const groups: GroupEntry[] = [["mcp", { mcpServers: { s1: {} } }]]

		syncCacheFromGroups(cache, groups, "modeA")

		expect(cache.get("modeA:mcp")).toEqual({ mcpServers: { s1: {} } })
		// Old un-scoped key must NOT be used
		expect(cache.get("mcp")).toBeUndefined()
	})

	it("syncCacheFromGroups keeps separate entries for different modes", () => {
		const cache = new Map<string, object>()

		const groupsA: GroupEntry[] = [["mcp", { mcpDefaultPolicy: "deny" }]]
		const groupsB: GroupEntry[] = [["mcp", { mcpServers: { x: { disabled: true } } }]]

		syncCacheFromGroups(cache, groupsA, "modeA")
		syncCacheFromGroups(cache, groupsB, "modeB")

		expect(cache.get("modeA:mcp")).toEqual({ mcpDefaultPolicy: "deny" })
		expect(cache.get("modeB:mcp")).toEqual({
			mcpServers: { x: { disabled: true } },
		})
	})

	it("removeGroupWithCache stores options under mode-scoped key", () => {
		const cache = new Map<string, object>()
		const groups: GroupEntry[] = [["mcp", { mcpServers: { s1: {} } }], "read"]

		const result = removeGroupWithCache(cache, groups, "mcp", "modeA")

		expect(result).toHaveLength(1)
		expect(result[0]).toBe("read")
		expect(cache.get("modeA:mcp")).toEqual({ mcpServers: { s1: {} } })
	})

	it("addGroupWithCache restores correct mode options", () => {
		const cache = new Map<string, object>()
		cache.set("modeA:mcp", { mcpDefaultPolicy: "deny" })
		cache.set("modeB:mcp", { mcpServers: { x: {} } })

		const groups: GroupEntry[] = ["read"]
		const result = addGroupWithCache(cache, groups, "mcp" as ToolGroup, "modeA")

		expect(result).toHaveLength(2)
		expect(result[1]).toEqual(["mcp", { mcpDefaultPolicy: "deny" }])
	})

	it("addGroupWithCache returns plain string when no cache entry for mode", () => {
		const cache = new Map<string, object>()
		cache.set("modeA:mcp", { mcpDefaultPolicy: "deny" })

		const groups: GroupEntry[] = ["read"]
		// Request for modeB which has NO cached entry
		const result = addGroupWithCache(cache, groups, "mcp" as ToolGroup, "modeB")

		expect(result).toHaveLength(2)
		expect(result[1]).toBe("mcp")
	})
})
