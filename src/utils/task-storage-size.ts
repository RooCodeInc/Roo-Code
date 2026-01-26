import * as path from "path"
import * as fs from "fs/promises"

import { getStorageBasePath } from "./storage"

/**
 * Result of counting task history items.
 * Note: Size calculation was removed for performance reasons - with large numbers of
 * tasks (e.g., 9000+), recursively stat'ing every file caused significant delays.
 */
export interface TaskStorageSizeResult {
	/** Number of task directories found */
	taskCount: number
}

/**
 * Counts the number of task directories in task history storage.
 *
 * This function is designed to be fast and non-blocking - it only counts
 * top-level directories without recursively walking the file tree.
 *
 * Note: Size calculation was intentionally removed because with large task counts
 * (e.g., 9000+), the recursive stat calls caused significant performance issues
 * and blocked the extension UI.
 *
 * @param globalStoragePath VS Code global storage fsPath (context.globalStorageUri.fsPath)
 * @param log Optional logger function for debugging
 * @returns TaskStorageSizeResult with task count
 */
export async function calculateTaskStorageSize(
	globalStoragePath: string,
	log?: (message: string) => void,
): Promise<TaskStorageSizeResult> {
	const defaultResult: TaskStorageSizeResult = {
		taskCount: 0,
	}

	let basePath: string

	try {
		basePath = await getStorageBasePath(globalStoragePath)
	} catch (e) {
		log?.(`[TaskStorageSize] Failed to resolve storage base path: ${e instanceof Error ? e.message : String(e)}`)
		return defaultResult
	}

	const tasksDir = path.join(basePath, "tasks")

	// Count task directories - this is a fast O(1) readdir operation
	let taskCount = 0
	try {
		const entries = await fs.readdir(tasksDir, { withFileTypes: true })
		taskCount = entries.filter((d) => d.isDirectory()).length
	} catch {
		// Tasks directory doesn't exist yet
		log?.(`[TaskStorageSize] Tasks directory not found at ${tasksDir}`)
		return defaultResult
	}

	return {
		taskCount,
	}
}
