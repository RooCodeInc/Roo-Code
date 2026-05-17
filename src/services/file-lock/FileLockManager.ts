import path from "path"

/**
 * Information about a file lock held by a task.
 */
export interface FileLockInfo {
	/** Absolute normalized path of the locked file */
	filePath: string
	/** ID of the task holding the lock */
	taskId: string
	/** Timestamp (ms) when the lock was acquired */
	acquiredAt: number
}

/**
 * Result returned when a lock acquisition attempt fails.
 */
export interface LockConflict {
	/** The file that is already locked */
	filePath: string
	/** The task that currently holds the lock */
	holdingTaskId: string
	/** How long (ms) the lock has been held */
	heldForMs: number
}

/**
 * Events emitted by the FileLockManager.
 */
export type FileLockEvent =
	| { type: "lock-acquired"; filePath: string; taskId: string }
	| { type: "lock-released"; filePath: string; taskId: string }
	| { type: "lock-expired"; filePath: string; taskId: string }
	| { type: "all-locks-released"; taskId: string; count: number }

export type FileLockEventListener = (event: FileLockEvent) => void

export interface FileLockManagerOptions {
	/**
	 * Maximum duration (ms) a lock can be held before it is forcibly released.
	 * Default: 120_000 (2 minutes).
	 */
	lockTimeoutMs?: number
}

const DEFAULT_LOCK_TIMEOUT_MS = 120_000

/**
 * Advisory file-level lock manager for coordinating writes across concurrent tasks.
 *
 * Locks are "advisory" -- they do not use OS-level file locks. Instead, the
 * tool execution layer checks the lock manager before allowing write operations.
 * This keeps the system portable and testable.
 *
 * All file paths are normalized to absolute paths using `path.resolve` before
 * being used as map keys, ensuring consistent lookup regardless of how the
 * path is specified (relative, absolute, trailing slashes, etc.).
 */
export class FileLockManager {
	/**
	 * Map from normalized absolute file path to lock info.
	 */
	private locks = new Map<string, FileLockInfo>()

	/**
	 * Reverse index: taskId -> set of normalized file paths locked by that task.
	 */
	private taskLocks = new Map<string, Set<string>>()

	/**
	 * Event listeners.
	 */
	private listeners: FileLockEventListener[] = []

	/**
	 * Maximum lock hold duration in milliseconds.
	 */
	private readonly lockTimeoutMs: number

	constructor(options?: FileLockManagerOptions) {
		this.lockTimeoutMs = options?.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS
	}

	/**
	 * Attempt to acquire a write lock on a file for a specific task.
	 *
	 * If the file is already locked by the same task, refreshes the timestamp
	 * and returns true (re-entrant). If locked by a different task, checks
	 * for expiration first -- if the existing lock has expired it is forcibly
	 * released before granting the new lock.
	 *
	 * @returns `true` if the lock was acquired, `false` if another task holds it.
	 */
	acquireLock(filePath: string, taskId: string): boolean {
		const normalized = this.normalizePath(filePath)
		const existing = this.locks.get(normalized)

		if (existing) {
			// Re-entrant: same task already holds the lock -- refresh timestamp
			if (existing.taskId === taskId) {
				existing.acquiredAt = Date.now()
				return true
			}

			// Check if the existing lock has expired
			if (this.isLockExpired(existing)) {
				this.forceReleaseLock(normalized, existing.taskId)
			} else {
				return false
			}
		}

		// Acquire the lock
		const lockInfo: FileLockInfo = {
			filePath: normalized,
			taskId,
			acquiredAt: Date.now(),
		}

		this.locks.set(normalized, lockInfo)

		let taskSet = this.taskLocks.get(taskId)
		if (!taskSet) {
			taskSet = new Set()
			this.taskLocks.set(taskId, taskSet)
		}
		taskSet.add(normalized)

		this.emit({ type: "lock-acquired", filePath: normalized, taskId })
		return true
	}

	/**
	 * Release a lock held by a specific task.
	 * No-op if the task does not hold the lock.
	 */
	releaseLock(filePath: string, taskId: string): void {
		const normalized = this.normalizePath(filePath)
		const existing = this.locks.get(normalized)

		if (!existing || existing.taskId !== taskId) {
			return
		}

		this.locks.delete(normalized)

		const taskSet = this.taskLocks.get(taskId)
		if (taskSet) {
			taskSet.delete(normalized)
			if (taskSet.size === 0) {
				this.taskLocks.delete(taskId)
			}
		}

		this.emit({ type: "lock-released", filePath: normalized, taskId })
	}

	/**
	 * Release all locks held by a specific task.
	 * Called when a task completes, is cancelled, or errors out.
	 */
	releaseAllLocks(taskId: string): void {
		const taskSet = this.taskLocks.get(taskId)
		if (!taskSet || taskSet.size === 0) {
			this.taskLocks.delete(taskId)
			return
		}

		const count = taskSet.size

		for (const normalized of taskSet) {
			this.locks.delete(normalized)
		}

		this.taskLocks.delete(taskId)

		this.emit({ type: "all-locks-released", taskId, count })
	}

	/**
	 * Check which task (if any) holds the lock on a file.
	 * Checks for expiration -- if the lock is expired, it is released and
	 * `undefined` is returned.
	 *
	 * @returns The taskId of the lock holder, or `undefined` if unlocked.
	 */
	getLockHolder(filePath: string): string | undefined {
		const normalized = this.normalizePath(filePath)
		const existing = this.locks.get(normalized)

		if (!existing) {
			return undefined
		}

		if (this.isLockExpired(existing)) {
			this.forceReleaseLock(normalized, existing.taskId)
			return undefined
		}

		return existing.taskId
	}

	/**
	 * Get detailed lock info for a file, or undefined if not locked.
	 * Checks for expiration.
	 */
	getLockInfo(filePath: string): FileLockInfo | undefined {
		const normalized = this.normalizePath(filePath)
		const existing = this.locks.get(normalized)

		if (!existing) {
			return undefined
		}

		if (this.isLockExpired(existing)) {
			this.forceReleaseLock(normalized, existing.taskId)
			return undefined
		}

		return { ...existing }
	}

	/**
	 * Get the conflict details when a lock acquisition would fail.
	 * Returns undefined if the file is not locked by another task.
	 */
	getLockConflict(filePath: string, taskId: string): LockConflict | undefined {
		const normalized = this.normalizePath(filePath)
		const existing = this.locks.get(normalized)

		if (!existing || existing.taskId === taskId) {
			return undefined
		}

		if (this.isLockExpired(existing)) {
			this.forceReleaseLock(normalized, existing.taskId)
			return undefined
		}

		return {
			filePath: normalized,
			holdingTaskId: existing.taskId,
			heldForMs: Date.now() - existing.acquiredAt,
		}
	}

	/**
	 * List all files currently locked by a specific task.
	 */
	getLockedFiles(taskId: string): string[] {
		const taskSet = this.taskLocks.get(taskId)
		if (!taskSet) {
			return []
		}
		return Array.from(taskSet)
	}

	/**
	 * Get all currently held locks. Primarily for debugging/UI display.
	 * Expired locks are cleaned up during this call.
	 */
	getAllLocks(): FileLockInfo[] {
		const result: FileLockInfo[] = []
		const expired: Array<{ normalized: string; taskId: string }> = []

		for (const [normalized, info] of this.locks) {
			if (this.isLockExpired(info)) {
				expired.push({ normalized, taskId: info.taskId })
			} else {
				result.push({ ...info })
			}
		}

		// Clean up expired locks
		for (const { normalized, taskId } of expired) {
			this.forceReleaseLock(normalized, taskId)
		}

		return result
	}

	/**
	 * Get the total number of active locks.
	 */
	get lockCount(): number {
		return this.locks.size
	}

	/**
	 * Register an event listener.
	 */
	onEvent(listener: FileLockEventListener): void {
		this.listeners.push(listener)
	}

	/**
	 * Remove an event listener.
	 */
	offEvent(listener: FileLockEventListener): void {
		const idx = this.listeners.indexOf(listener)
		if (idx !== -1) {
			this.listeners.splice(idx, 1)
		}
	}

	/**
	 * Clear all locks and listeners. Primarily for testing.
	 */
	dispose(): void {
		this.locks.clear()
		this.taskLocks.clear()
		this.listeners = []
	}

	// --- Private helpers ---

	private normalizePath(filePath: string): string {
		return path.resolve(filePath)
	}

	private isLockExpired(info: FileLockInfo): boolean {
		return Date.now() - info.acquiredAt > this.lockTimeoutMs
	}

	private forceReleaseLock(normalized: string, taskId: string): void {
		this.locks.delete(normalized)

		const taskSet = this.taskLocks.get(taskId)
		if (taskSet) {
			taskSet.delete(normalized)
			if (taskSet.size === 0) {
				this.taskLocks.delete(taskId)
			}
		}

		this.emit({ type: "lock-expired", filePath: normalized, taskId })
	}

	private emit(event: FileLockEvent): void {
		for (const listener of this.listeners) {
			try {
				listener(event)
			} catch {
				// Swallow listener errors to avoid breaking lock operations
			}
		}
	}
}
