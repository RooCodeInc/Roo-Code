import crypto from "crypto"

const HASH_PREFIX = "sha256:"

/**
 * Compute a SHA-256 content hash for spatial independence.
 * If lines move, the hash of the content block remains valid.
 */
export function contentHash(content: string): string {
	const hash = crypto.createHash("sha256").update(content, "utf8").digest("hex")
	return `${HASH_PREFIX}${hash}`
}

/**
 * Extract a logical code block (e.g. by line range) and return its hash.
 */
export function contentHashForRange(fullContent: string, startLine: number, endLine: number): string {
	const lines = fullContent.split("\n")
	const slice = lines.slice(Math.max(0, startLine - 1), endLine).join("\n")
	return contentHash(slice)
}
