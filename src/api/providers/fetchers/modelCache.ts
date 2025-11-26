import * as path from "path"
import fs from "fs/promises"
import * as fsSync from "fs"

import NodeCache from "node-cache"
import { z } from "zod"

import type { ProviderName } from "@roo-code/types"
import { modelInfoSchema } from "@roo-code/types"

import { safeWriteJson } from "../../../utils/safeWriteJson"

import { ContextProxy } from "../../../core/config/ContextProxy"
import { getCacheDirectoryPath } from "../../../utils/storage"
import type { RouterName, ModelRecord } from "../../../shared/api"
import { fileExistsAtPath } from "../../../utils/fs"

import { getOpenRouterModels } from "./openrouter"
import { getVercelAiGatewayModels } from "./vercel-ai-gateway"
import { getRequestyModels } from "./requesty"
import { getGlamaModels } from "./glama"
import { getUnboundModels } from "./unbound"
import { getLiteLLMModels } from "./litellm"
import { GetModelsOptions } from "../../../shared/api"
import { getOllamaModels } from "./ollama"
import { getLMStudioModels } from "./lmstudio"
import { getIOIntelligenceModels } from "./io-intelligence"
import { getDeepInfraModels } from "./deepinfra"
import { getHuggingFaceModels } from "./huggingface"
import { getRooModels } from "./roo"
import { getChutesModels } from "./chutes"

const memoryCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 5 * 60 })

// Zod schema for validating ModelRecord structure from disk cache
const modelRecordSchema = z.record(z.string(), modelInfoSchema)

async function writeModels(router: RouterName, data: ModelRecord) {
	const filename = `${router}_models.json`
	const cacheDir = await getCacheDirectoryPath(ContextProxy.instance.globalStorageUri.fsPath)
	await safeWriteJson(path.join(cacheDir, filename), data)
}

async function readModels(router: RouterName): Promise<ModelRecord | undefined> {
	const filename = `${router}_models.json`
	const cacheDir = await getCacheDirectoryPath(ContextProxy.instance.globalStorageUri.fsPath)
	const filePath = path.join(cacheDir, filename)
	const exists = await fileExistsAtPath(filePath)
	return exists ? JSON.parse(await fs.readFile(filePath, "utf8")) : undefined
}

/**
 * Fetch models from the provider API.
 * Extracted to avoid duplication between getModels() and refreshModels().
 *
 * @param options - Provider options for fetching models
 * @returns Fresh models from the provider API
 */
async function fetchModelsFromProvider(options: GetModelsOptions): Promise<ModelRecord> {
	const { provider } = options

	let models: ModelRecord

	switch (provider) {
		case "openrouter":
			models = await getOpenRouterModels()
			break
		case "requesty":
			// Requesty models endpoint requires an API key for per-user custom policies.
			models = await getRequestyModels(options.baseUrl, options.apiKey)
			break
		case "glama":
			models = await getGlamaModels()
			break
		case "unbound":
			// Unbound models endpoint requires an API key to fetch application specific models.
			models = await getUnboundModels(options.apiKey)
			break
		case "litellm":
			// Type safety ensures apiKey and baseUrl are always provided for LiteLLM.
			models = await getLiteLLMModels(options.apiKey, options.baseUrl)
			break
		case "ollama":
			models = await getOllamaModels(options.baseUrl, options.apiKey)
			break
		case "lmstudio":
			models = await getLMStudioModels(options.baseUrl)
			break
		case "deepinfra":
			models = await getDeepInfraModels(options.apiKey, options.baseUrl)
			break
		case "io-intelligence":
			models = await getIOIntelligenceModels(options.apiKey)
			break
		case "vercel-ai-gateway":
			models = await getVercelAiGatewayModels()
			break
		case "huggingface":
			models = await getHuggingFaceModels()
			break
		case "roo": {
			// Roo Code Cloud provider requires baseUrl and optional apiKey
			const rooBaseUrl = options.baseUrl ?? process.env.ROO_CODE_PROVIDER_URL ?? "https://api.roocode.com/proxy"
			models = await getRooModels(rooBaseUrl, options.apiKey)
			break
		}
		case "chutes":
			models = await getChutesModels(options.apiKey)
			break
		default: {
			// Ensures router is exhaustively checked if RouterName is a strict union.
			const exhaustiveCheck: never = provider
			throw new Error(`Unknown provider: ${exhaustiveCheck}`)
		}
	}

	return models
}

/**
 * Validate that fetched models contain expected models.
 * Returns true if the fetched models appear to be complete.
 */
function validateFetchedModels(provider: RouterName, fetchedModels: ModelRecord): boolean {
	// For OpenRouter, ensure we have a reasonable minimum number of models
	// to avoid replacing a full cache with an incomplete response
	if (provider === "openrouter") {
		const modelCount = Object.keys(fetchedModels).length
		// OpenRouter typically has 100+ models, so if we get less than 50,
		// something might be wrong with the API response
		if (modelCount < 50) {
			console.warn(
				`[MODEL_CACHE] OpenRouter returned only ${modelCount} models, which seems incomplete. Keeping existing cache.`,
			)
			return false
		}
	}

	return true
}

/**
 * Merge new models with existing cache, preserving user-selected models.
 * This prevents losing models that are in use but temporarily missing from API.
 */
function mergeModels(existingModels: ModelRecord, newModels: ModelRecord, preserveKeys?: Set<string>): ModelRecord {
	const merged = { ...newModels }

	// Preserve specific models if they're in the preserve list
	if (preserveKeys && preserveKeys.size > 0) {
		for (const key of preserveKeys) {
			if (existingModels[key] && !merged[key]) {
				// Keep the existing model if it's not in the new set
				merged[key] = existingModels[key]
				console.debug(`[MODEL_CACHE] Preserved model ${key} from existing cache`)
			}
		}
	}

	return merged
}

/**
 * Get models from the cache or fetch them from the provider and cache them.
 * There are two caches:
 * 1. Memory cache - This is a simple in-memory cache that is used to store models for a short period of time.
 * 2. File cache - This is a file-based cache that is used to store models for a longer period of time.
 *
 * @param router - The router to fetch models from.
 * @param apiKey - Optional API key for the provider.
 * @param baseUrl - Optional base URL for the provider (currently used only for LiteLLM).
 * @param preserveModelIds - Optional set of model IDs to preserve even if not in API response
 * @returns The models from the cache or the fetched models.
 */
export const getModels = async (
	options: GetModelsOptions & { preserveModelIds?: Set<string> },
): Promise<ModelRecord> => {
	const { provider, preserveModelIds } = options

	let models = getModelsFromCache(provider)

	if (models) {
		return models
	}

	try {
		const fetchedModels = await fetchModelsFromProvider(options)

		// Get existing cache for merging
		const existingModels = await readModels(provider).catch(() => undefined)

		// Validate the fetched models
		const isValid = validateFetchedModels(provider, fetchedModels)

		if (!isValid && existingModels) {
			// If validation fails and we have existing models, merge carefully
			models = mergeModels(existingModels, fetchedModels, preserveModelIds)
		} else if (existingModels && preserveModelIds && preserveModelIds.size > 0) {
			// Even if valid, preserve specific models if requested
			models = mergeModels(existingModels, fetchedModels, preserveModelIds)
		} else {
			models = fetchedModels
		}

		// Cache the merged models
		memoryCache.set(provider, models)

		await writeModels(provider, models).catch((err) =>
			console.error(`[MODEL_CACHE] Error writing ${provider} models to file cache:`, err),
		)

		return models || {}
	} catch (error) {
		// On error, try to use existing cache as fallback
		console.error(`[getModels] Failed to fetch models in modelCache for ${provider}:`, error)

		// Try to load from disk cache as fallback
		const diskCache = await readModels(provider).catch(() => undefined)
		if (diskCache) {
			console.debug(`[MODEL_CACHE] Using disk cache as fallback for ${provider}`)
			memoryCache.set(provider, diskCache)
			return diskCache
		}

		throw error // Re-throw the original error if no fallback available
	}
}

/**
 * Force-refresh models from API, bypassing cache.
 * Uses atomic writes so cache remains available during refresh.
 *
 * @param options - Provider options for fetching models
 * @returns Fresh models from API
 */
export const refreshModels = async (
	options: GetModelsOptions & { preserveModelIds?: Set<string> },
): Promise<ModelRecord> => {
	const { provider, preserveModelIds } = options

	try {
		// Force fresh API fetch - skip getModelsFromCache() check
		const fetchedModels = await fetchModelsFromProvider(options)

		// Get existing models for intelligent merging
		const existingModels = getModelsFromCache(provider)

		// Validate the fetched models
		const isValid = validateFetchedModels(provider, fetchedModels)

		let models: ModelRecord
		if (!isValid && existingModels) {
			// If validation fails, merge with existing to preserve user models
			models = mergeModels(existingModels, fetchedModels, preserveModelIds)
			console.debug(`[refreshModels] Merged ${provider} models due to incomplete API response`)
		} else if (existingModels && preserveModelIds && preserveModelIds.size > 0) {
			// Preserve specific models even in valid responses
			models = mergeModels(existingModels, fetchedModels, preserveModelIds)
		} else {
			models = fetchedModels
		}

		// Update memory cache first
		memoryCache.set(provider, models)

		// Atomically write to disk (safeWriteJson handles atomic writes)
		await writeModels(provider, models).catch((err) =>
			console.error(`[refreshModels] Error writing ${provider} models to disk:`, err),
		)

		return models
	} catch (error) {
		console.debug(`[refreshModels] Failed to refresh ${provider}:`, error)
		// On error, return existing cache if available (graceful degradation)
		return getModelsFromCache(provider) || {}
	}
}

/**
 * Initialize background model cache refresh.
 * Refreshes public provider caches without blocking or requiring auth.
 * Should be called once during extension activation.
 */
export async function initializeModelCacheRefresh(): Promise<void> {
	// Wait for extension to fully activate before refreshing
	setTimeout(async () => {
		// Providers that work without API keys
		const publicProviders: Array<{ provider: RouterName; options: GetModelsOptions }> = [
			{ provider: "openrouter", options: { provider: "openrouter" } },
			{ provider: "glama", options: { provider: "glama" } },
			{ provider: "vercel-ai-gateway", options: { provider: "vercel-ai-gateway" } },
		]

		// Refresh each provider in background (fire and forget)
		for (const { options } of publicProviders) {
			refreshModels(options).catch(() => {
				// Silent fail - old cache remains available
			})

			// Small delay between refreshes to avoid API rate limits
			await new Promise((resolve) => setTimeout(resolve, 500))
		}
	}, 2000)
}

/**
 * Flush models memory cache for a specific router.
 *
 * @param router - The router to flush models for.
 * @param refresh - If true, immediately fetch fresh data from API
 */
export const flushModels = async (router: RouterName, refresh: boolean = false): Promise<void> => {
	if (refresh) {
		// Don't delete memory cache - let refreshModels atomically replace it
		// This prevents a race condition where getModels() might be called
		// before refresh completes, avoiding a gap in cache availability
		refreshModels({ provider: router } as GetModelsOptions).catch((error) => {
			console.error(`[flushModels] Refresh failed for ${router}:`, error)
		})
	} else {
		// Only delete memory cache when not refreshing
		memoryCache.del(router)
	}
}

/**
 * Get models from cache, checking memory first, then disk.
 * This ensures providers always have access to last known good data,
 * preventing fallback to hardcoded defaults on startup.
 *
 * @param provider - The provider to get models for.
 * @returns Models from memory cache, disk cache, or undefined if not cached.
 */
export function getModelsFromCache(provider: ProviderName): ModelRecord | undefined {
	// Check memory cache first (fast)
	const memoryModels = memoryCache.get<ModelRecord>(provider)
	if (memoryModels) {
		return memoryModels
	}

	// Memory cache miss - try to load from disk synchronously
	// This is acceptable because it only happens on cold start or after cache expiry
	try {
		const filename = `${provider}_models.json`
		const cacheDir = getCacheDirectoryPathSync()
		if (!cacheDir) {
			return undefined
		}

		const filePath = path.join(cacheDir, filename)

		// Use synchronous fs to avoid async complexity in getModel() callers
		if (fsSync.existsSync(filePath)) {
			const data = fsSync.readFileSync(filePath, "utf8")
			const models = JSON.parse(data)

			// Validate the disk cache data structure using Zod schema
			// This ensures the data conforms to ModelRecord = Record<string, ModelInfo>
			const validation = modelRecordSchema.safeParse(models)
			if (!validation.success) {
				console.error(
					`[MODEL_CACHE] Invalid disk cache data structure for ${provider}:`,
					validation.error.format(),
				)
				return undefined
			}

			// Populate memory cache for future fast access
			memoryCache.set(provider, validation.data)

			return validation.data
		}
	} catch (error) {
		console.error(`[MODEL_CACHE] Error loading ${provider} models from disk:`, error)
	}

	return undefined
}

/**
 * Synchronous version of getCacheDirectoryPath for use in getModelsFromCache.
 * Returns the cache directory path without async operations.
 */
function getCacheDirectoryPathSync(): string | undefined {
	try {
		const globalStoragePath = ContextProxy.instance?.globalStorageUri?.fsPath
		if (!globalStoragePath) {
			return undefined
		}
		const cachePath = path.join(globalStoragePath, "cache")
		return cachePath
	} catch (error) {
		console.error(`[MODEL_CACHE] Error getting cache directory path:`, error)
		return undefined
	}
}
