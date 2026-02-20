import crypto from "crypto"
import fs from "fs"
import path from "path"

export interface ConcurrencySnapshot {
	file_path: string
	read_hash: string
	turn_id: string
	timestamp: string
	intent_id?: string
}

export interface StaleFileError {
	type: "STALE_FILE"
	message: string
	file_path: string
	expected_hash: string
	current_hash: string
	resolution: string
}

/**
 * Optimistic locking guard for concurrent file operations.
 * Prevents "lost updates" when multiple agents/turns write to the same file.
 *
 * Strategy:
 * 1. When an agent reads a file, record SHA-256 hash
 * 2. Before write, compare current disk hash with recorded hash
 * 3. If different: block write, return STALE_FILE error, force re-read
 *
 * Benefits:
 * - No distributed locks needed (optimistic)
 * - Detects concurrent modifications
 * - Forces conflict resolution via re-read
 * - Enables parallel agent orchestration safely
 */
export class ConcurrencyGuard {
	private orchestrationDir = ".orchestration"
	private snapshotPath = ".orchestration/concurrency_snapshots.jsonl"
	private sessionSnapshots: Map<string, ConcurrencySnapshot> = new Map()

	constructor() {
		// Ensure orchestration directory exists
		if (!fs.existsSync(this.orchestrationDir)) {
			fs.mkdirSync(this.orchestrationDir, { recursive: true })
		}
		this.loadSnapshots()
	}

	/**
	 * Compute SHA-256 hash of file content
	 */
	static hashContent(content: string): string {
		return crypto.createHash("sha256").update(content, "utf8").digest("hex")
	}

	/**
	 * Record a read snapshot when an agent reads a file
	 * (called at start of agent turn/read_file operation)
	 */
	recordSnapshot(filePath: string, content: string, turnId: string, intentId?: string): ConcurrencySnapshot {
		const readHash = ConcurrencyGuard.hashContent(content)
		const snapshot: ConcurrencySnapshot = {
			file_path: filePath,
			read_hash: readHash,
			turn_id: turnId,
			timestamp: new Date().toISOString(),
			intent_id: intentId,
		}

		// Store in memory map using file path as key
		this.sessionSnapshots.set(filePath, snapshot)

		// Persist to snapshot log
		this.appendSnapshot(snapshot)

		return snapshot
	}

	/**
	 * Verify concurrency before write operation
	 * Returns StaleFileError if current disk hash differs from recorded read hash
	 */
	verifyBeforeWrite(filePath: string): StaleFileError | null {
		// No snapshot recorded for this file (new file, OK to write)
		if (!this.sessionSnapshots.has(filePath)) {
			return null
		}

		// Get recorded snapshot
		const snapshot = this.sessionSnapshots.get(filePath)!
		const expectedHash = snapshot.read_hash

		// Check current file on disk
		let currentContent = ""
		try {
			currentContent = fs.readFileSync(filePath, "utf8")
		} catch {
			// File doesn't exist - OK to write (will create new file)
			return null
		}

		const currentHash = ConcurrencyGuard.hashContent(currentContent)

		// If hashes differ, file is stale - block write
		if (currentHash !== expectedHash) {
			return {
				type: "STALE_FILE",
				message: `File '${filePath}' has been modified since you read it. Your changes cannot be applied to prevent data loss.`,
				file_path: filePath,
				expected_hash: expectedHash,
				current_hash: currentHash,
				resolution:
					"Please re-read the file using the read_file tool to get the latest version, then make your changes again.",
			}
		}

		// Hashes match - file is not stale, OK to write
		return null
	}

	/**
	 * Clear snapshot for a file after successful write
	 */
	clearSnapshot(filePath: string): void {
		this.sessionSnapshots.delete(filePath)
	}

	/**
	 * Clear all snapshots (end of agent turn)
	 */
	clearAllSnapshots(): void {
		this.sessionSnapshots.clear()
	}

	/**
	 * Get snapshot for a file
	 */
	getSnapshot(filePath: string): ConcurrencySnapshot | undefined {
		return this.sessionSnapshots.get(filePath)
	}

	/**
	 * Get all current snapshots
	 */
	getAllSnapshots(): ConcurrencySnapshot[] {
		return Array.from(this.sessionSnapshots.values())
	}

	/**
	 * Append snapshot to persistent log
	 */
	private appendSnapshot(snapshot: ConcurrencySnapshot): void {
		try {
			const line = JSON.stringify(snapshot)
			fs.appendFileSync(this.snapshotPath, line + "\n", "utf8")
		} catch (err) {
			console.warn("Failed to persist concurrency snapshot:", err)
		}
	}

	/**
	 * Load snapshots from persistent log (for recovery)
	 */
	private loadSnapshots(): void {
		try {
			if (!fs.existsSync(this.snapshotPath)) {
				return
			}

			const content = fs.readFileSync(this.snapshotPath, "utf8")
			const lines = content
				.trim()
				.split("\n")
				.filter((line) => line.length > 0)

			for (const line of lines) {
				try {
					const snapshot: ConcurrencySnapshot = JSON.parse(line)
					// Load most recent snapshot for each file
					this.sessionSnapshots.set(snapshot.file_path, snapshot)
				} catch {
					// Ignore malformed lines
				}
			}
		} catch (err) {
			console.warn("Failed to load concurrency snapshots:", err)
		}
	}

	/**
	 * Get all historical snapshots from log
	 */
	readSnapshotLog(): ConcurrencySnapshot[] {
		try {
			if (!fs.existsSync(this.snapshotPath)) {
				return []
			}

			const content = fs.readFileSync(this.snapshotPath, "utf8")
			const lines = content
				.trim()
				.split("\n")
				.filter((line) => line.length > 0)
			const snapshots: ConcurrencySnapshot[] = []

			for (const line of lines) {
				try {
					snapshots.push(JSON.parse(line))
				} catch {
					// Ignore malformed lines
				}
			}

			return snapshots
		} catch (err) {
			console.warn("Failed to read snapshot log:", err)
			return []
		}
	}

	/**
	 * Query snapshots by file path
	 */
	getSnapshotsByFile(filePath: string): ConcurrencySnapshot[] {
		return this.readSnapshotLog().filter((s) => s.file_path === filePath)
	}

	/**
	 * Query snapshots by turn ID
	 */
	getSnapshotsByTurn(turnId: string): ConcurrencySnapshot[] {
		return this.readSnapshotLog().filter((s) => s.turn_id === turnId)
	}

	/**
	 * Query snapshots by intent ID
	 */
	getSnapshotsByIntent(intentId: string): ConcurrencySnapshot[] {
		return this.readSnapshotLog().filter((s) => s.intent_id === intentId)
	}
}
