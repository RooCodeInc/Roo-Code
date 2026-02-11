import type { Mock } from "vitest"
import * as vscode from "vscode"
import { createHash } from "crypto"
import { CacheManager } from "../cache-manager"

// Mock vscode
vitest.mock("vscode", () => ({
	Uri: {
		joinPath: vitest.fn(),
	},
}))

// Mock node-sqlite3-wasm Database
const { mockDb, mockDatabaseConstructor, mockStmt } = vitest.hoisted(() => {
	const mockStmt = {
		get: vitest.fn(),
		run: vitest.fn(),
		all: vitest.fn(),
	}

	const mockDb = {
		prepare: vitest.fn(() => mockStmt),
		exec: vitest.fn(),
		close: vitest.fn(),
		get: vitest.fn(),
		run: vitest.fn(),
		all: vitest.fn(),
		inTransaction: false,
	}

	const mockDatabaseConstructor = vitest.fn().mockImplementation(() => {
		return mockDb
	})

	return { mockDb, mockDatabaseConstructor, mockStmt }
})

vitest.mock("node-sqlite3-wasm", () => ({
	Database: mockDatabaseConstructor,
}))

// Mock TelemetryService
vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vitest.fn(),
		},
	},
}))

describe("CacheManager", () => {
	let mockContext: vscode.ExtensionContext
	let mockWorkspacePath: string
	let mockCachePath: vscode.Uri
	let cacheManager: CacheManager

	beforeEach(() => {
		// Reset all mocks
		vitest.clearAllMocks()

		// Reset mock implementations to default behavior
		mockStmt.get.mockReturnValue(undefined)
		mockStmt.run.mockReturnValue(undefined)
		mockStmt.all.mockReturnValue([])
		mockDb.exec.mockReturnValue(undefined)
		mockDb.close.mockReturnValue(undefined)
		mockDb.get.mockReturnValue(undefined)
		mockDb.run.mockReturnValue(undefined)
		mockDb.all.mockReturnValue([])
		mockDb.inTransaction = false

		// Mock context
		mockWorkspacePath = "/mock/workspace"
		mockCachePath = { fsPath: "/mock/storage/cache.v2.db" } as vscode.Uri
		mockContext = {
			globalStorageUri: { fsPath: "/mock/storage" } as vscode.Uri,
		} as vscode.ExtensionContext

		// Mock Uri.joinPath
		;(vscode.Uri.joinPath as Mock).mockReturnValue(mockCachePath)

		// Create cache manager instance
		cacheManager = new CacheManager(mockContext, mockWorkspacePath)
	})

	describe("constructor", () => {
		it("should correctly set up cachePath using Uri.joinPath and crypto.createHash", () => {
			const expectedHash = createHash("sha256").update(mockWorkspacePath).digest("hex")

			expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
				mockContext.globalStorageUri,
				`roo-index-cache-${expectedHash}.v2.db`,
			)
		})
	})

	describe("initialize", () => {
		it("should open database and create table successfully", () => {
			cacheManager.initialize()

			expect(mockDatabaseConstructor).toHaveBeenCalledWith(mockCachePath.fsPath)
			expect(mockDb.exec).toHaveBeenCalledWith("PRAGMA journal_mode = WAL")
			expect(mockDb.exec).toHaveBeenCalledWith("PRAGMA synchronous = OFF")
			expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS file_hashes"))
		})

		it("should handle database open errors", () => {
			mockDatabaseConstructor.mockImplementationOnce(() => {
				throw new Error("Failed to open database")
			})

			const consoleErrorSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

			expect(() => cacheManager.initialize()).toThrow("Failed to open database")
			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to initialize cache manager:", expect.any(Error))

			consoleErrorSpy.mockRestore()
		})

		it("should handle table creation errors", () => {
			mockDb.exec.mockImplementationOnce(() => {
				throw new Error("Table creation failed")
			})

			const consoleErrorSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

			expect(() => cacheManager.initialize()).toThrow("Table creation failed")
			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to initialize cache manager:", expect.any(Error))

			consoleErrorSpy.mockRestore()
		})

		it("should not reinitialize if already initialized", () => {
			cacheManager.initialize()
			const callCount = mockDatabaseConstructor.mock.calls.length

			cacheManager.initialize()

			expect(mockDatabaseConstructor.mock.calls.length).toBe(callCount)
		})
	})

	describe("getHash", () => {
		beforeEach(() => {
			cacheManager.initialize()
		})

		it("should return hash for existing file", () => {
			const filePath = "test.ts"
			const hash = "testhash123"
			mockDb.get.mockReturnValue({ hash })

			const result = cacheManager.getHash(filePath)

			expect(result).toBe(hash)
			expect(mockDb.get).toHaveBeenCalledWith("SELECT hash FROM file_hashes WHERE file_path = ?", filePath)
		})

		it("should return undefined for non-existent file", () => {
			const filePath = "nonexistent.ts"
			mockDb.get.mockReturnValue(undefined)

			const result = cacheManager.getHash(filePath)

			expect(result).toBeUndefined()
		})

		it("should handle database errors", () => {
			mockDb.get.mockImplementation(() => {
				throw new Error("Database error")
			})

			expect(() => cacheManager.getHash("test.ts")).toThrow("Database error")
		})

		it("should throw error if database not initialized", () => {
			const uninitializedManager = new CacheManager(mockContext, mockWorkspacePath)

			expect(() => uninitializedManager.getHash("test.ts")).toThrow("Database not initialized")
		})
	})

	describe("updateHash", () => {
		beforeEach(() => {
			cacheManager.initialize()
		})

		it("should insert new hash", () => {
			const filePath = "test.ts"
			const hash = "testhash123"

			cacheManager.updateHash(filePath, hash)

			expect(mockDb.run).toHaveBeenCalledWith(
				"INSERT OR REPLACE INTO file_hashes (file_path, hash) VALUES (?, ?)",
				[filePath, hash],
			)
		})

		it("should replace existing hash", () => {
			const filePath = "test.ts"
			const hash1 = "oldhash"
			const hash2 = "newhash"

			cacheManager.updateHash(filePath, hash1)
			cacheManager.updateHash(filePath, hash2)

			expect(mockDb.run).toHaveBeenCalledTimes(2)
		})

		it("should handle database errors", () => {
			mockDb.run.mockImplementation(() => {
				throw new Error("Insert failed")
			})

			const consoleErrorSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

			expect(() => cacheManager.updateHash("test.ts", "hash")).toThrow("Insert failed")

			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to update hash:", expect.any(Error))

			consoleErrorSpy.mockRestore()
		})

		it("should initialize database if not initialized", () => {
			const uninitializedManager = new CacheManager(mockContext, mockWorkspacePath)

			uninitializedManager.updateHash("test.ts", "hash")

			expect(mockDatabaseConstructor).toHaveBeenCalled()
		})
	})

	describe("updateHashes", () => {
		beforeEach(() => {
			cacheManager.initialize()
		})

		it("should update multiple hashes in a transaction", () => {
			const entries = [
				{ filePath: "file1.ts", hash: "hash1" },
				{ filePath: "file2.ts", hash: "hash2" },
				{ filePath: "file3.ts", hash: "hash3" },
			]

			cacheManager.updateHashes(entries)

			expect(mockDb.exec).toHaveBeenCalledWith("BEGIN TRANSACTION")
			expect(mockDb.run).toHaveBeenCalledWith(
				"INSERT OR REPLACE INTO file_hashes (file_path, hash) VALUES (?, ?)",
				["file1.ts", "hash1"],
			)
			expect(mockDb.run).toHaveBeenCalledWith(
				"INSERT OR REPLACE INTO file_hashes (file_path, hash) VALUES (?, ?)",
				["file2.ts", "hash2"],
			)
			expect(mockDb.run).toHaveBeenCalledWith(
				"INSERT OR REPLACE INTO file_hashes (file_path, hash) VALUES (?, ?)",
				["file3.ts", "hash3"],
			)
			expect(mockDb.exec).toHaveBeenCalledWith("COMMIT")
		})

		it("should handle empty entries array", () => {
			cacheManager.updateHashes([])

			// Should still call BEGIN and COMMIT
			expect(mockDb.exec).toHaveBeenCalledWith("BEGIN TRANSACTION")
			expect(mockDb.exec).toHaveBeenCalledWith("COMMIT")
		})

		it("should handle commit errors", () => {
			mockDb.exec.mockImplementationOnce(() => {
				throw new Error("Commit failed")
			})

			const consoleErrorSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

			expect(() => cacheManager.updateHashes([{ filePath: "test.ts", hash: "hash" }])).toThrow("Commit failed")

			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to update hashes:", expect.any(Error))

			consoleErrorSpy.mockRestore()
		})
	})

	describe("deleteHash", () => {
		beforeEach(() => {
			cacheManager.initialize()
		})

		it("should delete hash for existing file", () => {
			const filePath = "test.ts"

			cacheManager.deleteHash(filePath)

			expect(mockDb.run).toHaveBeenCalledWith("DELETE FROM file_hashes WHERE file_path = ?", filePath)
		})

		it("should handle database errors", () => {
			mockDb.run.mockImplementation(() => {
				throw new Error("Delete failed")
			})

			const consoleErrorSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

			expect(() => cacheManager.deleteHash("test.ts")).toThrow("Delete failed")

			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to delete hash:", expect.any(Error))

			consoleErrorSpy.mockRestore()
		})

		it("should initialize database if not initialized", () => {
			const uninitializedManager = new CacheManager(mockContext, mockWorkspacePath)

			uninitializedManager.deleteHash("test.ts")

			expect(mockDatabaseConstructor).toHaveBeenCalled()
		})
	})

	describe("deleteHashes", () => {
		beforeEach(() => {
			cacheManager.initialize()
		})

		it("should delete multiple hashes in a transaction", () => {
			const filePaths = ["file1.ts", "file2.ts", "file3.ts"]

			cacheManager.deleteHashes(filePaths)

			expect(mockDb.exec).toHaveBeenCalledWith("BEGIN TRANSACTION")
			expect(mockDb.run).toHaveBeenCalledWith("DELETE FROM file_hashes WHERE file_path = ?", "file1.ts")
			expect(mockDb.run).toHaveBeenCalledWith("DELETE FROM file_hashes WHERE file_path = ?", "file2.ts")
			expect(mockDb.run).toHaveBeenCalledWith("DELETE FROM file_hashes WHERE file_path = ?", "file3.ts")
			expect(mockDb.exec).toHaveBeenCalledWith("COMMIT")
		})

		it("should handle empty file paths array", () => {
			cacheManager.deleteHashes([])

			// Should return early without any database calls (except CREATE TABLE)
			expect(mockDb.exec).not.toHaveBeenCalledWith("BEGIN TRANSACTION")
		})

		it("should handle delete errors and rollback", () => {
			mockDb.exec.mockImplementationOnce(() => {
				throw new Error("Delete failed")
			})

			const consoleErrorSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

			expect(() => cacheManager.deleteHashes(["test.ts"])).toThrow("Delete failed")

			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to delete hashes:", expect.any(Error))

			consoleErrorSpy.mockRestore()
		})

		it("should handle commit errors", () => {
			mockDb.exec.mockImplementationOnce(() => {
				throw new Error("Commit failed")
			})

			expect(() => cacheManager.deleteHashes(["test.ts"])).toThrow("Commit failed")
		})
	})

	describe("deleteHashesNotIn", () => {
		beforeEach(() => {
			cacheManager.initialize()
		})

		it("should delete hashes not in the provided list and return deleted paths", () => {
			const filePaths = ["file1.ts", "file2.ts"]
			const deletedPaths = ["oldfile1.ts", "oldfile2.ts"]

			mockDb.all.mockReturnValueOnce(deletedPaths.map((path) => ({ file_path: path })))

			const result = cacheManager.deleteHashesNotIn(filePaths)

			expect(result).toEqual(deletedPaths)
			expect(mockDb.exec).toHaveBeenCalledWith("BEGIN TRANSACTION")
			expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining("CREATE TEMPORARY TABLE paths_to_keep"))
			expect(mockDb.run).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO paths_to_keep (file_path) VALUES"),
				...filePaths,
			)
			expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining("SELECT file_path FROM file_hashes"))
			expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM file_hashes"))
			expect(mockDb.exec).toHaveBeenCalledWith("DROP TABLE paths_to_keep")
			expect(mockDb.exec).toHaveBeenCalledWith("COMMIT")
		})

		it("should delete all hashes when provided empty array", () => {
			const allPaths = ["file1.ts", "file2.ts", "file3.ts"]

			mockDb.all.mockReturnValueOnce(allPaths.map((path) => ({ file_path: path })))

			const result = cacheManager.deleteHashesNotIn([])

			expect(result).toEqual(allPaths)
			expect(mockDb.all).toHaveBeenCalledWith("SELECT file_path FROM file_hashes")
			expect(mockDb.exec).toHaveBeenCalledWith("DELETE FROM file_hashes")
		})

		it("should return empty array when no files to delete", () => {
			const filePaths = ["file1.ts", "file2.ts"]

			mockDb.all.mockReturnValueOnce([])

			const result = cacheManager.deleteHashesNotIn(filePaths)

			expect(result).toEqual([])
		})

		it("should handle select errors", () => {
			mockDb.all.mockImplementation(() => {
				throw new Error("Select failed")
			})

			expect(() => cacheManager.deleteHashesNotIn(["file1.ts"])).toThrow("Select failed")
		})

		it("should handle delete errors and cleanup temp table", () => {
			mockDb.all.mockReturnValueOnce([{ file_path: "oldfile.ts" }])
			let callCount = 0
			mockDb.exec.mockImplementation((sql: string) => {
				callCount++
				// Throw on the DELETE FROM file_hashes statement (after BEGIN, CREATE TEMP, INSERT)
				if (sql.includes("DELETE FROM file_hashes")) {
					throw new Error("Delete failed")
				}
				return undefined
			})

			const consoleErrorSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

			expect(() => cacheManager.deleteHashesNotIn(["file1.ts"])).toThrow("Delete failed")

			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to delete hashes not in list:", expect.any(Error))
			// Verify temp table cleanup was attempted
			expect(mockDb.exec).toHaveBeenCalledWith("DROP TABLE IF EXISTS paths_to_keep")

			consoleErrorSpy.mockRestore()
		})

		it("should insert paths to keep in batches", () => {
			// Create a large list of paths (more than BATCH_SIZE of 1000)
			const filePaths = Array.from({ length: 2500 }, (_, i) => `file${i}.ts`)
			const deletedPaths = ["oldfile1.ts", "oldfile2.ts"]

			mockDb.all.mockReturnValueOnce(deletedPaths.map((path) => ({ file_path: path })))

			cacheManager.deleteHashesNotIn(filePaths)

			// Should have multiple INSERT calls (batches of 1000)
			// First batch: 1000 paths
			expect(mockDb.run).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO paths_to_keep (file_path) VALUES"),
				...filePaths.slice(0, 1000),
			)
			// Second batch: next 1000 paths
			expect(mockDb.run).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO paths_to_keep (file_path) VALUES"),
				...filePaths.slice(1000, 2000),
			)
			// Third batch: remaining 500 paths
			expect(mockDb.run).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO paths_to_keep (file_path) VALUES"),
				...filePaths.slice(2000, 2500),
			)
		})
	})

	describe("clearCacheFile", () => {
		beforeEach(() => {
			cacheManager.initialize()
		})

		it("should clear all hashes from database", () => {
			cacheManager.clearCacheFile()

			expect(mockDb.exec).toHaveBeenCalledWith("DELETE FROM file_hashes")
		})

		it("should handle database errors", () => {
			mockDb.exec.mockImplementation(() => {
				throw new Error("Clear failed")
			})

			const consoleErrorSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

			expect(() => cacheManager.clearCacheFile()).toThrow("Clear failed")

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Failed to clear cache file:",
				expect.any(Error),
				mockCachePath,
			)

			consoleErrorSpy.mockRestore()
		})

		it("should initialize database if not initialized", () => {
			const uninitializedManager = new CacheManager(mockContext, mockWorkspacePath)

			uninitializedManager.clearCacheFile()

			expect(mockDatabaseConstructor).toHaveBeenCalled()
		})
	})

	describe("dispose", () => {
		it("should close database connection", () => {
			cacheManager.initialize()
			cacheManager.dispose()

			expect(mockDb.close).toHaveBeenCalled()
		})

		it("should handle close errors", () => {
			cacheManager.initialize()
			mockDb.close.mockImplementation(() => {
				throw new Error("Close failed")
			})

			const consoleErrorSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

			cacheManager.dispose()

			expect(consoleErrorSpy).toHaveBeenCalledWith("Error disposing cache manager:", expect.any(Error))

			consoleErrorSpy.mockRestore()
		})

		it("should handle null database", () => {
			const uninitializedManager = new CacheManager(mockContext, mockWorkspacePath)

			expect(() => uninitializedManager.dispose()).not.toThrow()
		})
	})
})
