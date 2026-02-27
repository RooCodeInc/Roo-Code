import crypto from "crypto"

const HASH_PREFIX = "sha256:"

/**
 * Generate a SHA-256 hash of string content (spatial hashing utility).
 * Returns a prefixed hex string (e.g. "sha256:abc123...") for traceability.
 * Content hash remains valid even if line positions change.
 */
export function contentHash(content: string): string {
	const hash = crypto.createHash("sha256").update(content, "utf8").digest("hex")
	return `${HASH_PREFIX}${hash}`
}

/**
 * Alias for contentHash - generates SHA-256 hash of string content.
 * Use for spatial hashing in agent trace and diff operations.
 */
export function sha256Hash(content: string): string {
	return contentHash(content)
}

/**
 * Extract a logical code block (e.g. by line range) and return its hash.
 */
export function contentHashForRange(fullContent: string, startLine: number, endLine: number): string {
	const lines = fullContent.split("\n")
	const slice = lines.slice(Math.max(0, startLine - 1), endLine).join("\n")
	return contentHash(slice)
}
