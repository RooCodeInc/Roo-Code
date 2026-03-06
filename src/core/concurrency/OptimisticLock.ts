import fs from "fs/promises"

import { hashContent } from "../trace/ContentHasher"

export class StaleFileError extends Error {
	readonly expectedHash: string
	readonly currentHash: string
	readonly filePath: string

	constructor(filePath: string, expectedHash: string, currentHash: string) {
		super(
			`STALE_FILE_ERROR: File '${filePath}' changed since it was last read (expected=${expectedHash}, current=${currentHash}). Re-read the file before applying changes.`,
		)
		this.name = "StaleFileError"
		this.filePath = filePath
		this.expectedHash = expectedHash
		this.currentHash = currentHash
	}
}

export async function getCurrentHash(filePath: string): Promise<string> {
	const content = await fs.readFile(filePath, "utf8")
	return hashContent(content)
}

export async function validateLock(expectedHash: string, filePath: string): Promise<boolean> {
	if (!expectedHash || !expectedHash.trim()) {
		return false
	}

	try {
		const currentHash = await getCurrentHash(filePath)
		return currentHash === expectedHash.trim()
	} catch {
		return false
	}
}
