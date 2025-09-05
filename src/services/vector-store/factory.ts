import { VectorDatabaseAdapter, VectorStoreConfig } from "./interfaces"
import { QdrantAdapter } from "./adapters/qdrant"

export class VectorStoreFactory {
	static create(config: VectorStoreConfig): VectorDatabaseAdapter {
		if (config.provider === "qdrant") {
			const url = config.qdrant?.url
			const apiKey = config.qdrant?.apiKey
			return new QdrantAdapter(config.workspacePath, url, apiKey, config.dimension, config.collectionSuffix)
		}
		throw new Error(`Unsupported vector store provider: ${String((config as any).provider)}`)
	}
}
