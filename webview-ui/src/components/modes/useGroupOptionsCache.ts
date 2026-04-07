import { useRef, useEffect, useCallback } from "react"

import type { GroupEntry, ToolGroup } from "@roo-code/types"

import { syncCacheFromGroups, removeGroupWithCache, addGroupWithCache } from "./groupOptionsCache"

/**
 * Custom hook that caches group options (tuple second element) when
 * groups are removed, and restores them when groups are re-added.
 *
 * This prevents data loss when toggling a group like "mcp" off and
 * back on — without the cache, the MCP filter config (mcpServers,
 * mcpDefaultPolicy) would be discarded on uncheck.
 */
export function useGroupOptionsCache(groups: GroupEntry[], modeSlug: string) {
	const groupOptionsCache = useRef<Map<string, object>>(new Map())

	// Sync cache with external state: if external state has tuple
	// entries, update the cache so that toggles preserve them.
	useEffect(() => {
		syncCacheFromGroups(groupOptionsCache.current, groups, modeSlug)
	}, [groups, modeSlug])

	const removeGroup = useCallback(
		(currentGroups: GroupEntry[], groupName: string): GroupEntry[] => {
			return removeGroupWithCache(groupOptionsCache.current, currentGroups, groupName, modeSlug)
		},
		[modeSlug],
	)

	const addGroup = useCallback(
		(currentGroups: GroupEntry[], groupName: ToolGroup): GroupEntry[] => {
			return addGroupWithCache(groupOptionsCache.current, currentGroups, groupName, modeSlug)
		},
		[modeSlug],
	)

	return { removeGroup, addGroup, cache: groupOptionsCache }
}
