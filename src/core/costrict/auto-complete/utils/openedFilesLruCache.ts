/**
 * Modified from Kilo-Org/kilocode
 * Copyright Kilo Org, Inc.
 * Licensed under Apache-2.0
 */
import QuickLRU from "quick-lru"

// maximum number of open files that can be cached
const MAX_NUM_OPEN_CONTEXT_FILES = 20

// stores which files are currently open in the IDE, in viewing order
export const openedFilesLruCache = new QuickLRU<string, string>({
	maxSize: MAX_NUM_OPEN_CONTEXT_FILES,
})
