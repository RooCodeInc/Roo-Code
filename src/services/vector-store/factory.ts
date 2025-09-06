import { VectorDatabaseAdapter, VectorStoreConfig } from "./interfaces"
import { QdrantAdapter } from "./adapters/qdrant"
import { UnsupportedProviderError } from "./errors"

export class VectorStoreFactory {
	private static readonly supportedProviders = new Set(["qdrant"])

	static create(config: VectorStoreConfig): VectorDatabaseAdapter {
		if (config.provider === "qdrant") {
			const url = config.qdrant?.url
			const apiKey = config.qdrant?.apiKey
			return new QdrantAdapter(config.workspacePath, url, apiKey, config.dimension, config.collectionSuffix)
		}

		const supportedList = Array.from(this.supportedProviders).join(", ")
		throw new UnsupportedProviderError(
			`Unsupported vector store provider: ${config.provider}. Currently supported: ${supportedList}`,
		)
	}

	/**
	 * Register a new provider name to the list of supported providers.
	 * This allows future providers to be added without modifying error messages.
	 */
	static registerProvider(providerName: string): void {
		this.supportedProviders.add(providerName)
	}

	/**
	 * Get a list of currently supported provider names.
	 */
	static getSupportedProviders(): string[] {
		return Array.from(this.supportedProviders)
	}
}
