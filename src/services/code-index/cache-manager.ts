import * as vscode from "vscode"
import { createHash } from "crypto"
import { ICacheManager } from "./interfaces/cache"
import debounce from "lodash.debounce"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

/**
 * Multi-Level Cache Manager for code indexing
 * L1: In-memory cache (fastest, transient)
 * L2: File-based cache (persistent, slower)
 */
// TTL Constants for cache expiration
const L1_CACHE_TTL = 1000 * 60 * 30 // 30 minutes
const L2_CACHE_TTL = 1000 * 60 * 60 // 1 hour

export class CacheManager implements ICacheManager {
	private cachePath: vscode.Uri
	// L2: File-based cache (persistent storage) - stores {value, timestamp}
	private fileHashes: Record<string, { value: string; timestamp: number }> = {}
	// L1: In-memory cache (fastest access, populated on demand) - stores {value, timestamp}
	private l1Cache: Map<string, { value: string; timestamp: number }> = new Map()
	// Cache statistics for monitoring
	private l1Hits = 0
	private l2Hits = 0
	private misses = 0
	private _debouncedSaveCache: () => void

	/**
	 * Creates a new cache manager
	 * @param context VS Code extension context
	 * @param workspacePath Path to the workspace
	 */
	constructor(
		private context: vscode.ExtensionContext,
		private workspacePath: string,
	) {
		this.cachePath = vscode.Uri.joinPath(
			context.globalStorageUri,
			`roo-index-cache-${createHash("sha256").update(workspacePath).digest("hex")}.json`,
		)
		this._debouncedSaveCache = debounce(async () => {
			await this._performSave()
		}, 1500)
		// Initialize empty L1 cache
		this.l1Cache = new Map()
	}

	/**
	 * Initializes the cache manager by loading the cache file
	 * Populates both L2 (file-based) and L1 (in-memory) caches
	 */
	async initialize(): Promise<void> {
		try {
			const cacheData = await vscode.workspace.fs.readFile(this.cachePath)
			this.fileHashes = JSON.parse(cacheData.toString())
			// Populate L1 cache from L2 cache
			this.l1Cache = new Map(Object.entries(this.fileHashes))
		} catch (error) {
			this.fileHashes = {}
			this.l1Cache = new Map()
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "initialize",
			})
		}
	}

	/**
	 * Saves the cache to disk
	 */
	private async _performSave(): Promise<void> {
		try {
			await safeWriteJson(this.cachePath.fsPath, this.fileHashes)
		} catch (error) {
			console.error("Failed to save cache:", error)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "_performSave",
			})
		}
	}

	/**
	 * Clears the cache file by writing an empty object to it
	 * Clears both L1 (in-memory) and L2 (file-based) caches
	 */
	async clearCacheFile(): Promise<void> {
		try {
			await safeWriteJson(this.cachePath.fsPath, {})
			this.fileHashes = {}
			this.l1Cache.clear()
		} catch (error) {
			console.error("Failed to clear cache file:", error, this.cachePath)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "clearCacheFile",
			})
		}
	}

	/**
	 * Checks if an L1 cache entry is valid based on TTL
	 * @param entry Cache entry with timestamp
	 * @returns true if entry is valid, false if expired
	 */
	private _isL1EntryValid(entry: { value: string; timestamp: number } | undefined): boolean {
		if (entry === undefined) return false
		return Date.now() - entry.timestamp <= L1_CACHE_TTL
	}

	/**
	 * Checks if an L2 cache entry is valid based on TTL
	 * @param entry Cache entry with timestamp
	 * @returns true if entry is valid, false if expired
	 */
	private _isL2EntryValid(entry: { value: string; timestamp: number } | undefined): boolean {
		if (entry === undefined) return false
		return Date.now() - entry.timestamp <= L2_CACHE_TTL
	}

	/**
	 * Gets the hash for a file path
	 * Uses multi-level cache: L1 (in-memory) first, then L2 (file-based)
	 * @param filePath Path to the file
	 * @returns The hash for the file or undefined if not found or expired
	 */
	getHash(filePath: string): string | undefined {
		// Check L1 cache first (fastest)
		const l1Entry = this.l1Cache.get(filePath)
		if (l1Entry !== undefined && this._isL1EntryValid(l1Entry)) {
			this.l1Hits++
			return l1Entry.value
		}
		// L1 entry is expired or missing, remove it
		if (l1Entry !== undefined) {
			this.l1Cache.delete(filePath)
		}

		// Check L2 cache (persistent storage)
		const l2Entry = this.fileHashes[filePath]
		if (l2Entry !== undefined && this._isL2EntryValid(l2Entry)) {
			this.l2Hits++
			// Populate L1 cache for future lookups
			this.l1Cache.set(filePath, l2Entry)
			return l2Entry.value
		}
		// L2 entry is expired or missing
		if (l2Entry !== undefined) {
			// Clean up expired L2 entry
			delete this.fileHashes[filePath]
			this._debouncedSaveCache()
		}

		// Cache miss
		this.misses++
		return undefined
	}

	/**
	 * Updates the hash for a file path
	 * Updates both L1 (in-memory) and L2 (file-based) caches
	 * @param filePath Path to the file
	 * @param hash New hash value
	 */
	updateHash(filePath: string, hash: string): void {
		const entry = { value: hash, timestamp: Date.now() }
		// Update both L1 and L2 caches
		this.fileHashes[filePath] = entry
		this.l1Cache.set(filePath, entry)
		this._debouncedSaveCache()
	}

	/**
	 * Deletes the hash for a file path
	 * Deletes from both L1 (in-memory) and L2 (file-based) caches
	 * @param filePath Path to the file
	 */
	deleteHash(filePath: string): void {
		delete this.fileHashes[filePath]
		this.l1Cache.delete(filePath)
		this._debouncedSaveCache()
	}

	/**
	 * Gets a copy of all file hashes (only valid entries based on TTL)
	 * @returns A copy of the file hashes record (L2 cache state)
	 */
	getAllHashes(): Record<string, string> {
		const result: Record<string, string> = {}
		for (const [path, entry] of Object.entries(this.fileHashes)) {
			if (this._isL2EntryValid(entry)) {
				result[path] = entry.value
			}
		}
		return result
	}

	/**
	 * Gets cache statistics for monitoring cache performance
	 * @returns Object containing cache statistics
	 */
	getCacheStats(): {
		l1Size: number
		l2Size: number
		l1Hits: number
		l2Hits: number
		misses: number
		hitRate: number
	} {
		const totalRequests = this.l1Hits + this.l2Hits + this.misses
		const hitRate = totalRequests > 0 ? (this.l1Hits + this.l2Hits) / totalRequests : 0
		return {
			l1Size: this.l1Cache.size,
			l2Size: Object.keys(this.fileHashes).length,
			l1Hits: this.l1Hits,
			l2Hits: this.l2Hits,
			misses: this.misses,
			hitRate: Math.round(hitRate * 10000) / 100, // Round to 2 decimal places
		}
	}
}
