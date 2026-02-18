/**
 * Content Hasher - SHA-256 hashing for spatial independence
 * Computes deterministic hashes of code blocks to enable traceability
 * even when line numbers shift due to refactoring
 */

import * as crypto from "crypto"

export class ContentHasher {
	/**
	 * Compute SHA-256 hash of a string block
	 * @param content The code content to hash
	 * @returns SHA-256 hash prefixed with "sha256:"
	 */
	static computeHash(content: string): string {
		const hash = crypto.createHash("sha256").update(content, "utf8").digest("hex")
		return `sha256:${hash}`
	}

	/**
	 * Compute hash of a file's content
	 * @param filePath Path to the file
	 * @returns SHA-256 hash or null if file doesn't exist
	 */
	static async computeFileHash(filePath: string): Promise<string | null> {
		try {
			const fs = await import("fs/promises")
			const content = await fs.readFile(filePath, "utf8")
			return this.computeHash(content)
		} catch (error) {
			return null
		}
	}

	/**
	 * Compute hash of a specific range within a file
	 * @param filePath Path to the file
	 * @param startLine 1-indexed start line
	 * @param endLine 1-indexed end line (inclusive)
	 * @returns SHA-256 hash of the range or null if error
	 */
	static async computeRangeHash(filePath: string, startLine: number, endLine: number): Promise<string | null> {
		try {
			const fs = await import("fs/promises")
			const content = await fs.readFile(filePath, "utf8")
			const lines = content.split("\n")

			// Convert to 0-indexed and extract range
			const rangeLines = lines.slice(startLine - 1, endLine)
			const rangeContent = rangeLines.join("\n")

			return this.computeHash(rangeContent)
		} catch (error) {
			return null
		}
	}

	/**
	 * Verify if a hash matches the current content
	 * @param content Current content
	 * @param expectedHash Expected hash (with or without "sha256:" prefix)
	 * @returns true if hashes match
	 */
	static verifyHash(content: string, expectedHash: string): boolean {
		const computedHash = this.computeHash(content)
		const normalizedExpected = expectedHash.startsWith("sha256:") ? expectedHash : `sha256:${expectedHash}`

		return computedHash === normalizedExpected
	}
}
