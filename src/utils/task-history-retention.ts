import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import type { Dirent } from "fs"
import pLimit from "p-limit"

import { TASK_HISTORY_RETENTION_OPTIONS, type TaskHistoryRetentionSetting } from "@roo-code/types"

import { getStorageBasePath } from "./storage"
import { GlobalFileNames } from "../shared/globalFileNames"
import { t } from "../i18n"

export type RetentionSetting = TaskHistoryRetentionSetting

export type PurgeResult = {
	purgedCount: number
	cutoff: number | null
}

export type CheckpointPurgeResult = {
	culledCount: number
	cutoff: number
}

/** Concurrency limit for parallel metadata reads */
const METADATA_READ_CONCURRENCY = 50

/** Concurrency limit for parallel task deletions */
const DELETION_CONCURRENCY = 10

/** Hardcoded checkpoint retention: 30 days */
const CHECKPOINT_RETENTION_DAYS = 30

/**
 * Task metadata read result for batch processing
 */
interface TaskMetadata {
	taskId: string
	taskDir: string
	ts: number | null
	isOrphan: boolean
	mtime: number | null
}

/**
 * Read metadata for a single task directory.
 * Returns null if the task directory should be skipped.
 */
async function readTaskMetadata(taskId: string, tasksDir: string): Promise<TaskMetadata | null> {
	const taskDir = path.join(tasksDir, taskId)
	const metadataPath = path.join(taskDir, GlobalFileNames.taskMetadata)

	let ts: number | null = null
	let isOrphan = false
	let mtime: number | null = null

	// Try to read metadata file
	try {
		const raw = await fs.readFile(metadataPath, "utf8")
		const meta: unknown = JSON.parse(raw)
		const maybeTs = Number(
			typeof meta === "object" && meta !== null && "ts" in meta ? (meta as { ts: unknown }).ts : undefined,
		)
		if (Number.isFinite(maybeTs)) {
			ts = maybeTs
		}
	} catch {
		// Missing or invalid metadata
	}

	// Check for orphan directories (checkpoint-only) - only if no valid timestamp
	if (ts === null) {
		try {
			const childEntries = await fs.readdir(taskDir, { withFileTypes: true })
			const visibleNames = childEntries.map((e) => e.name).filter((n) => !n.startsWith("."))
			const hasCheckpointsDir = childEntries.some((e) => e.isDirectory() && e.name === "checkpoints")
			const nonCheckpointVisible = visibleNames.filter((n) => n !== "checkpoints")
			const hasMetadataFile = visibleNames.includes(GlobalFileNames.taskMetadata)
			if (hasCheckpointsDir && nonCheckpointVisible.length === 0 && !hasMetadataFile) {
				isOrphan = true
			}
		} catch {
			// Ignore errors
		}

		// Get mtime as fallback for tasks without valid ts
		if (!isOrphan) {
			try {
				const stat = await fs.stat(taskDir)
				mtime = stat.mtime.getTime()
			} catch {
				// Can't stat - skip this task
				return null
			}
		}
	}

	return { taskId, taskDir, ts, isOrphan, mtime }
}

/**
 * Check if path exists
 */
async function pathExists(p: string): Promise<boolean> {
	try {
		await fs.access(p)
		return true
	} catch {
		return false
	}
}

/**
 * Simplified directory removal - one attempt with fallback
 * Removed aggressive retries and sleeps for performance
 */
async function removeDir(dir: string): Promise<boolean> {
	// First attempt: standard recursive remove
	try {
		await fs.rm(dir, { recursive: true, force: true })
	} catch {
		// ignore
	}

	if (!(await pathExists(dir))) return true

	// Fallback: try removing checkpoints first (common stubborn directory)
	try {
		await fs.rm(path.join(dir, "checkpoints"), { recursive: true, force: true })
		await fs.rm(dir, { recursive: true, force: true })
	} catch {
		// ignore
	}

	return !(await pathExists(dir))
}

/**
 * Purge old task directories under <base>/tasks based on task_metadata.json ts value.
 * Optimized for performance with parallel metadata reads and parallel deletions.
 * Executes best-effort deletes; errors are logged and skipped.
 *
 * @param retention Retention setting: "never" | "90" | "60" | "30" | "7" | "3" or number of days
 * @param globalStoragePath VS Code global storage fsPath (context.globalStorageUri.fsPath)
 * @param log Optional logger
 * @param dryRun When true, logs which tasks would be deleted but does not delete anything
 * @returns PurgeResult with count and cutoff used
 */
export async function purgeOldTasks(
	retention: RetentionSetting,
	globalStoragePath: string,
	log?: (message: string) => void,
	dryRun: boolean = false,
	deleteTaskById?: (taskId: string, taskDirPath: string) => Promise<void>,
	verbose: boolean = false,
): Promise<PurgeResult> {
	const days = normalizeDays(retention)
	if (!days) {
		log?.("[Retention] No purge (setting is 'never' or not a positive number)")
		return { purgedCount: 0, cutoff: null }
	}

	const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
	const logv = (msg: string) => {
		if (verbose) log?.(msg)
	}
	logv(
		`[Retention] Starting optimized purge with retention=${retention} (${days} day(s))${dryRun ? " (dry run)" : ""}`,
	)

	let basePath: string

	try {
		basePath = await getStorageBasePath(globalStoragePath)
	} catch (e) {
		log?.(
			`[Retention] Failed to resolve storage base path: ${
				e instanceof Error ? e.message : String(e)
			}${dryRun ? " (dry run)" : ""}`,
		)
		return { purgedCount: 0, cutoff }
	}

	const tasksDir = path.join(basePath, "tasks")

	let entries: Dirent[]
	try {
		entries = await fs.readdir(tasksDir, { withFileTypes: true })
	} catch (e) {
		// No tasks directory yet or unreadable; nothing to purge.
		logv(`[Retention] Tasks directory not found or unreadable at ${tasksDir}${dryRun ? " (dry run)" : ""}`)
		return { purgedCount: 0, cutoff }
	}

	const taskDirs = entries.filter((d) => d.isDirectory())
	const totalTasks = taskDirs.length

	logv(`[Retention] Found ${totalTasks} task director${totalTasks === 1 ? "y" : "ies"} under ${tasksDir}`)

	if (totalTasks === 0) {
		return { purgedCount: 0, cutoff }
	}

	// Phase 1: Batch read all metadata in parallel
	logv(`[Retention] Phase 1: Reading metadata for ${totalTasks} tasks (concurrency: ${METADATA_READ_CONCURRENCY})`)
	const metadataLimit = pLimit(METADATA_READ_CONCURRENCY)

	const metadataResults = await Promise.all(
		taskDirs.map((d) => metadataLimit(() => readTaskMetadata(d.name, tasksDir))),
	)

	// Phase 2: Filter tasks that need deletion
	const tasksToDelete: Array<{ metadata: TaskMetadata; reason: string }> = []

	for (const metadata of metadataResults) {
		if (!metadata) continue

		let shouldDelete = false
		let reason = ""

		// Check orphan directories (delete regardless of age)
		if (metadata.isOrphan) {
			shouldDelete = true
			reason = "orphan checkpoints_only"
		}
		// Check by timestamp
		else if (metadata.ts !== null && metadata.ts < cutoff) {
			shouldDelete = true
			reason = `ts=${metadata.ts}`
		}
		// Check by mtime fallback
		else if (metadata.ts === null && metadata.mtime !== null && metadata.mtime < cutoff) {
			shouldDelete = true
			reason = `no valid ts, mtime=${new Date(metadata.mtime).toISOString()}`
		}

		if (shouldDelete) {
			tasksToDelete.push({ metadata, reason })
		}
	}

	logv(`[Retention] Phase 2: ${tasksToDelete.length} of ${totalTasks} tasks marked for deletion`)

	if (tasksToDelete.length === 0) {
		log?.(`[Retention] No tasks met purge criteria${dryRun ? " (dry run)" : ""}`)
		return { purgedCount: 0, cutoff }
	}

	// Phase 3: Delete tasks in parallel
	if (dryRun) {
		for (const { metadata, reason } of tasksToDelete) {
			logv(`[Retention][DRY RUN] Would delete task ${metadata.taskId} (${reason}) @ ${metadata.taskDir}`)
		}
		log?.(
			`[Retention] Would purge ${tasksToDelete.length} task(s) (dry run); cutoff=${new Date(cutoff).toISOString()}`,
		)
		return { purgedCount: tasksToDelete.length, cutoff }
	}

	logv(`[Retention] Phase 3: Deleting ${tasksToDelete.length} tasks (concurrency: ${DELETION_CONCURRENCY})`)
	const deleteLimit = pLimit(DELETION_CONCURRENCY)

	const deleteResults = await Promise.all(
		tasksToDelete.map(({ metadata, reason }) =>
			deleteLimit(async (): Promise<boolean> => {
				let deleted = false

				try {
					if (deleteTaskById) {
						logv(
							`[Retention] Deleting task ${metadata.taskId} via provider @ ${metadata.taskDir} (${reason})`,
						)
						await deleteTaskById(metadata.taskId, metadata.taskDir)
						deleted = !(await pathExists(metadata.taskDir))
					} else {
						logv(`[Retention] Deleting task ${metadata.taskId} via fs.rm @ ${metadata.taskDir} (${reason})`)
						await fs.rm(metadata.taskDir, { recursive: true, force: true })
						deleted = !(await pathExists(metadata.taskDir))
					}
				} catch (e) {
					// Primary deletion failed, try fallback
					logv(
						`[Retention] Primary deletion failed for ${metadata.taskId}: ${
							e instanceof Error ? e.message : String(e)
						}`,
					)
				}

				// Fallback: simplified removal
				if (!deleted) {
					deleted = await removeDir(metadata.taskDir)
				}

				if (!deleted) {
					log?.(
						`[Retention] Failed to delete task ${metadata.taskId} @ ${metadata.taskDir}: directory still present`,
					)
				} else {
					logv(`[Retention] Deleted task ${metadata.taskId} (${reason}) @ ${metadata.taskDir}`)
				}

				return deleted
			}),
		),
	)

	const purged = deleteResults.filter(Boolean).length

	if (purged > 0) {
		log?.(
			`[Retention] Purged ${purged} task(s)${dryRun ? " (dry run)" : ""}; cutoff=${new Date(cutoff).toISOString()}`,
		)
	} else {
		log?.(`[Retention] No tasks met purge criteria${dryRun ? " (dry run)" : ""}`)
	}

	return { purgedCount: purged, cutoff }
}

/**
 * Normalize retention into a positive integer day count or 0 (no-op).
 */
function normalizeDays(value: RetentionSetting): number {
	if (value === "never") return 0
	const n = parseInt(value, 10)
	return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

/**
 * Options for starting the background retention purge.
 */
export interface BackgroundPurgeOptions {
	/** VS Code global storage fsPath */
	globalStoragePath: string
	/** Logger function */
	log: (message: string) => void
	/** Function to delete a task by ID (should use ClineProvider.deleteTaskWithId for full cleanup) */
	deleteTaskById: (taskId: string, taskDirPath: string) => Promise<void>
	/** Retention setting value from Roo application state */
	retention: RetentionSetting
}

/**
 * Starts the task history retention purge in the background.
 * This function is designed to be called after extension activation completes,
 * using a fire-and-forget pattern (void) to avoid blocking activation.
 *
 * It reads the retention setting from Roo application state, executes the purge,
 * and shows a notification if tasks were deleted.
 *
 * @param options Configuration options for the background purge
 */
export function startBackgroundRetentionPurge(options: BackgroundPurgeOptions): void {
	const { globalStoragePath, log, deleteTaskById, retention } = options

	void (async () => {
		try {
			// Skip if retention is disabled
			if (retention === "never") {
				log("[Retention] Background purge skipped: retention is set to 'never'")
				return
			}

			if (!TASK_HISTORY_RETENTION_OPTIONS.includes(retention)) {
				log(`[Retention] Background purge skipped: invalid retention value '${retention}'`)
				return
			}

			log(`[Retention] Starting background purge: setting=${retention}`)

			const result = await purgeOldTasks(retention, globalStoragePath, log, false, deleteTaskById)

			log(
				`[Retention] Background purge complete: purged=${result.purgedCount}, cutoff=${result.cutoff ?? "none"}`,
			)

			// Show user notification if tasks were deleted
			if (result.purgedCount > 0) {
				const message = t("common:taskHistoryRetention.purgeNotification", {
					count: result.purgedCount,
					days: retention,
				})

				vscode.window.showInformationMessage(message)
			}
		} catch (error) {
			log(`[Retention] Failed during background purge: ${error instanceof Error ? error.message : String(error)}`)
		}
	})()
}

/**
 * Metadata result for checkpoint culling - simplified from TaskMetadata
 */
interface CheckpointTaskMetadata {
	taskId: string
	taskDir: string
	checkpointsDir: string
	lastActivity: number | null // ts or mtime
}

/**
 * Read metadata for checkpoint culling - only needs task age, not orphan detection
 */
async function readCheckpointTaskMetadata(taskId: string, tasksDir: string): Promise<CheckpointTaskMetadata | null> {
	const taskDir = path.join(tasksDir, taskId)
	const checkpointsDir = path.join(taskDir, "checkpoints")

	// First check if checkpoints directory exists
	if (!(await pathExists(checkpointsDir))) {
		return null // No checkpoints to cull
	}

	const metadataPath = path.join(taskDir, GlobalFileNames.taskMetadata)
	let lastActivity: number | null = null

	// Try to read timestamp from metadata file
	try {
		const raw = await fs.readFile(metadataPath, "utf8")
		const meta: unknown = JSON.parse(raw)
		const maybeTs = Number(
			typeof meta === "object" && meta !== null && "ts" in meta ? (meta as { ts: unknown }).ts : undefined,
		)
		if (Number.isFinite(maybeTs)) {
			lastActivity = maybeTs
		}
	} catch {
		// Missing or invalid metadata
	}

	// Fallback to mtime if no valid ts
	if (lastActivity === null) {
		try {
			const stat = await fs.stat(taskDir)
			lastActivity = stat.mtime.getTime()
		} catch {
			// Can't determine age - skip this task
			return null
		}
	}

	return { taskId, taskDir, checkpointsDir, lastActivity }
}

/**
 * Cull checkpoints from tasks that haven't been touched in CHECKPOINT_RETENTION_DAYS.
 * This is a non-configurable, always-on feature that removes only the checkpoints/
 * subdirectory while preserving the task itself (conversation history, metadata).
 *
 * @param globalStoragePath VS Code global storage fsPath
 * @param log Optional logger
 * @param dryRun When true, logs which checkpoints would be deleted but does not delete
 * @returns CheckpointPurgeResult with count and cutoff used
 */
export async function purgeOldCheckpoints(
	globalStoragePath: string,
	log?: (message: string) => void,
	dryRun: boolean = false,
): Promise<CheckpointPurgeResult> {
	const cutoff = Date.now() - CHECKPOINT_RETENTION_DAYS * 24 * 60 * 60 * 1000

	log?.(`[Checkpoints] Starting checkpoint cull (${CHECKPOINT_RETENTION_DAYS} days)${dryRun ? " (dry run)" : ""}`)

	let basePath: string

	try {
		basePath = await getStorageBasePath(globalStoragePath)
	} catch (e) {
		log?.(`[Checkpoints] Failed to resolve storage base path: ${e instanceof Error ? e.message : String(e)}`)
		return { culledCount: 0, cutoff }
	}

	const tasksDir = path.join(basePath, "tasks")

	let entries: Dirent[]
	try {
		entries = await fs.readdir(tasksDir, { withFileTypes: true })
	} catch {
		// No tasks directory yet or unreadable
		log?.(`[Checkpoints] Tasks directory not found or unreadable`)
		return { culledCount: 0, cutoff }
	}

	const taskDirs = entries.filter((d) => d.isDirectory())
	const totalTasks = taskDirs.length

	if (totalTasks === 0) {
		log?.(`[Checkpoints] No tasks found`)
		return { culledCount: 0, cutoff }
	}

	log?.(`[Checkpoints] Scanning ${totalTasks} tasks for old checkpoints...`)

	// Phase 1: Read metadata for all tasks with checkpoints
	const metadataLimit = pLimit(METADATA_READ_CONCURRENCY)
	const metadataResults = await Promise.all(
		taskDirs.map((d) => metadataLimit(() => readCheckpointTaskMetadata(d.name, tasksDir))),
	)

	// Count tasks that have checkpoints
	const tasksWithCheckpoints = metadataResults.filter((m) => m !== null).length
	log?.(`[Checkpoints] Found ${tasksWithCheckpoints} tasks with checkpoints`)

	// Phase 2: Filter tasks with checkpoints that need culling
	const tasksToCull: CheckpointTaskMetadata[] = []

	for (const metadata of metadataResults) {
		if (!metadata) continue

		// Check if task is older than cutoff
		if (metadata.lastActivity !== null && metadata.lastActivity < cutoff) {
			tasksToCull.push(metadata)
		}
	}

	if (tasksToCull.length === 0) {
		log?.(`[Checkpoints] No checkpoints older than 30 days`)
		return { culledCount: 0, cutoff }
	}

	log?.(`[Checkpoints] ${tasksToCull.length} tasks have checkpoints older than 30 days`)

	// Dry run mode
	if (dryRun) {
		for (const metadata of tasksToCull) {
			log?.(
				`[Checkpoints][DRY RUN] Would cull checkpoints for task ${metadata.taskId} (last activity: ${new Date(metadata.lastActivity!).toISOString()})`,
			)
		}
		log?.(`[Checkpoints] Would cull checkpoints from ${tasksToCull.length} task(s) (dry run)`)
		return { culledCount: tasksToCull.length, cutoff }
	}

	// Phase 3: Delete checkpoints directories in parallel
	log?.(`[Checkpoints] Deleting checkpoints from ${tasksToCull.length} tasks...`)
	const deleteLimit = pLimit(DELETION_CONCURRENCY)
	let deletedCount = 0

	const deleteResults = await Promise.all(
		tasksToCull.map((metadata) =>
			deleteLimit(async (): Promise<boolean> => {
				try {
					await fs.rm(metadata.checkpointsDir, { recursive: true, force: true })
					const stillExists = await pathExists(metadata.checkpointsDir)
					if (!stillExists) {
						deletedCount++
						// Log progress every 100 deletions
						if (deletedCount % 100 === 0) {
							log?.(`[Checkpoints] Progress: ${deletedCount}/${tasksToCull.length} deleted`)
						}
						return true
					}
				} catch {
					// Ignore errors
				}
				return false
			}),
		),
	)

	const culled = deleteResults.filter(Boolean).length

	if (culled > 0) {
		log?.(`[Checkpoints] Culled checkpoints from ${culled} task(s)`)
	}

	return { culledCount: culled, cutoff }
}

/**
 * Options for starting the background checkpoint purge.
 */
export interface BackgroundCheckpointPurgeOptions {
	/** VS Code global storage fsPath */
	globalStoragePath: string
	/** Logger function */
	log: (message: string) => void
}

/**
 * Starts the checkpoint culling in the background.
 * This function is designed to be called after extension activation completes,
 * using a fire-and-forget pattern (void) to avoid blocking activation.
 *
 * Checkpoints are culled from tasks that haven't been touched in 30 days.
 * This is non-configurable and always runs.
 *
 * @param options Configuration options for the background checkpoint purge
 */
export function startBackgroundCheckpointPurge(options: BackgroundCheckpointPurgeOptions): void {
	const { globalStoragePath, log } = options

	void (async () => {
		try {
			log(`[Checkpoints] Starting background checkpoint cull (${CHECKPOINT_RETENTION_DAYS} days)`)

			const result = await purgeOldCheckpoints(globalStoragePath, log, false)

			log(
				`[Checkpoints] Background checkpoint cull complete: culled=${result.culledCount}, cutoff=${new Date(result.cutoff).toISOString()}`,
			)

			// No user notification - silent operation as requested
		} catch (error) {
			log(
				`[Checkpoints] Failed during background checkpoint cull: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	})()
}
