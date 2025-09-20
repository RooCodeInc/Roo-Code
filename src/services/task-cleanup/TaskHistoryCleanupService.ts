import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import type { HistoryItem } from "@roo-code/types"
import { getTaskDirectoryPath } from "../../utils/storage"

export interface TaskHistoryCleanupConfig {
	enabled: boolean
	maxCount?: number
	maxDiskSpaceMB?: number
	maxAgeDays?: number
}

export interface CleanupResult {
	deletedCount: number
	freedSpaceMB: number
	errors: string[]
}

/**
 * Service responsible for automatically cleaning up old task history
 * to prevent disk space from expanding rapidly when checkpoints are enabled.
 */
export class TaskHistoryCleanupService {
	private isRunning = false
	private lastCleanupTime = 0
	private readonly MIN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour minimum between cleanups

	constructor(
		private readonly globalStoragePath: string,
		private readonly log: (message: string) => void,
	) {}

	/**
	 * Performs cleanup of task history based on configured thresholds.
	 * This method is idempotent and safe to call multiple times.
	 */
	public async performCleanup(
		taskHistory: HistoryItem[],
		config: TaskHistoryCleanupConfig,
		updateTaskHistory: (history: HistoryItem[]) => Promise<void>,
		deleteTaskWithId: (id: string) => Promise<void>,
	): Promise<CleanupResult> {
		const result: CleanupResult = {
			deletedCount: 0,
			freedSpaceMB: 0,
			errors: [],
		}

		// Skip if cleanup is disabled
		if (!config.enabled) {
			return result
		}

		// Skip if another cleanup is already running
		if (this.isRunning) {
			this.log("[TaskHistoryCleanupService] Cleanup already in progress, skipping")
			return result
		}

		// Skip if we've cleaned up too recently
		const now = Date.now()
		if (now - this.lastCleanupTime < this.MIN_CLEANUP_INTERVAL_MS) {
			this.log("[TaskHistoryCleanupService] Skipping cleanup - too soon since last cleanup")
			return result
		}

		try {
			this.isRunning = true
			this.lastCleanupTime = now
			this.log("[TaskHistoryCleanupService] Starting automatic cleanup")

			// Get current workspace path to avoid deleting tasks from current workspace
			const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

			// Filter tasks that are eligible for deletion (not from current workspace)
			const eligibleTasks = taskHistory.filter((task) => {
				// Keep tasks from current workspace
				if (currentWorkspace && task.workspace === currentWorkspace) {
					return false
				}
				// Keep tasks without timestamps (shouldn't happen but be safe)
				if (!task.ts) {
					return false
				}
				return true
			})

			// Sort tasks by timestamp (oldest first)
			const sortedTasks = [...eligibleTasks].sort((a, b) => (a.ts || 0) - (b.ts || 0))

			const tasksToDelete: HistoryItem[] = []

			// 1. Check age-based cleanup
			if (config.maxAgeDays !== undefined && config.maxAgeDays > 0) {
				const cutoffTime = now - config.maxAgeDays * 24 * 60 * 60 * 1000
				for (const task of sortedTasks) {
					if (task.ts && task.ts < cutoffTime) {
						if (!tasksToDelete.includes(task)) {
							tasksToDelete.push(task)
						}
					}
				}
				this.log(
					`[TaskHistoryCleanupService] Found ${tasksToDelete.length} tasks older than ${config.maxAgeDays} days`,
				)
			}

			// 2. Check count-based cleanup
			if (config.maxCount !== undefined && config.maxCount > 0) {
				const totalCount = taskHistory.length
				if (totalCount > config.maxCount) {
					const countToDelete = totalCount - config.maxCount
					// Delete oldest tasks first
					for (let i = 0; i < Math.min(countToDelete, sortedTasks.length); i++) {
						if (!tasksToDelete.includes(sortedTasks[i])) {
							tasksToDelete.push(sortedTasks[i])
						}
					}
					this.log(
						`[TaskHistoryCleanupService] Task count (${totalCount}) exceeds limit (${config.maxCount}), marking ${countToDelete} for deletion`,
					)
				}
			}

			// 3. Check disk space-based cleanup
			if (config.maxDiskSpaceMB !== undefined && config.maxDiskSpaceMB > 0) {
				const totalSizeMB = await this.calculateTotalTaskSize(taskHistory)
				if (totalSizeMB > config.maxDiskSpaceMB) {
					this.log(
						`[TaskHistoryCleanupService] Total size (${totalSizeMB.toFixed(2)}MB) exceeds limit (${config.maxDiskSpaceMB}MB)`,
					)
					// Delete oldest tasks until we're under the limit
					let currentSizeMB = totalSizeMB
					for (const task of sortedTasks) {
						if (currentSizeMB <= config.maxDiskSpaceMB) {
							break
						}
						if (!tasksToDelete.includes(task)) {
							const taskSizeMB = await this.getTaskSize(task.id)
							tasksToDelete.push(task)
							currentSizeMB -= taskSizeMB
							result.freedSpaceMB += taskSizeMB
						}
					}
				}
			}

			// Delete the identified tasks
			if (tasksToDelete.length > 0) {
				this.log(`[TaskHistoryCleanupService] Deleting ${tasksToDelete.length} tasks`)

				for (const task of tasksToDelete) {
					try {
						// Calculate size before deletion for reporting
						if (result.freedSpaceMB === 0) {
							const sizeMB = await this.getTaskSize(task.id)
							result.freedSpaceMB += sizeMB
						}

						// Delete the task
						await deleteTaskWithId(task.id)
						result.deletedCount++
						this.log(`[TaskHistoryCleanupService] Deleted task ${task.id}`)
					} catch (error) {
						const errorMsg = `Failed to delete task ${task.id}: ${error instanceof Error ? error.message : String(error)}`
						this.log(`[TaskHistoryCleanupService] ${errorMsg}`)
						result.errors.push(errorMsg)
					}
				}

				// Update task history to remove deleted tasks
				const remainingTasks = taskHistory.filter((task) => !tasksToDelete.some((t) => t.id === task.id))
				await updateTaskHistory(remainingTasks)
			}

			this.log(
				`[TaskHistoryCleanupService] Cleanup completed: deleted ${result.deletedCount} tasks, freed ${result.freedSpaceMB.toFixed(2)}MB`,
			)
		} catch (error) {
			const errorMsg = `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`
			this.log(`[TaskHistoryCleanupService] ${errorMsg}`)
			result.errors.push(errorMsg)
		} finally {
			this.isRunning = false
		}

		return result
	}

	/**
	 * Calculates the total disk space used by all tasks in MB
	 */
	private async calculateTotalTaskSize(taskHistory: HistoryItem[]): Promise<number> {
		let totalSizeMB = 0
		for (const task of taskHistory) {
			try {
				const sizeMB = await this.getTaskSize(task.id)
				totalSizeMB += sizeMB
			} catch (error) {
				// Task directory might not exist, skip it
				this.log(
					`[TaskHistoryCleanupService] Could not calculate size for task ${task.id}: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
		return totalSizeMB
	}

	/**
	 * Gets the size of a single task directory in MB
	 */
	private async getTaskSize(taskId: string): Promise<number> {
		try {
			const taskDir = await getTaskDirectoryPath(this.globalStoragePath, taskId)
			const size = await this.getDirectorySize(taskDir)
			return size / (1024 * 1024) // Convert bytes to MB
		} catch (error) {
			return 0
		}
	}

	/**
	 * Recursively calculates the size of a directory in bytes
	 */
	private async getDirectorySize(dirPath: string): Promise<number> {
		let totalSize = 0
		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })
			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name)
				if (entry.isDirectory()) {
					totalSize += await this.getDirectorySize(fullPath)
				} else if (entry.isFile()) {
					const stats = await fs.stat(fullPath)
					totalSize += stats.size
				}
			}
		} catch (error) {
			// Directory might not exist or be inaccessible
			this.log(
				`[TaskHistoryCleanupService] Could not access directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
		return totalSize
	}

	/**
	 * Checks if cleanup should be triggered based on current state and config
	 */
	public shouldTriggerCleanup(taskHistory: HistoryItem[], config: TaskHistoryCleanupConfig): boolean {
		if (!config.enabled) {
			return false
		}

		// Check if enough time has passed since last cleanup
		const now = Date.now()
		if (now - this.lastCleanupTime < this.MIN_CLEANUP_INTERVAL_MS) {
			return false
		}

		// Check count threshold
		if (config.maxCount !== undefined && config.maxCount > 0) {
			if (taskHistory.length > config.maxCount) {
				return true
			}
		}

		// Check age threshold - cleanup if we have old tasks
		if (config.maxAgeDays !== undefined && config.maxAgeDays > 0) {
			const cutoffTime = now - config.maxAgeDays * 24 * 60 * 60 * 1000
			const hasOldTasks = taskHistory.some((task) => task.ts && task.ts < cutoffTime)
			if (hasOldTasks) {
				return true
			}
		}

		// Note: We don't check disk space here as it's expensive to calculate
		// Disk space cleanup will be checked during the actual cleanup process
		return false
	}
}
