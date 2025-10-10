import Valkey, { Command, Redis } from "iovalkey"
import { createHash } from "crypto"
import * as path from "path"
import { IVectorStore, VectorStoreSearchResult, Payload } from "../interfaces"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants"
import { t } from "../../../i18n"

export class ValkeySearchVectorStore implements IVectorStore {
	private readonly vectorSize: number
	private readonly DISTANCE_METRIC = "COSINE"
	private client: Redis | null = null
	private isInitializing = false
	private readonly indexName: string
	private readonly valkeyHostname: string
	private readonly valkeyPort: number
	private readonly valkeyUsername?: string
	private readonly valkeyPassword?: string
	private readonly useSsl: boolean
	private readonly workspacePath: string

	constructor(
		workspacePath: string,
		hostname: string,
		port: number,
		vectorSize: number,
		username?: string,
		password?: string,
		useSsl: boolean = false,
	) {
		this.workspacePath = workspacePath
		this.valkeyHostname = hostname
		this.valkeyPort = port
		this.valkeyUsername = username
		this.valkeyPassword = password
		this.vectorSize = vectorSize
		this.useSsl = useSsl || false

		const hash = createHash("sha256").update(workspacePath).digest("hex")
		this.indexName = `ws-${hash.substring(0, 16)}`
		this.initializeClient()
	}

	private async initializeClient(): Promise<void> {
		if (this.isInitializing) {
			console.log("[ValkeySearch] Connection already initializing")
			return
		}

		this.isInitializing = true

		try {
			this.client = new Valkey({
				password: this.valkeyPassword,
				username: this.valkeyUsername,
				host: this.valkeyHostname,
				port: this.valkeyPort,
				tls: this.useSsl ? {} : undefined,
			})
			this.client.on("error", (error: Error) => {
				console.error("[ValkeySearch] Connection error:", error.message)
				this.isInitializing = false
				throw new Error(
					t("embeddings:vectorStore.vectorError", {
						errorMessage: error.message,
					}),
				)
			})

			this.client.on("ready", () => {
				this.isInitializing = false
				console.log("[ValkeySearch] Connection established")
			})

			this.client.on("end", () => {
				console.log("[ValkeySearch] Connection closed")
				this.destroy()
			})

			await this.client.connect()
		} catch (error) {
			this.isInitializing = false
			if (error instanceof Error) {
				throw new Error(
					t("embeddings:vectorStore.valkeyConnectionFailed", {
						valkeyUrl: `${this.valkeyHostname}:${this.valkeyPort}`,
						errorMessage: error,
					}),
				)
			}
			throw error
		}
	}

	private async ensureConnected() {
		if (!this.client || this.client.status !== "ready") {
			await this.initializeClient()
		}
	}

	async initialize(): Promise<boolean> {
		await this.ensureConnected()

		try {
			const infoArray = await this.client?.sendCommand(
				new Command("FT.INFO", [this.indexName], {
					replyEncoding: "utf-8",
				}),
			)
			const dimension = await this.getIndexDimension(this.indexName)

			if (Array.isArray(infoArray) && dimension === this.vectorSize) {
				return false
			} else {
				await this.deleteCollection()
			}
		} catch (error) {
			// Index does not exist, continue creation
		}

		try {
			await this._createIndex()
			await this.saveIndexDimension(this.indexName, this.vectorSize)
			return true
		} catch (error) {
			throw new Error(error.message)
		}
	}

	private async _createIndex(): Promise<void> {
		await this.client?.sendCommand(
			new Command("FT.CREATE", [
				this.indexName,
				"ON",
				"HASH",
				"SCHEMA",
				"vector",
				"VECTOR",
				"HNSW",
				"10",
				"TYPE",
				"FLOAT32",
				"DIM",
				String(this.vectorSize),
				"DISTANCE_METRIC",
				this.DISTANCE_METRIC,
				"M",
				"64",
				"EF_CONSTRUCTION",
				"512",
				"pathSegments",
				"TAG",
				"SEPARATOR",
				"|",
				"CASESENSITIVE",
				"filePath",
				"TAG",
				"CASESENSITIVE",
			]),
		)
		await this.saveIndexDimension(this.indexName, this.vectorSize)
	}

	buildPathSegments(filePath?: string): string[] {
		if (!filePath) return []

		const normalizedPath = path.posix.normalize(filePath.replace(/\\/g, "/"))

		if (normalizedPath === "/" || normalizedPath === "." || normalizedPath === "./") return ["/"]

		const parts = normalizedPath.split("/").filter(Boolean)
		const prefixes: string[] = []
		for (let i = 0; i < parts.length; i++) {
			const pref = "/" + parts.slice(0, i + 1).join("/")
			prefixes.push(pref)
		}
		return prefixes
	}

	async upsertPoints(
		points: Array<{
			id: string
			vector: number[]
			payload: Record<string, any>
		}>,
	): Promise<void> {
		await this.ensureConnected()

		if (points.length === 0) return

		const pipeline = this.client?.pipeline()
		for (const point of points) {
			const docId = `${this.indexName}:${point.id}`

			const pathSegments = this.buildPathSegments(point.payload?.filePath)

			const args = [
				docId,
				"filePath",
				point.payload.filePath,
				"pathSegments",
				pathSegments.join("|"),
				"codeChunk",
				point.payload.codeChunk,
				"startLine",
				String(point.payload.startLine),
				"endLine",
				String(point.payload.endLine),
				"vector",
				this.float32Buffer(point.vector),
			]

			pipeline?.call("HSET", args)
		}
		await pipeline?.exec()
	}

	float32Buffer(arr: number[]) {
		const floatArray = new Float32Array(arr)
		const float32Buffer = Buffer.from(floatArray.buffer)
		return float32Buffer
	}

	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]> {
		await this.ensureConnected()

		let directoryFilter: string | undefined = undefined
		if (directoryPrefix) {
			const normalizedPrefix = path.posix.normalize(directoryPrefix.replace(/\\/g, "/"))
			if (normalizedPrefix !== "." && normalizedPrefix !== "./") {
				directoryFilter = normalizedPrefix
			}
		}

		const vectorBuffer = this.float32Buffer(queryVector)
		const searchLimit = maxResults ?? DEFAULT_MAX_SEARCH_RESULTS

		const q = directoryFilter
			? `@pathSegments:{${directoryFilter}*} => [KNN ${searchLimit} @vector $qvec AS score]`
			: `*=>[KNN ${searchLimit} @vector $qvec AS score]`

		const searchParams = [
			this.indexName,
			q,
			"PARAMS",
			"2",
			"qvec",
			vectorBuffer,
			"RETURN",
			"5",
			"score",
			"filePath",
			"codeChunk",
			"startLine",
			"endLine",
			"DIALECT",
			"2",
			"LIMIT",
			"0",
			String(searchLimit),
		]

		const results = await this.client?.sendCommand(
			new Command("FT.SEARCH", searchParams, { replyEncoding: "utf8" }),
		)

		if (!Array.isArray(results) || results.length < 2) {
			return []
		}

		const parsedResults: VectorStoreSearchResult[] = []

		for (let i = 1; i < results.length; i += 2) {
			const docId = results[i] as string
			const fields = results[i + 1] as string[]

			const score = parseFloat(fields[1])
			const payload: Payload = {
				filePath: fields[3],
				codeChunk: fields[5],
				startLine: parseInt(fields[7]),
				endLine: parseInt(fields[9]),
			}

			parsedResults.push({
				id: docId.replace(`${this.indexName}:`, ""),
				payload: payload,
				score: 1 - score,
			})
		}

		return parsedResults
			.filter((r) => r.score >= (minScore || DEFAULT_SEARCH_MIN_SCORE))
			.sort((a, b) => b.score - a.score)
	}

	async deletePointsByFilePath(filePath: string): Promise<void> {
		await this.deletePointsByMultipleFilePaths([filePath])
	}

	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) return
		await this.ensureConnected()

		try {
			const collectionExists = await this.collectionExists()
			if (!collectionExists) {
				return
			}
			const workspaceRoot = this.workspacePath

			const normalizedFilePaths = filePaths.map((filePath) => {
				const relativePath = path.isAbsolute(filePath) ? path.relative(workspaceRoot, filePath) : filePath
				const normalizedRelativePath = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath
				return `${path.posix.normalize(normalizedRelativePath.replace(/\\/g, "/")).replaceAll(".", "\\.").replaceAll("/", "\\/").replaceAll("-", "\\-")}`
			})
			const query = `@filePath:{${normalizedFilePaths.join("|")}}`

			const result = await this.client?.sendCommand(
				new Command("FT.SEARCH", [this.indexName, query, "NOCONTENT", "LIMIT", "0", "10000"], {
					replyEncoding: "utf8",
				}),
			)

			const pipeline = this.client?.pipeline()
			if (Array.isArray(result) && result.length > 1) {
				for (let i = 1; i < result.length; i++) {
					const docId = result[i] as string
					pipeline?.call("DEL", [docId])
				}
				await pipeline?.exec()
			}
		} catch (error) {
			console.error("Failed to delete points by file paths:", error)
			throw error
		}
	}

	async deleteCollection(): Promise<void> {
		await this.ensureConnected()
		await this.clearCollection()
		await this.client?.sendCommand(new Command("FT.DROPINDEX", [this.indexName]))
		await this.removeIndexDimension(this.indexName)
	}

	async clearCollection(): Promise<void> {
		await this.ensureConnected()
		if (!this.client) {
			return
		}

		let cursor = "0"
		do {
			// Using 'SCAN' to iterate through keys with the given prefix
			const scanResult = await this.client.scan(cursor, "MATCH", `${this.indexName}:*`, "COUNT", 100)
			cursor = scanResult[0]
			const keys = scanResult[1]

			if (keys.length > 0) {
				// Deleting the found keys in a pipeline for efficiency
				const pipeline = this.client.pipeline()
				keys.forEach((key) => pipeline.del(key))
				await pipeline.exec()
			}
		} while (cursor !== "0")
	}

	async collectionExists(): Promise<boolean> {
		await this.ensureConnected()
		try {
			await this.client?.sendCommand(
				new Command("FT.INFO", [this.indexName], {
					replyEncoding: "utf-8",
				}),
			)
			return true
		} catch (error) {
			return false
		}
	}

	/**
	 * Save index dimension to Redis/Valkey using JSON
	 * @param indexName - index name
	 * @param dimension - dimension
	 */
	async saveIndexDimension(indexName: string, dimension: number): Promise<void> {
		await this.ensureConnected()
		const key = `index:meta:${indexName}`
		const metadata = {
			dimension: dimension,
			createdAt: new Date().toISOString(),
			distanceMetric: this.DISTANCE_METRIC,
		}

		await this.client?.sendCommand(new Command("JSON.SET", [key, "$", JSON.stringify(metadata)]))
	}

	/**
	 * Get index dimension from Redis/Valkey
	 * @param indexName - index name
	 * @returns dimension or null if not found
	 */
	async getIndexDimension(indexName: string): Promise<number | null> {
		await this.ensureConnected()
		try {
			const key = `index:meta:${indexName}`

			const result = await this.client?.sendCommand(
				new Command("JSON.GET", [key, "$.dimension"], {
					replyEncoding: "utf8",
				}),
			)

			if (result && typeof result === "string") {
				const parsed = JSON.parse(result)
				if (Array.isArray(parsed) && parsed.length > 0) {
					return parsed[0]
				}
			}

			return null
		} catch (error) {
			return null
		}
	}

	async removeIndexDimension(indexName: string): Promise<void> {
		await this.ensureConnected()
		const key = `index:meta:${indexName}`
		await this.client?.sendCommand(new Command("JSON.DEL", [key]))
	}

	async destroy() {
		if (this.client && this.client.disconnect) {
			this.client.disconnect()
		}
	}
}
