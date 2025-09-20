import * as vscode from "vscode"
import * as path from "path"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager, IndexingState } from "./state-manager"
import { IFileWatcher, IVectorStore, BatchProcessingSummary } from "./interfaces"
import { DirectoryScanner } from "./processors"
import { CacheManager } from "./cache-manager"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { t } from "../../i18n"

/**
 * Manages the code indexing workflow, coordinating between different services and managers.
 */
export class CodeIndexOrchestrator {
	private _fileWatcherSubscriptions: vscode.Disposable[] = []
	private _isProcessing: boolean = false
	private _qdrantRetryTimer: NodeJS.Timeout | undefined
	private _qdrantRetryCount: number = 0
	private readonly MAX_RETRY_COUNT = 10
	private readonly RETRY_INTERVAL_MS = 30000 // 30 seconds

	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly stateManager: CodeIndexStateManager,
		private readonly workspacePath: string,
		private readonly cacheManager: CacheManager,
		private readonly vectorStore: IVectorStore,
		private readonly scanner: DirectoryScanner,
		private readonly fileWatcher: IFileWatcher,
	) {}

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

		try {
			// Try to initialize the vector store with connection retry
			let collectionCreated = false
			let connectionError: Error | null = null

			try {
				collectionCreated = await this.vectorStore.initialize()
			} catch (error: any) {
				// Check if this is a connection error (Qdrant not available)
				const errorMessage = error?.message || String(error)
				if (
					errorMessage.includes("qdrantConnectionFailed") ||
					errorMessage.includes("ECONNREFUSED") ||
					errorMessage.includes("Failed to connect") ||
					errorMessage.includes("connect ECONNREFUSED")
				) {
					connectionError = error as Error
					console.warn(
						"[CodeIndexOrchestrator] Qdrant connection failed, will attempt incremental indexing when available:",
						errorMessage,
					)
					// Don't throw here - continue with cache-based incremental indexing
				} else {
					// Other errors should still be thrown
					throw error
				}
			}

			// Only clear cache if we successfully created a new collection
			// This preserves the cache for incremental indexing when Qdrant comes back online
			if (collectionCreated) {
				await this.cacheManager.clearCacheFile()
			}

			// If Qdrant is not available, we should not proceed with scanning
			// Instead, set up monitoring for when it becomes available
			if (connectionError) {
				this.stateManager.setSystemState(
					"Error",
					t("embeddings:orchestrator.qdrantNotAvailable", {
						errorMessage:
							"Qdrant service is not available. Indexing will resume automatically when the service is restored.",
					}),
				)
				// Set up periodic retry for Qdrant connection
				this._setupQdrantConnectionRetry()
				return
			}

			this.stateManager.setSystemState("Indexing", "Services ready. Starting workspace scan...")

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

			this.stateManager.setSystemState("Indexed", t("embeddings:orchestrator.fileWatcherStarted"))
		} catch (error: any) {
			console.error("[CodeIndexOrchestrator] Error during indexing:", error)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "startIndexing",
			})

			// Check if this is a connection error - if so, don't clear the cache
			const errorMessage = error?.message || String(error)
			const isConnectionError =
				errorMessage.includes("qdrantConnectionFailed") ||
				errorMessage.includes("ECONNREFUSED") ||
				errorMessage.includes("Failed to connect") ||
				errorMessage.includes("connect ECONNREFUSED")

			if (!isConnectionError) {
				// Only clear collection and cache for non-connection errors
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

				await this.cacheManager.clearCacheFile()
			}

			this.stateManager.setSystemState(
				"Error",
				isConnectionError
					? "Qdrant service is not available. Indexing will resume automatically when the service is restored."
					: t("embeddings:orchestrator.failedDuringInitialScan", {
							errorMessage: error.message || t("embeddings:orchestrator.unknownError"),
						}),
			)

			if (isConnectionError) {
				// Set up periodic retry for Qdrant connection
				this._setupQdrantConnectionRetry()
			}

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

		// Clear any pending retry timer
		if (this._qdrantRetryTimer) {
			clearTimeout(this._qdrantRetryTimer)
			this._qdrantRetryTimer = undefined
		}

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

	/**
	 * Sets up automatic retry mechanism for Qdrant connection
	 * Will periodically check if Qdrant becomes available and resume indexing
	 */
	private _setupQdrantConnectionRetry(): void {
		// Clear any existing timer
		if (this._qdrantRetryTimer) {
			clearTimeout(this._qdrantRetryTimer)
		}

		// Don't retry forever - have a reasonable limit
		if (this._qdrantRetryCount >= this.MAX_RETRY_COUNT) {
			console.warn(
				`[CodeIndexOrchestrator] Max retry count (${this.MAX_RETRY_COUNT}) reached for Qdrant connection`,
			)
			this.stateManager.setSystemState(
				"Error",
				"Maximum retry attempts reached. Please ensure Qdrant is running and restart indexing manually.",
			)
			return
		}

		this._qdrantRetryTimer = setTimeout(async () => {
			console.log(
				`[CodeIndexOrchestrator] Attempting to reconnect to Qdrant (attempt ${this._qdrantRetryCount + 1}/${this.MAX_RETRY_COUNT})...`,
			)

			try {
				// Try to initialize the vector store
				const collectionCreated = await this.vectorStore.initialize()

				// Success! Reset retry count and start indexing
				console.log("[CodeIndexOrchestrator] Successfully reconnected to Qdrant!")
				this._qdrantRetryCount = 0
				this._qdrantRetryTimer = undefined

				// Only clear cache if a new collection was created
				if (collectionCreated) {
					await this.cacheManager.clearCacheFile()
				}

				// Resume indexing with incremental approach
				this.stateManager.setSystemState("Indexing", "Qdrant connection restored. Resuming indexing...")

				// Start the indexing process
				await this._performIncrementalIndexing()
			} catch (error: any) {
				// Still not available, schedule another retry
				this._qdrantRetryCount++
				console.warn(
					`[CodeIndexOrchestrator] Qdrant still not available, will retry in ${this.RETRY_INTERVAL_MS / 1000} seconds...`,
				)

				// Update status to show we're still retrying
				this.stateManager.setSystemState(
					"Error",
					`Qdrant service not available. Retry attempt ${this._qdrantRetryCount}/${this.MAX_RETRY_COUNT}. Next retry in ${this.RETRY_INTERVAL_MS / 1000} seconds...`,
				)

				// Schedule next retry
				this._setupQdrantConnectionRetry()
			}
		}, this.RETRY_INTERVAL_MS)
	}

	/**
	 * Performs incremental indexing based on cached file hashes
	 * This is used when recovering from Qdrant connection failures
	 */
	private async _performIncrementalIndexing(): Promise<void> {
		if (this._isProcessing) {
			console.warn("[CodeIndexOrchestrator] Already processing, skipping incremental indexing")
			return
		}

		this._isProcessing = true

		try {
			this.stateManager.setSystemState("Indexing", "Performing incremental indexing...")

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

			// Perform incremental scan using existing cache
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
				throw new Error("Incremental scan failed")
			}

			// Start the file watcher
			await this._startWatcher()

			this.stateManager.setSystemState("Indexed", "Incremental indexing completed. Index up-to-date.")
		} catch (error: any) {
			console.error("[CodeIndexOrchestrator] Error during incremental indexing:", error)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "_performIncrementalIndexing",
			})

			this.stateManager.setSystemState(
				"Error",
				`Failed during incremental indexing: ${error.message || "Unknown error"}`,
			)
			this.stopWatcher()
		} finally {
			this._isProcessing = false
		}
	}
}
