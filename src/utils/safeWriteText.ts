import * as fs from "fs/promises"
import * as path from "path"
import * as lockfile from "proper-lockfile"

/**
 * Safely writes text data to a file.
 * - Creates parent directories if they don't exist
 * - Uses 'proper-lockfile' for inter-process advisory locking to prevent concurrent writes
 * - Writes to a temporary file in the same directory first
 * - If the target file exists, it's backed up before being replaced
 * - Attempts to roll back and clean up in case of errors
 */
export async function safeWriteText(filePath: string, content: string): Promise<void> {
	const absoluteFilePath = path.resolve(filePath)
	let releaseLock = async () => {}

	const dirPath = path.dirname(absoluteFilePath)
	await fs.mkdir(dirPath, { recursive: true })
	await fs.access(dirPath)

	releaseLock = await lockfile.lock(absoluteFilePath, {
		stale: 31000,
		update: 10000,
		realpath: false,
		retries: {
			retries: 5,
			factor: 2,
			minTimeout: 100,
			maxTimeout: 1000,
		},
		onCompromised: (err) => {
			throw err
		},
	})

	let tempNewPath: string | null = null
	let tempBackupPath: string | null = null

	try {
		tempNewPath = path.join(
			path.dirname(absoluteFilePath),
			`.${path.basename(absoluteFilePath)}.new_${Date.now()}_${Math.random().toString(36).substring(2)}.tmp`,
		)

		await fs.writeFile(tempNewPath, content, "utf8")

		try {
			await fs.access(absoluteFilePath)
			tempBackupPath = path.join(
				path.dirname(absoluteFilePath),
				`.${path.basename(absoluteFilePath)}.bak_${Date.now()}_${Math.random().toString(36).substring(2)}.tmp`,
			)
			await fs.rename(absoluteFilePath, tempBackupPath)
		} catch (accessError: any) {
			if (accessError.code !== "ENOENT") {
				throw accessError
			}
		}

		await fs.rename(tempNewPath, absoluteFilePath)
		tempNewPath = null

		if (tempBackupPath) {
			try {
				await fs.unlink(tempBackupPath)
				tempBackupPath = null
			} catch {
				// non-fatal
			}
		}
	} catch (originalError) {
		// Attempt rollback if backup was made
		if (tempBackupPath) {
			try {
				await fs.rename(tempBackupPath, absoluteFilePath)
				tempBackupPath = null
			} catch {
				// If rollback fails, preserve original error.
			}
		}

		if (tempNewPath) {
			await fs.unlink(tempNewPath).catch(() => {})
		}

		if (tempBackupPath) {
			await fs.unlink(tempBackupPath).catch(() => {})
		}

		throw originalError
	} finally {
		await releaseLock().catch(() => {})
	}
}
