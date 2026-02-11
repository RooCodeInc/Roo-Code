import * as vscode from "vscode"
import { createHash } from "crypto"
import { ICacheManager } from "./interfaces/cache"
import { Database } from "node-sqlite3-wasm"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

/**
 * Manages the cache for code indexing using SQLite database with node-sqlite3-wasm
 */
export class CacheManager implements ICacheManager {
	private dbPath: vscode.Uri
	private db: Database | null = null
	private static readonly BATCH_SIZE = 1000

	/**
	 * Creates a new cache manager
	 * @param context VS Code extension context
	 * @param workspacePath Path to the workspace
	 */
	constructor(
		private context: vscode.ExtensionContext,
		private workspacePath: string,
	) {
		this.dbPath = vscode.Uri.joinPath(
			context.globalStorageUri,
			`roo-index-cache-${createHash("sha256").update(workspacePath).digest("hex")}.v2.db`,
		)
	}

	/**
	 * Initializes the cache manager by opening the database and creating the table
	 */
	initialize(): void {
		if (this.db) {
			return
		}

		try {
			this.db = new Database(this.dbPath.fsPath)
			// Changing the journal mode to "Write-Ahead Log" is known to bring significantly better performance in most case
			this.db.exec("PRAGMA journal_mode = WAL")
			// Disable synchronous mode for better performance,
			// as we don't need to ensure the database file is safely written to disk at every transaction
			this.db.exec("PRAGMA synchronous = OFF")
			this.db.exec(`
				CREATE TABLE IF NOT EXISTS file_hashes (
					file_path TEXT PRIMARY KEY,
					hash TEXT NOT NULL
				)
			`)
		} catch (error) {
			this.dispose()
			console.error("Failed to initialize cache manager:", error)
			throw error
		}
	}

	/**
	 * Clears the cache file by deleting all rows from the table
	 */
	clearCacheFile(): void {
		try {
			this.initialize()
			if (!this.db) {
				throw new Error("Database not initialized")
			}
			this.db.exec("DELETE FROM file_hashes")
		} catch (error) {
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "clearCacheFile",
			})
			console.error("Failed to clear cache file:", error, this.dbPath)
			throw error
		}
	}

	/**
	 * Gets the hash for a file path
	 * @param filePath Path to the file
	 * @returns The hash for the file or undefined if not found
	 */
	getHash(filePath: string): string | undefined {
		try {
			if (!this.db) {
				throw new Error("Database not initialized")
			}
			const result = this.db.get("SELECT hash FROM file_hashes WHERE file_path = ?", filePath) as
				| { hash: string }
				| undefined
			return result?.hash
		} catch (error) {
			console.error("Failed to get hash:", error)
			throw error
		}
	}

	/**
	 * Updates the hash for a file path
	 * @param filePath Path to the file
	 * @param hash New hash value
	 */
	updateHash(filePath: string, hash: string): void {
		try {
			this.initialize()
			if (!this.db) {
				throw new Error("Database not initialized")
			}
			this.db.run("INSERT OR REPLACE INTO file_hashes (file_path, hash) VALUES (?, ?)", [filePath, hash])
		} catch (error) {
			console.error("Failed to update hash:", error)
			throw error
		}
	}

	/**
	 * Updates multiple hashes in a single transaction
	 * @param entries Array of {filePath, hash} entries to update
	 */
	updateHashes(entries: Array<{ filePath: string; hash: string }>): void {
		try {
			if (!this.db) {
				throw new Error("Database not initialized")
			}
			this.db.exec("BEGIN TRANSACTION")
			try {
				for (const item of entries) {
					this.db.run("INSERT OR REPLACE INTO file_hashes (file_path, hash) VALUES (?, ?)", [
						item.filePath,
						item.hash,
					])
				}
				this.db.exec("COMMIT")
			} catch (err) {
				if (this.db.inTransaction) {
					this.db.exec("ROLLBACK")
				}
				throw err
			}
		} catch (error) {
			console.error("Failed to update hashes:", error)
			throw error
		}
	}

	/**
	 * Deletes the hash for a file path
	 * @param filePath Path to the file
	 */
	deleteHash(filePath: string): void {
		try {
			this.initialize()
			if (!this.db) {
				throw new Error("Database not initialized")
			}
			this.db.run("DELETE FROM file_hashes WHERE file_path = ?", filePath)
		} catch (error) {
			console.error("Failed to delete hash:", error)
			throw error
		}
	}

	/**
	 * Deletes multiple hashes in a single transaction
	 * @param filePaths Array of file paths to delete
	 */
	deleteHashes(filePaths: string[]): void {
		if (filePaths.length === 0) {
			return
		}
		try {
			if (!this.db) {
				throw new Error("Database not initialized")
			}
			this.db.exec("BEGIN TRANSACTION")
			try {
				for (const path of filePaths) {
					this.db.run("DELETE FROM file_hashes WHERE file_path = ?", path)
				}
				this.db.exec("COMMIT")
			} catch (err) {
				if (this.db.inTransaction) {
					this.db.exec("ROLLBACK")
				}
				throw err
			}
		} catch (error) {
			console.error("Failed to delete hashes:", error)
			throw error
		}
	}

	/**
	 * Deletes hashes for file paths that are NOT in the provided list
	 * Returns the list of deleted file paths
	 * @param filePaths Array of file paths to keep (all others will be deleted)
	 */
	deleteHashesNotIn(filePaths: string[]): string[] {
		try {
			this.initialize()
			if (!this.db) {
				return []
			}

			// First, get the paths that will be deleted
			let deletedPaths: string[] = []
			if (filePaths.length === 0) {
				// If no paths to keep, delete everything and return all paths
				const rows = this.db.all("SELECT file_path FROM file_hashes") as { file_path: string }[]
				deletedPaths = rows.map((row) => row.file_path)
				this.db.exec("DELETE FROM file_hashes")
			} else {
				this.db.exec("BEGIN TRANSACTION")
				try {
					// Create a temporary table with the file paths to keep
					this.db.exec(`
						CREATE TEMPORARY TABLE paths_to_keep (
							file_path TEXT PRIMARY KEY
						)
					`)

					// Insert paths to keep in batches
					for (let i = 0; i < filePaths.length; i += CacheManager.BATCH_SIZE) {
						const batch = filePaths.slice(i, i + CacheManager.BATCH_SIZE)
						const placeholders = batch.map(() => "(?)").join(",")
						this.db.run(`INSERT INTO paths_to_keep (file_path) VALUES ${placeholders}`, ...batch)
					}

					// Get all paths that will be deleted (using NOT EXISTS with temp table)
					const rows = this.db.all(`
						SELECT file_path FROM file_hashes
						WHERE NOT EXISTS (
							SELECT 1 FROM paths_to_keep WHERE paths_to_keep.file_path = file_hashes.file_path
						)
					`) as { file_path: string }[]
					deletedPaths = rows.map((row) => row.file_path)

					// Delete using the temp table
					this.db.exec(`
						DELETE FROM file_hashes
						WHERE NOT EXISTS (
							SELECT 1 FROM paths_to_keep WHERE paths_to_keep.file_path = file_hashes.file_path
						)
					`)

					// Drop the temporary table
					this.db.exec("DROP TABLE paths_to_keep")

					this.db.exec("COMMIT")
				} catch (err) {
					if (this.db.inTransaction) {
						this.db.exec("ROLLBACK")
					}
					// Clean up temp table if it exists
					try {
						this.db.exec("DROP TABLE IF EXISTS paths_to_keep")
					} catch {
						// Ignore cleanup errors
					}
					throw err
				}
			}

			return deletedPaths
		} catch (error) {
			console.error("Failed to delete hashes not in list:", error)
			throw error
		}
	}

	/**
	 * Closes the database connection (cleanup)
	 */
	dispose(): void {
		if (this.db) {
			try {
				this.db.close()
			} catch (error) {
				console.error("Error disposing cache manager:", error)
			}
			this.db = null
		}
	}
}
