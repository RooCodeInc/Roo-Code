import { ICondensationProvider, ProviderConfig } from "./types"

/**
 * Registry for managing condensation providers
 * Singleton pattern for global access
 */
export class ProviderRegistry {
	private static instance: ProviderRegistry
	private providers: Map<string, ICondensationProvider> = new Map()
	private configs: Map<string, ProviderConfig> = new Map()

	private constructor() {}

	/**
	 * Get singleton instance
	 */
	static getInstance(): ProviderRegistry {
		if (!ProviderRegistry.instance) {
			ProviderRegistry.instance = new ProviderRegistry()
		}
		return ProviderRegistry.instance
	}

	/**
	 * Register a provider
	 */
	register(provider: ICondensationProvider, config?: Partial<ProviderConfig>): void {
		this.providers.set(provider.id, provider)

		const fullConfig: ProviderConfig = {
			id: provider.id,
			enabled: config?.enabled ?? true,
			priority: config?.priority ?? 100,
			config: config?.config,
		}

		this.configs.set(provider.id, fullConfig)
	}

	/**
	 * Unregister a provider
	 */
	unregister(providerId: string): boolean {
		const deleted = this.providers.delete(providerId)
		this.configs.delete(providerId)
		return deleted
	}

	/**
	 * Get provider by ID
	 */
	getProvider(providerId: string): ICondensationProvider | undefined {
		return this.providers.get(providerId)
	}

	/**
	 * Get all registered providers
	 */
	getAllProviders(): ICondensationProvider[] {
		return Array.from(this.providers.values())
	}

	/**
	 * Get enabled providers sorted by priority
	 */
	getEnabledProviders(): ICondensationProvider[] {
		return Array.from(this.providers.values())
			.filter((p) => {
				const config = this.configs.get(p.id)
				return config?.enabled !== false
			})
			.sort((a, b) => {
				const configA = this.configs.get(a.id)
				const configB = this.configs.get(b.id)
				return (configA?.priority || 100) - (configB?.priority || 100)
			})
	}

	/**
	 * Update provider configuration
	 */
	updateConfig(providerId: string, config: Partial<ProviderConfig>): boolean {
		const existing = this.configs.get(providerId)
		if (!existing) {
			return false
		}

		this.configs.set(providerId, { ...existing, ...config })
		return true
	}

	/**
	 * Get provider configuration
	 */
	getConfig(providerId: string): ProviderConfig | undefined {
		return this.configs.get(providerId)
	}

	/**
	 * Clear all providers (for testing)
	 */
	clear(): void {
		this.providers.clear()
		this.configs.clear()
	}
}

/**
 * Convenience function to get registry instance
 */
export function getProviderRegistry(): ProviderRegistry {
	return ProviderRegistry.getInstance()
}