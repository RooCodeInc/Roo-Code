import { ApiHandler } from "../../api/index"
import { ApiMessage } from "../task-persistence/apiMessages"
import { getProviderRegistry } from "./ProviderRegistry"
import { NativeCondensationProvider } from "./providers/NativeProvider"
import { LosslessCondensationProvider } from "./providers/lossless"
import { TruncationCondensationProvider } from "./providers/truncation"
import { SmartCondensationProvider } from "./providers/smart"
import { BALANCED_CONFIG } from "./providers/smart/configs"
import { CondensationContext, CondensationOptions, CondensationResult, ICondensationProvider } from "./types"

/**
 * Manager for orchestrating condensation operations
 * Handles provider selection and execution
 */
export class CondensationManager {
	private static instance: CondensationManager
	private defaultProviderId: string = "native"

	private constructor() {
		// Register default providers
		this.registerDefaultProviders()
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): CondensationManager {
		if (!CondensationManager.instance) {
			CondensationManager.instance = new CondensationManager()
		}
		return CondensationManager.instance
	}

	/**
	 * Register default providers (Native, Lossless, Truncation)
	 */
	private registerDefaultProviders(): void {
		const registry = getProviderRegistry()

		// Register Native provider
		const nativeProvider = new NativeCondensationProvider()
		registry.register(nativeProvider, {
			enabled: true,
			priority: 100,
		})

		// Register Lossless provider
		const losslessProvider = new LosslessCondensationProvider()
		registry.register(losslessProvider, {
			enabled: true,
			priority: 90,
		})

		// Register Truncation provider
		const truncationProvider = new TruncationCondensationProvider()
		registry.register(truncationProvider, {
			enabled: true,
			priority: 80,
		})

		// Register Smart Provider with BALANCED config as default
		const smartProvider = new SmartCondensationProvider(BALANCED_CONFIG)
		registry.register(smartProvider, {
			enabled: true,
			priority: 95, // Between Lossless and Native
		})
	}

	/**
	 * Set default provider ID
	 */
	setDefaultProvider(providerId: string): void {
		const registry = getProviderRegistry()
		const provider = registry.getProvider(providerId)

		if (!provider) {
			throw new Error(`Provider '${providerId}' not found`)
		}

		this.defaultProviderId = providerId
	}

	/**
	 * Get default provider ID
	 */
	getDefaultProvider(): string {
		return this.defaultProviderId
	}

	/**
	 * Condense conversation using specified or default provider
	 */
	async condense(
		messages: ApiMessage[],
		apiHandler: ApiHandler,
		options?: {
			providerId?: string
			systemPrompt?: string
			taskId?: string
			prevContextTokens?: number
			targetTokens?: number
			condensingApiHandler?: ApiHandler
			customCondensingPrompt?: string
			isAutomaticTrigger?: boolean
		},
	): Promise<CondensationResult> {
		// Get provider
		const providerId = options?.providerId || this.defaultProviderId
		const provider = this.getProvider(providerId)

		// Build context
		const context: CondensationContext = {
			messages,
			systemPrompt: options?.systemPrompt || "",
			taskId: options?.taskId || "unknown",
			prevContextTokens: options?.prevContextTokens || 0,
			targetTokens: options?.targetTokens,
		}

		// Build options
		const condensationOptions: CondensationOptions = {
			apiHandler,
			condensingApiHandler: options?.condensingApiHandler,
			customCondensingPrompt: options?.customCondensingPrompt,
			isAutomaticTrigger: options?.isAutomaticTrigger || false,
		}

		// Execute condensation
		return provider.condense(context, condensationOptions)
	}

	/**
	 * Estimate cost of condensation
	 */
	async estimateCost(
		messages: ApiMessage[],
		options?: {
			providerId?: string
			systemPrompt?: string
			taskId?: string
			prevContextTokens?: number
		},
	): Promise<number> {
		const providerId = options?.providerId || this.defaultProviderId
		const provider = this.getProvider(providerId)

		const context: CondensationContext = {
			messages,
			systemPrompt: options?.systemPrompt || "",
			taskId: options?.taskId || "unknown",
			prevContextTokens: options?.prevContextTokens || 0,
		}

		return provider.estimateCost(context)
	}

	/**
	 * Get provider by ID
	 */
	private getProvider(providerId: string): ICondensationProvider {
		const registry = getProviderRegistry()
		const provider = registry.getProvider(providerId)

		if (!provider) {
			throw new Error(`Provider '${providerId}' not found`)
		}

		const config = registry.getConfig(providerId)
		if (config && !config.enabled) {
			throw new Error(`Provider '${providerId}' is disabled`)
		}

		return provider
	}

	/**
	 * List available providers
	 */
	listProviders(): Array<{
		id: string
		name: string
		description: string
		enabled: boolean
		priority: number
	}> {
		const registry = getProviderRegistry()
		const providers = registry.getAllProviders()

		return providers.map((p) => {
			const config = registry.getConfig(p.id)
			return {
				id: p.id,
				name: p.name,
				description: p.description,
				enabled: config?.enabled ?? true,
				priority: config?.priority ?? 100,
			}
		})
	}
}

/**
 * Convenience function to get manager instance
 */
export function getCondensationManager(): CondensationManager {
	return CondensationManager.getInstance()
}
