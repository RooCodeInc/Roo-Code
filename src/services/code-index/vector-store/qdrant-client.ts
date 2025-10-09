import { QdrantClient, Schemas } from "@qdrant/js-client-rest"
import { createHash } from "crypto"
import * as path from "path"
import { getWorkspacePath } from "../../../utils/path"
import { IVectorStore } from "../interfaces/vector-store"
import { Payload, VectorStoreSearchResult } from "../interfaces"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants"
import { t } from "../../../i18n"
import { getCurrentBranch, sanitizeBranchName } from "../../../utils/git"

/**
 * Qdrant implementation of the vector store interface
 */
export class QdrantVectorStore implements IVectorStore {
	private readonly vectorSize!: number
	private readonly DISTANCE_METRIC = "Cosine"

	private client: QdrantClient
	private collectionName: string
	private readonly qdrantUrl: string = "http://localhost:6333"
	private readonly workspacePath: string
	private readonly branchIsolationEnabled: boolean
	private currentBranch: string | null = null

	// Lazy collection creation flag
	private _collectionEnsured = false
	private _ensurePromise?: Promise<void>

	// Collection existence cache to avoid redundant API calls
	private _collectionExistsCache?: boolean
	private _collectionInfoCache?: Schemas["CollectionInfo"] | null

	// Branch name cache to avoid redundant file I/O operations
	// This cache is invalidated when GitBranchWatcher detects a branch change
	private _cachedBranchName: string | undefined | null = undefined
	private _branchCacheValid: boolean = false

	/**
	 * Creates a new Qdrant vector store
	 * @param workspacePath Path to the workspace
	 * @param url Optional URL to the Qdrant server
	 * @param vectorSize Size of the embedding vectors
	 * @param apiKey Optional API key for Qdrant authentication
	 * @param branchIsolationEnabled Whether to use branch-specific collections
	 * @param initialBranch Optional initial branch name to avoid file I/O on first call
	 */
	constructor(
		workspacePath: string,
		url: string,
		vectorSize: number,
		apiKey?: string,
		branchIsolationEnabled: boolean = false,
		initialBranch?: string,
	) {
		// Parse the URL to determine the appropriate QdrantClient configuration
		const parsedUrl = this.parseQdrantUrl(url)

		// Store the resolved URL for our property
		this.qdrantUrl = parsedUrl
		this.workspacePath = workspacePath
		this.branchIsolationEnabled = branchIsolationEnabled

		try {
			const urlObj = new URL(parsedUrl)

			// Always use host-based configuration with explicit ports to avoid QdrantClient defaults
			let port: number
			let useHttps: boolean

			if (urlObj.port) {
				// Explicit port specified - use it and determine protocol
				port = Number(urlObj.port)
				useHttps = urlObj.protocol === "https:"
			} else {
				// No explicit port - use protocol defaults
				if (urlObj.protocol === "https:") {
					port = 443
					useHttps = true
				} else {
					// http: or other protocols default to port 80
					port = 80
					useHttps = false
				}
			}

			this.client = new QdrantClient({
				host: urlObj.hostname,
				https: useHttps,
				port: port,
				prefix: urlObj.pathname === "/" ? undefined : urlObj.pathname.replace(/\/+$/, ""),
				apiKey,
				headers: {
					"User-Agent": "Roo-Code",
				},
			})
		} catch (urlError) {
			// If URL parsing fails, fall back to URL-based config
			// Note: This fallback won't correctly handle prefixes, but it's a last resort for malformed URLs.
			this.client = new QdrantClient({
				url: parsedUrl,
				apiKey,
				headers: {
					"User-Agent": "Roo-Code",
				},
			})
		}

		// Generate base collection name from workspace path
		// Note: This is NOT password hashing - it's creating a deterministic identifier
		// from the workspace path for collection naming. SHA-256 is appropriate here.
		// codeql[js/insufficient-password-hash] - False positive: not hashing passwords
		const hash = createHash("sha256").update(workspacePath).digest("hex")
		this.vectorSize = vectorSize

		// Base collection name (will be updated dynamically if branch isolation is enabled)
		this.collectionName = `ws-${hash.substring(0, 16)}`

		// If initial branch is provided, cache it to avoid file I/O on first call
		if (initialBranch !== undefined) {
			this._cachedBranchName = initialBranch
			this._branchCacheValid = true
		}
	}

	/**
	 * Parses and normalizes Qdrant server URLs to handle various input formats
	 * @param url Raw URL input from user
	 * @returns Properly formatted URL for QdrantClient
	 */
	private parseQdrantUrl(url: string | undefined): string {
		// Handle undefined/null/empty cases
		if (!url || url.trim() === "") {
			return "http://localhost:6333"
		}

		const trimmedUrl = url.trim()

		// Check if it starts with a protocol
		if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://") && !trimmedUrl.includes("://")) {
			// No protocol - treat as hostname
			return this.parseHostname(trimmedUrl)
		}

		try {
			// Attempt to parse as complete URL - return as-is, let constructor handle ports
			const parsedUrl = new URL(trimmedUrl)
			return trimmedUrl
		} catch {
			// Failed to parse as URL - treat as hostname
			return this.parseHostname(trimmedUrl)
		}
	}

	/**
	 * Handles hostname-only inputs
	 * @param hostname Raw hostname input
	 * @returns Properly formatted URL with http:// prefix
	 */
	private parseHostname(hostname: string): string {
		if (hostname.includes(":")) {
			// Has port - add http:// prefix if missing
			return hostname.startsWith("http") ? hostname : `http://${hostname}`
		} else {
			// No port - add http:// prefix without port (let constructor handle port assignment)
			return `http://${hostname}`
		}
	}

	/**
	 * Gets collection info with caching to avoid redundant API calls
	 * @param useCache Whether to use cached value (default: true)
	 * @returns Collection info or null if collection doesn't exist
	 */
	private async getCollectionInfo(useCache: boolean = true): Promise<Schemas["CollectionInfo"] | null> {
		// Return cached value if available and cache is enabled
		if (useCache && this._collectionInfoCache !== undefined) {
			return this._collectionInfoCache
		}

		try {
			const collectionInfo = await this.client.getCollection(this.collectionName)

			// Cache the result
			this._collectionInfoCache = collectionInfo
			this._collectionExistsCache = true

			return collectionInfo
		} catch (error: any) {
			// Check if this is a "not found" error (404) vs a connection error
			const status = error?.status || error?.response?.status || error?.statusCode

			if (status === 404) {
				// Collection doesn't exist - cache this result
				this._collectionInfoCache = null
				this._collectionExistsCache = false
				return null
			}

			// For other errors (connection issues, server errors, etc.), log and re-throw
			const errorMessage = error?.message || String(error)
			console.error(`[QdrantVectorStore] Error accessing collection "${this.collectionName}":`, errorMessage, {
				status,
			})

			// Re-throw connection/server errors instead of silently returning null
			throw new Error(`Failed to access Qdrant collection "${this.collectionName}": ${errorMessage}`)
		}
	}

	/**
	 * Invalidates the collection info cache
	 * Should be called when collection is created, deleted, or modified
	 */
	private _invalidateCollectionCache(): void {
		this._collectionInfoCache = undefined
		this._collectionExistsCache = undefined
	}

	/**
	 * Helper method to create or validate collection with proper dimension checking.
	 * Extracted to eliminate code duplication between initialize() and _ensureCollectionExists().
	 * @returns Promise resolving to boolean indicating if a new collection was created
	 */
	private async _createOrValidateCollection(): Promise<boolean> {
		let created = false
		const collectionInfo = await this.getCollectionInfo()

		if (collectionInfo === null) {
			// Collection doesn't exist, create it
			console.log(`[QdrantVectorStore] Creating new collection "${this.collectionName}"...`)
			await this.client.createCollection(this.collectionName, {
				vectors: {
					size: this.vectorSize,
					distance: this.DISTANCE_METRIC,
					on_disk: true,
				},
				hnsw_config: {
					m: 64,
					ef_construct: 512,
					on_disk: true,
				},
			})

			// Invalidate cache immediately after collection creation
			// This ensures cache consistency even if index creation fails
			this._invalidateCollectionCache()

			await this._createPayloadIndexes()

			console.log(`[QdrantVectorStore] Successfully created collection "${this.collectionName}"`)
			created = true
		} else {
			// Collection exists, validate vector size
			console.log(`[QdrantVectorStore] Collection "${this.collectionName}" already exists, validating...`)
			const vectorsConfig = collectionInfo.config?.params?.vectors
			let existingVectorSize: number

			if (typeof vectorsConfig === "number") {
				existingVectorSize = vectorsConfig
			} else if (
				vectorsConfig &&
				typeof vectorsConfig === "object" &&
				"size" in vectorsConfig &&
				typeof vectorsConfig.size === "number"
			) {
				existingVectorSize = vectorsConfig.size
			} else {
				existingVectorSize = 0
			}

			if (existingVectorSize !== this.vectorSize && existingVectorSize !== 0) {
				// Dimension mismatch, recreate
				console.warn(
					`[QdrantVectorStore] Dimension mismatch for "${this.collectionName}": expected ${this.vectorSize}, found ${existingVectorSize}. Recreating...`,
				)
				created = await this._recreateCollectionWithNewDimension(existingVectorSize)
				await this._createPayloadIndexes()
			} else {
				console.log(`[QdrantVectorStore] Collection "${this.collectionName}" validated successfully`)
			}
		}

		return created
	}

	/**
	 * Initializes the vector store by eagerly creating or validating the collection.
	 *
	 * This method is called by the orchestrator before full workspace scans to ensure
	 * the collection exists upfront. For file-watcher-only workflows, collection creation
	 * is deferred to _ensureCollectionExists() (lazy creation) on first write.
	 *
	 * When to use:
	 * - initialize(): Called before full scans; creates collection eagerly
	 * - _ensureCollectionExists(): Called on first write; creates collection lazily
	 *
	 * @returns Promise resolving to boolean indicating if a new collection was created
	 * @throws {Error} If collection creation fails or Qdrant connection fails
	 * @throws {Error} If vector dimension mismatch cannot be resolved
	 */
	async initialize(): Promise<boolean> {
		// Update collection name based on current branch if branch isolation is enabled
		if (this.branchIsolationEnabled) {
			await this.updateCollectionNameForBranch()
		}

		try {
			// Use shared helper to create or validate collection
			const created = await this._createOrValidateCollection()

			// Mark collection as ensured since we just created/validated it
			this._collectionEnsured = true

			return created
		} catch (error: any) {
			const errorMessage = error?.message || error
			console.error(
				`[QdrantVectorStore] Failed to initialize Qdrant collection "${this.collectionName}":`,
				errorMessage,
			)

			// If this is already a vector dimension mismatch error (identified by cause), re-throw it as-is
			if (error instanceof Error && error.cause !== undefined) {
				throw error
			}

			// Otherwise, provide a more user-friendly error message that includes the original error
			throw new Error(
				t("embeddings:vectorStore.qdrantConnectionFailed", { qdrantUrl: this.qdrantUrl, errorMessage }),
			)
		}
	}

	/**
	 * Recreates the collection with a new vector dimension, handling failures gracefully.
	 * @param existingVectorSize The current vector size of the existing collection
	 * @returns Promise resolving to boolean indicating if a new collection was created
	 */
	private async _recreateCollectionWithNewDimension(existingVectorSize: number): Promise<boolean> {
		console.warn(
			`[QdrantVectorStore] Collection ${this.collectionName} exists with vector size ${existingVectorSize}, but expected ${this.vectorSize}. Recreating collection.`,
		)

		let deletionSucceeded = false
		let recreationAttempted = false

		try {
			// Step 1: Attempt to delete the existing collection
			console.log(`[QdrantVectorStore] Deleting existing collection ${this.collectionName}...`)
			await this.client.deleteCollection(this.collectionName)
			deletionSucceeded = true
			console.log(`[QdrantVectorStore] Successfully deleted collection ${this.collectionName}`)

			// Step 2: Wait a brief moment to ensure deletion is processed
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Step 3: Verify the collection is actually deleted
			const verificationInfo = await this.getCollectionInfo()
			if (verificationInfo !== null) {
				throw new Error("Collection still exists after deletion attempt")
			}

			// Step 4: Create the new collection with correct dimensions
			console.log(
				`[QdrantVectorStore] Creating new collection ${this.collectionName} with vector size ${this.vectorSize}...`,
			)
			recreationAttempted = true
			await this.client.createCollection(this.collectionName, {
				vectors: {
					size: this.vectorSize,
					distance: this.DISTANCE_METRIC,
					on_disk: true,
				},
				hnsw_config: {
					m: 64,
					ef_construct: 512,
					on_disk: true,
				},
			})
			console.log(`[QdrantVectorStore] Successfully created new collection ${this.collectionName}`)
			return true
		} catch (recreationError) {
			const errorMessage = recreationError instanceof Error ? recreationError.message : String(recreationError)

			// Provide detailed error context based on what stage failed
			let contextualErrorMessage: string
			if (!deletionSucceeded) {
				contextualErrorMessage = `Failed to delete existing collection with vector size ${existingVectorSize}. ${errorMessage}`
			} else if (!recreationAttempted) {
				contextualErrorMessage = `Deleted existing collection but failed verification step. ${errorMessage}`
			} else {
				contextualErrorMessage = `Deleted existing collection but failed to create new collection with vector size ${this.vectorSize}. ${errorMessage}`
			}

			console.error(
				`[QdrantVectorStore] CRITICAL: Failed to recreate collection ${this.collectionName} for dimension change (${existingVectorSize} -> ${this.vectorSize}). ${contextualErrorMessage}`,
			)

			// Create a comprehensive error message for the user
			const dimensionMismatchError = new Error(
				t("embeddings:vectorStore.vectorDimensionMismatch", {
					errorMessage: contextualErrorMessage,
				}),
			)

			// Preserve the original error context
			dimensionMismatchError.cause = recreationError
			throw dimensionMismatchError
		}
	}

	/**
	 * Creates payload indexes for the collection, handling errors gracefully.
	 */
	private async _createPayloadIndexes(): Promise<void> {
		for (let i = 0; i <= 4; i++) {
			try {
				await this.client.createPayloadIndex(this.collectionName, {
					field_name: `pathSegments.${i}`,
					field_schema: "keyword",
				})
			} catch (indexError: any) {
				const errorMessage = (indexError?.message || "").toLowerCase()
				if (!errorMessage.includes("already exists")) {
					console.warn(
						`[QdrantVectorStore] Could not create payload index for pathSegments.${i} on ${this.collectionName}. Details:`,
						indexError?.message || indexError,
					)
				}
			}
		}
	}

	/**
	 * Ensures the collection exists before writing.
	 * Creates the collection and indexes lazily on first write.
	 * Uses promise-based locking to prevent race conditions from concurrent calls.
	 *
	 * This method is called by upsertPoints() to implement lazy collection creation.
	 * Unlike initialize(), which eagerly creates collections for full scans, this method
	 * defers creation until the first write operation, reducing storage overhead for
	 * branches that are never indexed.
	 *
	 * @throws {Error} If collection creation fails or Qdrant connection fails
	 * @throws {Error} If vector dimension mismatch cannot be resolved
	 */
	private async _ensureCollectionExists(): Promise<void> {
		if (this._collectionEnsured) return

		// Prevent concurrent calls - return existing promise if already in progress
		if (this._ensurePromise) {
			return this._ensurePromise
		}

		// Create and store the ensure promise
		this._ensurePromise = (async () => {
			try {
				// Update collection name based on current branch if branch isolation is enabled
				if (this.branchIsolationEnabled) {
					await this.updateCollectionNameForBranch()
				}

				// Use shared helper to create or validate collection
				await this._createOrValidateCollection()

				// Only set flag on success
				this._collectionEnsured = true
			} catch (error: any) {
				// Reset promise on error so next call can retry
				this._ensurePromise = undefined

				const errorMessage = error?.message || error
				console.error(
					`[QdrantVectorStore] Failed to ensure collection "${this.collectionName}" exists:`,
					errorMessage,
				)

				// If this is already a vector dimension mismatch error, re-throw as-is
				if (error instanceof Error && error.cause !== undefined) {
					throw error
				}

				// Otherwise, provide a user-friendly error message
				throw new Error(
					t("embeddings:vectorStore.qdrantConnectionFailed", { qdrantUrl: this.qdrantUrl, errorMessage }),
				)
			} finally {
				// Clear promise after completion (success or failure)
				this._ensurePromise = undefined
			}
		})()

		return this._ensurePromise
	}

	/**
	 * Upserts points into the vector store
	 * @param points Array of points to upsert
	 */
	async upsertPoints(
		points: Array<{
			id: string
			vector: number[]
			payload: Record<string, any>
		}>,
	): Promise<void> {
		try {
			// Ensure collection exists before writing
			await this._ensureCollectionExists()

			const processedPoints = points.map((point) => {
				if (point.payload?.filePath) {
					const segments = point.payload.filePath.split(path.sep).filter(Boolean)
					const pathSegments = segments.reduce(
						(acc: Record<string, string>, segment: string, index: number) => {
							acc[index.toString()] = segment
							return acc
						},
						{},
					)
					return {
						...point,
						payload: {
							...point.payload,
							pathSegments,
						},
					}
				}
				return point
			})

			await this.client.upsert(this.collectionName, {
				points: processedPoints,
				wait: true,
			})
		} catch (error) {
			console.error("Failed to upsert points:", error)
			throw error
		}
	}

	/**
	 * Checks if a payload is valid
	 * @param payload Payload to check
	 * @returns Boolean indicating if the payload is valid
	 */
	private isPayloadValid(payload: Record<string, unknown> | null | undefined): payload is Payload {
		if (!payload) {
			return false
		}
		const validKeys = ["filePath", "codeChunk", "startLine", "endLine"]
		const hasValidKeys = validKeys.every((key) => key in payload)
		return hasValidKeys
	}

	/**
	 * Searches for similar vectors
	 * @param queryVector Vector to search for
	 * @param directoryPrefix Optional directory prefix to filter results
	 * @param minScore Optional minimum score threshold
	 * @param maxResults Optional maximum number of results to return
	 * @returns Promise resolving to search results
	 */
	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]> {
		try {
			// If collection doesn't exist yet, return empty results
			const collectionInfo = await this.getCollectionInfo()
			if (collectionInfo === null) {
				return []
			}

			let filter = undefined

			if (directoryPrefix) {
				// Check if the path represents current directory
				const normalizedPrefix = path.posix.normalize(directoryPrefix.replace(/\\/g, "/"))
				// Note: path.posix.normalize("") returns ".", and normalize("./") returns "./"
				if (normalizedPrefix === "." || normalizedPrefix === "./") {
					// Don't create a filter - search entire workspace
					filter = undefined
				} else {
					// Remove leading "./" from paths like "./src" to normalize them
					const cleanedPrefix = path.posix.normalize(
						normalizedPrefix.startsWith("./") ? normalizedPrefix.slice(2) : normalizedPrefix,
					)
					const segments = cleanedPrefix.split("/").filter(Boolean)
					if (segments.length > 0) {
						filter = {
							must: segments.map((segment, index) => ({
								key: `pathSegments.${index}`,
								match: { value: segment },
							})),
						}
					}
				}
			}

			const searchRequest = {
				query: queryVector,
				filter,
				score_threshold: minScore ?? DEFAULT_SEARCH_MIN_SCORE,
				limit: maxResults ?? DEFAULT_MAX_SEARCH_RESULTS,
				params: {
					hnsw_ef: 128,
					exact: false,
				},
				with_payload: {
					include: ["filePath", "codeChunk", "startLine", "endLine", "pathSegments"],
				},
			}

			const operationResult = await this.client.query(this.collectionName, searchRequest)
			const filteredPoints = operationResult.points.filter((p) => this.isPayloadValid(p.payload))

			return filteredPoints as VectorStoreSearchResult[]
		} catch (error) {
			console.error("Failed to search points:", error)
			throw error
		}
	}

	/**
	 * Deletes points by file path
	 * @param filePath Path of the file to delete points for
	 */
	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) {
			return
		}

		try {
			// First check if the collection exists
			const collectionExists = await this.collectionExists()
			if (!collectionExists) {
				console.warn(
					`[QdrantVectorStore] Skipping deletion - collection "${this.collectionName}" does not exist`,
				)
				return
			}

			const workspaceRoot = this.workspacePath

			// Build filters using pathSegments to match the indexed fields
			const filters = filePaths.map((filePath) => {
				// IMPORTANT: Use the relative path to match what's stored in upsertPoints
				// upsertPoints stores the relative filePath, not the absolute path
				const relativePath = path.isAbsolute(filePath) ? path.relative(workspaceRoot, filePath) : filePath

				// Normalize the relative path
				const normalizedRelativePath = path.normalize(relativePath)

				// Split the path into segments like we do in upsertPoints
				const segments = normalizedRelativePath.split(path.sep).filter(Boolean)

				// Create a filter that matches all segments of the path
				// This ensures we only delete points that match the exact file path
				const mustConditions = segments.map((segment, index) => ({
					key: `pathSegments.${index}`,
					match: { value: segment },
				}))

				return { must: mustConditions }
			})

			// Use 'should' to match any of the file paths (OR condition)
			const filter = filters.length === 1 ? filters[0] : { should: filters }

			await this.client.delete(this.collectionName, {
				filter,
				wait: true,
			})
		} catch (error: any) {
			// Extract more detailed error information
			const errorMessage = error?.message || String(error)
			const errorStatus = error?.status || error?.response?.status || error?.statusCode
			const errorDetails = error?.response?.data || error?.data || ""

			console.error(`[QdrantVectorStore] Failed to delete points by file paths:`, {
				error: errorMessage,
				status: errorStatus,
				details: errorDetails,
				collection: this.collectionName,
				fileCount: filePaths.length,
				// Include first few file paths for debugging (avoid logging too many)
				samplePaths: filePaths.slice(0, 3),
			})
		}
	}

	/**
	 * Deletes the entire collection.
	 */
	async deleteCollection(): Promise<void> {
		try {
			// Check if collection exists before attempting deletion to avoid errors
			if (await this.collectionExists()) {
				await this.client.deleteCollection(this.collectionName)

				// Invalidate cache after deleting collection
				this._invalidateCollectionCache()
			}
		} catch (error) {
			console.error(`[QdrantVectorStore] Failed to delete collection ${this.collectionName}:`, error)
			throw error // Re-throw to allow calling code to handle it
		}
	}

	/**
	 * Clears all points from the collection
	 */
	async clearCollection(): Promise<void> {
		try {
			// Only clear if collection exists
			const exists = await this.collectionExists()
			if (!exists) {
				console.warn(`[QdrantVectorStore] Skipping clear - collection "${this.collectionName}" does not exist`)
				return
			}

			await this.client.delete(this.collectionName, {
				filter: {
					must: [],
				},
				wait: true,
			})
		} catch (error) {
			console.error("Failed to clear collection:", error)
			throw error
		}
	}

	/**
	 * Checks if the collection exists
	 * @returns Promise resolving to boolean indicating if the collection exists
	 */
	async collectionExists(): Promise<boolean> {
		const collectionInfo = await this.getCollectionInfo()
		return collectionInfo !== null
	}

	/**
	 * Updates the collection name based on the current Git branch
	 * Only called when branch isolation is enabled
	 * Uses cached branch name to avoid redundant file I/O operations
	 */
	private async updateCollectionNameForBranch(): Promise<void> {
		// Use cached branch name if available, otherwise fetch from git
		let branch: string | undefined
		if (this._branchCacheValid) {
			branch = this._cachedBranchName ?? undefined
		} else {
			branch = await getCurrentBranch(this.workspacePath)
			// Cache the branch name for future calls
			this._cachedBranchName = branch
			this._branchCacheValid = true
		}

		// Generate base collection name
		// Note: This is NOT password hashing - it's creating a deterministic identifier
		// from the workspace path for collection naming. SHA-256 is appropriate here.
		// codeql[js/insufficient-password-hash] - False positive: not hashing passwords
		const hash = createHash("sha256").update(this.workspacePath).digest("hex")
		let collectionName = `ws-${hash.substring(0, 16)}`

		if (branch) {
			// Sanitize branch name for use in collection name
			const sanitizedBranch = sanitizeBranchName(branch)
			collectionName = `${collectionName}-br-${sanitizedBranch}`
			this.currentBranch = branch
		} else {
			// Detached HEAD or not a git repo - use workspace-only collection
			this.currentBranch = null
		}

		// Update the collection name and invalidate cache if name changed
		if (this.collectionName !== collectionName) {
			this.collectionName = collectionName
			this._invalidateCollectionCache()
		}
	}

	/**
	 * Invalidates the branch name cache
	 * Should be called when GitBranchWatcher detects a branch change
	 * This forces the next call to updateCollectionNameForBranch to re-read from git
	 */
	public invalidateBranchCache(): void {
		this._branchCacheValid = false
		this._cachedBranchName = undefined
	}

	/**
	 * Gets the current branch being used for the collection
	 * @returns The current branch name or null if not using branch isolation
	 */
	public getCurrentBranch(): string | null {
		return this.branchIsolationEnabled ? this.currentBranch : null
	}
}
