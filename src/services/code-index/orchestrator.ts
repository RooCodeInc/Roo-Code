import * as vscode from "vscode"
import * as path from "path"
import { createHash } from "crypto"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager, IndexingState } from "./state-manager"
import { IFileWatcher, IVectorStore, BatchProcessingSummary, CodeBlock } from "./interfaces"
import { DirectoryScanner, CodeParser } from "./processors"
import { CacheManager } from "./cache-manager"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { t } from "../../i18n"

/**
 * File priority levels for priority-based processing
 */
export enum FilePriority {
	CRITICAL = 1, // Currently open files
	HIGH = 2, // Recently modified files
	MEDIUM = 3, // Files in context
	LOW = 4, // All other files
}

/**
 * Interface representing an indexed file with its metadata
 */
export interface IndexedFile {
	path: string
	contentHash: string
	lastIndexed: number
	priority: number
}

/**
 * Interface for parse result cache entry
 */
interface ParseResultCacheEntry {
	result: CodeBlock[]
	contentHash: string
	timestamp: number
}

/**
 * Result interface for incremental scan operations
 */
export interface ScanResult {
	changed: number
	deleted: number
}

/**
 * Interface for file type statistics
 */
export interface FileTypeStats {
	extension: string
	count: number
}

/**
 * Interface for file type count map
 */
export interface FileTypeCountMap {
	[extension: string]: number
}

/**
 * Manages the code indexing workflow, coordinating between different services and managers.
 */
export class CodeIndexOrchestrator {
	private _fileWatcherSubscriptions: vscode.Disposable[] = []
	private _isProcessing: boolean = false

	// Smart Incremental Indexing: Track indexed files with their metadata
	private indexedFiles: Map<string, IndexedFile> = new Map()

	// Parse Result Caching: Cache parsed results to avoid re-parsing unchanged files
	private parseResultCache: Map<string, ParseResultCacheEntry> = new Map()

	// Code parser instance for parse result caching
	private readonly codeParser: CodeParser

	// Track currently open files for priority calculation
	private openFiles: Set<string> = new Set()

	// Recently modified threshold (5 minutes)
	private readonly recentModificationThreshold = 5 * 60 * 1000

	// Maximum cache size for parse results (500 entries)
	private readonly maxParseCacheSize = 500

	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly stateManager: CodeIndexStateManager,
		private readonly workspacePath: string,
		private readonly cacheManager: CacheManager,
		private readonly vectorStore: IVectorStore,
		private readonly scanner: DirectoryScanner,
		private readonly fileWatcher: IFileWatcher,
		codeParser?: CodeParser,
	) {
		this.codeParser = codeParser ?? new CodeParser()
	}

	/**
	 * Starts the file watcher if not already running.
	 */
	private async _startWatcher(): Promise<void> {
		if (!this.configManager.isFeatureConfigured) {
			throw new Error("Cannot start watcher: Service not configured.")
		}

		this.stateManager.setSystemState("Indexing", "Initializing file watcher...")

		try {
			await this.fileWatcher.initialize()

			this._fileWatcherSubscriptions = [
				this.fileWatcher.onDidStartBatchProcessing((filePaths: string[]) => {}),
				this.fileWatcher.onBatchProgressUpdate(({ processedInBatch, totalInBatch, currentFile }) => {
					if (totalInBatch > 0 && this.stateManager.state !== "Indexing") {
						this.stateManager.setSystemState("Indexing", "Processing file changes...")
					}
					this.stateManager.reportFileQueueProgress(
						processedInBatch,
						totalInBatch,
						currentFile ? path.basename(currentFile) : undefined,
					)
					if (processedInBatch === totalInBatch) {
						// Covers (N/N) and (0/0)
						if (totalInBatch > 0) {
							// Batch with items completed
							this.stateManager.setSystemState("Indexed", "File changes processed. Index up-to-date.")
						} else {
							if (this.stateManager.state === "Indexing") {
								// Only transition if it was "Indexing"
								this.stateManager.setSystemState("Indexed", "Index up-to-date. File queue empty.")
							}
						}
					}
				}),
				this.fileWatcher.onDidFinishBatchProcessing((summary: BatchProcessingSummary) => {
					if (summary.batchError) {
						console.error(`[CodeIndexOrchestrator] Batch processing failed:`, summary.batchError)
					} else {
						const successCount = summary.processedFiles.filter(
							(f: { status: string }) => f.status === "success",
						).length
						const errorCount = summary.processedFiles.filter(
							(f: { status: string }) => f.status === "error" || f.status === "local_error",
						).length
					}
				}),
			]
		} catch (error) {
			console.error("[CodeIndexOrchestrator] Failed to start file watcher:", error)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "_startWatcher",
			})
			throw error
		}
	}

	/**
	 * Updates the status of a file in the state manager.
	 */

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */
	public async startIndexing(): Promise<void> {
		// Check if workspace is available first
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			this.stateManager.setSystemState("Error", t("embeddings:orchestrator.indexingRequiresWorkspace"))
			console.warn("[CodeIndexOrchestrator] Start rejected: No workspace folder open.")
			return
		}

		if (!this.configManager.isFeatureConfigured) {
			this.stateManager.setSystemState("Standby", "Missing configuration. Save your settings to start indexing.")
			console.warn("[CodeIndexOrchestrator] Start rejected: Missing configuration.")
			return
		}

		if (
			this._isProcessing ||
			(this.stateManager.state !== "Standby" &&
				this.stateManager.state !== "Error" &&
				this.stateManager.state !== "Indexed")
		) {
			console.warn(
				`[CodeIndexOrchestrator] Start rejected: Already processing or in state ${this.stateManager.state}.`,
			)
			return
		}

		this._isProcessing = true
		this.stateManager.setSystemState("Indexing", "Initializing services...")

		// Track whether we successfully connected to Qdrant and started indexing
		// This helps us decide whether to preserve cache on error
		let indexingStarted = false

		try {
			const collectionCreated = await this.vectorStore.initialize()

			// Successfully connected to Qdrant
			indexingStarted = true

			if (collectionCreated) {
				await this.cacheManager.clearCacheFile()
			}

			// Check if the collection already has indexed data
			// If it does, we can skip the full scan and just start the watcher
			const hasExistingData = await this.vectorStore.hasIndexedData()

			if (hasExistingData && !collectionCreated) {
				// Collection exists with data - run incremental scan to catch any new/changed files
				// This handles files added while workspace was closed or Qdrant was inactive
				console.log(
					"[CodeIndexOrchestrator] Collection already has indexed data. Running incremental scan for new/changed files...",
				)
				this.stateManager.setSystemState("Indexing", "Checking for new or modified files...")

				// Mark as incomplete at the start of incremental scan
				await this.vectorStore.markIndexingIncomplete()

				let cumulativeBlocksIndexed = 0
				let cumulativeBlocksFoundSoFar = 0
				let batchErrors: Error[] = []

				const handleFileParsed = (fileBlockCount: number) => {
					cumulativeBlocksFoundSoFar += fileBlockCount
					this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
				}

				const handleBlocksIndexed = (indexedCount: number) => {
					cumulativeBlocksIndexed += indexedCount
					this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
				}

				// Run incremental scan - scanner will skip unchanged files using cache
				const result = await this.scanner.scanDirectory(
					this.workspacePath,
					(batchError: Error) => {
						console.error(
							`[CodeIndexOrchestrator] Error during incremental scan batch: ${batchError.message}`,
							batchError,
						)
						batchErrors.push(batchError)
					},
					handleBlocksIndexed,
					handleFileParsed,
				)

				if (!result) {
					throw new Error("Incremental scan failed, is scanner initialized?")
				}

				// If new files were found and indexed, log the results
				if (cumulativeBlocksFoundSoFar > 0) {
					console.log(
						`[CodeIndexOrchestrator] Incremental scan completed: ${cumulativeBlocksIndexed} blocks indexed from new/changed files`,
					)
				} else {
					console.log("[CodeIndexOrchestrator] No new or changed files found")
				}

				await this._startWatcher()

				// Mark indexing as complete after successful incremental scan
				await this.vectorStore.markIndexingComplete()

				this.stateManager.setSystemState("Indexed", t("embeddings:orchestrator.fileWatcherStarted"))

				// Update file type statistics
				this.updateFileTypeStats()
			} else {
				// No existing data or collection was just created - do a full scan
				this.stateManager.setSystemState("Indexing", "Services ready. Starting workspace scan...")

				// Mark as incomplete at the start of full scan
				await this.vectorStore.markIndexingIncomplete()

				let cumulativeBlocksIndexed = 0
				let cumulativeBlocksFoundSoFar = 0
				let batchErrors: Error[] = []

				const handleFileParsed = (fileBlockCount: number) => {
					cumulativeBlocksFoundSoFar += fileBlockCount
					this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
				}

				const handleBlocksIndexed = (indexedCount: number) => {
					cumulativeBlocksIndexed += indexedCount
					this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
				}

				const result = await this.scanner.scanDirectory(
					this.workspacePath,
					(batchError: Error) => {
						console.error(
							`[CodeIndexOrchestrator] Error during initial scan batch: ${batchError.message}`,
							batchError,
						)
						batchErrors.push(batchError)
					},
					handleBlocksIndexed,
					handleFileParsed,
				)

				if (!result) {
					throw new Error("Scan failed, is scanner initialized?")
				}

				const { stats } = result

				// Check if any blocks were actually indexed successfully
				// If no blocks were indexed but blocks were found, it means all batches failed
				if (cumulativeBlocksIndexed === 0 && cumulativeBlocksFoundSoFar > 0) {
					if (batchErrors.length > 0) {
						// Use the first batch error as it's likely representative of the main issue
						const firstError = batchErrors[0]
						throw new Error(`Indexing failed: ${firstError.message}`)
					} else {
						throw new Error(t("embeddings:orchestrator.indexingFailedNoBlocks"))
					}
				}

				// Check for partial failures - if a significant portion of blocks failed
				const failureRate = (cumulativeBlocksFoundSoFar - cumulativeBlocksIndexed) / cumulativeBlocksFoundSoFar
				if (batchErrors.length > 0 && failureRate > 0.1) {
					// More than 10% of blocks failed to index
					const firstError = batchErrors[0]
					throw new Error(
						`Indexing partially failed: Only ${cumulativeBlocksIndexed} of ${cumulativeBlocksFoundSoFar} blocks were indexed. ${firstError.message}`,
					)
				}

				// CRITICAL: If there were ANY batch errors and NO blocks were successfully indexed,
				// this is a complete failure regardless of the failure rate calculation
				if (batchErrors.length > 0 && cumulativeBlocksIndexed === 0) {
					const firstError = batchErrors[0]
					throw new Error(`Indexing failed completely: ${firstError.message}`)
				}

				// Final sanity check: If we found blocks but indexed none and somehow no errors were reported,
				// this is still a failure
				if (cumulativeBlocksFoundSoFar > 0 && cumulativeBlocksIndexed === 0) {
					throw new Error(t("embeddings:orchestrator.indexingFailedCritical"))
				}

				await this._startWatcher()

				// Mark indexing as complete after successful full scan
				await this.vectorStore.markIndexingComplete()

				this.stateManager.setSystemState("Indexed", t("embeddings:orchestrator.fileWatcherStarted"))

				// Update file type statistics
				this.updateFileTypeStats()
			}
		} catch (error: any) {
			console.error("[CodeIndexOrchestrator] Error during indexing:", error)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "startIndexing",
			})
			if (indexingStarted) {
				try {
					await this.vectorStore.clearCollection()
				} catch (cleanupError) {
					console.error("[CodeIndexOrchestrator] Failed to clean up after error:", cleanupError)
					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
						stack: cleanupError instanceof Error ? cleanupError.stack : undefined,
						location: "startIndexing.cleanup",
					})
				}
			}

			// Only clear cache if indexing had started (Qdrant connection succeeded)
			// If we never connected to Qdrant, preserve cache for incremental scan when it comes back
			if (indexingStarted) {
				// Indexing started but failed mid-way - clear cache to avoid cache-Qdrant mismatch
				await this.cacheManager.clearCacheFile()
				console.log(
					"[CodeIndexOrchestrator] Indexing failed after starting. Clearing cache to avoid inconsistency.",
				)
			} else {
				// Never connected to Qdrant - preserve cache for future incremental scan
				console.log(
					"[CodeIndexOrchestrator] Failed to connect to Qdrant. Preserving cache for future incremental scan.",
				)
			}

			this.stateManager.setSystemState(
				"Error",
				t("embeddings:orchestrator.failedDuringInitialScan", {
					errorMessage: error.message || t("embeddings:orchestrator.unknownError"),
				}),
			)
			this.stopWatcher()
		} finally {
			this._isProcessing = false
		}
	}

	/**
	 * Stops the file watcher and cleans up resources.
	 */
	public stopWatcher(): void {
		this.fileWatcher.dispose()
		this._fileWatcherSubscriptions.forEach((sub) => sub.dispose())
		this._fileWatcherSubscriptions = []

		if (this.stateManager.state !== "Error") {
			this.stateManager.setSystemState("Standby", t("embeddings:orchestrator.fileWatcherStopped"))
		}
		this._isProcessing = false
	}

	/**
	 * Clears all index data by stopping the watcher, clearing the vector store,
	 * and resetting the cache file.
	 */
	public async clearIndexData(): Promise<void> {
		this._isProcessing = true

		try {
			await this.stopWatcher()

			try {
				if (this.configManager.isFeatureConfigured) {
					await this.vectorStore.deleteCollection()
				} else {
					console.warn("[CodeIndexOrchestrator] Service not configured, skipping vector collection clear.")
				}
			} catch (error: any) {
				console.error("[CodeIndexOrchestrator] Failed to clear vector collection:", error)
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "clearIndexData",
				})
				this.stateManager.setSystemState("Error", `Failed to clear vector collection: ${error.message}`)
			}

			await this.cacheManager.clearCacheFile()

			if (this.stateManager.state !== "Error") {
				this.stateManager.setSystemState("Standby", "Index data cleared successfully.")
			}
		} finally {
			this._isProcessing = false
		}
	}

	/**
	 * Gets the current state of the indexing system.
	 */
	public get state(): IndexingState {
		return this.stateManager.state
	}

	// ==================== Smart Incremental Indexing ====================

	/**
	 * Performs an incremental scan to detect and process changed files
	 * @returns Promise resolving to scan result with counts of changed and deleted files
	 */
	public async performIncrementalScan(): Promise<ScanResult> {
		const changedFiles = await this.detectChangedFiles()
		const deletedFiles = await this.detectDeletedFiles()

		// Delete removed files from index
		for (const file of deletedFiles) {
			await this.vectorStore.deletePointsByFilePath(file)
			this.indexedFiles.delete(file)
			this.parseResultCache.delete(file)
		}

		// Reindex only changed files
		for (const file of changedFiles) {
			await this.reindexFile(file)
		}

		return { changed: changedFiles.length, deleted: deletedFiles.length }
	}

	/**
	 * Detects files that have been modified since last indexing
	 * @returns Promise resolving to array of changed file paths
	 */
	private async detectChangedFiles(): Promise<string[]> {
		const changedFiles: string[] = []

		// Get all files from the cache manager (persisted hashes)
		const cachedHashes = this.cacheManager.getAllHashes()

		for (const [filePath, cachedHash] of Object.entries(cachedHashes)) {
			const indexedFile = this.indexedFiles.get(filePath)

			if (!indexedFile) {
				// New file not in our tracked list
				changedFiles.push(filePath)
				continue
			}

			if (indexedFile.contentHash !== cachedHash) {
				// File has changed
				changedFiles.push(filePath)
			}
		}

		return changedFiles
	}

	/**
	 * Detects files that have been deleted since last indexing
	 * @returns Promise resolving to array of deleted file paths
	 */
	private async detectDeletedFiles(): Promise<string[]> {
		const deletedFiles: string[] = []

		// Get all files from the cache manager
		const cachedHashes = this.cacheManager.getAllHashes()

		for (const [filePath] of this.indexedFiles) {
			// If a file is in our indexed list but not in cache, it was deleted
			if (!(filePath in cachedHashes)) {
				deletedFiles.push(filePath)
			}
		}

		return deletedFiles
	}

	/**
	 * Reindexes a single file and updates the indexed files map
	 * @param filePath Path to the file to reindex
	 */
	private async reindexFile(filePath: string): Promise<void> {
		try {
			// Get the parse result (using cache if available)
			const blocks = await this.getOrParseFile(filePath)

			if (blocks.length === 0) {
				return
			}

			// Get file hash for the indexed file
			const cachedHash = this.cacheManager.getHash(filePath) || ""

			// Delete old points from vector store
			await this.vectorStore.deletePointsByFilePath(filePath)

			// Convert blocks to points and upsert
			const points = this.blocksToPoints(blocks)
			await this.vectorStore.upsertPoints(points)

			// Update indexed files map
			this.indexedFiles.set(filePath, {
				path: filePath,
				contentHash: cachedHash,
				lastIndexed: Date.now(),
				priority: this.calculateFilePriority(filePath),
			})
		} catch (error) {
			console.error(`[CodeIndexOrchestrator] Error reindexing file ${filePath}:`, error)
		}
	}

	// ==================== Priority-based File Processing ====================

	/**
	 * Calculates the priority level for a file based on various factors
	 * @param filePath Path to the file
	 * @returns Priority level for the file
	 */
	public calculateFilePriority(filePath: string): FilePriority {
		if (this.isCurrentlyOpen(filePath)) {
			return FilePriority.CRITICAL
		}
		if (this.isRecentlyModified(filePath)) {
			return FilePriority.HIGH
		}
		if (this.isInContext(filePath)) {
			return FilePriority.MEDIUM
		}
		return FilePriority.LOW
	}

	/**
	 * Checks if a file is currently open in the editor
	 * @param filePath Path to the file
	 * @returns True if the file is currently open
	 */
	private isCurrentlyOpen(filePath: string): boolean {
		return this.openFiles.has(filePath)
	}

	/**
	 * Checks if a file was recently modified
	 * @param filePath Path to the file
	 * @returns True if the file was modified within the recent threshold
	 */
	private isRecentlyModified(filePath: string): boolean {
		const indexedFile = this.indexedFiles.get(filePath)
		if (!indexedFile) {
			return false
		}

		const timeSinceLastIndex = Date.now() - indexedFile.lastIndexed
		return timeSinceLastIndex < this.recentModificationThreshold
	}

	/**
	 * Checks if a file is in the current context (e.g., related to open files)
	 * @param filePath Path to the file
	 * @returns True if the file is in context
	 */
	private isInContext(filePath: string): boolean {
		// Simple implementation: check if file shares directory with open files
		for (const openFile of this.openFiles) {
			const openDir = path.dirname(openFile)
			const fileDir = path.dirname(filePath)
			if (
				openDir === fileDir ||
				openDir.startsWith(fileDir + path.sep) ||
				fileDir.startsWith(openDir + path.sep)
			) {
				return true
			}
		}
		return false
	}

	/**
	 * Processes files in priority order (highest priority first)
	 * @param files Array of file paths to process
	 */
	public async processFilesByPriority(files: string[]): Promise<void> {
		// Sort files by priority
		const sorted = files.sort((a, b) => this.calculateFilePriority(a) - this.calculateFilePriority(b))

		// Process files in priority order
		for (const file of sorted) {
			await this.indexFile(file)
		}
	}

	/**
	 * Indexes a single file
	 * @param filePath Path to the file to index
	 */
	private async indexFile(filePath: string): Promise<void> {
		try {
			const blocks = await this.getOrParseFile(filePath)

			if (blocks.length === 0) {
				return
			}

			// Get file hash
			const cachedHash = this.cacheManager.getHash(filePath) || ""

			// Convert blocks to points and upsert
			const points = this.blocksToPoints(blocks)
			await this.vectorStore.upsertPoints(points)

			// Update indexed files map
			this.indexedFiles.set(filePath, {
				path: filePath,
				contentHash: cachedHash,
				lastIndexed: Date.now(),
				priority: this.calculateFilePriority(filePath),
			})
		} catch (error) {
			console.error(`[CodeIndexOrchestrator] Error indexing file ${filePath}:`, error)
		}
	}

	/**
	 * Converts code blocks to vector store points
	 * @param blocks Array of code blocks
	 * @returns Array of points for vector store
	 */
	private blocksToPoints(blocks: CodeBlock[]) {
		return blocks.map((block) => ({
			id: block.segmentHash,
			vector: [], // Will be populated by embedder
			payload: {
				filePath: block.file_path,
				codeChunk: block.content,
				startLine: block.start_line,
				endLine: block.end_line,
				identifier: block.identifier,
				type: block.type,
				fileHash: block.fileHash,
				segmentHash: block.segmentHash,
			},
		}))
	}

	// ==================== Parse Result Caching ====================

	/**
	 * Gets cached parse result or parses the file and caches the result
	 * @param filePath Path to the file to parse
	 * @returns Promise resolving to array of code blocks
	 */
	public async getOrParseFile(filePath: string): Promise<CodeBlock[]> {
		try {
			// Read file content
			const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
			const contentStr = content.toString()
			const contentHash = createHash("sha256").update(contentStr).digest("hex")

			// Check cache
			const cached = this.parseResultCache.get(filePath)
			if (cached && cached.contentHash === contentHash) {
				return cached.result
			}

			// Parse the file
			const result = await this.codeParser.parseFile(filePath, { content: contentStr, fileHash: contentHash })

			// Cache the result
			this.setParseCache(filePath, result, contentHash)

			return result
		} catch (error) {
			console.error(`[CodeIndexOrchestrator] Error parsing file ${filePath}:`, error)
			return []
		}
	}

	/**
	 * Sets a parse result in the cache with LRU eviction
	 * @param filePath Path to the file
	 * @param result Parse result
	 * @param contentHash Hash of the file content
	 */
	private setParseCache(filePath: string, result: CodeBlock[], contentHash: string): void {
		// Check if cache is full and evict oldest entry
		if (this.parseResultCache.size >= this.maxParseCacheSize) {
			let oldestKey: string | null = null
			let oldestTimestamp = Infinity

			for (const [key, entry] of this.parseResultCache) {
				if (entry.timestamp < oldestTimestamp) {
					oldestTimestamp = entry.timestamp
					oldestKey = key
				}
			}

			if (oldestKey) {
				this.parseResultCache.delete(oldestKey)
			}
		}

		this.parseResultCache.set(filePath, {
			result,
			contentHash,
			timestamp: Date.now(),
		})
	}

	/**
	 * Clears the parse result cache
	 */
	public clearParseCache(): void {
		this.parseResultCache.clear()
	}

	/**
	 * Gets statistics about the parse result cache
	 * @returns Cache statistics
	 */
	public getParseCacheStats(): { size: number; maxSize: number } {
		return {
			size: this.parseResultCache.size,
			maxSize: this.maxParseCacheSize,
		}
	}

	// ==================== File Tracking ====================

	/**
	 * Marks a file as currently open
	 * @param filePath Path to the file
	 */
	public markFileOpen(filePath: string): void {
		this.openFiles.add(filePath)
		// Update priority in indexed files
		const indexedFile = this.indexedFiles.get(filePath)
		if (indexedFile) {
			indexedFile.priority = this.calculateFilePriority(filePath)
		}
	}

	/**
	 * Marks a file as no longer open
	 * @param filePath Path to the file
	 */
	public markFileClosed(filePath: string): void {
		this.openFiles.delete(filePath)
		// Update priority in indexed files
		const indexedFile = this.indexedFiles.get(filePath)
		if (indexedFile) {
			indexedFile.priority = this.calculateFilePriority(filePath)
		}
	}

	/**
	 * Gets the count of indexed files
	 * @returns Number of indexed files
	 */
	public getIndexedFileCount(): number {
		return this.indexedFiles.size
	}

	/**
	 * Gets all indexed files
	 * @returns Array of indexed file entries
	 */
	public getIndexedFiles(): IndexedFile[] {
		return Array.from(this.indexedFiles.values())
	}

	// ==================== File Type Statistics ====================

	/**
	 * Gets file type statistics (count by extension)
	 * @returns Array of file type stats sorted by count descending
	 */
	public getFileTypeStats(): FileTypeStats[] {
		const counts: FileTypeCountMap = {}

		// Use cacheManager to get all indexed files
		// The indexedFiles Map is only populated during incremental operations,
		// but cacheManager contains the actual indexed files from the scanner
		const allHashes = this.cacheManager.getAllHashes()

		for (const filePath of Object.keys(allHashes)) {
			const ext = path.extname(filePath).toLowerCase() || ".noext"
			counts[ext] = (counts[ext] || 0) + 1
		}

		return Object.entries(counts)
			.map(([extension, count]) => ({ extension, count }))
			.sort((a, b) => b.count - a.count)
	}

	/**
	 * Gets total number of indexed files
	 * @returns Total file count
	 */
	public getTotalFileCount(): number {
		// Use cacheManager to get accurate count of indexed files
		const allHashes = this.cacheManager.getAllHashes()
		return Object.keys(allHashes).length
	}

	/**
	 * Gets files filtered by extension
	 * @param extension File extension to filter by (with or without dot)
	 * @returns Array of indexed files with the specified extension
	 */
	public getFilesByExtension(extension: string): IndexedFile[] {
		const normalizedExt = extension.toLowerCase()
		const extWithDot = normalizedExt.startsWith(".") ? normalizedExt : `.${normalizedExt}`

		return Array.from(this.indexedFiles.values()).filter((file) =>
			path.extname(file.path).toLowerCase() === extWithDot
		)
	}

	/**
	 * Updates file type stats in the state manager
	 * This should be called when indexing is complete or when files change
	 */
	public updateFileTypeStats(): void {
		const stats = this.getFileTypeStats()
		const totalCount = this.getTotalFileCount()
		this.stateManager.setFileTypeStats(stats, totalCount)
	}
}
