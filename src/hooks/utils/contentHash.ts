/**
 * Content hashing utility for spatial independence.
 *
 * The key insight: line numbers shift when code is refactored.
 * A SHA-256 hash of the actual content does NOT change with line shifts.
 * This means we can always find and verify a code block even after refactoring.
 */

import crypto from "crypto"

/**
 * Compute a SHA-256 hash of a string content block.
 * Returns the hash as "sha256:<hex>" for clear identification.
 */
export function computeContentHash(content: string): string {
	const hash = crypto.createHash("sha256").update(content, "utf8").digest("hex")
	return `sha256:${hash}`
}

/**
 * Count lines in a string (1-based end line number).
 */
export function countLines(content: string): number {
	return content.split("\n").length
}
