import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces/embedder"
import { MAX_ITEM_TOKENS } from "../constants"
import { t } from "../../../i18n"
import { WatsonXAI } from "@ibm-cloud/watsonx-ai"
import { IamAuthenticator, CloudPakForDataAuthenticator } from "ibm-cloud-sdk-core"

/**
 * IBM watsonx embedder implementation using the native IBM Cloud watsonx.ai package.
 *
 */
export class WatsonxEmbedder implements IEmbedder {
	private readonly watsonxClient: WatsonXAI
	private static readonly WATSONX_VERSION = "2024-05-31"
	private static readonly WATSONX_REGION = "us-south"
	private static readonly DEFAULT_MODEL = "ibm/slate-125m-english-rtrvr-v2"
	private readonly modelId: string
	private readonly projectId?: string

	/**
	 * Creates a new watsonx embedder
	 * @param apiKey The watsonx API key for authentication
	 * @param modelId The model ID to use (defaults to ibm/slate-125m-english-rtrvr-v2)
	 * @param projectId Optional IBM Cloud project ID for watsonx
	 * @param platform Optional platform type (ibmCloud or cloudPak)
	 * @param baseUrl Optional base URL for the service (required for cloudPak)
	 * @param region Optional region for IBM Cloud (defaults to us-south)
	 * @param username Optional username for Cloud Pak for Data
	 * @param password Optional password for Cloud Pak for Data
	 */
	constructor(
		apiKey: string,
		modelId?: string,
		projectId?: string,
		platform: "ibmCloud" | "cloudPak" = "ibmCloud",
		baseUrl?: string,
		region: string = "us-south",
		username?: string,
		password?: string,
	) {
		if (!apiKey && !(username && password)) {
			throw new Error(t("embeddings:validation.apiKeyRequired"))
		}
		this.modelId = modelId || WatsonxEmbedder.DEFAULT_MODEL
		this.projectId = projectId

		let options: any = {
			version: WatsonxEmbedder.WATSONX_VERSION,
		}

		if (platform === "ibmCloud") {
			options.authenticator = new IamAuthenticator({
				apikey: apiKey,
			})
			options.serviceUrl = baseUrl || `https://${region}.ml.cloud.ibm.com`
		} else if (platform === "cloudPak") {
			if (!baseUrl) {
				throw new Error("Base URL is required for IBM Cloud Pak for Data")
			}

			if (username) {
				if (password) {
					options.authenticator = new CloudPakForDataAuthenticator({
						url: baseUrl,
						username: username,
						password: password,
					})
				} else if (apiKey) {
					options.authenticator = new CloudPakForDataAuthenticator({
						url: baseUrl,
						username: username,
						apikey: apiKey,
					})
				}
			}

			options.serviceUrl = baseUrl
		}

		this.watsonxClient = new WatsonXAI(options)

		try {
			this.watsonxClient.getAuthenticator().authenticate()
		} catch (error) {
			console.error("WatsonX authentication failed:", error)
			throw new Error(t("embeddings:validation.authenticationFailed"))
		}
	}

	/**
	 * Gets the expected dimension for a given model ID
	 * @param modelId The model ID to get the dimension for
	 * @returns The expected dimension for the model, or 768 if unknown
	 */
	private getExpectedDimension(modelId: string): number {
		// Known dimensions for watsonx models
		const knownDimensions: Record<string, number> = {
			"ibm/slate-125m-english-rtrvr-v2": 768,
			"ibm/slate-125m-english-rtrvr": 768,
			"ibm/slate-30m-english-rtrvr-v2": 384,
			"ibm/slate-30m-english-rtrvr": 384,
			"ibm/granite-embedding-107m-multilingual": 384,
			"ibm/granite-embedding-278M-multilingual": 768,
		}
		return knownDimensions[modelId] || 768
	}

	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const MAX_RETRIES = 3
		const INITIAL_DELAY_MS = 1000
		const MAX_CONCURRENT_REQUESTS = 1
		const REQUEST_DELAY_MS = 500
		const modelToUse = model || this.modelId
		const embeddings: number[][] = []
		let promptTokens = 0
		let totalTokens = 0
		for (let i = 0; i < texts.length; i += MAX_CONCURRENT_REQUESTS) {
			const batch = texts.slice(i, i + MAX_CONCURRENT_REQUESTS)
			const batchResults = await Promise.all(
				batch.map(async (text, batchIndex) => {
					const textIndex = i + batchIndex
					if (!text.trim()) {
						return { index: textIndex, embedding: [], tokens: 0 }
					}
					const estimatedTokens = Math.ceil(text.length / 4)
					if (estimatedTokens > MAX_ITEM_TOKENS) {
						console.warn(
							t("embeddings:textExceedsTokenLimit", {
								index: textIndex,
								itemTokens: estimatedTokens,
								maxTokens: MAX_ITEM_TOKENS,
							}),
						)
						return { index: textIndex, embedding: [], tokens: 0 }
					}
					let lastError
					for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
						try {
							if (attempt > 0) {
								const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt - 1)
								await delay(delayMs)
								console.warn(
									`IBM watsonx API call failed, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
								)
							}
							const response = await this.watsonxClient.embedText({
								modelId: modelToUse,
								inputs: [text],
								projectId: this.projectId,
								parameters: {
									truncate_input_tokens: MAX_ITEM_TOKENS,
									return_options: {
										input_text: true,
									},
								},
							})
							if (response.result && response.result.results && response.result.results.length > 0) {
								let embedding = response.result.results[0].embedding
								if (!embedding || embedding.length === 0) {
									console.error(`Empty embedding returned for text at index ${textIndex}`)
									const expectedDimension = this.getExpectedDimension(modelToUse)
									if (expectedDimension > 0) {
										embedding = new Array(expectedDimension).fill(0.0001)
									} else {
										throw new Error(`Cannot determine expected dimension for model ${modelToUse}`)
									}
								}
								if (!embedding || embedding.length === 0) {
									throw new Error("Failed to create valid embedding")
								}

								const tokens = response.result.input_token_count || 0
								return { index: textIndex, embedding, tokens }
							} else {
								console.warn(`No embedding results for text at index ${textIndex}`)
								const expectedDimension = this.getExpectedDimension(modelToUse)
								if (expectedDimension > 0) {
									const fallbackEmbedding = new Array(expectedDimension).fill(0.0001)
									return { index: textIndex, embedding: fallbackEmbedding, tokens: 0 }
								} else {
									return { index: textIndex, embedding: [], tokens: 0 }
								}
							}
						} catch (error) {
							lastError = error
						}
					}

					console.error(
						`Failed to embed text at index ${textIndex} after ${MAX_RETRIES} attempts:`,
						lastError,
					)
					return { index: textIndex, embedding: [], tokens: 0 }
				}),
			)

			if (i + MAX_CONCURRENT_REQUESTS < texts.length) {
				await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS * 2))
			}

			// Process batch results
			for (const result of batchResults) {
				while (embeddings.length <= result.index) {
					embeddings.push([])
				}

				embeddings[result.index] = result.embedding
				promptTokens += result.tokens
				totalTokens += result.tokens
			}
		}
		return {
			embeddings,
			usage: {
				promptTokens,
				totalTokens,
			},
		}
	}

	/**
	 * Validates the watsonx embedder configuration by testing the API key and connection
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			const testText = "test"
			const response = await this.watsonxClient.embedText({
				modelId: this.modelId,
				inputs: [testText],
				projectId: this.projectId,
				parameters: {
					truncate_input_tokens: MAX_ITEM_TOKENS,
					return_options: {
						input_text: true,
					},
				},
			})

			if (!response?.result?.results || response.result.results.length === 0) {
				console.error("IBM watsonx validation failed: Invalid response format", response)
				return {
					valid: false,
					error: "embeddings:validation.invalidResponse",
				}
			}
			return { valid: true }
		} catch (error) {
			console.error("IBM watsonx validation error:", error)
			let errorMessage = "embeddings:validation.unknownError"
			let errorDetails = ""

			if (error instanceof Error) {
				errorDetails = error.message
				if (error.message.includes("401") || error.message.includes("unauthorized")) {
					errorMessage = "embeddings:validation.invalidApiKey"
				} else if (error.message.includes("404") || error.message.includes("not found")) {
					errorMessage = "embeddings:validation.endpointNotFound"
				} else if (error.message.includes("timeout") || error.message.includes("ECONNREFUSED")) {
					errorMessage = "embeddings:validation.connectionTimeout"
				} else if (error.message.includes("project")) {
					errorMessage = "embeddings:validation.invalidProjectId"
				} else if (error.message.includes("model")) {
					errorMessage = "embeddings:validation.invalidModelId"
				}
			}
			return {
				valid: false,
				error: `${errorMessage} (${errorDetails})`,
			}
		}
	}

	/**
	 * Fetches available embedding models from the IBM watsonx API
	 * @returns Promise resolving to an object with model IDs as keys and model info as values
	 */
	async getAvailableModels(): Promise<Record<string, { dimension: number }>> {
		try {
			const knownModels: Record<string, { dimension: number }> = {
				"ibm/slate-125m-english-rtrvr-v2": { dimension: 768 },
			}
			try {
				const response = await this.watsonxClient.listFoundationModelSpecs({ filters: "function_embedding" })
				if (response && response.result) {
					const result = response.result as any

					const modelsList = result.models || result.resources || result.foundation_models || []

					if (Array.isArray(modelsList)) {
						for (const model of modelsList) {
							const modelId = model.id || model.name || model.model_id
							const dimension = model.model_limits.embedding_dimension || 768
							knownModels[modelId] = { dimension }
						}
					}
				}
			} catch (apiError) {
				console.warn("Error fetching models from IBM watsonx API:", apiError)
			}
			return knownModels
		} catch (error) {
			console.error("Error in getAvailableModels:", error)
			return {
				"ibm/slate-125m-english-rtrvr-v2": { dimension: 768 },
			}
		}
	}

	/**
	 * Returns information about this embedder
	 */
	get embedderInfo(): EmbedderInfo {
		return {
			name: "watsonx",
		}
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
