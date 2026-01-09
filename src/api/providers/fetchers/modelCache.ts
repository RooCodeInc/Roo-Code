import * as path from "path"
import fs from "fs/promises"
import * as fsSync from "fs"

import NodeCache from "node-cache"
import { z } from "zod"

import type { ProviderName } from "@roo-code/types"
import { modelInfoSchema, TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { safeWriteJson } from "../../../utils/safeWriteJson"

import { ContextProxy } from "../../../core/config/ContextProxy"
import { getCacheDirectoryPath } from "../../../utils/storage"
import type { RouterName, ModelRecord } from "../../../shared/api"
import { fileExistsAtPath } from "../../../utils/fs"

import { getOpenRouterModels } from "./openrouter"
import { getVercelAiGatewayModels } from "./vercel-ai-gateway"
import { getRequestyModels } from "./requesty"
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

// Track in-flight refresh requests to prevent concurrent API calls for the same provider+instance
// This prevents race conditions where multiple calls might overwrite each other's results
// Uses unique cache keys that include base URL hash for multi-instance providers
const inFlightRefresh = new Map<string, Promise<ModelRecord>>()

// Providers that can have multiple instances with different base URLs
// These need unique cache keys to prevent model mixing between configurations
const multiInstanceProviders = new Set<ProviderName>([
	"litellm",
	"ollama",
	"lmstudio",
	"requesty",
	"deepinfra",
	"roo",
])

/**
 * Simple hash function for generating short, deterministic hashes from strings.
 * Uses djb2 algorithm which produces good distribution for URL-like strings.
 * @param str - String to hash
 * @returns 8-character hex hash
 */
function simpleHash(str: string): string {
	let hash = 5381
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i)
	}
	// Convert to unsigned 32-bit integer and then to hex
	return (hash >>> 0).toString(16).padStart(8, "0")
}

/**
 * Generate a unique cache key for a provider based on its configuration.
 * For multi-instance providers (LiteLLM, Ollama, etc.), includes a hash of the
 * base URL to ensure different instances maintain separate caches.
 *
 * @param options - Provider options including provider name and optional baseUrl
 * @returns Unique cache key string
 */
export function getCacheKey(options: GetModelsOptions): string {
	const { provider } = options
	const baseUrl = "baseUrl" in options ? options.baseUrl : undefined

	// For multi-instance providers with a base URL, include a hash of the URL
	if (multiInstanceProviders.has(provider) && baseUrl) {
		const urlHash = simpleHash(baseUrl)
		return `${provider}_${urlHash}`
	}

	return provider
}

/**
 * Generate a unique filename for disk cache based on provider configuration.
 * Uses the same unique key logic as getCacheKey.
 *
 * @param options - Provider options including provider name and optional baseUrl
 * @returns Filename for the cache file (without path)
 */
function getCacheFilename(options: GetModelsOptions): string {
	return `${getCacheKey(options)}_models.json`
}

async function writeModels(options: GetModelsOptions, data: ModelRecord) {
	const filename = getCacheFilename(options)
	const cacheDir = await getCacheDirectoryPath(ContextProxy.instance.globalStorageUri.fsPath)
	await safeWriteJson(path.join(cacheDir, filename), data)
}

async function readModels(options: GetModelsOptions): Promise<ModelRecord | undefined> {
	const filename = getCacheFilename(options)
	const cacheDir = await getCacheDirectoryPath(ContextProxy.instance.globalStorageUri.fsPath)
	const filePath = path.join(cacheDir, filename)
	const exists = await fileExistsAtPath(filePath)
	return exists ? JSON.parse(await fs.readFile(filePath, "utf8")) : undefined
}

/**
 * Delete the disk cache file for a specific provider configuration.
 * Used during flush to ensure both memory and disk caches are cleared.
 *
 * @param options - Provider options including provider name and optional baseUrl
 */
async function deleteModelsCacheFile(options: GetModelsOptions): Promise<void> {
	const filename = getCacheFilename(options)
	const cacheDir = getCacheDirectoryPathSync()
	if (!cacheDir) {
		return
	}
	const filePath = path.join(cacheDir, filename)
	try {
		await fs.unlink(filePath)
	} catch (error) {
		// File may not exist, which is fine
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			console.error(`[MODEL_CACHE] Error deleting cache file ${filename}:`, error)
		}
	}
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
 * Get models from the cache or fetch them from the provider and cache them.
 * There are two caches:
 * 1. Memory cache - This is a simple in-memory cache that is used to store models for a short period of time.
 * 2. File cache - This is a file-based cache that is used to store models for a longer period of time.
 *
 * For multi-instance providers (LiteLLM, Ollama, etc.), uses unique cache keys that
 * include a hash of the base URL to ensure different instances maintain separate caches.
 *
 * @param options - Provider options including provider name and optional baseUrl
 * @returns The models from the cache or the fetched models.
 */
export const getModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
	const { provider } = options
	const cacheKey = getCacheKey(options)

	let models = getModelsFromCacheWithKey(cacheKey)

	if (models) {
		return models
	}

	try {
		models = await fetchModelsFromProvider(options)
		const modelCount = Object.keys(models).length

		// Only cache non-empty results to prevent persisting failed API responses
		// Empty results could indicate API failure rather than "no models exist"
		if (modelCount > 0) {
			memoryCache.set(cacheKey, models)

			await writeModels(options, models).catch((err) =>
				console.error(`[MODEL_CACHE] Error writing ${cacheKey} models to file cache:`, err),
			)
		} else {
			TelemetryService.instance.captureEvent(TelemetryEventName.MODEL_CACHE_EMPTY_RESPONSE, {
				provider,
				context: "getModels",
				hasExistingCache: false,
			})
		}

		return models
	} catch (error) {
		// Log the error and re-throw it so the caller can handle it (e.g., show a UI message).
		console.error(`[getModels] Failed to fetch models in modelCache for ${cacheKey}:`, error)

		throw error // Re-throw the original error to be handled by the caller.
	}
}

/**
 * Force-refresh models from API, bypassing cache.
 * Uses atomic writes so cache remains available during refresh.
 * This function also prevents concurrent API calls for the same provider+instance using
 * in-flight request tracking to avoid race conditions.
 *
 * For multi-instance providers (LiteLLM, Ollama, etc.), uses unique cache keys that
 * include a hash of the base URL to ensure different instances maintain separate caches.
 *
 * @param options - Provider options for fetching models
 * @returns Fresh models from API, or existing cache if refresh yields worse data
 */
export const refreshModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
	const { provider } = options
	const cacheKey = getCacheKey(options)

	// Check if there's already an in-flight refresh for this provider+instance
	// This prevents race conditions where multiple concurrent refreshes might
	// overwrite each other's results
	const existingRequest = inFlightRefresh.get(cacheKey)
	if (existingRequest) {
		return existingRequest
	}

	// Create the refresh promise and track it
	const refreshPromise = (async (): Promise<ModelRecord> => {
		try {
			// Force fresh API fetch - skip getModelsFromCacheWithKey() check
			const models = await fetchModelsFromProvider(options)
			const modelCount = Object.keys(models).length

			// Get existing cached data for comparison
			const existingCache = getModelsFromCacheWithKey(cacheKey)
			const existingCount = existingCache ? Object.keys(existingCache).length : 0

			if (modelCount === 0) {
				TelemetryService.instance.captureEvent(TelemetryEventName.MODEL_CACHE_EMPTY_RESPONSE, {
					provider,
					context: "refreshModels",
					hasExistingCache: existingCount > 0,
					existingCacheSize: existingCount,
				})
				if (existingCount > 0) {
					return existingCache!
				} else {
					return {}
				}
			}

			// Update memory cache first
			memoryCache.set(cacheKey, models)

			// Atomically write to disk (safeWriteJson handles atomic writes)
			await writeModels(options, models).catch((err) =>
				console.error(`[refreshModels] Error writing ${cacheKey} models to disk:`, err),
			)

			return models
		} catch (error) {
			// Log the error for debugging, then return existing cache if available (graceful degradation)
			console.error(`[refreshModels] Failed to refresh ${cacheKey} models:`, error)
			return getModelsFromCacheWithKey(cacheKey) || {}
		} finally {
			// Always clean up the in-flight tracking
			inFlightRefresh.delete(cacheKey)
		}
	})()

	// Track the in-flight request
	inFlightRefresh.set(cacheKey, refreshPromise)

	return refreshPromise
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
			{ provider: "vercel-ai-gateway", options: { provider: "vercel-ai-gateway" } },
			{ provider: "chutes", options: { provider: "chutes" } },
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
 * Flush models cache for a specific provider configuration.
 * Clears both memory cache and disk cache for the unique cache key.
 *
 * @param options - The options for fetching models, including provider, apiKey, and baseUrl
 * @param refresh - If true, immediately fetch fresh data from API
 */
export const flushModels = async (options: GetModelsOptions, refresh: boolean = false): Promise<void> => {
	const cacheKey = getCacheKey(options)
	if (refresh) {
		// Don't delete memory cache - let refreshModels atomically replace it
		// This prevents a race condition where getModels() might be called
		// before refresh completes, avoiding a gap in cache availability
		// Await the refresh to ensure the cache is updated before returning
		await refreshModels(options)
	} else {
		// Delete both memory and file cache when not refreshing
		memoryCache.del(cacheKey)
		await deleteModelsCacheFile(options).catch((err) =>
			console.error(`[flushModels] Error deleting ${cacheKey} cache file:`, err),
		)
	}
}

/**
 * Get models from cache using a unique cache key, checking memory first, then disk.
 * This ensures providers always have access to last known good data,
 * preventing fallback to hardcoded defaults on startup.
 *
 * @param cacheKey - The unique cache key (provider or provider_hash for multi-instance)
 * @returns Models from memory cache, disk cache, or undefined if not cached.
 */
function getModelsFromCacheWithKey(cacheKey: string): ModelRecord | undefined {
	// Check memory cache first (fast)
	const memoryModels = memoryCache.get<ModelRecord>(cacheKey)
	if (memoryModels) {
		return memoryModels
	}

	// Memory cache miss - try to load from disk synchronously
	// This is acceptable because it only happens on cold start or after cache expiry
	try {
		const filename = `${cacheKey}_models.json`
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
					`[MODEL_CACHE] Invalid disk cache data structure for ${cacheKey}:`,
					validation.error.format(),
				)
				return undefined
			}

			// Populate memory cache for future fast access
			memoryCache.set(cacheKey, validation.data)

			return validation.data
		}
	} catch (error) {
		console.error(`[MODEL_CACHE] Error loading ${cacheKey} models from disk:`, error)
	}

	return undefined
}

/**
 * Get models from cache for a provider.
 * This is a convenience wrapper that uses the provider name as the cache key.
 * For multi-instance providers, use getModels() instead which handles unique keys.
 *
 * @param provider - The provider to get models for.
 * @returns Models from memory cache, disk cache, or undefined if not cached.
 */
export function getModelsFromCache(provider: ProviderName): ModelRecord | undefined {
	return getModelsFromCacheWithKey(provider)
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
