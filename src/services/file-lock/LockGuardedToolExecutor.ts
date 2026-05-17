import path from "path"

import type { ToolName } from "@roo-code/types"

import { FileLockManager, type LockConflict } from "./FileLockManager"

/**
 * Set of tool names that perform file write operations and require lock guards.
 */
export const WRITE_TOOL_NAMES: ReadonlySet<ToolName> = new Set<ToolName>([
	"write_to_file",
	"apply_diff",
	"apply_patch",
	"edit_file",
	"search_replace",
	"search_and_replace",
])

/**
 * Patch file header markers used by apply_patch to specify file operations.
 */
const PATCH_FILE_MARKERS = ["*** Add File: ", "*** Delete File: ", "*** Update File: "] as const

/**
 * Extract target file paths from tool parameters based on tool name.
 *
 * Each write tool encodes the target file path differently:
 * - write_to_file, apply_diff: `params.path`
 * - edit_file, search_replace, search_and_replace: `params.file_path`
 * - apply_patch: multiple paths embedded in the patch content
 *
 * @returns Array of relative file paths the tool intends to write to.
 */
export function extractWriteTargetPaths(toolName: ToolName, params: Record<string, unknown>): string[] {
	switch (toolName) {
		case "write_to_file":
		case "apply_diff": {
			const p = params.path
			if (typeof p === "string" && p.length > 0) {
				return [p]
			}
			return []
		}

		case "edit_file":
		case "search_replace":
		case "search_and_replace": {
			const p = params.file_path
			if (typeof p === "string" && p.length > 0) {
				return [p]
			}
			return []
		}

		case "apply_patch": {
			return extractFilePathsFromPatch(params.patch)
		}

		default:
			return []
	}
}

/**
 * Extract file paths from apply_patch content.
 * The patch format uses markers like "*** Add File: path", "*** Delete File: path", etc.
 */
function extractFilePathsFromPatch(patchContent: unknown): string[] {
	if (typeof patchContent !== "string" || patchContent.length === 0) {
		return []
	}

	const filePaths: string[] = []
	const lines = patchContent.split("\n")

	for (const line of lines) {
		for (const marker of PATCH_FILE_MARKERS) {
			if (line.startsWith(marker)) {
				const filePath = line.substring(marker.length).trim()
				if (filePath) {
					filePaths.push(filePath)
				}
				break
			}
		}
	}

	return filePaths
}

/**
 * Result of attempting to acquire locks for a tool execution.
 */
export type LockAcquisitionResult =
	| { success: true; lockedPaths: string[] }
	| { success: false; conflicts: LockConflict[]; lockedPaths: string[] }

/**
 * Orchestrates file lock acquisition and release around write tool executions.
 *
 * This executor is designed to be called by the tool execution layer before
 * invoking a write tool. It:
 *
 * 1. Extracts target file paths from the tool's parameters
 * 2. Attempts to acquire locks on all target files for the given task
 * 3. If any lock fails, releases all locks acquired in this batch and returns conflicts
 * 4. On success, the caller executes the tool, then calls `releaseLocks()`
 *
 * Usage:
 * ```typescript
 * const executor = new LockGuardedToolExecutor(fileLockManager)
 * const result = executor.tryAcquireLocks("write_to_file", params, taskId, cwd)
 *
 * if (!result.success) {
 *   // Report conflicts to the LLM
 *   return formatLockConflictError(result.conflicts)
 * }
 *
 * try {
 *   await tool.execute(params, task, callbacks)
 * } finally {
 *   executor.releaseLocks(result.lockedPaths, taskId)
 * }
 * ```
 */
export class LockGuardedToolExecutor {
	constructor(private readonly lockManager: FileLockManager) {}

	/**
	 * Check if the given tool name is a write tool that requires lock guards.
	 */
	isWriteTool(toolName: ToolName): boolean {
		return WRITE_TOOL_NAMES.has(toolName)
	}

	/**
	 * Attempt to acquire file locks for all files a write tool targets.
	 *
	 * If the tool is not a write tool or has no extractable paths, returns
	 * success with an empty lockedPaths array (no locks needed).
	 *
	 * Uses all-or-nothing semantics: if any file can't be locked, all locks
	 * acquired in this batch are released and the conflicts are returned.
	 *
	 * @param toolName - The tool being executed
	 * @param params - The tool's parameters
	 * @param taskId - The ID of the task executing the tool
	 * @param cwd - The working directory for resolving relative paths
	 * @returns Lock acquisition result
	 */
	tryAcquireLocks(
		toolName: ToolName,
		params: Record<string, unknown>,
		taskId: string,
		cwd: string,
	): LockAcquisitionResult {
		if (!this.isWriteTool(toolName)) {
			return { success: true, lockedPaths: [] }
		}

		const relativePaths = extractWriteTargetPaths(toolName, params)

		if (relativePaths.length === 0) {
			return { success: true, lockedPaths: [] }
		}

		// Resolve to absolute paths for consistent locking
		const absolutePaths = relativePaths.map((p) => path.resolve(cwd, p))

		// Sort paths to prevent deadlocks when multiple tools lock multiple files
		const sortedPaths = [...absolutePaths].sort()

		const lockedPaths: string[] = []
		const conflicts: LockConflict[] = []

		for (const absPath of sortedPaths) {
			const acquired = this.lockManager.acquireLock(absPath, taskId)

			if (acquired) {
				lockedPaths.push(absPath)
			} else {
				// Collect conflict info
				const conflict = this.lockManager.getLockConflict(absPath, taskId)
				if (conflict) {
					conflicts.push(conflict)
				}
			}
		}

		// All-or-nothing: if any conflict, release everything we acquired
		if (conflicts.length > 0) {
			for (const locked of lockedPaths) {
				this.lockManager.releaseLock(locked, taskId)
			}
			return { success: false, conflicts, lockedPaths: [] }
		}

		return { success: true, lockedPaths }
	}

	/**
	 * Release locks on the specified paths for a task.
	 * Should be called in a `finally` block after tool execution.
	 */
	releaseLocks(lockedPaths: string[], taskId: string): void {
		for (const absPath of lockedPaths) {
			this.lockManager.releaseLock(absPath, taskId)
		}
	}

	/**
	 * Format a human-readable error message for lock conflicts.
	 * This message is intended to be returned to the LLM so it can
	 * understand why the write was blocked and take corrective action.
	 */
	static formatLockConflictError(conflicts: LockConflict[]): string {
		const lines = ["Cannot write to the following file(s) because they are locked by another task:", ""]

		for (const conflict of conflicts) {
			const heldSec = Math.round(conflict.heldForMs / 1000)
			lines.push(`  - ${conflict.filePath} (locked by task ${conflict.holdingTaskId} for ${heldSec}s)`)
		}

		lines.push("")
		lines.push("Wait for the other task to finish writing, or work on a different file.")

		return lines.join("\n")
	}
}
