/**
 * Hashing utilities for spatial independence
 * SHA-256 content hashing ensures traces remain valid even if lines move
 */
import { createHash } from "crypto"

export function sha256(content: string): string {
	return createHash("sha256").update(content, "utf8").digest("hex")
}

export function computeContentHash(content: string, startLine: number, endLine: number): string {
	const lines = content.split("\n")
	const block = lines.slice(startLine - 1, endLine).join("\n")
	return sha256(block)
}
