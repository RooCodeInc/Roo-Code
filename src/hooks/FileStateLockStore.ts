import * as crypto from "crypto"
import * as path from "path"

/**
 * In-memory store for optimistic locking: maps file paths to the last-seen content hash.
 * When the agent reads a file, we record the hash. Before write, we compare disk hash to stored hash;
 * if they differ, the file was modified externally (stale) and we block the write.
 */
export class FileStateLockStore {
	private expectedHashes: Map<string, string> = new Map()

	private normalizePath(filePath: string): string {
		let normalized = filePath.replace(/\\/g, "/")
		if (normalized.startsWith("./")) {
			normalized = normalized.slice(2)
		}
		return normalized
	}

	private computeHash(content: string): string {
		return crypto.createHash("sha256").update(Buffer.from(content, "utf-8")).digest("hex")
	}

	/**
	 * Record the content hash for a path after a successful read.
	 * Call this from ReadFileTool after returning content to the agent.
	 */
	record(filePath: string, content: string): void {
		const key = this.normalizePath(filePath)
		this.expectedHashes.set(key, this.computeHash(content))
	}

	getExpectedHash(filePath: string): string | undefined {
		return this.expectedHashes.get(this.normalizePath(filePath))
	}

	/**
	 * Returns true if we have a stored hash and it does not match the current content (stale).
	 */
	checkStale(filePath: string, currentContent: string): boolean {
		const expected = this.getExpectedHash(filePath)
		if (expected === undefined) return false
		return expected !== this.computeHash(currentContent)
	}

	/**
	 * Update stored hash after a successful write so the next write is valid.
	 * Call from PostToolHook after write_to_file / edit_file succeeds.
	 */
	update(filePath: string, content: string): void {
		this.record(filePath, content)
	}

	/**
	 * Clear stored hash for a path (e.g. after delete). Optional.
	 */
	clear(filePath: string): void {
		this.expectedHashes.delete(this.normalizePath(filePath))
	}
}
