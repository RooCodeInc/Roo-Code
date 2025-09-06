import { QdrantClient, Schemas } from "@qdrant/js-client-rest"
import { createHash } from "crypto"
import * as path from "path"
import { VectorDatabaseAdapter, VectorRecord } from "../interfaces"
import { QdrantFilterTranslator } from "../filters"
import { DimensionMismatchError, CollectionInitError } from "../errors"
import { t } from "../../../i18n"

/**
 * Qdrant adapter implementing the provider-agnostic VectorDatabaseAdapter.
 *
 * Parity goals:
 * - Collection naming via workspace hash (handled by caller) and dimension checks.
 * - URL/port normalization (HTTPS→443, HTTP→80) with path prefix support.
 * - Payload indexes for `pathSegments.0..4`.
 * - Upsert shapes `pathSegments` from payload.filePath.
 * - Search returns results including `filePath`, `codeChunk`, `startLine`, `endLine`, `pathSegments` and filters out invalid payloads.
 */
export class QdrantAdapter implements VectorDatabaseAdapter {
	private client: QdrantClient
	private readonly name: string
	private readonly urlResolved: string
	private readonly vectorSize: number
	private readonly DISTANCE_METRIC = "Cosine"
	private readonly filterTranslator = new QdrantFilterTranslator()

	/**
	 * Creates a new Qdrant adapter bound to a workspace.
	 * @param workspacePath Path to workspace used for stable collection naming.
	 * @param qdrantUrl Qdrant endpoint (scheme/host[:port][/prefix]).
	 * @param apiKey Optional Qdrant API key.
	 * @param dimension Embedding dimension for the collection.
	 */
	constructor(
		private readonly workspacePath: string,
		qdrantUrl: string | undefined,
		private readonly apiKey: string | undefined,
		dimension: number,
		collectionSuffix?: string,
	) {
		this.vectorSize = dimension
		const parsedUrl = this.parseQdrantUrl(qdrantUrl)
		this.urlResolved = parsedUrl

		try {
			const urlObj = new URL(parsedUrl)
			let port: number
			let useHttps: boolean
			if (urlObj.port) {
				port = Number(urlObj.port)
				useHttps = urlObj.protocol === "https:"
			} else {
				if (urlObj.protocol === "https:") {
					port = 443
					useHttps = true
				} else {
					port = 80
					useHttps = false
				}
			}
			this.client = new QdrantClient({
				host: urlObj.hostname,
				https: useHttps,
				port: port,
				prefix: urlObj.pathname === "/" ? undefined : urlObj.pathname.replace(/\/+$/, ""),
				apiKey: apiKey,
				headers: { "User-Agent": "Roo-Code" },
			})
		} catch {
			this.client = new QdrantClient({ url: parsedUrl, apiKey: apiKey, headers: { "User-Agent": "Roo-Code" } })
		}

		const hash = createHash("sha256").update(workspacePath).digest("hex")
		const base = `ws-${hash.substring(0, 16)}`
		const suffix = collectionSuffix ? this.sanitizeSuffix(collectionSuffix) : ""
		this.name = suffix ? `${base}-${suffix}` : base
	}

	/**
	 * Sanitizes a collection suffix to a safe, predictable token.
	 */
	private sanitizeSuffix(raw: string): string {
		return raw
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
	}

	provider(): "qdrant" {
		return "qdrant"
	}

	capabilities() {
		return { deleteByFilter: true, filterScroll: true }
	}

	collectionName(): string {
		return this.name
	}

	private parseQdrantUrl(url: string | undefined): string {
		if (!url || url.trim() === "") return "http://localhost:6333"
		const trimmedUrl = url.trim()
		if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://") && !trimmedUrl.includes("://")) {
			return this.parseHostname(trimmedUrl)
		}
		try {
			new URL(trimmedUrl)
			return trimmedUrl
		} catch {
			return this.parseHostname(trimmedUrl)
		}
	}

	private parseHostname(hostname: string): string {
		if (hostname.includes(":")) {
			return hostname.startsWith("http") ? hostname : `http://${hostname}`
		}
		return `http://${hostname}`
	}

	private async getCollectionInfo(): Promise<Schemas["CollectionInfo"] | null> {
		try {
			const collectionInfo = await this.client.getCollection(this.name)
			return collectionInfo
		} catch (error) {
			if (error instanceof Error) {
				console.warn(`[QdrantAdapter] getCollectionInfo warning for "${this.name}":`, error.message)
			}
			return null
		}
	}

	/**
	 * Ensures the collection exists and matches the configured dimension.
	 * Returns true when created or recreated due to dimension mismatch.
	 */
	async ensureCollection(name: string, dimension: number): Promise<boolean> {
		let created = false
		try {
			const info = await this.getCollectionInfo()
			if (info === null) {
				await this.client.createCollection(this.name, {
					vectors: { size: this.vectorSize, distance: this.DISTANCE_METRIC, on_disk: true },
					hnsw_config: { m: 64, ef_construct: 512, on_disk: true },
				})
				created = true
			} else {
				const vectorsConfig = info.config?.params?.vectors
				let existingVectorSize = 0
				if (typeof vectorsConfig === "number") {
					existingVectorSize = vectorsConfig
				} else if (vectorsConfig && typeof vectorsConfig === "object" && "size" in vectorsConfig) {
					existingVectorSize = (vectorsConfig as any).size ?? 0
				}
				if (existingVectorSize !== this.vectorSize) {
					try {
						await this.recreateCollectionWithNewDimension(existingVectorSize)
						created = true
					} catch (error) {
						throw new DimensionMismatchError(
							`Failed to recreate collection '${this.name}' with new dimension ${this.vectorSize}. Previous dimension: ${existingVectorSize}. ${error instanceof Error ? error.message : String(error)}`,
						)
					}
				}
			}
			await this.createPayloadIndexes()
			return created
		} catch (error: any) {
			const errorMessage = error?.message || String(error)
			console.error(`[QdrantAdapter] Failed to ensure collection "${this.name}":`, errorMessage)
			if (error instanceof DimensionMismatchError) throw error
			if (error instanceof Error && (error as any).cause !== undefined) throw error
			throw new CollectionInitError(
				t("embeddings:vectorStore.qdrantConnectionFailed", { qdrantUrl: this.urlResolved, errorMessage }),
			)
		}
	}

	/** Recreates a collection when the dimension changes. */
	private async recreateCollectionWithNewDimension(existingVectorSize: number): Promise<void> {
		console.log(
			`[QdrantAdapter] Recreating collection '${this.name}': changing from ${existingVectorSize} to ${this.vectorSize} dimensions`,
		)
		try {
			await this.client.deleteCollection(this.name)
			await new Promise((r) => setTimeout(r, 100))
			const verificationInfo = await this.getCollectionInfo()
			if (verificationInfo !== null) {
				throw new CollectionInitError("Collection still exists after deletion attempt")
			}
			await this.client.createCollection(this.name, {
				vectors: { size: this.vectorSize, distance: this.DISTANCE_METRIC, on_disk: true },
				hnsw_config: { m: 64, ef_construct: 512, on_disk: true },
			})
		} catch (recreationError) {
			const errorMessage = recreationError instanceof Error ? recreationError.message : String(recreationError)
			throw new DimensionMismatchError(t("embeddings:vectorStore.vectorDimensionMismatch", { errorMessage }))
		}
	}

	/** Creates `pathSegments.N` payload indexes (best-effort). */
	private async createPayloadIndexes(): Promise<void> {
		for (let i = 0; i <= 4; i++) {
			try {
				await this.client.createPayloadIndex(this.name, {
					field_name: `pathSegments.${i}`,
					field_schema: "keyword",
				})
			} catch (indexError: any) {
				const msg = (indexError?.message || "").toLowerCase()
				if (!msg.includes("already exists")) {
					console.warn(
						`[QdrantAdapter] Could not create payload index pathSegments.${i} on ${this.name}:`,
						indexError?.message || indexError,
					)
				}
			}
		}
	}

	/** Upserts a batch of vector records, shaping `pathSegments` from filePath if present. */
	async upsert(records: Array<VectorRecord>): Promise<void> {
		try {
			const processed = records.map((r) => {
				const p = r.payload as any
				if (p?.filePath) {
					const segments = String(p.filePath).replace(/\\/g, "/").split("/").filter(Boolean)
					const pathSegments = segments.reduce(
						(acc: Record<string, string>, segment: string, index: number) => {
							acc[index.toString()] = segment
							return acc
						},
						{},
					)
					return { ...r, payload: { ...p, pathSegments } }
				}
				return r
			})
			await this.client.upsert(this.name, { points: processed as any, wait: true })
		} catch (error) {
			// Recover on NotFound by ensuring the collection, then retry once.
			const status = (error as any)?.status || (error as any)?.response?.status
			const message = (error as any)?.message || String(error)
			if (status === 404 || /not\s*found/i.test(message)) {
				try {
					await this.ensureCollection(this.name, this.vectorSize)
					await this.client.upsert(this.name, { points: records as any, wait: true })
					return
				} catch (retryErr) {
					console.error("[QdrantAdapter] Upsert retry after ensure failed:", retryErr)
					throw retryErr
				}
			}
			console.error("[QdrantAdapter] Failed to upsert records:", error)
			throw error
		}
	}

	/** Performs similarity search with optional filter and minScore. */
	async search(embedding: number[], limit: number, filters?: any, minScore?: number): Promise<Array<VectorRecord>> {
		try {
			const searchRequest: any = {
				query: embedding,
				filter: filters,
				score_threshold: minScore,
				limit,
				params: { hnsw_ef: 128, exact: false },
				with_payload: { include: ["filePath", "codeChunk", "startLine", "endLine", "pathSegments"] },
			}
			const res = await this.client.query(this.name, searchRequest)
			const points = (res.points || []).filter((p: any) => this.isPayloadValid(p?.payload))
			return points as any
		} catch (error) {
			console.error("[QdrantAdapter] Failed to search:", error)
			throw error
		}
	}

	/** Deletes points matching the provided filter. */
	async deleteByFilter(filter: any): Promise<void> {
		await this.client.delete(this.name, { filter, wait: true })
	}

	/** Deletes all points in the collection. */
	async clearAll(): Promise<void> {
		await this.client.delete(this.name, { filter: { must: [] }, wait: true })
	}

	/** Deletes the collection if it exists. */
	async deleteCollection(): Promise<void> {
		if (await this.collectionExists()) {
			await this.client.deleteCollection(this.name)
		}
	}

	/** Returns true if the collection exists. */
	async collectionExists(): Promise<boolean> {
		const info = await this.getCollectionInfo()
		return info !== null
	}

	private isPayloadValid(payload: Record<string, unknown> | null | undefined): boolean {
		if (!payload) return false
		const validKeys = ["filePath", "codeChunk", "startLine", "endLine"]
		return validKeys.every((k) => k in payload)
	}
}
