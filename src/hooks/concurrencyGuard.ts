import crypto from "crypto"
import fs from "fs/promises"
import fsSync from "fs"

const SESSION_ID = crypto.randomUUID()
const readSnapshotBySessionTaskFile = new Map<string, string>()

function toKey(taskId: string, absolutePath: string): string {
	return `${SESSION_ID}::${taskId}::${absolutePath}`
}

export function sha256(input: string): string {
	return crypto.createHash("sha256").update(input, "utf-8").digest("hex")
}

async function streamHashFile(absolutePath: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const hash = crypto.createHash("sha256")
		const stream = fsSync.createReadStream(absolutePath, { highWaterMark: 1024 * 1024 })
		stream.on("data", (chunk) => hash.update(chunk))
		stream.on("error", reject)
		stream.on("end", () => resolve(hash.digest("hex")))
	})
}

export async function hashFileContent(absolutePath: string): Promise<string | null> {
	try {
		return await streamHashFile(absolutePath)
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
		readSnapshotBySessionTaskFile.set(toKey(taskId, absolutePath), hash)
	}
	return hash
}

export async function readFileContentSafe(absolutePath: string): Promise<string | null> {
	try {
		return await fs.readFile(absolutePath, "utf-8")
	} catch (error: any) {
		if (error?.code === "ENOENT") {
			return null
		}
		throw error
	}
}

export async function validateWriteFreshness(
	taskId: string,
	absolutePath: string,
	providedReadHash?: string,
): Promise<{ ok: boolean; expectedHash: string | null; actualHash: string | null }> {
	const expectedHash = providedReadHash ?? readSnapshotBySessionTaskFile.get(toKey(taskId, absolutePath)) ?? null
	const actualHash = await hashFileContent(absolutePath)

	if (!expectedHash || expectedHash === actualHash) {
		return { ok: true, expectedHash, actualHash }
	}
	return { ok: false, expectedHash, actualHash }
}

export async function markWriteSnapshot(taskId: string, absolutePath: string): Promise<string | null> {
	const hash = await hashFileContent(absolutePath)
	if (hash) {
		readSnapshotBySessionTaskFile.set(toKey(taskId, absolutePath), hash)
	}
	return hash
}

export function getConcurrencySessionId(): string {
	return SESSION_ID
}
