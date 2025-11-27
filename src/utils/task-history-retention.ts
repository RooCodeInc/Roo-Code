import * as path from "path"
import * as fs from "fs/promises"
import type { Dirent } from "fs"

import { getStorageBasePath } from "./storage"
import { GlobalFileNames } from "../shared/globalFileNames"

/**
 * Allowed retention day values (as numbers).
 */
export type RetentionDays = 90 | 60 | 30 | 7 | 3

/**
 * Supported values for the retention setting.
 * - "never" or 0 disables purging
 * - "90" | "60" | "30" | "7" | "3" (string) or 90 | 60 | 30 | 7 | 3 (number) specify days
 */
export type RetentionSetting = "never" | "0" | `${RetentionDays}` | RetentionDays | 0

export type PurgeResult = {
	purgedCount: number
	cutoff: number | null
}

/**
 * Purge old task directories under <base>/tasks based on task_metadata.json ts value.
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
	logv(`[Retention] Starting purge with retention=${retention} (${days} day(s))${dryRun ? " (dry run)" : ""}`)

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

	logv(`[Retention] Found ${taskDirs.length} task director${taskDirs.length === 1 ? "y" : "ies"} under ${tasksDir}`)

	// Small helpers
	const pathExists = async (p: string): Promise<boolean> => {
		try {
			await fs.access(p)
			return true
		} catch {
			return false
		}
	}

	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

	// Aggressive recursive remove with retries; also directly clears checkpoints if needed
	const removeDirAggressive = async (dir: string): Promise<boolean> => {
		// Try up to 3 passes with short delays
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				await fs.rm(dir, { recursive: true, force: true })
			} catch {
				// ignore and try more targeted cleanup below
			}

			// Verify
			if (!(await pathExists(dir))) return true

			// Targeted cleanup for stubborn checkpoint-only directories
			try {
				await fs.rm(path.join(dir, "checkpoints"), { recursive: true, force: true })
			} catch {
				// ignore
			}

			// Remove children one by one in case some FS impls struggle with rm -r
			try {
				const entries = await fs.readdir(dir, { withFileTypes: true })
				for (const entry of entries) {
					const entryPath = path.join(dir, entry.name)
					try {
						if (entry.isDirectory()) {
							await fs.rm(entryPath, { recursive: true, force: true })
						} else {
							await fs.unlink(entryPath)
						}
					} catch {
						// ignore individual failures; we'll retry the parent
					}
				}
			} catch {
				// ignore
			}

			// Final attempt this pass
			try {
				await fs.rm(dir, { recursive: true, force: true })
			} catch {
				// ignore
			}

			if (!(await pathExists(dir))) return true

			// Backoff a bit before next attempt
			await sleep(50 * attempt)
		}

		return !(await pathExists(dir))
	}

	const results: number[] = []

	for (const d of taskDirs) {
		const taskDir = path.join(tasksDir, d.name)
		const metadataPath = path.join(taskDir, GlobalFileNames.taskMetadata)

		let ts: number | null = null

		// First try to get a timestamp from task_metadata.json (if present)
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
			// Missing or invalid metadata; we'll fall back to directory mtime.
		}

		let shouldDelete = false
		let reason = ""

		// Check for checkpoint-only orphan directories (delete regardless of age)
		try {
			const childEntries = await fs.readdir(taskDir, { withFileTypes: true })
			const visibleNames = childEntries.map((e) => e.name).filter((n) => !n.startsWith("."))
			const hasCheckpointsDir = childEntries.some((e) => e.isDirectory() && e.name === "checkpoints")
			const nonCheckpointVisible = visibleNames.filter((n) => n !== "checkpoints")
			const hasMetadataFile = visibleNames.includes(GlobalFileNames.taskMetadata)
			if (hasCheckpointsDir && nonCheckpointVisible.length === 0 && !hasMetadataFile) {
				shouldDelete = true
				reason = "orphan checkpoints_only"
			}
		} catch {
			// Ignore errors while scanning children; proceed with normal logic
		}

		if (!shouldDelete && ts !== null && ts < cutoff) {
			// Normal case: metadata has a valid ts older than cutoff
			shouldDelete = true
			reason = `ts=${ts}`
		} else if (!shouldDelete) {
			// Orphan/legacy case: no valid ts; fall back to directory mtime
			try {
				const stat = await fs.stat(taskDir)
				const mtimeMs = stat.mtime.getTime()
				if (mtimeMs < cutoff) {
					shouldDelete = true
					reason = `no valid ts, mtime=${stat.mtime.toISOString()}`
				}
			} catch {
				// If we can't stat the directory, skip it.
			}
		}

		if (!shouldDelete) {
			results.push(0)
			continue
		}

		if (dryRun) {
			logv(`[Retention][DRY RUN] Would delete task ${d.name} (${reason}) @ ${taskDir}`)
			results.push(1)
			continue
		}

		// Attempt deletion using provider callback (for full cleanup) or direct rm
		let deletionError: unknown | null = null
		let deleted = false
		try {
			if (deleteTaskById) {
				logv(`[Retention] Deleting task ${d.name} via provider @ ${taskDir} (${reason})`)
				await deleteTaskById(d.name, taskDir)
				// Provider callback handles full cleanup; check if directory is gone
				deleted = !(await pathExists(taskDir))
			} else {
				logv(`[Retention] Deleting task ${d.name} via fs.rm @ ${taskDir} (${reason})`)
				await fs.rm(taskDir, { recursive: true, force: true })
				deleted = !(await pathExists(taskDir))
			}
		} catch (e) {
			deletionError = e
		}

		// If directory still exists after initial attempt, try aggressive cleanup with retries
		if (!deleted) {
			deleted = await removeDirAggressive(taskDir)
		}

		if (!deleted) {
			// Did not actually remove; report the most relevant error
			if (deletionError) {
				log?.(
					`[Retention] Failed to delete task ${d.name} @ ${taskDir}: ${
						deletionError instanceof Error ? deletionError.message : String(deletionError)
					} (directory still present)`,
				)
			} else {
				log?.(
					`[Retention] Failed to delete task ${d.name} @ ${taskDir}: directory still present after cleanup attempts`,
				)
			}
			results.push(0)
			continue
		}

		logv(`[Retention] Deleted task ${d.name} (${reason}) @ ${taskDir}`)
		results.push(1)
	}

	const purged = results.reduce<number>((sum, n) => sum + n, 0)

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
	const n = typeof value === "number" ? value : parseInt(String(value), 10)
	return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}
