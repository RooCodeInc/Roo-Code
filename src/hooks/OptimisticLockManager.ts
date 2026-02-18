/**
 * Optimistic Lock Manager - Detects concurrent file modifications
 * Prevents write conflicts when multiple agents edit the same file
 */

import { ContentHasher } from "./ContentHasher"
import { FileHash } from "./types"

export class OptimisticLockManager {
	private baselineHashes: Map<string, FileHash> = new Map()

	/**
	 * Record baseline hash when agent starts working on a file
	 * @param filePath Absolute path to the file
	 * @returns The recorded hash or null if file doesn't exist
	 */
	async recordBaseline(filePath: string): Promise<string | null> {
		const hash = await ContentHasher.computeFileHash(filePath)
		if (hash) {
			this.baselineHashes.set(filePath, {
				path: filePath,
				hash,
				timestamp: Date.now(),
			})
		}
		return hash
	}

	/**
	 * Check if file has been modified since baseline was recorded
	 * @param filePath Absolute path to the file
	 * @returns Object with collision flag and error message if detected
	 */
	async checkForCollision(filePath: string): Promise<{ hasCollision: boolean; error?: string }> {
		const baseline = this.baselineHashes.get(filePath)
		if (!baseline) {
			// No baseline recorded, allow write
			return { hasCollision: false }
		}

		const currentHash = await ContentHasher.computeFileHash(filePath)
		if (!currentHash) {
			// File was deleted, clear baseline and allow
			this.baselineHashes.delete(filePath)
			return { hasCollision: false }
		}

		if (currentHash !== baseline.hash) {
			const timeSinceBaseline = Date.now() - baseline.timestamp
			const minutesAgo = Math.floor(timeSinceBaseline / 60000)

			return {
				hasCollision: true,
				error: `Stale File Detected: "${filePath}" was modified by another agent or user since you last read it (${minutesAgo} minute(s) ago).\n\nBaseline hash: ${baseline.hash}\nCurrent hash:  ${currentHash}\n\nTo resolve this conflict:\n1. Re-read the file to get the latest content\n2. Recalculate your changes based on the new content\n3. Retry the write operation\n\nThis protection prevents overwriting concurrent changes.`,
			}
		}

		return { hasCollision: false }
	}

	/**
	 * Update baseline hash after successful write
	 * @param filePath Absolute path to the file
	 */
	async updateBaseline(filePath: string): Promise<void> {
		const hash = await ContentHasher.computeFileHash(filePath)
		if (hash) {
			this.baselineHashes.set(filePath, {
				path: filePath,
				hash,
				timestamp: Date.now(),
			})
		}
	}

	/**
	 * Clear baseline for a specific file
	 * @param filePath Absolute path to the file
	 */
	clearBaseline(filePath: string): void {
		this.baselineHashes.delete(filePath)
	}

	/**
	 * Clear all baselines (e.g., when task completes)
	 */
	clearAll(): void {
		this.baselineHashes.clear()
	}

	/**
	 * Get all files with recorded baselines
	 * @returns Array of file paths
	 */
	getTrackedFiles(): string[] {
		return Array.from(this.baselineHashes.keys())
	}

	/**
	 * Get baseline info for a file
	 * @param filePath Absolute path to the file
	 * @returns FileHash object or undefined
	 */
	getBaseline(filePath: string): FileHash | undefined {
		return this.baselineHashes.get(filePath)
	}
}
