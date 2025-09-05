/**
 * Represents a stored or retrieved vector record.
 * @template T Optional payload shape carried alongside the vector.
 */
export interface VectorRecord<T = any> {
	id: string
	vector: number[]
	payload: T
	score?: number
}

/**
 * Generic key/value filter type passed to provider adapters.
 * Adapters are responsible for translating these into their native
 * query/filter language (see FilterTranslator in filters.ts).
 */
export type VectorFilter = Record<string, string | number | boolean>

/**
 * Declares optional capabilities that an adapter can expose so that
 * higher layers can branch behavior without provider-specific code.
 */
export interface DatabaseCapabilities {
	deleteByFilter?: boolean
	filterScroll?: boolean
}

/**
 * Provider-agnostic vector database surface consumed by higher layers.
 *
 * Implementations should provide parity with the behavior documented
 * in Code Index (naming, payload includes, filtering semantics) where
 * applicable.
 */
export interface VectorDatabaseAdapter {
	provider(): "qdrant"
	capabilities(): DatabaseCapabilities
	collectionName(): string

	/**
	 * Ensures the collection exists with the requested dimension.
	 * @returns true when the collection was created or recreated (dimension change), false when already compatible.
	 */
	ensureCollection(name: string, dimension: number): Promise<boolean>

	/**
	 * Upserts (inserts or replaces) a batch of vector records.
	 */
	upsert(records: Array<VectorRecord>): Promise<void>

	/**
	 * Vector similarity search.
	 * @param embedding Query embedding.
	 * @param limit Maximum number of results to return.
	 * @param filters Optional provider-native filter produced by a FilterTranslator.
	 * @param minScore Optional minimum similarity score threshold.
	 */
	search(embedding: number[], limit: number, filters?: any, minScore?: number): Promise<Array<VectorRecord>>

	deleteByFilter?(filter: any): Promise<void>
	clearAll(): Promise<void>
	deleteCollection(): Promise<void>
	collectionExists(): Promise<boolean>
}

/**
 * Minimal configuration required to instantiate a provider adapter via the factory.
 */
export interface VectorStoreConfig {
	provider: "qdrant"
	workspacePath: string
	dimension: number
	/** Optional collection suffix to allow feature-specific isolation (e.g., "chatmemory"). */
	collectionSuffix?: string
	qdrant?: {
		url: string
		apiKey?: string
	}
}
