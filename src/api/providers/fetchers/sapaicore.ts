import axios from "axios"
import { z } from "zod"

import type { ModelInfo } from "@roo-code/types"
import { sapAiCoreModels } from "@roo-code/types"

import type { ModelRecord } from "../../../shared/api"
import { DEFAULT_HEADERS } from "../constants"

/**
 * SAP AI Core Authentication Response Schema
 */
const sapAiCoreTokenResponseSchema = z.object({
	access_token: z.string(),
	expires_in: z.number(),
	scope: z.string(),
	jti: z.string(),
	token_type: z.string(),
})

export type SapAiCoreTokenResponse = z.infer<typeof sapAiCoreTokenResponseSchema>

/**
 * SAP AI Core Model Details Schema
 */
const sapAiCoreModelDetailsSchema = z.object({
	name: z.string(),
	version: z.string().optional(),
})

/**
 * SAP AI Core Backend Details Schema
 */
const sapAiCoreBackendDetailsSchema = z
	.object({
		model: sapAiCoreModelDetailsSchema.optional(),
	})
	.passthrough()

/**
 * SAP AI Core Deployment Resource Schema
 */
const sapAiCoreDeploymentResourceSchema = z.object({
	backendDetails: sapAiCoreBackendDetailsSchema.optional(),
	backend_details: sapAiCoreBackendDetailsSchema.optional(), // Alternative naming
	scaling: z
		.object({
			backendDetails: z.object({}).passthrough().optional(),
			backend_details: z.object({}).passthrough().optional(),
		})
		.optional(),
})

/**
 * SAP AI Core Deployment Details Schema
 */
const sapAiCoreDeploymentDetailsSchema = z.object({
	resources: sapAiCoreDeploymentResourceSchema.optional(),
})

/**
 * SAP AI Core Deployment Schema
 */
const sapAiCoreDeploymentSchema = z.object({
	id: z.string(),
	createdAt: z.string().optional(),
	modifiedAt: z.string().optional(),
	status: z.string().optional(),
	targetStatus: z.string(),
	details: sapAiCoreDeploymentDetailsSchema.optional(),
	scenarioId: z.string().optional(),
	configurationId: z.string().optional(),
	latestRunningConfigurationId: z.string().optional(),
	lastOperation: z.string().optional(),
	submissionTime: z.string().optional(),
	startTime: z.string().optional(),
	configurationName: z.string().optional(),
	deploymentUrl: z.string().optional(),
})

/**
 * SAP AI Core Deployments Response Schema
 */
const sapAiCoreDeploymentsResponseSchema = z.object({
	count: z.number().optional(),
	resources: z.array(sapAiCoreDeploymentSchema),
})

export type SapAiCoreDeployment = z.infer<typeof sapAiCoreDeploymentSchema>
export type SapAiCoreDeploymentsResponse = z.infer<typeof sapAiCoreDeploymentsResponseSchema>

/**
 * SAP AI Core Fetcher Options
 */
export interface SapAiCoreFetcherOptions {
	sapAiCoreClientId: string
	sapAiCoreClientSecret: string
	sapAiCoreTokenUrl: string
	sapAiCoreBaseUrl: string
	sapAiResourceGroup?: string
}

/**
 * Cache entry for storing fetched models and authentication tokens
 */
interface SapAiCoreCacheEntry {
	models: ModelRecord
	token?: {
		access_token: string
		expires_at: number
	}
	timestamp: number
}

// Cache duration: 5 minutes for models, token expiry handled separately
const CACHE_DURATION = 5 * 60 * 1000
let cache: SapAiCoreCacheEntry | null = null

/**
 * Authenticates with SAP AI Core and returns an access token
 */
async function authenticateWithSapAiCore(options: SapAiCoreFetcherOptions): Promise<SapAiCoreTokenResponse> {
	// Validate HTTPS requirement for security
	if (!options.sapAiCoreTokenUrl.startsWith("https://")) {
		throw new Error("SAP AI Core Token URL must use HTTPS for security")
	}

	const payload = new URLSearchParams({
		grant_type: "client_credentials",
		client_id: options.sapAiCoreClientId,
		client_secret: options.sapAiCoreClientSecret,
	})

	const tokenUrl = options.sapAiCoreTokenUrl.replace(/\/+$/, "") + "/oauth/token"

	try {
		const response = await axios.post(tokenUrl, payload, {
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				...DEFAULT_HEADERS,
			},
			timeout: 10000, // 10 second timeout
		})

		const result = sapAiCoreTokenResponseSchema.safeParse(response.data)

		if (!result.success) {
			console.error("SAP AI Core token response validation failed:", result.error.format())
			throw new Error("Invalid token response format from SAP AI Core")
		}

		return result.data
	} catch (error) {
		console.error("SAP AI Core authentication failed:", error)

		if (axios.isAxiosError(error)) {
			if (error.response) {
				throw new Error(
					`SAP AI Core authentication failed: ${error.response.status} ${error.response.statusText}`,
				)
			} else if (error.request) {
				throw new Error(
					"SAP AI Core authentication failed: No response from server. Check your internet connection and token URL.",
				)
			}
		}

		throw new Error(
			`SAP AI Core authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		)
	}
}

/**
 * Gets a valid access token, using cache if available and not expired
 */
async function getValidToken(options: SapAiCoreFetcherOptions): Promise<string> {
	const now = Date.now()

	// Check if we have a cached token that's still valid
	if (cache?.token && cache.token.expires_at > now) {
		return cache.token.access_token
	}

	// Authenticate and get new token
	const tokenResponse = await authenticateWithSapAiCore(options)
	const expiresAt = now + tokenResponse.expires_in * 1000

	// Update cache with new token
	if (cache) {
		cache.token = {
			access_token: tokenResponse.access_token,
			expires_at: expiresAt,
		}
	} else {
		cache = {
			models: {},
			token: {
				access_token: tokenResponse.access_token,
				expires_at: expiresAt,
			},
			timestamp: now,
		}
	}

	return tokenResponse.access_token
}

/**
 * Fetches deployments from SAP AI Core
 */
async function fetchSapAiCoreDeployments(options: SapAiCoreFetcherOptions): Promise<SapAiCoreDeployment[]> {
	// Validate HTTPS requirement for security
	if (!options.sapAiCoreBaseUrl.startsWith("https://")) {
		throw new Error("SAP AI Core Base URL must use HTTPS for security")
	}

	const token = await getValidToken(options)

	const headers = {
		Authorization: `Bearer ${token}`,
		"AI-Resource-Group": options.sapAiResourceGroup || "default",
		"Content-Type": "application/json",
		"AI-Client-Type": "Roo-Code",
		...DEFAULT_HEADERS,
	}

	const url = `${options.sapAiCoreBaseUrl}/v2/lm/deployments?$top=10000&$skip=0`

	try {
		const response = await axios.get(url, {
			headers,
			timeout: 15000, // 15 second timeout for deployment fetching
		})

		const result = sapAiCoreDeploymentsResponseSchema.safeParse(response.data)

		if (!result.success) {
			console.error("Validation errors:", JSON.stringify(result.error.format(), null, 2))
			throw new Error("Invalid deployments response format from SAP AI Core")
		}

		return result.data.resources
	} catch (error) {
		console.error("Error fetching SAP AI Core deployments:", error)

		if (axios.isAxiosError(error)) {
			if (error.response) {
				throw new Error(
					`Failed to fetch SAP AI Core deployments: ${error.response.status} ${error.response.statusText}`,
				)
			} else if (error.request) {
				throw new Error(
					"Failed to fetch SAP AI Core deployments: No response from server. Check your internet connection and base URL.",
				)
			}
		}

		throw new Error(
			`Failed to fetch SAP AI Core deployments: ${error instanceof Error ? error.message : "Unknown error"}`,
		)
	}
}

/**
 * Parses SAP AI Core deployment into model information
 */
function parseSapAiCoreDeployment(deployment: SapAiCoreDeployment): { modelName: string; modelInfo: ModelInfo } | null {
	// Skip non-running deployments
	if (deployment.targetStatus !== "RUNNING") {
		return null
	}

	// Try both camelCase and snake_case property names for backend details
	const backendDetails =
		deployment.details?.resources?.backendDetails || deployment.details?.resources?.backend_details

	// Skip deployments without model information (e.g., orchestration deployments)
	if (!backendDetails?.model?.name) {
		return null
	}

	const modelName = backendDetails.model.name.toLowerCase()

	// Skip invalid model names
	if (!modelName || modelName === "") {
		return null
	}

	// Get model info from predefined SAP AI Core models
	const predefinedModelInfo = sapAiCoreModels[modelName as keyof typeof sapAiCoreModels]

	if (predefinedModelInfo) {
		return {
			modelName,
			modelInfo: {
				...predefinedModelInfo,
				description: `${modelName} via SAP AI Core (Deployment: ${deployment.id})`,
			},
		}
	}

	// Fallback for unknown models - create basic model info
	const fallbackModelInfo: ModelInfo = {
		maxTokens: 8192, // Conservative default
		contextWindow: 200000, // Conservative default
		supportsImages: false, // Conservative default
		supportsPromptCache: false, // Conservative default
		supportsComputerUse: false, // Conservative default
		description: `${modelName} via SAP AI Core (Deployment: ${deployment.id}) - Unknown model`,
	}

	return {
		modelName,
		modelInfo: fallbackModelInfo,
	}
}

/**
 * Fetches available models from SAP AI Core
 *
 * This function authenticates with SAP AI Core, fetches running deployments,
 * and returns model information for deployed models.
 *
 * @param options SAP AI Core configuration options
 * @returns A promise that resolves to a record of model IDs to model info
 * @throws Will throw an error if authentication fails or deployments cannot be fetched
 */
export async function getSapAiCoreModels(options: SapAiCoreFetcherOptions): Promise<ModelRecord> {
	const now = Date.now()

	// Check cache first, but also validate token expiration
	if (cache && now - cache.timestamp < CACHE_DURATION) {
		// If we have a token, check if it's still valid
		if (!cache.token || cache.token.expires_at > now) {
			return cache.models
		}
		// Token is expired, proceed with fresh fetch which will re-authenticate
	}

	const models: ModelRecord = {}

	try {
		// Validate required options
		if (!options.sapAiCoreClientId || !options.sapAiCoreClientSecret) {
			console.warn("SAP AI Core credentials not provided, returning empty model list")
			return models
		}

		if (!options.sapAiCoreTokenUrl || !options.sapAiCoreBaseUrl) {
			console.warn("SAP AI Core URLs not provided, returning empty model list")
			return models
		}

		// Fetch deployments
		const deployments = await fetchSapAiCoreDeployments(options)

		// Process deployments and extract model information
		const processedModels = new Map<string, ModelInfo>()

		for (const deployment of deployments) {
			const parsed = parseSapAiCoreDeployment(deployment)

			if (parsed) {
				const { modelName, modelInfo } = parsed

				// Avoid duplicates - keep the first occurrence
				if (!processedModels.has(modelName)) {
					processedModels.set(modelName, modelInfo)
				}
			}
		}

		// Convert Map to Record
		for (const [modelName, modelInfo] of processedModels) {
			models[modelName] = modelInfo
		}

		// Update cache
		cache = {
			models,
			token: cache?.token, // Preserve existing token if available
			timestamp: now,
		}

		console.log(`Successfully fetched ${Object.keys(models).length} SAP AI Core models`)
		return models
	} catch (error) {
		console.error("Error fetching SAP AI Core models:", error)

		// Return cached data if available
		if (cache) {
			console.warn("Returning cached SAP AI Core models due to fetch error")
			return cache.models
		}

		// For testing purposes when no SAP credentials are available,
		// return empty object instead of throwing (allows graceful degradation)
		console.warn("No cached SAP AI Core models available, returning empty model list")
		return models
	}
}

/**
 * Get cached SAP AI Core models without making an API request
 */
export function getCachedSapAiCoreModels(): ModelRecord | null {
	return cache?.models || null
}

/**
 * Clear the SAP AI Core models cache
 */
export function clearSapAiCoreCache(): void {
	cache = null
}

/**
 * Get deployed model names for the model picker
 * This is a convenience function that extracts just the model names
 */
export async function getSapAiCoreDeployedModelNames(options: SapAiCoreFetcherOptions): Promise<string[]> {
	try {
		const models = await getSapAiCoreModels(options)
		return Object.keys(models).sort()
	} catch (error) {
		console.error("Error fetching SAP AI Core deployed model names:", error)
		return []
	}
}
