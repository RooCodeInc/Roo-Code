import * as crypto from "crypto"

export function generateContentHash(content: string): string {
	return crypto.createHash("sha256").update(content, "utf8").digest("hex")
}

export function generateBlockHash(content: string, startLine: number, endLine: number): string {
	const lines = content.split("\n")
	const blockContent = lines.slice(startLine - 1, endLine).join("\n")
	return generateContentHash(blockContent)
}
