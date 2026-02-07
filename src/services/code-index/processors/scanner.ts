import { listFiles } from "../../glob/list-files"
import { Ignore } from "ignore"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"
import { stat } from "fs/promises"
import * as path from "path"
import { generateNormalizedAbsolutePath, generateRelativeFilePath } from "../shared/get-relative-path"
import { getWorkspacePathForContext } from "../../../utils/path"
import { scannerExtensions } from "../shared/supported-extensions"
import * as vscode from "vscode"
import { CodeBlock, ICodeParser, IEmbedder, IVectorStore, IDirectoryScanner } from "../interfaces"
import { createHash } from "crypto"
import { v5 as uuidv5 } from "uuid"
import pLimit from "p-limit"
import { Mutex } from "async-mutex"
import { CacheManager } from "../cache-manager"
import { t } from "../../../i18n"
import {
	QDRANT_CODE_BLOCK_NAMESPACE,
	MAX_FILE_SIZE_BYTES,
	MAX_LIST_FILES_LIMIT_CODE_INDEX,
	BATCH_SEGMENT_THRESHOLD,
	MAX_BATCH_RETRIES,
	INITIAL_RETRY_DELAY_MS,
	PARSING_CONCURRENCY,
	BATCH_PROCESSING_CONCURRENCY,
	MAX_PENDING_BATCHES,
} from "../constants"
import { isPathInIgnoredDirectory } from "../../glob/ignore-utils"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { sanitizeErrorMessage } from "../shared/validation-helpers"
import { Package } from "../../../shared/package"
import { createAsyncQueue } from "../../../utils/asyncQueue"

export class DirectoryScanner implements IDirectoryScanner {
	private readonly batchSegmentThreshold: number

	constructor(
		private readonly embedder: IEmbedder,
		private readonly qdrantClient: IVectorStore,
		private readonly codeParser: ICodeParser,
		private readonly cacheManager: CacheManager,
		private readonly ignoreInstance: Ignore,
		batchSegmentThreshold?: number,
	) {
		// Get the configurable batch size from VSCode settings, fallback to default
		// If not provided in constructor, try to get from VSCode settings
		if (batchSegmentThreshold !== undefined) {
			this.batchSegmentThreshold = batchSegmentThreshold
		} else {
			try {
				this.batchSegmentThreshold = vscode.workspace
					.getConfiguration(Package.name)
					.get<number>("codeIndex.embeddingBatchSize", BATCH_SEGMENT_THRESHOLD)
			} catch {
				// In test environment, vscode.workspace might not be available
				this.batchSegmentThreshold = BATCH_SEGMENT_THRESHOLD
			}
		}
	}

	/**
	 * Recursively scans a directory for code blocks in supported files.
	 * @param directoryPath The directory to scan
	 * @param rooIgnoreController Optional RooIgnoreController instance for filtering
	 * @param context VS Code ExtensionContext for cache storage
	 * @param onError Optional error handler callback
	 * @returns AsyncGenerator that yields progress updates and final result
	 */
	public async *scanDirectory(
		directory: string,
		onError?: (error: Error) => void,
		onBlocksIndexed?: (indexedCount: number) => void,
		onFileParsed?: (fileBlockCount: number) => void,
		onFileDiscovered?: () => void,
		onFileFullyProcessedOrAlreadyProcessed?: (fileBlockCount?: number) => void,
	): AsyncGenerator<
		| { type: "progress"; processed: number; skipped: number; totalBlockCount: number }
		| { type: "complete"; stats: { processed: number; skipped: number }; totalBlockCount: number }
	> {
		const directoryPath = directory
		// Capture workspace context at scan start
		const scanWorkspace = getWorkspacePathForContext(directoryPath)

		// Initialize RooIgnoreController
		const ignoreController = new RooIgnoreController(directoryPath)
		await ignoreController.initialize()

		// Initialize tracking variables
		const processedFiles = new Set<string>()
		let processedCount = 0
		let skippedCount = 0

		// Initialize parallel processing tools
		const parseLimiter = pLimit(PARSING_CONCURRENCY) // Concurrency for file parsing
		const batchLimiter = pLimit(BATCH_PROCESSING_CONCURRENCY) // Concurrency for batch processing
		const mutex = new Mutex()

		// Shared batch accumulators (protected by mutex)
		let currentBatchBlocks: CodeBlock[] = []
		let currentBatchTexts: string[] = []
		let currentBatchFileInfos: { filePath: string; fileHash: string; isNew: boolean }[] = []
		// Track block count per file in the current batch
		let currentBatchFileBlockCounts: Map<string, number> = new Map()
		const activeBatchPromises = new Set<Promise<unknown>>()
		let pendingBatchCount = 0

		// Initialize block counter
		let totalBlockCount = 0

		// Create async queues for streaming file processing and progress updates
		const fileQueue = createAsyncQueue<string>({ limit: MAX_LIST_FILES_LIMIT_CODE_INDEX })

		// Progress queue to collect updates from parallel tasks
		type ProgressUpdate = {
			type: "progress"
			processed: number
			skipped: number
			totalBlockCount: number
		}
		const progressQueue = createAsyncQueue<ProgressUpdate>({ limit: MAX_LIST_FILES_LIMIT_CODE_INDEX })

		// Start background task to discover and queue files
		const discoveryTask = (async () => {
			try {
				// Get all files recursively (handles .gitignore automatically)
				// listFiles now yields paths one at a time for memory efficiency
				for await (const filePath of listFiles(directoryPath, true, MAX_LIST_FILES_LIMIT_CODE_INDEX)) {
					// Filter out directories (marked with trailing '/')
					if (filePath.endsWith("/")) {
						continue
					}

					// Filter by supported extensions, ignore patterns, and excluded directories
					const ext = path.extname(filePath).toLowerCase()
					const relativeFilePath = generateRelativeFilePath(filePath, scanWorkspace)

					// Check if file is in an ignored directory using the shared helper
					// Use relative path to avoid matching parent directories outside the workspace
					if (isPathInIgnoredDirectory(relativeFilePath)) {
						continue
					}

					// Check if file is supported and not ignored
					if (scannerExtensions.includes(ext) && !this.ignoreInstance.ignores(relativeFilePath)) {
						// Filter paths using .rooignore
						const allowedPaths = ignoreController.filterPaths([filePath])
						if (allowedPaths.length > 0) {
							// Report file discovery
							onFileDiscovered?.()
							// Queue file for processing
							fileQueue.enqueue(filePath)
						}
					}
				}
			} catch (error) {
				console.error(`Error during file discovery in workspace ${scanWorkspace}:`, error)
				fileQueue.error(error instanceof Error ? error : new Error(String(error)))
			} finally {
				fileQueue.complete()
			}
		})()

		// Process files as they arrive from the queue in parallel
		const processingPromises = new Set<Promise<void>>()
		let processTask = (async () => {
			for await (const filePath of fileQueue) {
				const processPromise = parseLimiter(async () => {
					try {
						// Check file size
						const stats = await stat(filePath)
						if (stats.size > MAX_FILE_SIZE_BYTES) {
							skippedCount++ // Skip large files
							return
						}

						// Read file content
						const content = await vscode.workspace.fs
							.readFile(vscode.Uri.file(filePath))
							.then((buffer) => Buffer.from(buffer).toString("utf-8"))

						// Calculate current hash
						const currentFileHash = createHash("sha256").update(content).digest("hex")
						processedFiles.add(filePath)

						// Check against cache
						const cachedFileHash = this.cacheManager.getHash(filePath)
						const isNewFile = !cachedFileHash
						if (cachedFileHash === currentFileHash) {
							// File is unchanged - report as fully processed
							onFileFullyProcessedOrAlreadyProcessed?.()
							skippedCount++
							return
						}

						// File is new or changed - parse it using the injected parser function
						const blocks = await this.codeParser.parseFile(filePath, { content, fileHash: currentFileHash })
						const fileBlockCount = blocks.length
						onFileParsed?.(fileBlockCount)
						processedCount++

						// Queue progress update for each processed file
						progressQueue.enqueue({
							type: "progress" as const,
							processed: processedCount,
							skipped: skippedCount,
							totalBlockCount,
						})

						// Process embeddings if configured
						if (this.embedder && this.qdrantClient && blocks.length > 0) {
							// Add to batch accumulators
							let addedBlocksFromFile = false
							const fileBlocksPromises = []

							for (const block of blocks) {
								const trimmedContent = block.content.trim()
								if (trimmedContent) {
									const release = await mutex.acquire()
									try {
										currentBatchBlocks.push(block)
										currentBatchTexts.push(trimmedContent)
										addedBlocksFromFile = true

										// Check if batch threshold is met
										if (currentBatchBlocks.length >= this.batchSegmentThreshold) {
											// Wait if we've reached the maximum pending batches
											while (pendingBatchCount >= MAX_PENDING_BATCHES) {
												// Wait for at least one batch to complete
												await Promise.race(activeBatchPromises)
											}

											// Copy current batch data and clear accumulators
											const batchBlocks = [...currentBatchBlocks]
											const batchTexts = [...currentBatchTexts]
											const batchFileInfos = [...currentBatchFileInfos]
											const batchFileBlockCounts = new Map(currentBatchFileBlockCounts)
											currentBatchBlocks = []
											currentBatchTexts = []
											currentBatchFileInfos = []
											currentBatchFileBlockCounts.clear()

											// Increment pending batch count
											pendingBatchCount++

											// Queue batch processing
											const batchPromise = batchLimiter(() =>
												this.processBatch(
													batchBlocks,
													batchTexts,
													batchFileInfos,
													batchFileBlockCounts,
													scanWorkspace,
													onError,
													onBlocksIndexed,
													onFileFullyProcessedOrAlreadyProcessed,
												),
											)
											activeBatchPromises.add(batchPromise)
											fileBlocksPromises.push(batchPromise)

											// Clean up completed promises to prevent memory accumulation
											batchPromise.finally(() => {
												activeBatchPromises.delete(batchPromise)
												pendingBatchCount--
											})
										}
									} finally {
										release()
									}
								}
							}

							// Add file info once per file (outside the block loop)
							if (addedBlocksFromFile) {
								let fileProcessedPromise = Promise.all(fileBlocksPromises)
								activeBatchPromises.add(fileProcessedPromise)
								fileProcessedPromise.finally(() => {
									activeBatchPromises.delete(fileProcessedPromise)
								})

								const release = await mutex.acquire()
								try {
									totalBlockCount += fileBlockCount
									currentBatchFileInfos.push({
										filePath,
										fileHash: currentFileHash,
										isNew: isNewFile,
									})
									// Track block count for this file in the current batch
									currentBatchFileBlockCounts.set(filePath, fileBlockCount)
								} finally {
									release()
								}
							}
						} else {
							// Only update hash if not being processed in a batch

							this.cacheManager.updateHash(filePath, currentFileHash)
						}
					} catch (error) {
						console.error(`Error processing file ${filePath} in workspace ${scanWorkspace}:`, error)
						TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
							error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
							stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
							location: "scanDirectory:processFile",
						})
						if (onError) {
							onError(
								error instanceof Error
									? new Error(`${error.message} (Workspace: ${scanWorkspace}, File: ${filePath})`)
									: new Error(
											t("embeddings:scanner.unknownErrorProcessingFile", { filePath }) +
												` (Workspace: ${scanWorkspace})`,
										),
							)
						}
					}
				})
				processingPromises.add(processPromise)
				processPromise.finally(() => {
					processingPromises.delete(processPromise)
				})
			}
			await discoveryTask

			// Wait for all processing to complete, don't use Promise.all
			// To avoid holding all the promises in memory
			for (let promise; (promise = processingPromises.values().next().value); ) {
				await promise
			}

			progressQueue.complete()
		})()

		for await (const update of progressQueue) {
			yield update
		}

		await processTask

		// Process any remaining items in batch
		if (currentBatchBlocks.length > 0) {
			const release = await mutex.acquire()
			try {
				// Copy current batch data and clear accumulators
				const batchBlocks = [...currentBatchBlocks]
				const batchTexts = [...currentBatchTexts]
				const batchFileInfos = [...currentBatchFileInfos]
				const batchFileBlockCounts = new Map(currentBatchFileBlockCounts)
				currentBatchBlocks = []
				currentBatchTexts = []
				currentBatchFileInfos = []
				currentBatchFileBlockCounts.clear()

				// Increment pending batch count for final batch
				pendingBatchCount++

				// Queue final batch processing
				const batchPromise = batchLimiter(() =>
					this.processBatch(
						batchBlocks,
						batchTexts,
						batchFileInfos,
						batchFileBlockCounts,
						scanWorkspace,
						onError,
						onBlocksIndexed,
						onFileFullyProcessedOrAlreadyProcessed,
					),
				)
				activeBatchPromises.add(batchPromise)

				// Clean up completed promises to prevent memory accumulation
				batchPromise.finally(() => {
					activeBatchPromises.delete(batchPromise)
					pendingBatchCount--
				})
			} finally {
				release()
			}
		}

		// Wait for all batch processing to complete
		// This should be okay, as we don't expect a huge number of batches at this point of time
		await Promise.all(activeBatchPromises)

		// Handle deleted files
		if (this.qdrantClient) {
			try {
				// Delete hashes for files that were not processed (deleted or no longer supported)
				const deletedFilePaths = this.cacheManager.deleteHashesNotIn(Array.from(processedFiles))

				// Delete points from vector store for the deleted files
				if (deletedFilePaths.length > 0) {
					try {
						await this.qdrantClient.deletePointsByMultipleFilePaths(deletedFilePaths)
					} catch (error: any) {
						const errorStatus = error?.status || error?.response?.status || error?.statusCode
						const errorMessage = error instanceof Error ? error.message : String(error)

						console.error(
							`[DirectoryScanner] Failed to delete points for ${deletedFilePaths.length} files in workspace ${scanWorkspace}:`,
							error,
						)

						TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
							error: sanitizeErrorMessage(errorMessage),
							stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
							location: "scanDirectory:deleteRemovedFiles",
							errorStatus: errorStatus,
							fileCount: deletedFilePaths.length,
						})

						if (onError) {
							// Report error to error handler
							onError(
								error instanceof Error
									? new Error(
											`Failed to delete points for ${deletedFilePaths.length} files. ${error.message} (Workspace: ${scanWorkspace})`,
										)
									: new Error(
											t("embeddings:scanner.unknownErrorDeletingPoints", {
												filePath: `${deletedFilePaths.length} files`,
											}) + ` (Workspace: ${scanWorkspace})`,
										),
							)
						}
						// Log error and continue processing instead of re-throwing
						console.error(`Failed to delete points for removed files in workspace ${scanWorkspace}:`, error)
					}
				}
			} catch (error: any) {
				console.error(`[DirectoryScanner] Failed to handle deleted files in workspace ${scanWorkspace}:`, error)

				if (onError) {
					onError(
						error instanceof Error
							? new Error(`${error.message} (Workspace: ${scanWorkspace})`)
							: new Error(`Failed to handle deleted files (Workspace: ${scanWorkspace})`),
					)
				}
			}
		}

		// Yield final result
		yield {
			type: "complete" as const,
			stats: {
				processed: processedCount,
				skipped: skippedCount,
			},
			totalBlockCount,
		}
	}

	private async processBatch(
		batchBlocks: CodeBlock[],
		batchTexts: string[],
		batchFileInfos: { filePath: string; fileHash: string; isNew: boolean }[],
		batchFileBlockCounts: Map<string, number>,
		scanWorkspace: string,
		onError?: (error: Error) => void,
		onBlocksIndexed?: (indexedCount: number) => void,
		onFileFullyProcessedOrAlreadyProcessed?: (fileBlockCount?: number) => void,
	): Promise<void> {
		if (batchBlocks.length === 0) return

		let attempts = 0
		let success = false
		let lastError: Error | null = null

		while (attempts < MAX_BATCH_RETRIES && !success) {
			attempts++
			try {
				// --- Deletion Step ---
				const uniqueFilePaths = [
					...new Set(
						batchFileInfos
							.filter((info) => !info.isNew) // Only modified files (not new)
							.map((info) => info.filePath),
					),
				]
				if (uniqueFilePaths.length > 0) {
					try {
						await this.qdrantClient.deletePointsByMultipleFilePaths(uniqueFilePaths)
					} catch (deleteError: any) {
						const errorStatus =
							deleteError?.status || deleteError?.response?.status || deleteError?.statusCode
						const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError)

						console.error(
							`[DirectoryScanner] Failed to delete points for ${uniqueFilePaths.length} files before upsert in workspace ${scanWorkspace}:`,
							deleteError,
						)

						TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
							error: sanitizeErrorMessage(errorMessage),
							stack:
								deleteError instanceof Error
									? sanitizeErrorMessage(deleteError.stack || "")
									: undefined,
							location: "processBatch:deletePointsByMultipleFilePaths",
							fileCount: uniqueFilePaths.length,
							errorStatus: errorStatus,
						})

						// Re-throw with workspace context
						throw new Error(
							`Failed to delete points for ${uniqueFilePaths.length} files. Workspace: ${scanWorkspace}. ${errorMessage}`,
							{ cause: deleteError },
						)
					}
				}
				// --- End Deletion Step ---

				// Create embeddings for batch
				const { embeddings } = await this.embedder.createEmbeddings(batchTexts)

				// Prepare points for Qdrant
				const points = batchBlocks.map((block, index) => {
					const normalizedAbsolutePath = generateNormalizedAbsolutePath(block.file_path, scanWorkspace)

					// Use segmentHash for unique ID generation to handle multiple segments from same line
					const pointId = uuidv5(block.segmentHash, QDRANT_CODE_BLOCK_NAMESPACE)

					return {
						id: pointId,
						vector: embeddings[index],
						payload: {
							filePath: generateRelativeFilePath(normalizedAbsolutePath, scanWorkspace),
							codeChunk: block.content,
							startLine: block.start_line,
							endLine: block.end_line,
							segmentHash: block.segmentHash,
						},
					}
				})

				// Upsert points to Qdrant
				await this.qdrantClient.upsertPoints(points)
				onBlocksIndexed?.(batchBlocks.length)

				// Update hashes for successfully processed files in this batch
				this.cacheManager.updateHashes(
					batchFileInfos.map((info) => ({ filePath: info.filePath, hash: info.fileHash })),
				)

				// Report that files have been fully processed
				for (const fileInfo of batchFileInfos) {
					const fileBlockCount = batchFileBlockCounts.get(fileInfo.filePath)
					if (fileBlockCount !== undefined) {
						onFileFullyProcessedOrAlreadyProcessed?.(fileBlockCount)
					}
				}
				success = true
			} catch (error) {
				lastError = error as Error
				console.error(
					`[DirectoryScanner] Error processing batch (attempt ${attempts}) in workspace ${scanWorkspace}:`,
					error,
				)
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
					stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
					location: "processBatch:retry",
					attemptNumber: attempts,
					batchSize: batchBlocks.length,
				})

				if (attempts < MAX_BATCH_RETRIES) {
					const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempts - 1)
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}

		if (!success && lastError) {
			console.error(`[DirectoryScanner] Failed to process batch after ${MAX_BATCH_RETRIES} attempts`)
			if (onError) {
				// Preserve the original error message from embedders which now have detailed i18n messages
				const errorMessage = lastError.message || "Unknown error"

				// For other errors, provide context
				onError(
					new Error(
						t("embeddings:scanner.failedToProcessBatchWithError", {
							maxRetries: MAX_BATCH_RETRIES,
							errorMessage,
						}),
					),
				)
			}
		}
	}
}
