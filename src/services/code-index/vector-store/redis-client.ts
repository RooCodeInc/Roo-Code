import Redis from "ioredis"
import { createHash } from "crypto"
import * as path from "path"
import { v5 as uuidv5 } from "uuid"
import { IVectorStore, PointStruct, Payload, VectorStoreSearchResult } from "../interfaces"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE, REDIS_CODE_BLOCK_NAMESPACE } from "../constants"
import { t } from "../../../i18n"

/**
 * Redis Stack (RediSearch) implementation of the vector store interface
 * Uses RediSearch's HNSW-based vector similarity search
 */
export class RedisVectorStore implements IVectorStore {
	private readonly vectorSize: number
	private readonly DISTANCE_METRIC = "COSINE"

	private client: Redis
	private readonly indexName: string
	private readonly keyPrefix: string
	private readonly redisUrl: string
	private readonly workspacePath: string
	private isConnected: boolean = false

	/**
	 * Creates a new Redis vector store
	 * @param workspacePath Path to the workspace
	 * @param url Redis connection URL (e.g., redis://localhost:6379)
	 * @param vectorSize Dimension of the vectors
	 * @param password Optional Redis password
	 * @param database Optional Redis database number (default: 0)
	 */
	constructor(workspacePath: string, url: string, vectorSize: number, password?: string, database: number = 0) {
		this.workspacePath = workspacePath
		this.vectorSize = vectorSize
		this.redisUrl = url

		// Parse URL and create client
		try {
			const parsedUrl = new URL(url)
			this.client = new Redis({
				host: parsedUrl.hostname,
				port: parseInt(parsedUrl.port) || 6379,
				password: password || parsedUrl.password || undefined,
				db: database,
				lazyConnect: true,
				retryStrategy: (times) => {
					if (times > 3) {
						return null // Stop retrying after 3 attempts
					}
					return Math.min(times * 200, 1000)
				},
			})
		} catch {
			// Fallback for simple host:port format
			this.client = new Redis({
				host: url.split(":")[0] || "localhost",
				port: parseInt(url.split(":")[1]) || 6379,
				password: password || undefined,
				db: database,
				lazyConnect: true,
			})
		}

		// Generate index name from workspace path (same pattern as Qdrant)
		const hash = createHash("sha256").update(workspacePath).digest("hex")
		this.indexName = `ws-${hash.substring(0, 16)}`
		this.keyPrefix = `${this.indexName}:`

		// Set up error handler
		this.client.on("error", (err) => {
			console.error("[RedisVectorStore] Redis client error:", err.message)
		})
	}

	/**
	 * Ensures Redis connection is established
	 */
	private async ensureConnected(): Promise<void> {
		if (!this.isConnected) {
			try {
				await this.client.connect()
				this.isConnected = true
			} catch (error: any) {
				// Already connected is fine
				if (!error.message?.includes("already connected")) {
					throw error
				}
				this.isConnected = true
			}
		}
	}

	/**
	 * Checks if the RediSearch index exists
	 */
	private async indexExists(): Promise<boolean> {
		try {
			await this.ensureConnected()
			await this.client.call("FT.INFO", this.indexName)
			return true
		} catch (error: any) {
			// Index doesn't exist if we get an error
			if (error.message?.includes("Unknown index name") || error.message?.includes("Unknown Index name")) {
				return false
			}
			// Re-throw other errors
			throw error
		}
	}

	/**
	 * Gets the current vector dimension from an existing index
	 */
	private async getExistingVectorDimension(): Promise<number | null> {
		try {
			await this.ensureConnected()
			const info = (await this.client.call("FT.INFO", this.indexName)) as string[]

			// Parse FT.INFO response to find vector dimension
			// The response is a flat array: [key1, value1, key2, value2, ...]
			const attributesIndex = info.indexOf("attributes")
			if (attributesIndex === -1) return null

			const attributes = info[attributesIndex + 1] as unknown as any[][]
			for (const attr of attributes) {
				// Each attribute is an array like: [name, type, ...]
				if (Array.isArray(attr)) {
					const typeIndex = attr.indexOf("type")
					if (typeIndex !== -1 && attr[typeIndex + 1] === "VECTOR") {
						const dimIndex = attr.indexOf("DIM")
						if (dimIndex !== -1) {
							return parseInt(attr[dimIndex + 1] as string)
						}
					}
				}
			}
			return null
		} catch {
			return null
		}
	}

	/**
	 * Creates the RediSearch index with vector field
	 */
	private async createIndex(): Promise<void> {
		await this.ensureConnected()

		// Create RediSearch index with VECTOR field using HNSW algorithm
		// Schema: vector (VECTOR), filePath (TAG), codeChunk (TEXT), startLine/endLine (NUMERIC), type (TAG), pathSegments (TAGs)
		await this.client.call(
			"FT.CREATE",
			this.indexName,
			"ON",
			"HASH",
			"PREFIX",
			"1",
			this.keyPrefix,
			"SCHEMA",
			// Vector field with HNSW algorithm
			"vector",
			"VECTOR",
			"HNSW",
			"6",
			"TYPE",
			"FLOAT32",
			"DIM",
			this.vectorSize.toString(),
			"DISTANCE_METRIC",
			this.DISTANCE_METRIC,
			// Payload fields
			"filePath",
			"TAG",
			"SEPARATOR",
			"|",
			"codeChunk",
			"TEXT",
			"NOSTEM",
			"startLine",
			"NUMERIC",
			"endLine",
			"NUMERIC",
			"type",
			"TAG",
			// Path segment fields for directory filtering
			"pathSegment0",
			"TAG",
			"pathSegment1",
			"TAG",
			"pathSegment2",
			"TAG",
			"pathSegment3",
			"TAG",
			"pathSegment4",
			"TAG",
		)

		console.log(`[RedisVectorStore] Created index ${this.indexName} with vector dimension ${this.vectorSize}`)
	}

	/**
	 * Initializes the vector store
	 * @returns Promise resolving to boolean indicating if a new index was created
	 */
	async initialize(): Promise<boolean> {
		try {
			await this.ensureConnected()

			const exists = await this.indexExists()

			if (!exists) {
				// Index doesn't exist, create it
				await this.createIndex()
				return true
			}

			// Index exists, check vector dimension
			const existingDimension = await this.getExistingVectorDimension()

			if (existingDimension === this.vectorSize) {
				// Dimension matches, no action needed
				return false
			}

			// Dimension mismatch, recreate index
			if (existingDimension !== null) {
				console.warn(
					`[RedisVectorStore] Index ${this.indexName} exists with vector dimension ${existingDimension}, but expected ${this.vectorSize}. Recreating index.`,
				)
				await this.deleteCollection()
			}

			await this.createIndex()
			return true
		} catch (error: any) {
			const errorMessage = error?.message || String(error)
			console.error(`[RedisVectorStore] Failed to initialize Redis index "${this.indexName}":`, errorMessage)

			throw new Error(
				t("embeddings:vectorStore.redisConnectionFailed", { redisUrl: this.redisUrl, errorMessage }),
			)
		}
	}

	/**
	 * Converts a number array to a Float32Array buffer for Redis vector storage
	 */
	private vectorToBuffer(vector: number[]): Buffer {
		return Buffer.from(new Float32Array(vector).buffer)
	}

	/**
	 * Upserts points into the vector store
	 * @param points Array of points to upsert
	 */
	async upsertPoints(points: PointStruct[]): Promise<void> {
		if (points.length === 0) return

		try {
			await this.ensureConnected()

			const pipeline = this.client.pipeline()

			for (const point of points) {
				const key = `${this.keyPrefix}${point.id}`
				const vectorBuffer = this.vectorToBuffer(point.vector)

				// Build path segments from filePath
				const segments = point.payload?.filePath?.split(path.sep).filter(Boolean) || []
				const pathSegmentFields: Record<string, string> = {}
				for (let i = 0; i <= 4 && i < segments.length; i++) {
					pathSegmentFields[`pathSegment${i}`] = segments[i]
				}

				// Build the hash fields
				const fields: Record<string, string | Buffer> = {
					vector: vectorBuffer,
					filePath: point.payload?.filePath || "",
					codeChunk: point.payload?.codeChunk || "",
					startLine: (point.payload?.startLine ?? 0).toString(),
					endLine: (point.payload?.endLine ?? 0).toString(),
					type: point.payload?.type || "code",
					...pathSegmentFields,
				}

				// Use HSET to store the hash
				pipeline.hset(key, fields)
			}

			await pipeline.exec()
		} catch (error) {
			console.error("[RedisVectorStore] Failed to upsert points:", error)
			throw error
		}
	}

	/**
	 * Escapes special characters in RediSearch TAG values
	 */
	private escapeTagValue(value: string): string {
		// RediSearch TAG values need certain characters escaped
		return value.replace(/[,.<>{}[\]"':;!@#$%^&*()\-+=~`|\\/ ]/g, "\\$&")
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
			await this.ensureConnected()

			const vectorBuffer = this.vectorToBuffer(queryVector)
			const limit = maxResults ?? DEFAULT_MAX_SEARCH_RESULTS
			const threshold = minScore ?? DEFAULT_SEARCH_MIN_SCORE

			// Build filter query
			let filterParts: string[] = []

			// Always exclude metadata points
			filterParts.push("-@type:{metadata}")

			// Add directory prefix filter if provided
			if (directoryPrefix) {
				const normalizedPrefix = path.posix.normalize(directoryPrefix.replace(/\\/g, "/"))

				// Skip filter for current directory
				if (normalizedPrefix !== "." && normalizedPrefix !== "./") {
					const cleanedPrefix = normalizedPrefix.startsWith("./")
						? normalizedPrefix.slice(2)
						: normalizedPrefix
					const segments = cleanedPrefix.split("/").filter(Boolean)

					// Add path segment filters
					segments.forEach((segment, index) => {
						if (index <= 4) {
							filterParts.push(`@pathSegment${index}:{${this.escapeTagValue(segment)}}`)
						}
					})
				}
			}

			const filterQuery = filterParts.length > 0 ? `(${filterParts.join(" ")})` : "*"

			// Build KNN query
			// RediSearch KNN syntax: [filter]=>[KNN limit @vector $BLOB]
			const query = `${filterQuery}=>[KNN ${limit} @vector $BLOB AS __score]`

			const results = (await this.client.call(
				"FT.SEARCH",
				this.indexName,
				query,
				"PARAMS",
				"2",
				"BLOB",
				vectorBuffer,
				"SORTBY",
				"__score",
				"DIALECT",
				"2",
				"RETURN",
				"6",
				"filePath",
				"codeChunk",
				"startLine",
				"endLine",
				"__score",
				"type",
			)) as any[]

			return this.parseSearchResults(results, threshold)
		} catch (error) {
			console.error("[RedisVectorStore] Failed to search points:", error)
			throw error
		}
	}

	/**
	 * Parses RediSearch results into VectorStoreSearchResult format
	 */
	private parseSearchResults(results: any[], minScore: number): VectorStoreSearchResult[] {
		// Redis FT.SEARCH returns: [count, key1, [field1, value1, ...], key2, [field2, value2, ...], ...]
		if (!results || results.length === 0) return []

		const count = results[0] as number
		if (count === 0) return []

		const parsed: VectorStoreSearchResult[] = []

		for (let i = 1; i < results.length; i += 2) {
			const key = results[i] as string
			const fields = results[i + 1] as string[]

			if (!fields || !Array.isArray(fields)) continue

			// Parse fields array into object
			const fieldMap: Record<string, string> = {}
			for (let j = 0; j < fields.length; j += 2) {
				fieldMap[fields[j]] = fields[j + 1]
			}

			// RediSearch returns cosine distance (0 = identical, 2 = opposite)
			// Convert to similarity score (1 = identical, 0 = orthogonal, -1 = opposite)
			const distance = parseFloat(fieldMap["__score"] || "2")
			const score = 1 - distance / 2

			// Filter by minimum score
			if (score < minScore) continue

			// Skip metadata points (additional safety check)
			if (fieldMap["type"] === "metadata") continue

			// Validate required fields
			if (!fieldMap["filePath"] || !fieldMap["codeChunk"]) continue

			parsed.push({
				id: key.replace(this.keyPrefix, ""),
				score,
				payload: {
					filePath: fieldMap["filePath"],
					codeChunk: fieldMap["codeChunk"],
					startLine: parseInt(fieldMap["startLine"] || "0"),
					endLine: parseInt(fieldMap["endLine"] || "0"),
				} as Payload,
			})
		}

		return parsed
	}

	/**
	 * Deletes points by file path
	 * @param filePath Path of the file to delete points for
	 */
	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	/**
	 * Deletes points by multiple file paths
	 * @param filePaths Array of file paths to delete points for
	 */
	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) return

		try {
			await this.ensureConnected()

			// Check if index exists
			if (!(await this.indexExists())) {
				console.warn(`[RedisVectorStore] Skipping deletion - index "${this.indexName}" does not exist`)
				return
			}

			for (const filePath of filePaths) {
				// Convert to relative path if absolute
				const relativePath = path.isAbsolute(filePath) ? path.relative(this.workspacePath, filePath) : filePath

				// Normalize path
				const normalizedPath = path.normalize(relativePath)

				// Search for keys matching this filePath
				const escapedPath = this.escapeTagValue(normalizedPath.replace(/\\/g, "/"))
				const query = `@filePath:{${escapedPath}}`

				try {
					const results = (await this.client.call(
						"FT.SEARCH",
						this.indexName,
						query,
						"NOCONTENT",
						"LIMIT",
						"0",
						"10000",
					)) as any[]

					const count = results[0] as number
					if (count > 0) {
						// Extract keys and delete them
						const keys = results.slice(1) as string[]
						if (keys.length > 0) {
							await this.client.del(...keys)
						}
					}
				} catch (searchError: any) {
					// If search fails (e.g., no results), just continue
					if (!searchError.message?.includes("no such index")) {
						console.warn(
							`[RedisVectorStore] Warning during deletion search for ${filePath}:`,
							searchError.message,
						)
					}
				}
			}
		} catch (error: any) {
			console.error("[RedisVectorStore] Failed to delete points by file paths:", {
				error: error.message,
				fileCount: filePaths.length,
				samplePaths: filePaths.slice(0, 3),
			})
		}
	}

	/**
	 * Clears all points from the collection
	 */
	async clearCollection(): Promise<void> {
		try {
			await this.ensureConnected()

			// Scan and delete all keys with our prefix
			let cursor = "0"
			do {
				const [nextCursor, keys] = await this.client.scan(
					cursor,
					"MATCH",
					`${this.keyPrefix}*`,
					"COUNT",
					"1000",
				)
				cursor = nextCursor

				if (keys.length > 0) {
					await this.client.del(...keys)
				}
			} while (cursor !== "0")

			console.log(`[RedisVectorStore] Cleared all points from ${this.indexName}`)
		} catch (error) {
			console.error("[RedisVectorStore] Failed to clear collection:", error)
			throw error
		}
	}

	/**
	 * Deletes the entire collection (index and all data)
	 */
	async deleteCollection(): Promise<void> {
		try {
			await this.ensureConnected()

			// First clear all data
			await this.clearCollection()

			// Then drop the index if it exists
			if (await this.indexExists()) {
				await this.client.call("FT.DROPINDEX", this.indexName)
				console.log(`[RedisVectorStore] Dropped index ${this.indexName}`)
			}
		} catch (error) {
			console.error(`[RedisVectorStore] Failed to delete collection ${this.indexName}:`, error)
			throw error
		}
	}

	/**
	 * Checks if the collection exists
	 * @returns Promise resolving to boolean indicating if the collection exists
	 */
	async collectionExists(): Promise<boolean> {
		return this.indexExists()
	}

	/**
	 * Checks if the collection exists and has indexed points
	 * @returns Promise resolving to boolean indicating if the collection exists and has points
	 */
	async hasIndexedData(): Promise<boolean> {
		try {
			await this.ensureConnected()

			if (!(await this.indexExists())) {
				return false
			}

			// Check if the indexing completion marker exists
			const metadataId = uuidv5("__indexing_metadata__", REDIS_CODE_BLOCK_NAMESPACE)
			const metadataKey = `${this.keyPrefix}${metadataId}`

			const exists = await this.client.exists(metadataKey)
			if (exists) {
				const indexingComplete = await this.client.hget(metadataKey, "indexing_complete")
				return indexingComplete === "true"
			}

			// Backward compatibility: check if we have any data
			// Use FT.INFO to get document count
			try {
				const info = (await this.client.call("FT.INFO", this.indexName)) as any[]
				const numDocsIndex = info.indexOf("num_docs")
				if (numDocsIndex !== -1) {
					const numDocs = parseInt(info[numDocsIndex + 1] as string)
					if (numDocs > 0) {
						console.log(
							"[RedisVectorStore] No indexing metadata marker found. Using backward compatibility mode (checking num_docs > 0).",
						)
						return true
					}
				}
			} catch {
				// Ignore errors in fallback check
			}

			return false
		} catch (error) {
			console.warn("[RedisVectorStore] Failed to check if collection has data:", error)
			return false
		}
	}

	/**
	 * Marks the indexing process as complete by storing metadata
	 * Should be called after a successful full workspace scan or incremental scan
	 */
	async markIndexingComplete(): Promise<void> {
		try {
			await this.ensureConnected()

			const metadataId = uuidv5("__indexing_metadata__", REDIS_CODE_BLOCK_NAMESPACE)
			const key = `${this.keyPrefix}${metadataId}`

			// Store metadata with a zero vector
			const zeroVector = this.vectorToBuffer(new Array(this.vectorSize).fill(0))

			await this.client.hset(key, {
				vector: zeroVector,
				type: "metadata",
				indexing_complete: "true",
				completed_at: Date.now().toString(),
				filePath: "",
				codeChunk: "",
				startLine: "0",
				endLine: "0",
			})

			console.log("[RedisVectorStore] Marked indexing as complete")
		} catch (error) {
			console.error("[RedisVectorStore] Failed to mark indexing as complete:", error)
			throw error
		}
	}

	/**
	 * Marks the indexing process as incomplete by storing metadata
	 * Should be called at the start of indexing to indicate work in progress
	 */
	async markIndexingIncomplete(): Promise<void> {
		try {
			await this.ensureConnected()

			const metadataId = uuidv5("__indexing_metadata__", REDIS_CODE_BLOCK_NAMESPACE)
			const key = `${this.keyPrefix}${metadataId}`

			// Store metadata with a zero vector
			const zeroVector = this.vectorToBuffer(new Array(this.vectorSize).fill(0))

			await this.client.hset(key, {
				vector: zeroVector,
				type: "metadata",
				indexing_complete: "false",
				started_at: Date.now().toString(),
				filePath: "",
				codeChunk: "",
				startLine: "0",
				endLine: "0",
			})

			console.log("[RedisVectorStore] Marked indexing as incomplete (in progress)")
		} catch (error) {
			console.error("[RedisVectorStore] Failed to mark indexing as incomplete:", error)
			throw error
		}
	}

	/**
	 * Disconnects from Redis
	 */
	async disconnect(): Promise<void> {
		if (this.isConnected) {
			await this.client.quit()
			this.isConnected = false
		}
	}
}
