import { ModelInfo } from "@roo-code/types"
import { IamAuthenticator, CloudPakForDataAuthenticator, UserOptions } from "ibm-cloud-sdk-core"
import { WatsonXAI } from "@ibm-cloud/watsonx-ai"
import WatsonxAiMlVml_v1 from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js"

/**
 * Fetches available watsonx models
 *
 * @param apiKey - The watsonx API key (for IBM Cloud or IBM Cloud Pak for Data with API key auth)
 * @param projectId Optional IBM Cloud project ID or IBM Cloud Pak for Data project ID
 * @param baseUrl - Optional base URL for the watsonx API
 * @param platform - Optional platform type (ibmCloud or cloudPak)
 * @param authType - Optional authentication type (API key or password) for Cloud Pak for Data
 * @param username - Optional username for Cloud Pak for Data
 * @param password - Optional password for Cloud Pak for Data (when using password auth)
 * @returns A promise resolving to an object with model IDs as keys and model info as values
 */
export async function getWatsonxModels(
	apiKey?: string,
	projectId?: string,
	baseUrl?: string,
	platform?: string,
	authType?: string,
	username?: string,
	password?: string,
): Promise<Record<string, ModelInfo>> {
	try {
		let options: UserOptions = {
			version: "2024-05-31",
		}

		if (!platform) {
			throw new Error("Platform selection is required for IBM watsonx provider")
		}

		if (platform === "ibmCloud") {
			if (!apiKey) {
				throw new Error("API key is required for IBM Cloud")
			}
			if (!projectId) {
				throw new Error("Project ID is required for IBM Cloud")
			}
			if (!baseUrl) {
				throw new Error("Base URL is required for for IBM Cloud")
			}
			options.serviceUrl = baseUrl
			options.authenticator = new IamAuthenticator({
				apikey: apiKey,
			})
		} else if (platform === "cloudPak") {
			if (!baseUrl) {
				throw new Error("Base URL is required for IBM Cloud Pak for Data")
			}
			if (!projectId) {
				throw new Error("Project ID is required for IBM Cloud Pak for Data")
			}
			if (!username) {
				throw new Error("Username is required for IBM Cloud Pak for Data")
			}
			if (!authType) {
				throw new Error("Auth Type selection is required for IBM Cloud Pak for Data")
			}
			if (authType === "apiKey" && !apiKey) {
				throw new Error("API key is required for IBM Cloud Pak for Data")
			}
			if (authType === "password" && !password) {
				throw new Error("Password is required for IBM Cloud Pak for Data")
			}
			options.serviceUrl = baseUrl
			if (username) {
				if (password) {
					options.authenticator = new CloudPakForDataAuthenticator({
						url: `${baseUrl}/icp4d-api`,
						username: username,
						password: password,
					})
				} else if (apiKey) {
					options.authenticator = new CloudPakForDataAuthenticator({
						url: `${baseUrl}/icp4d-api`,
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
				const result = response.result as WatsonxAiMlVml_v1.FoundationModels
				const modelsList = result.resources
				if (Array.isArray(modelsList) && modelsList.length > 0) {
					for (const model of modelsList) {
						const modelId = model.model_id
						let contextWindow = 131072
						if (model.model_limits && model.model_limits.max_sequence_length) {
							contextWindow = model.model_limits.max_sequence_length
						}
						let maxTokens = Math.floor(contextWindow / 16)
						if (
							model.model_limits &&
							model.training_parameters &&
							model.training_parameters.max_output_tokens &&
							model.training_parameters.max_output_tokens.max
						) {
							maxTokens = model.training_parameters.max_output_tokens.max
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
			console.error("Error fetching models from IBM watsonx API:", error)
			throw new Error(
				`Failed to fetch models from IBM watsonx API: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
		}
		return knownModels
	} catch (apiError) {
		console.error("Error fetching IBM watsonx models:", apiError)
		throw new Error(
			`Failed to fetch models from IBM watsonx API: ${apiError instanceof Error ? apiError.message : "Unknown error"}`,
		)
	}
}
