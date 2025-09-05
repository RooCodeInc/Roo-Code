import { IVectorStore, VectorStoreSearchResult, Payload } from "./interfaces"
import { VectorDatabaseAdapter } from "../vector-store/interfaces"
import { CollectionManager } from "../vector-store/collection-manager"
import { FilterTranslator, QdrantFilterTranslator } from "../vector-store/filters"
import { getWorkspacePath } from "../../utils/path"

/**
 * Bridges Code Index's `IVectorStore` interface to the provider-agnostic
 * `VectorDatabaseAdapter`.
 *
 * Notes
 * - initialize() uses ensure-once and returns true on create/recreate (parity).
 * - search() builds Qdrant-compatible directory prefix filters via translator.
 * - deletePointsBy* no-ops when collection is missing (legacy parity).
 */
export class CodeIndexVectorStoreAdapter implements IVectorStore {
	private ensured = false
	constructor(
		private readonly adapter: VectorDatabaseAdapter,
		private readonly dimension: number,
		private readonly translator: FilterTranslator = new QdrantFilterTranslator(),
		private readonly workspaceRoot: string = getWorkspacePath() ?? "",
	) {}

	async initialize(): Promise<boolean> {
		const name = this.adapter.collectionName()
		const created = await CollectionManager.ensureOnce(
			(n, d) => this.adapter.ensureCollection(n, d),
			name,
			this.dimension,
		)
		this.ensured = true
		return created
	}

	/** Upserts points by mapping to adapter records. */
	async upsertPoints(points: Array<{ id: string; vector: number[]; payload: Record<string, any> }>): Promise<void> {
		const records = points.map((p) => ({ id: p.id, vector: p.vector, payload: p.payload }))
		await this.adapter.upsert(records)
	}

	/**
	 * Vector similarity search.
	 * @param queryVector Query embedding.
	 * @param directoryPrefix Optional directory prefix filter; '.' or './' result in no filter.
	 * @param minScore Optional minimum similarity score.
	 * @param maxResults Optional max number of results.
	 */
	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]> {
		const filter = this.translator.directoryPrefixToFilter(directoryPrefix)
		const results = await this.adapter.search(queryVector, maxResults ?? 10, filter, minScore)
		return results.map((r) => ({ id: r.id, score: (r as any).score, payload: r.payload as Payload }))
	}

	/** Deletes all points for a single file path. */
	async deletePointsByFilePath(filePath: string): Promise<void> {
		await this.deletePointsByMultipleFilePaths([filePath])
	}

	/**
	 * Deletes all points for the provided file paths. For parity, this is a no-op
	 * when the collection does not exist.
	 */
	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) return
		const caps = this.adapter.capabilities()
		const filter = this.translator.filePathsToDeleteFilter(filePaths, this.workspaceRoot)
		if (caps.deleteByFilter && typeof this.adapter.deleteByFilter === "function" && filter) {
			// Match legacy behavior: no-op if collection doesn't exist
			if (!(await this.adapter.collectionExists())) return
			await this.adapter.deleteByFilter(filter)
		} else {
			// No-op fallback for now since Qdrant supports delete-by-filter
		}
	}

	/** Clears all points from the current collection. */
	async clearCollection(): Promise<void> {
		await this.adapter.clearAll()
	}

	/** Deletes the current collection. */
	async deleteCollection(): Promise<void> {
		await this.adapter.deleteCollection()
	}

	/** Returns true if the current collection exists. */
	async collectionExists(): Promise<boolean> {
		return this.adapter.collectionExists()
	}
}
