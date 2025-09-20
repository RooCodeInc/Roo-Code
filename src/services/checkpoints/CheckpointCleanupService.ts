import fs from "fs/promises"
import path from "path"
import simpleGit, { SimpleGit } from "simple-git"
import { CheckpointConfig, DEFAULT_CHECKPOINT_CONFIG } from "./config"

/**
 * Service for cleaning up old checkpoints based on retention policies
 */
export class CheckpointCleanupService {
	private config: CheckpointConfig
	private cleanupTimer?: NodeJS.Timeout
	private log: (message: string) => void

	constructor(config: Partial<CheckpointConfig> = {}, log: (message: string) => void = console.log) {
		this.config = { ...DEFAULT_CHECKPOINT_CONFIG, ...config }
		this.log = log

		if (this.config.autoCleanup && this.config.cleanupIntervalMinutes) {
			this.startAutoCleanup()
		}
	}

	/**
	 * Start automatic cleanup timer
	 */
	private startAutoCleanup(): void {
		const intervalMs = (this.config.cleanupIntervalMinutes || 60) * 60 * 1000
		this.cleanupTimer = setInterval(() => {
			this.performCleanup().catch((error) => {
				this.log(`[CheckpointCleanupService] Auto cleanup failed: ${error.message}`)
			})
		}, intervalMs)
	}

	/**
	 * Stop automatic cleanup timer
	 */
	public stopAutoCleanup(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer)
			this.cleanupTimer = undefined
		}
	}

	/**
	 * Perform cleanup of old checkpoints based on configured policies
	 */
	public async performCleanup(globalStorageDir?: string): Promise<CleanupResult> {
		const result: CleanupResult = {
			removedCheckpoints: 0,
			freedSpaceMB: 0,
			errors: [],
		}

		if (!globalStorageDir) {
			this.log("[CheckpointCleanupService] No storage directory provided, skipping cleanup")
			return result
		}

		try {
			// Clean up by age
			if (this.config.maxCheckpointAgeDays) {
				const ageResult = await this.cleanupByAge(globalStorageDir, this.config.maxCheckpointAgeDays)
				result.removedCheckpoints += ageResult.removedCheckpoints
				result.freedSpaceMB += ageResult.freedSpaceMB
				result.errors.push(...ageResult.errors)
			}

			// Clean up by count per task
			if (this.config.maxCheckpointsPerTask) {
				const countResult = await this.cleanupByCount(globalStorageDir, this.config.maxCheckpointsPerTask)
				result.removedCheckpoints += countResult.removedCheckpoints
				result.freedSpaceMB += countResult.freedSpaceMB
				result.errors.push(...countResult.errors)
			}

			// Clean up by total size
			if (this.config.maxTotalSizeMB) {
				const sizeResult = await this.cleanupBySize(globalStorageDir, this.config.maxTotalSizeMB)
				result.removedCheckpoints += sizeResult.removedCheckpoints
				result.freedSpaceMB += sizeResult.freedSpaceMB
				result.errors.push(...sizeResult.errors)
			}

			this.log(
				`[CheckpointCleanupService] Cleanup completed: removed ${result.removedCheckpoints} checkpoints, freed ${result.freedSpaceMB.toFixed(2)}MB`,
			)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.log(`[CheckpointCleanupService] Cleanup failed: ${errorMessage}`)
			result.errors.push(errorMessage)
		}

		return result
	}

	/**
	 * Clean up checkpoints older than specified days
	 */
	private async cleanupByAge(globalStorageDir: string, maxAgeDays: number): Promise<CleanupResult> {
		const result: CleanupResult = {
			removedCheckpoints: 0,
			freedSpaceMB: 0,
			errors: [],
		}

		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays)

		try {
			const tasksDir = path.join(globalStorageDir, "tasks")
			const taskDirs = await this.getDirectories(tasksDir)

			for (const taskId of taskDirs) {
				const checkpointsDir = path.join(tasksDir, taskId, "checkpoints")

				if (!(await this.directoryExists(checkpointsDir))) {
					continue
				}

				try {
					const git = simpleGit(checkpointsDir)
					const log = await git.log()

					for (const commit of log.all) {
						const commitDate = new Date(commit.date)
						if (commitDate < cutoffDate) {
							// This commit and all older ones should be removed
							const sizeBeforeKB = await this.getDirectorySizeKB(checkpointsDir)

							// Remove the commit and all its history
							await this.removeCommitAndOlder(git, commit.hash)

							const sizeAfterKB = await this.getDirectorySizeKB(checkpointsDir)
							const freedMB = (sizeBeforeKB - sizeAfterKB) / 1024

							result.removedCheckpoints++
							result.freedSpaceMB += freedMB

							this.log(
								`[CheckpointCleanupService] Removed old checkpoint ${commit.hash} from task ${taskId} (age: ${maxAgeDays} days)`,
							)
						}
					}
				} catch (error) {
					const errorMessage = `Failed to clean task ${taskId}: ${error instanceof Error ? error.message : String(error)}`
					result.errors.push(errorMessage)
					this.log(`[CheckpointCleanupService] ${errorMessage}`)
				}
			}
		} catch (error) {
			const errorMessage = `Failed to clean by age: ${error instanceof Error ? error.message : String(error)}`
			result.errors.push(errorMessage)
		}

		return result
	}

	/**
	 * Clean up excess checkpoints per task
	 */
	private async cleanupByCount(globalStorageDir: string, maxCount: number): Promise<CleanupResult> {
		const result: CleanupResult = {
			removedCheckpoints: 0,
			freedSpaceMB: 0,
			errors: [],
		}

		try {
			const tasksDir = path.join(globalStorageDir, "tasks")
			const taskDirs = await this.getDirectories(tasksDir)

			for (const taskId of taskDirs) {
				const checkpointsDir = path.join(tasksDir, taskId, "checkpoints")

				if (!(await this.directoryExists(checkpointsDir))) {
					continue
				}

				try {
					const git = simpleGit(checkpointsDir)
					const log = await git.log()

					if (log.total > maxCount) {
						// Remove oldest checkpoints
						const toRemove = log.all.slice(maxCount)

						for (const commit of toRemove) {
							const sizeBeforeKB = await this.getDirectorySizeKB(checkpointsDir)

							// Remove the old commit
							await this.removeCommit(git, commit.hash)

							const sizeAfterKB = await this.getDirectorySizeKB(checkpointsDir)
							const freedMB = (sizeBeforeKB - sizeAfterKB) / 1024

							result.removedCheckpoints++
							result.freedSpaceMB += freedMB

							this.log(
								`[CheckpointCleanupService] Removed excess checkpoint ${commit.hash} from task ${taskId} (count limit: ${maxCount})`,
							)
						}
					}
				} catch (error) {
					const errorMessage = `Failed to clean task ${taskId}: ${error instanceof Error ? error.message : String(error)}`
					result.errors.push(errorMessage)
					this.log(`[CheckpointCleanupService] ${errorMessage}`)
				}
			}
		} catch (error) {
			const errorMessage = `Failed to clean by count: ${error instanceof Error ? error.message : String(error)}`
			result.errors.push(errorMessage)
		}

		return result
	}

	/**
	 * Clean up checkpoints when total size exceeds limit
	 */
	private async cleanupBySize(globalStorageDir: string, maxSizeMB: number): Promise<CleanupResult> {
		const result: CleanupResult = {
			removedCheckpoints: 0,
			freedSpaceMB: 0,
			errors: [],
		}

		try {
			const tasksDir = path.join(globalStorageDir, "tasks")
			const checkpointsDir = path.join(globalStorageDir, "checkpoints")

			// Calculate total size
			let totalSizeMB = 0
			if (await this.directoryExists(tasksDir)) {
				totalSizeMB += (await this.getDirectorySizeKB(tasksDir)) / 1024
			}
			if (await this.directoryExists(checkpointsDir)) {
				totalSizeMB += (await this.getDirectorySizeKB(checkpointsDir)) / 1024
			}

			if (totalSizeMB <= maxSizeMB) {
				return result // Within limits
			}

			this.log(
				`[CheckpointCleanupService] Total size ${totalSizeMB.toFixed(2)}MB exceeds limit ${maxSizeMB}MB, cleaning up...`,
			)

			// Get all checkpoints with their timestamps
			const allCheckpoints: CheckpointInfo[] = []

			if (await this.directoryExists(tasksDir)) {
				const taskDirs = await this.getDirectories(tasksDir)
				for (const taskId of taskDirs) {
					const taskCheckpointsDir = path.join(tasksDir, taskId, "checkpoints")
					if (await this.directoryExists(taskCheckpointsDir)) {
						try {
							const git = simpleGit(taskCheckpointsDir)
							const log = await git.log()
							for (const commit of log.all) {
								allCheckpoints.push({
									taskId,
									commitHash: commit.hash,
									date: new Date(commit.date),
									dir: taskCheckpointsDir,
								})
							}
						} catch (error) {
							// Skip this task if we can't read its git log
						}
					}
				}
			}

			// Sort by date (oldest first)
			allCheckpoints.sort((a, b) => a.date.getTime() - b.date.getTime())

			// Remove oldest checkpoints until we're under the limit
			const targetSizeMB = maxSizeMB * 0.8 // Clean to 80% of limit

			for (const checkpoint of allCheckpoints) {
				if (totalSizeMB <= targetSizeMB) {
					break
				}

				try {
					const git = simpleGit(checkpoint.dir)
					const sizeBeforeKB = await this.getDirectorySizeKB(checkpoint.dir)

					await this.removeCommit(git, checkpoint.commitHash)

					const sizeAfterKB = await this.getDirectorySizeKB(checkpoint.dir)
					const freedMB = (sizeBeforeKB - sizeAfterKB) / 1024

					result.removedCheckpoints++
					result.freedSpaceMB += freedMB
					totalSizeMB -= freedMB

					this.log(
						`[CheckpointCleanupService] Removed checkpoint ${checkpoint.commitHash} from task ${checkpoint.taskId} to meet size limit`,
					)
				} catch (error) {
					const errorMessage = `Failed to remove checkpoint ${checkpoint.commitHash}: ${error instanceof Error ? error.message : String(error)}`
					result.errors.push(errorMessage)
				}
			}
		} catch (error) {
			const errorMessage = `Failed to clean by size: ${error instanceof Error ? error.message : String(error)}`
			result.errors.push(errorMessage)
		}

		return result
	}

	/**
	 * Remove a specific commit from git history
	 */
	private async removeCommit(git: SimpleGit, commitHash: string): Promise<void> {
		try {
			// Use git rebase to remove the commit
			await git.raw(["rebase", "--onto", `${commitHash}^`, commitHash, "HEAD"])
		} catch (error) {
			// If rebase fails, try alternative approach
			this.log(`[CheckpointCleanupService] Rebase failed for ${commitHash}, trying alternative approach`)
			// Reset to parent commit
			await git.reset(["--hard", `${commitHash}^`])
		}
	}

	/**
	 * Remove a commit and all older commits
	 */
	private async removeCommitAndOlder(git: SimpleGit, commitHash: string): Promise<void> {
		try {
			// Create a new branch from the commit after the one we want to remove
			const newRoot = `${commitHash}^`
			await git.raw(["checkout", "--orphan", "temp-cleanup"])
			await git.raw(["commit", "--allow-empty", "-m", "Cleanup: removed old checkpoints"])
			await git.raw(["rebase", "--onto", "temp-cleanup", newRoot, "master"])
			await git.checkout("master")
			await git.branch(["-D", "temp-cleanup"])
		} catch (error) {
			this.log(
				`[CheckpointCleanupService] Failed to remove old commits: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Get list of directories in a path
	 */
	private async getDirectories(dirPath: string): Promise<string[]> {
		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })
			return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
		} catch {
			return []
		}
	}

	/**
	 * Check if a directory exists
	 */
	private async directoryExists(dirPath: string): Promise<boolean> {
		try {
			const stat = await fs.stat(dirPath)
			return stat.isDirectory()
		} catch {
			return false
		}
	}

	/**
	 * Get directory size in KB
	 */
	private async getDirectorySizeKB(dirPath: string): Promise<number> {
		let totalSize = 0

		try {
			const files = await fs.readdir(dirPath, { withFileTypes: true })

			for (const file of files) {
				const filePath = path.join(dirPath, file.name)

				if (file.isDirectory()) {
					totalSize += await this.getDirectorySizeKB(filePath)
				} else {
					try {
						const stat = await fs.stat(filePath)
						totalSize += stat.size / 1024 // Convert to KB
					} catch {
						// Skip files we can't stat
					}
				}
			}
		} catch {
			// Return 0 if we can't read the directory
		}

		return totalSize
	}

	/**
	 * Dispose of the cleanup service
	 */
	public dispose(): void {
		this.stopAutoCleanup()
	}
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
	removedCheckpoints: number
	freedSpaceMB: number
	errors: string[]
}

/**
 * Information about a checkpoint
 */
interface CheckpointInfo {
	taskId: string
	commitHash: string
	date: Date
	dir: string
}
