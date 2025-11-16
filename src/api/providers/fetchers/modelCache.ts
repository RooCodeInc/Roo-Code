import * as path from "path"
import fs from "fs/promises"
import * as crypto from "crypto"

import NodeCache from "node-cache"

import type { ProviderName } from "@roo-code/types"

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

/**
 * Generate a unique cache key for providers that need to differentiate based on configuration.
 * For providers like LiteLLM, Ollama, LM Studio, etc. that can have different instances,
 * we need to include the base URL in the cache key.
 */
function getCacheKey(options: GetModelsOptions): string {
	const { provider, baseUrl } = options

	// For providers that can have multiple instances with different base URLs,
	// include the base URL in the cache key
	if (baseUrl && ["litellm", "ollama", "lmstudio", "requesty", "deepinfra"].includes(provider)) {
		// Create a hash of the base URL to keep the key short
		const urlHash = crypto.createHash("md5").update(baseUrl).digest("hex").substring(0, 8)
		return `${provider}_${urlHash}`
	}

	// For other providers, just use the provider name
	return provider
}

/**
 * Generate a filename for the file cache that includes instance-specific information.
 */
function getCacheFilename(options: GetModelsOptions): string {
	const cacheKey = getCacheKey(options)
	return `${cacheKey}_models.json`
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
 * Get models from the cache or fetch them from the provider and cache them.
 * There are two caches:
 * 1. Memory cache - This is a simple in-memory cache that is used to store models for a short period of time.
 * 2. File cache - This is a file-based cache that is used to store models for a longer period of time.
 *
 * @param router - The router to fetch models from.
 * @param apiKey - Optional API key for the provider.
 * @param baseUrl - Optional base URL for the provider (currently used only for LiteLLM).
 * @returns The models from the cache or the fetched models.
 */
export const getModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
	const { provider } = options
	const cacheKey = getCacheKey(options)

	let models = getModelsFromCache(cacheKey)

	if (models) {
		return models
	}

	try {
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
				const rooBaseUrl =
					options.baseUrl ?? process.env.ROO_CODE_PROVIDER_URL ?? "https://api.roocode.com/proxy"
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

		// Cache the fetched models using the unique cache key
		memoryCache.set(cacheKey, models)

		await writeModels(options, models).catch((err) =>
			console.error(`[getModels] Error writing ${provider} models to file cache:`, err),
		)

		try {
			models = await readModels(options)
		} catch (error) {
			console.error(`[getModels] error reading ${provider} models from file cache`, error)
		}
		return models || {}
	} catch (error) {
		// Log the error and re-throw it so the caller can handle it (e.g., show a UI message).
		console.error(`[getModels] Failed to fetch models in modelCache for ${provider}:`, error)

		throw error // Re-throw the original error to be handled by the caller.
	}
}

/**
 * Flush models memory cache for a specific router.
 * This now needs to flush all possible cache keys for providers with multiple instances.
 *
 * @param router - The router to flush models for.
 */
export const flushModels = async (router: RouterName) => {
	// For providers that can have multiple instances, we need to flush all possible cache keys
	// Since we don't know all the possible base URLs, we'll flush all keys that start with the provider name
	const keys = memoryCache.keys()
	for (const key of keys) {
		if (key.startsWith(router)) {
			memoryCache.del(key)
		}
	}
}

export function getModelsFromCache(cacheKey: string) {
	return memoryCache.get<ModelRecord>(cacheKey)
}
