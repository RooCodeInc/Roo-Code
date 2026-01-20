import * as path from "path"
import * as fs from "fs/promises"
import type { Dirent, Stats } from "fs"

import { getStorageBasePath } from "./storage"
import { formatBytes } from "./formatBytes"

/**
 * Result of calculating task history storage size
 */
export interface TaskStorageSizeResult {
	/** Total size in bytes */
	totalBytes: number
	/** Number of task directories found */
	taskCount: number
	/** Formatted size string (e.g., "12.34 MB") */
	formattedSize: string
}

// Re-export for backwards compatibility with existing imports/tests.
export { formatBytes }

/**
 * Recursively calculates the total size of a directory.
 * @param dirPath Path to the directory
 * @returns Total size in bytes
 */
async function getDirectorySize(dirPath: string, depth: number = 0): Promise<number> {
	let totalSize = 0

	// Safety check: prevent infinite recursion by limiting depth
	if (depth > 50) {
		return 0
	}

	try {
		const entries: Dirent[] = await fs.readdir(dirPath, { withFileTypes: true })

		// Process entries in parallel for better performance
		const sizes = await Promise.all(
			entries.map(async (entry) => {
				const entryPath = path.join(dirPath, entry.name)

				try {
					// Check for symlinks to prevent infinite loops
					if (entry.isSymbolicLink()) {
						return 0
					}

					if (entry.isDirectory()) {
						return await getDirectorySize(entryPath, depth + 1)
					} else if (entry.isFile()) {
						const stat: Stats = await fs.stat(entryPath)
						return stat.size
					}
				} catch {
					// Ignore errors for individual entries (permission issues, deleted files, etc.)
				}

				return 0
			}),
		)

		totalSize = sizes.reduce((acc, size) => acc + size, 0)
	} catch {
		// Directory doesn't exist or can't be read
	}

	return totalSize
}

/**
 * Calculates the total storage size used by task history.
 * This includes all files in the tasks/ directory (task data, checkpoints, etc.).
 *
 * This function is designed to be non-blocking and safe for background execution.
 * Errors are handled gracefully and will return 0 bytes if the directory doesn't exist
 * or can't be read.
 *
 * @param globalStoragePath VS Code global storage fsPath (context.globalStorageUri.fsPath)
 * @param log Optional logger function for debugging
 * @returns TaskStorageSizeResult with size info
 */
export async function calculateTaskStorageSize(
	globalStoragePath: string,
	log?: (message: string) => void,
): Promise<TaskStorageSizeResult> {
	const defaultResult: TaskStorageSizeResult = {
		totalBytes: 0,
		taskCount: 0,
		formattedSize: "0 B",
	}

	let basePath: string

	try {
		basePath = await getStorageBasePath(globalStoragePath)
	} catch (e) {
		log?.(`[TaskStorageSize] Failed to resolve storage base path: ${e instanceof Error ? e.message : String(e)}`)
		return defaultResult
	}

	const tasksDir = path.join(basePath, "tasks")

	// Count task directories
	let taskCount = 0
	try {
		const entries = await fs.readdir(tasksDir, { withFileTypes: true })
		taskCount = entries.filter((d) => d.isDirectory()).length
	} catch {
		// Tasks directory doesn't exist yet
		log?.(`[TaskStorageSize] Tasks directory not found at ${tasksDir}`)
		return defaultResult
	}

	// Calculate total size
	const totalBytes = await getDirectorySize(tasksDir)

	return {
		totalBytes,
		taskCount,
		formattedSize: formatBytes(totalBytes),
	}
}
