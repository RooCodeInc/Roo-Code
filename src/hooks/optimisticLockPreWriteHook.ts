import { getCurrentHash, StaleFileError, validateLock } from "../core/concurrency/OptimisticLock"

import type { HookResult, OptimisticLockContext } from "./types"

export interface OptimisticLockResult extends HookResult {
	currentHash?: string
}

export async function runOptimisticLockPreWriteHook(context: OptimisticLockContext): Promise<OptimisticLockResult> {
	const expectedHash = String(context.expectedHash ?? "").trim()
	if (!expectedHash) {
		return { ok: true }
	}

	const isValid = await validateLock(expectedHash, context.filePath)
	if (isValid) {
		return { ok: true }
	}

	const currentHash = await getCurrentHash(context.filePath).catch(() => "unavailable")
	const error = new StaleFileError(context.filePath, expectedHash, currentHash)
	return {
		ok: false,
		error: error.message,
		currentHash,
	}
}
