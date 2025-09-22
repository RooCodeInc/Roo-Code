import { ModelInfo } from "@roo-code/types"
import { IamAuthenticator, CloudPakForDataAuthenticator } from "ibm-cloud-sdk-core"
import { WatsonXAI } from "@ibm-cloud/watsonx-ai"

/**
 * Fetches available watsonx models
 *
 * @param apiKey - The watsonx API key (for IBM Cloud or Cloud Pak with API key auth)
 * @param projectId - Optional project ID for watsonx
 * @param baseUrl - Optional base URL for the watsonx API
 * @param platform - Optional platform type (ibmCloud or cloudPak)
 * @param username - Optional username for Cloud Pak for Data
 * @param password - Optional password for Cloud Pak for Data (when using password auth)
 * @returns A promise resolving to an object with model IDs as keys and model info as values
 */
export async function getWatsonxModels(
	apiKey: string,
	baseUrl?: string,
	platform: "ibmCloud" | "cloudPak" = "ibmCloud",
	username?: string,
	password?: string,
): Promise<Record<string, ModelInfo>> {
	try {
		let options: any = {
			version: "2024-05-31",
		}

		if (platform === "ibmCloud" || !platform) {
			if (apiKey) {
				options.authenticator = new IamAuthenticator({
					apikey: apiKey,
				})
			} else {
				return {}
			}
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
		}

		const service = WatsonXAI.newInstance(options)

		let knownModels: Record<string, ModelInfo> = {}

		try {
			const response = await service.listFoundationModelSpecs({ filters: "function_text_chat" })
			if (response && response.result) {
				const result = response.result as any
				const modelsList = result.resources
				if (Array.isArray(modelsList) && modelsList.length > 0) {
					for (const model of modelsList) {
						const modelId = model.id || model.name || model.model_id
						let contextWindow = 131072
						if (model.model_limits && model.model_limits.max_sequence_length) {
							contextWindow = model.model_limits.max_sequence_length
						}
						let maxTokens = Math.floor(contextWindow / 2)
						if (model.model_limits && model.model_limits.max_output_tokens) {
							maxTokens = model.model_limits.max_output_tokens
						}

						let description = ""
						if (model.long_description) {
							description = model.long_description
						} else if (model.short_description) {
							description = model.short_description
						}
						if (
							!(
								modelId === "meta-llama/llama-guard-3-11b-vision" ||
								modelId === "ibm/granite-guardian-3-8b" ||
								modelId === "ibm/granite-guardian-3-2b"
							)
						) {
							knownModels[modelId] = {
								contextWindow,
								maxTokens,
								supportsPromptCache: false,
								description,
							}
						}
					}
				}
			}
		} catch (error) {
			console.warn("Error fetching models from IBM watsonx API:", error)
			return {}
		}
		return knownModels
	} catch (apiError) {
		console.error("Error fetching IBM watsonx models:", apiError)
		return {}
	}
}

/**
 * Fetches available embedded watsonx models
 *
 * @param apiKey - The watsonx API key (for IBM Cloud or Cloud Pak with API key auth)
 * @param baseUrl - Optional base URL for the watsonx API
 * @param platform - Optional platform type (ibmCloud or cloudPak)
 * @param username - Optional username for Cloud Pak for Data
 * @param password - Optional password for Cloud Pak for Data (when using password auth)
 * @returns A promise resolving to an object with model IDs as keys and model info as values
 */
export async function getEmbeddedWatsonxModels(
	apiKey: string,
	baseUrl?: string,
	platform: "ibmCloud" | "cloudPak" = "ibmCloud",
	username?: string,
	password?: string,
): Promise<Record<string, { dimension: number }>> {
	try {
		let options: any = {
			version: "2024-05-31",
		}

		if (platform === "ibmCloud" || !platform) {
			if (apiKey) {
				options.authenticator = new IamAuthenticator({
					apikey: apiKey,
				})
			} else {
				return {}
			}
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
		}

		const service = WatsonXAI.newInstance(options)

		let knownModels: Record<string, { dimension: number }> = {}

		try {
			const response = await service.listFoundationModelSpecs({ filters: "function_embedding" })
			if (response && response.result) {
				const result = response.result as any

				const modelsList = result.models || result.resources || result.foundation_models || []

				if (Array.isArray(modelsList)) {
					for (const model of modelsList) {
						const modelId = model.id || model.name || model.model_id
						if (modelId.startsWith("ibm")) {
							const dimension = model.model_limits.embedding_dimension
							knownModels[modelId] = { dimension }
						}
					}
				}
			}
		} catch (error) {
			console.warn("Error fetching embedded models from IBM watsonx API:", error)
			return {}
		}
		return knownModels
	} catch (apiError) {
		console.error("Error fetching embedded IBM watsonx models:", apiError)
		return {}
	}
}
