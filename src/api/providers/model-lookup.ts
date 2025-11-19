import type { ModelInfo, ProviderName } from "@roo-code/types"

import {
	getModelsForStaticProvider,
	getStaticProviderNames,
	isStaticProvider,
} from "../../services/custom-models/static-providers"
import { getWorkspacePath } from "../../utils/path"

/**
 * Cache for merged static provider models
 * Pre-loaded during extension activation for synchronous access
 */
const mergedModelsCache = new Map<ProviderName, Record<string, ModelInfo>>()
let isPreloaded = false

/**
 * Get models for a provider, including custom models from .roo/models/
 * This works for both static providers (anthropic, bedrock, etc.) and is used
 * to look up model information in provider handlers.
 *
 * @param provider The provider name
 * @param staticModels The base static models dictionary
 * @returns Promise of merged models (static + custom)
 */
export async function getProviderModels(
	provider: ProviderName,
	staticModels: Record<string, ModelInfo>,
): Promise<Record<string, ModelInfo>> {
	// Check cache first
	if (mergedModelsCache.has(provider)) {
		return mergedModelsCache.get(provider)!
	}

	try {
		const cwd = getWorkspacePath()
		const mergedModels = await getModelsForStaticProvider(provider, cwd)

		// Cache the result
		mergedModelsCache.set(provider, mergedModels)

		return mergedModels
	} catch (error) {
		console.error(`[ModelLookup] Error loading custom models for ${provider}:`, error)
		// Fallback to static models only
		return staticModels
	}
}

/**
 * Pre-load custom models for all static providers
 * Should be called during extension activation
 * @param cwd Current working directory
 */
export async function preloadStaticProviderModels(cwd: string): Promise<void> {
	try {
		// Get all static provider names from the source of truth
		const staticProviders = getStaticProviderNames()

		// Load custom models for each static provider
		await Promise.all(
			staticProviders.map(async (provider) => {
				try {
					const models = await getModelsForStaticProvider(provider, cwd)
					mergedModelsCache.set(provider, models)
				} catch (error) {
					console.error(`[ModelLookup] Error preloading custom models for ${provider}:`, error)
				}
			}),
		)

		isPreloaded = true
		console.log(`[ModelLookup] Preloaded custom models for ${staticProviders.length} static providers`)
	} catch (error) {
		console.error("[ModelLookup] Error during preload:", error)
	}
}

/**
 * Get models synchronously for a provider (uses pre-loaded cache)
 * Falls back to static models if not pre-loaded or provider not found
 * @param provider The provider name
 * @param staticModels The base static models dictionary
 * @returns Merged models (static + custom)
 */
export function getProviderModelsSync(
	provider: ProviderName,
	staticModels: Record<string, ModelInfo>,
): Record<string, ModelInfo> {
	if (!isPreloaded || !mergedModelsCache.has(provider)) {
		// Not preloaded yet or not in cache, return static models only
		return staticModels
	}

	return mergedModelsCache.get(provider)!
}

/**
 * Clear the cache for a specific provider or all providers
 * @param provider Optional provider to clear cache for. If not provided, clears all.
 */
export function clearProviderModelsCache(provider?: ProviderName): void {
	if (provider) {
		mergedModelsCache.delete(provider)
	} else {
		mergedModelsCache.clear()
		isPreloaded = false
	}
}

/**
 * Check if a model ID exists in the provider's models (including custom models)
 * @param provider The provider name
 * @param modelId The model ID to check
 * @param staticModels The base static models dictionary
 * @returns Promise of boolean indicating if model exists
 */
export async function hasModel(
	provider: ProviderName,
	modelId: string,
	staticModels: Record<string, ModelInfo>,
): Promise<boolean> {
	const models = await getProviderModels(provider, staticModels)
	return modelId in models
}

export { isPreloaded }

/**
 * Get model info for a specific model ID
 * @param provider The provider name
 * @param modelId The model ID
 * @param staticModels The base static models dictionary
 * @returns Promise of ModelInfo or undefined if not found
 */
export async function getModelInfo(
	provider: ProviderName,
	modelId: string,
	staticModels: Record<string, ModelInfo>,
): Promise<ModelInfo | undefined> {
	const models = await getProviderModels(provider, staticModels)
	return models[modelId]
}
