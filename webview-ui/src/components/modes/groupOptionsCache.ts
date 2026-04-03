import type { GroupEntry, ToolGroup } from "@roo-code/types"

/**
 * Helper to extract the group name from a GroupEntry.
 * A GroupEntry is either a plain string or a tuple [name, options].
 */
export function getGroupName(entry: GroupEntry): string {
	if (typeof entry === "string") {
		return entry
	}
	return entry[0]
}

/**
 * Synchronise a cache map with the current groups array.
 * For every tuple entry, upsert its options into the cache.
 */
export function syncCacheFromGroups(cache: Map<string, object>, groups: GroupEntry[]): void {
	for (const entry of groups) {
		if (Array.isArray(entry) && entry[1]) {
			cache.set(entry[0], entry[1])
		}
	}
}

/**
 * Remove a group by name.  When the entry being removed is a
 * tuple (i.e. it carries options), stash those options in the
 * cache so they can be restored later.
 *
 * Returns the filtered groups array.
 */
export function removeGroupWithCache(
	cache: Map<string, object>,
	groups: GroupEntry[],
	groupName: string,
): GroupEntry[] {
	const entry = groups.find((g) => getGroupName(g) === groupName)
	if (entry && Array.isArray(entry) && entry[1]) {
		cache.set(entry[0], entry[1])
	}
	return groups.filter((g) => getGroupName(g) !== groupName)
}

/**
 * Add a group by name.  If the cache contains previously-saved
 * options for this group, restore it as a tuple [name, options].
 * Otherwise add it as a plain string.
 *
 * Returns the new groups array.
 */
export function addGroupWithCache(
	cache: Map<string, object>,
	groups: GroupEntry[],
	groupName: ToolGroup,
): GroupEntry[] {
	const cached = cache.get(groupName)
	if (cached) {
		return [...groups, [groupName, cached] as GroupEntry]
	}
	return [...groups, groupName]
}
