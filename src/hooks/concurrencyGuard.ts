import crypto from "crypto"
import fs from "fs/promises"

const readSnapshotByTaskFile = new Map<string, string>()

function toKey(taskId: string, absolutePath: string): string {
	return `${taskId}::${absolutePath}`
}

export function sha256(input: string): string {
	return crypto.createHash("sha256").update(input, "utf-8").digest("hex")
}

export async function hashFileContent(absolutePath: string): Promise<string | null> {
	try {
		const content = await fs.readFile(absolutePath, "utf-8")
		return sha256(content)
	} catch (error: any) {
		if (error?.code === "ENOENT") {
			return null
		}
		throw error
	}
}

export async function captureReadSnapshot(taskId: string, absolutePath: string): Promise<string | null> {
	const hash = await hashFileContent(absolutePath)
	if (hash) {
		readSnapshotByTaskFile.set(toKey(taskId, absolutePath), hash)
	}
	return hash
}

export async function validateWriteFreshness(
	taskId: string,
	absolutePath: string,
	providedReadHash?: string,
): Promise<{ ok: boolean; expectedHash: string | null; actualHash: string | null }> {
	const expectedHash = providedReadHash ?? readSnapshotByTaskFile.get(toKey(taskId, absolutePath)) ?? null
	const actualHash = await hashFileContent(absolutePath)

	if (!expectedHash || expectedHash === actualHash) {
		return { ok: true, expectedHash, actualHash }
	}
	return { ok: false, expectedHash, actualHash }
}

export async function markWriteSnapshot(taskId: string, absolutePath: string): Promise<string | null> {
	const hash = await hashFileContent(absolutePath)
	if (hash) {
		readSnapshotByTaskFile.set(toKey(taskId, absolutePath), hash)
	}
	return hash
}
