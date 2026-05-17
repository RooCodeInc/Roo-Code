export {
	FileLockManager,
	type FileLockManagerOptions,
	type FileLockInfo,
	type LockConflict,
	type FileLockEvent,
	type FileLockEventListener,
} from "./FileLockManager"

export {
	LockGuardedToolExecutor,
	extractWriteTargetPaths,
	WRITE_TOOL_NAMES,
	type LockAcquisitionResult,
} from "./LockGuardedToolExecutor"

import { FileLockManager } from "./FileLockManager"
import { LockGuardedToolExecutor } from "./LockGuardedToolExecutor"

/**
 * Module-level singleton instances for the file lock subsystem.
 * Lazily initialized on first access.
 */
let _fileLockManager: FileLockManager | undefined
let _lockGuardedToolExecutor: LockGuardedToolExecutor | undefined

/**
 * Get the singleton FileLockManager instance.
 * Creates it on first call.
 */
export function getFileLockManager(): FileLockManager {
	if (!_fileLockManager) {
		_fileLockManager = new FileLockManager()
	}
	return _fileLockManager
}

/**
 * Get the singleton LockGuardedToolExecutor instance.
 * Creates it (and the underlying FileLockManager) on first call.
 */
export function getLockGuardedToolExecutor(): LockGuardedToolExecutor {
	if (!_lockGuardedToolExecutor) {
		_lockGuardedToolExecutor = new LockGuardedToolExecutor(getFileLockManager())
	}
	return _lockGuardedToolExecutor
}

/**
 * Reset singleton instances. Intended for testing only.
 */
export function resetFileLockSingletons(): void {
	if (_fileLockManager) {
		_fileLockManager.dispose()
	}
	_fileLockManager = undefined
	_lockGuardedToolExecutor = undefined
}
