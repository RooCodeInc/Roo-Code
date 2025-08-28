import { Anthropic } from "@anthropic-ai/sdk"
import axios from "axios"
import OpenAI from "openai"

import type { ModelInfo } from "@roo-code/types"
import { SapAiCoreModelId, sapAiCoreDefaultModelId, sapAiCoreModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToBedrockConverseMessages } from "../transform/bedrock-converse-format"
import { convertAnthropicContentToGemini } from "../transform/gemini-format"
import { ApiStream } from "../transform/stream"
import { addCacheBreakpoints } from "../transform/caching/anthropic"
import { BaseProvider } from "./base-provider"
import { getSapAiCoreDeployedModelNames } from "./fetchers/sapaicore"

/**
 * Fetches deployed model names from SAP AI Core
 * @param options SAP AI Core configuration options
 * @returns Promise<string[]> Array of deployed model base names
 * @deprecated Use getSapAiCoreDeployedModelNames from fetchers/sapaicore instead
 */
export async function getSapAiCoreDeployedModels(options: {
	sapAiCoreClientId: string
	sapAiCoreClientSecret: string
	sapAiCoreTokenUrl: string
	sapAiCoreBaseUrl: string
	sapAiResourceGroup?: string
}): Promise<string[]> {
	// Delegate to the standardized fetcher implementation
	return getSapAiCoreDeployedModelNames(options)
}

interface SapAiCoreHandlerOptions extends ApiHandlerOptions {
	sapAiCoreClientId?: string
	sapAiCoreClientSecret?: string
	sapAiCoreTokenUrl?: string
	sapAiResourceGroup?: string
	sapAiCoreBaseUrl?: string
	reasoningEffort?: "low" | "medium" | "high" | "minimal"
	thinkingBudgetTokens?: number
}

interface Deployment {
	id: string
	name: string
}

interface Token {
	access_token: string
	expires_in: number
	scope: string
	jti: string
	token_type: string
	expires_at: number
}

/**
 * Process Gemini streaming response with enhanced thinking content support
 */
export function processGeminiStreamChunk(data: any): {
	text?: string
	reasoning?: string
	usageMetadata?: {
		promptTokenCount?: number
		candidatesTokenCount?: number
		thoughtsTokenCount?: number
		cachedContentTokenCount?: number
	}
} {
	const result: ReturnType<typeof processGeminiStreamChunk> = {}

	// Early return for null, undefined, or falsy data
	if (!data) {
		return result
	}

	// Handle thinking content from Gemini's response
	const candidateForThoughts = data?.candidates?.[0]
	const partsForThoughts = candidateForThoughts?.content?.parts
	let thoughts = ""

	if (partsForThoughts) {
		for (const part of partsForThoughts) {
			const { thought, text } = part
			if (thought && text) {
				thoughts += text + "\n"
			}
		}
	}

	if (thoughts.trim() !== "") {
		result.reasoning = thoughts.trim()
	}

	// Handle regular text content
	if (data.text) {
		result.text = data.text
	}

	// Handle content parts for non-thought text
	if (data.candidates && data.candidates[0]?.content?.parts) {
		let nonThoughtText = ""
		for (const part of data.candidates[0].content.parts) {
			if (part.text && !part.thought) {
				nonThoughtText += part.text
			}
		}
		if (nonThoughtText && !result.text) {
			result.text = nonThoughtText
		}
	}

	// Handle usage metadata
	if (data.usageMetadata) {
		result.usageMetadata = {
			promptTokenCount: data.usageMetadata.promptTokenCount,
			candidatesTokenCount: data.usageMetadata.candidatesTokenCount,
			thoughtsTokenCount: data.usageMetadata.thoughtsTokenCount,
			cachedContentTokenCount: data.usageMetadata.cachedContentTokenCount,
		}
	}

	return result
}

/**
 * Safely parse JSON with fallback handling for common malformed JSON issues
 * Used specifically for SAP AI Core streaming responses
 */
export function parseJsonSafely(str: string): any {
	// Wrap it in parentheses so JS will treat it as an expression
	const obj = new Function("return " + str)()
	return JSON.stringify(obj)
}

/**
 * Prepare Gemini request payload with thinking configuration using standardized transforms
 */
function prepareGeminiRequestPayload(
	systemPrompt: string,
	messages: Anthropic.Messages.MessageParam[],
	model: { id: SapAiCoreModelId; info: ModelInfo },
	thinkingBudgetTokens?: number,
): any {
	// Use standardized Gemini content conversion
	const contents = messages.map((message) => ({
		role: message.role === "assistant" ? "model" : "user",
		parts: convertAnthropicContentToGemini(message.content),
	}))

	const payload = {
		contents,
		systemInstruction: {
			parts: [
				{
					text: systemPrompt,
				},
			],
		},
		generationConfig: {
			maxOutputTokens: model.info.maxTokens,
			temperature: 0.0,
		},
	}

	// Add thinking config if the model supports it and budget is provided
	const thinkingBudget = thinkingBudgetTokens ?? 0

	if (thinkingBudget > 0 && model.info.maxThinkingTokens) {
		// Add thinking configuration to the payload
		;(payload as any).thinkingConfig = {
			thinkingBudget: thinkingBudget,
			includeThoughts: true,
		}
	}

	return payload
}

export class SapAiCoreHandler extends BaseProvider implements SingleCompletionHandler {
	private options: SapAiCoreHandlerOptions
	private token?: Token
	private deployments?: Deployment[]

	constructor(options: SapAiCoreHandlerOptions) {
		super()
		this.options = options
	}

	private async authenticate(): Promise<Token> {
		const payload = {
			grant_type: "client_credentials",
			client_id: this.options.sapAiCoreClientId || "",
			client_secret: this.options.sapAiCoreClientSecret || "",
		}

		const baseTokenUrl = this.options.sapAiCoreTokenUrl || ""
		if (!baseTokenUrl.startsWith("https://")) {
			throw new Error("SAP AI Core Token URL must use HTTPS for security")
		}

		const tokenUrl = baseTokenUrl.replace(/\/+$/, "") + "/oauth/token"
		const response = await axios.post(tokenUrl, payload, {
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
		})
		const token = response.data as Token
		token.expires_at = Date.now() + token.expires_in * 1000
		return token
	}

	private async getToken(): Promise<string> {
		if (!this.token || this.token.expires_at < Date.now()) {
			this.token = await this.authenticate()
		}
		return this.token.access_token
	}

	private async getAiCoreDeployments(): Promise<Deployment[]> {
		if (this.options.sapAiCoreClientSecret === "") {
			return [{ id: "notconfigured", name: "ai-core-not-configured" }]
		}

		if (!this.options.sapAiCoreBaseUrl?.startsWith("https://")) {
			throw new Error("SAP AI Core Base URL must use HTTPS for security")
		}

		const token = await this.getToken()
		const headers = {
			Authorization: `Bearer ${token}`,
			"AI-Resource-Group": this.options.sapAiResourceGroup || "default",
			"Content-Type": "application/json",
			"AI-Client-Type": "Roo-Code",
		}

		const url = `${this.options.sapAiCoreBaseUrl}/v2/lm/deployments?$top=10000&$skip=0`

		try {
			const response = await axios.get(url, { headers })
			const deployments = response.data.resources

			return deployments
				.filter((deployment: any) => deployment.targetStatus === "RUNNING")
				.map((deployment: any) => {
					const model = deployment.details?.resources?.backend_details?.model
					if (!model?.name || !model?.version) {
						return null // Skip this row
					}
					return {
						id: deployment.id,
						name: `${model.name}:${model.version}`,
					}
				})
				.filter((deployment: any) => deployment !== null)
		} catch (error) {
			console.error("Error fetching deployments:", error)
			throw new Error("Failed to fetch deployments")
		}
	}

	private async getDeploymentForModel(modelId: string): Promise<string> {
		// If deployments are not fetched yet or the model is not found in the fetched deployments, fetch deployments
		if (!this.deployments || !this.hasDeploymentForModel(modelId)) {
			this.deployments = await this.getAiCoreDeployments()
		}

		const deployment = this.deployments.find((d) => {
			const deploymentBaseName = d.name.split(":")[0].toLowerCase()
			const modelBaseName = modelId.split(":")[0].toLowerCase()
			return deploymentBaseName === modelBaseName
		})

		if (!deployment) {
			throw new Error(`No running deployment found for model ${modelId}`)
		}

		return deployment.id
	}

	private hasDeploymentForModel(modelId: string): boolean {
		if (!this.deployments || !Array.isArray(this.deployments)) {
			return false
		}
		return this.deployments.some((d) => {
			if (!d.name || typeof d.name !== "string") {
				return false
			}
			const deploymentBaseName = d.name.split(":")[0].toLowerCase()
			const modelBaseName = modelId.split(":")[0].toLowerCase()
			return deploymentBaseName === modelBaseName
		})
	}

	/**
	 * Get deployed model names for the model picker
	 * Uses the standardized fetcher implementation
	 * @returns Promise<string[]> Array of deployed model base names
	 */
	async getDeployedModelNames(): Promise<string[]> {
		return getSapAiCoreDeployedModelNames({
			sapAiCoreClientId: this.options.sapAiCoreClientId || "",
			sapAiCoreClientSecret: this.options.sapAiCoreClientSecret || "",
			sapAiCoreTokenUrl: this.options.sapAiCoreTokenUrl || "",
			sapAiCoreBaseUrl: this.options.sapAiCoreBaseUrl || "",
			sapAiResourceGroup: this.options.sapAiResourceGroup,
		})
	}

	async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		if (!this.options.sapAiCoreBaseUrl?.startsWith("https://")) {
			throw new Error("SAP AI Core Base URL must use HTTPS for security")
		}

		const token = await this.getToken()
		const headers = {
			Authorization: `Bearer ${token}`,
			"AI-Resource-Group": this.options.sapAiResourceGroup || "default",
			"Content-Type": "application/json",
			"AI-Client-Type": "Roo-Code",
		}

		const model = this.getModel()

		const anthropicModels = [
			"anthropic--claude-4-sonnet",
			"anthropic--claude-4-opus",
			"anthropic--claude-3.7-sonnet",
			"anthropic--claude-3.5-sonnet",
			"anthropic--claude-3-sonnet",
			"anthropic--claude-3-haiku",
			"anthropic--claude-3-opus",
		]

		const openAIModels = [
			"gpt-4o",
			"gpt-4",
			"gpt-4o-mini",
			"o1",
			"gpt-4.1",
			"gpt-4.1-nano",
			"gpt-5",
			"gpt-5-nano",
			"gpt-5-mini",
			"o3-mini",
			"o3",
			"o4-mini",
		]

		const geminiModels = ["gemini-2.5-flash", "gemini-2.5-pro"]
		// Check if model is supported before getting deployment
		if (
			!anthropicModels.includes(model.id) &&
			!openAIModels.includes(model.id) &&
			!geminiModels.includes(model.id)
		) {
			throw new Error(`Unsupported model: ${model.id}`)
		}

		const deploymentId = await this.getDeploymentForModel(model.id)

		let url: string
		let payload: any

		if (anthropicModels.includes(model.id)) {
			url = `${this.options.sapAiCoreBaseUrl}/v2/inference/deployments/${deploymentId}/invoke-with-response-stream`

			// Use standardized Bedrock Converse format transformer
			const formattedMessages = convertToBedrockConverseMessages(messages)

			// Get message indices for caching
			const userMsgIndices = messages.reduce(
				(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
				[] as number[],
			)
			const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
			const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

			if (
				model.id === "anthropic--claude-4-sonnet" ||
				model.id === "anthropic--claude-4-opus" ||
				model.id === "anthropic--claude-3.7-sonnet"
			) {
				// Use converse-stream endpoint with caching support
				url = `${this.options.sapAiCoreBaseUrl}/v2/inference/deployments/${deploymentId}/converse-stream`

				const messagesWithCache = convertToBedrockConverseMessages(messages)

				const lastMessageIndex = messagesWithCache.length - 1
				if (lastMessageIndex >= 0 && messagesWithCache[lastMessageIndex].role === "user") {
					const content = messagesWithCache[lastMessageIndex].content
					if (Array.isArray(content) && content.length > 0) {
						const lastContent = content[content.length - 1] as any
						lastContent.cache_control = { type: "ephemeral" }
					}
				}

				payload = {
					inferenceConfig: {
						maxTokens: model.info.maxTokens,
						temperature: 0.0,
					},
					system: [{ text: systemPrompt, cache_control: { type: "ephemeral" } }],
					messages: messagesWithCache,
				}
			} else {
				// Use invoke-with-response-stream endpoint
				payload = {
					max_tokens: model.info.maxTokens,
					system: systemPrompt,
					messages,
					anthropic_version: "bedrock-2023-05-31",
				}
			}
		} else if (openAIModels.includes(model.id)) {
			// Use standardized OpenAI message conversion
			const openAiMessages = convertToOpenAiMessages(messages)

			url = `${this.options.sapAiCoreBaseUrl}/v2/inference/deployments/${deploymentId}/chat/completions?api-version=2024-12-01-preview`
			payload = {
				stream: true,
				messages: [{ role: "system", content: systemPrompt }, ...openAiMessages],
				max_tokens: model.info.maxTokens,
				temperature: 0.0,
				frequency_penalty: 0,
				presence_penalty: 0,
				stop: null,
				stream_options: { include_usage: true },
			}

			// Handle reasoning models
			if (["o1", "o3-mini", "o3", "o4-mini", "gpt-5", "gpt-5-nano", "gpt-5-mini"].includes(model.id)) {
				delete payload.max_tokens
				delete payload.temperature

				// Add reasoning effort for reasoning models
				if (this.options.reasoningEffort) {
					payload.reasoning_effort = this.options.reasoningEffort
				}
			}

			if (model.id === "o3-mini") {
				delete payload.stream
				delete payload.stream_options
			}
		} else if (geminiModels.includes(model.id)) {
			url = `${this.options.sapAiCoreBaseUrl}/v2/inference/deployments/${deploymentId}/models/${model.id}:streamGenerateContent`
			payload = prepareGeminiRequestPayload(systemPrompt, messages, model, this.options.thinkingBudgetTokens)
		} else {
			// This should never be reached due to the earlier model support check
			throw new Error(`Unsupported model: ${model.id}`)
		}
		try {
			const response = await axios.post(url, JSON.stringify(payload, null, 2), {
				headers,
				responseType: "stream",
			})

			if (model.id === "o3-mini") {
				const response = await axios.post(url, JSON.stringify(payload, null, 2), { headers })

				// Yield the usage information
				if (response.data.usage) {
					yield {
						type: "usage",
						inputTokens: response.data.usage.prompt_tokens,
						outputTokens: response.data.usage.completion_tokens,
					}
				}

				// Yield the content
				if (response.data.choices && response.data.choices.length > 0) {
					yield {
						type: "text",
						text: response.data.choices[0].message.content,
					}
				}
			} else if (openAIModels.includes(model.id)) {
				yield* this.streamCompletionGPT(response.data, model)
			} else if (
				model.id === "anthropic--claude-4-sonnet" ||
				model.id === "anthropic--claude-4-opus" ||
				model.id === "anthropic--claude-3.7-sonnet"
			) {
				yield* this.streamCompletionSonnet37(response.data, model)
			} else if (geminiModels.includes(model.id)) {
				yield* this.streamCompletionGemini(response.data, model)
			} else {
				yield* this.streamCompletion(response.data, model)
			}
		} catch (error: any) {
			if (error.response) {
				console.error("Error status:", error.response.status)
				console.error("Error data:", error.response.data)

				if (error.response.status === 404) {
					throw new Error(`404 Not Found: ${error.response.data}`)
				}

				// Handle other HTTP errors
				throw new Error("Failed to create message")
			} else if (error.request) {
				throw new Error("No response received from server")
			} else {
				throw new Error(`Error setting up request: ${error.message}`)
			}
		}
	}

	private async *streamCompletion(stream: any, _model: { id: SapAiCoreModelId; info: ModelInfo }): ApiStream {
		const usage = { input_tokens: 0, output_tokens: 0 }

		try {
			for await (const chunk of stream) {
				const lines = chunk.toString().split("\n").filter(Boolean)
				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const jsonData = line.slice(6)
						try {
							const data = JSON.parse(jsonData)
							if (data.type === "message_start") {
								usage.input_tokens = data.message.usage.input_tokens
								yield {
									type: "usage",
									inputTokens: usage.input_tokens,
									outputTokens: usage.output_tokens,
								}
							} else if (data.type === "content_block_start" || data.type === "content_block_delta") {
								const contentBlock =
									data.type === "content_block_start" ? data.content_block : data.delta

								if (contentBlock.type === "text" || contentBlock.type === "text_delta") {
									yield {
										type: "text",
										text: contentBlock.text || "",
									}
								}
							} else if (data.type === "message_delta") {
								if (data.usage) {
									usage.output_tokens = data.usage.output_tokens
									yield {
										type: "usage",
										inputTokens: 0,
										outputTokens: data.usage.output_tokens,
									}
								}
							}
						} catch (error) {
							console.error("Failed to parse JSON data:", error)
						}
					}
				}
			}
		} catch (error) {
			console.error("Error streaming completion:", error)
			throw error
		}
	}

	private async *streamCompletionSonnet37(stream: any, _model: { id: SapAiCoreModelId; info: ModelInfo }): ApiStream {
		try {
			for await (const chunk of stream) {
				const lines = chunk.toString().split("\n").filter(Boolean)

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const jsonData = line.slice(6)

						try {
							const data = JSON.parse(parseJsonSafely(jsonData))

							// Handle metadata (token usage)
							if (data.metadata?.usage) {
								let inputTokens = data.metadata.usage.inputTokens || 0
								const outputTokens = data.metadata.usage.outputTokens || 0

								// calibrate input token
								const totalTokens = data.metadata.usage.totalTokens || 0
								const cacheReadInputTokens = data.metadata.usage.cacheReadInputTokens || 0
								const cacheWriteOutputTokens = data.metadata.usage.cacheWriteOutputTokens || 0
								if (
									inputTokens + outputTokens + cacheReadInputTokens + cacheWriteOutputTokens !==
									totalTokens
								) {
									inputTokens =
										totalTokens - outputTokens - cacheReadInputTokens - cacheWriteOutputTokens
								}

								yield {
									type: "usage",
									inputTokens,
									outputTokens,
								}
							}

							// Handle content block delta (text generation)
							if (data.contentBlockDelta) {
								if (data.contentBlockDelta?.delta?.text) {
									yield {
										type: "text",
										text: data.contentBlockDelta.delta.text,
									}
								}

								// Handle reasoning content if present
								if (data.contentBlockDelta?.delta?.reasoningContent?.text) {
									yield {
										type: "reasoning",
										text: data.contentBlockDelta.delta.reasoningContent.text,
									}
								}
							}
						} catch (error) {
							console.error("Failed to parse JSON data:", error)
						}
					}
				}
			}
		} catch (error) {
			console.error("Error streaming completion:", error)
			throw error
		}
	}

	private async *streamCompletionGPT(stream: any, _model: { id: SapAiCoreModelId; info: ModelInfo }): ApiStream {
		let inputTokens = 0
		let outputTokens = 0

		try {
			for await (const chunk of stream) {
				const lines = chunk.toString().split("\n").filter(Boolean)
				for (const line of lines) {
					if (line.trim() === "data: [DONE]") {
						// End of stream, yield final usage
						yield {
							type: "usage",
							inputTokens,
							outputTokens,
						}
						return
					}

					if (line.startsWith("data: ")) {
						const jsonData = line.slice(6)
						try {
							const data = JSON.parse(jsonData)

							if (data.choices && data.choices.length > 0) {
								const choice = data.choices[0]
								if (choice.delta && choice.delta.content) {
									yield {
										type: "text",
										text: choice.delta.content,
									}
								}
							}

							// Handle usage information
							if (data.usage) {
								inputTokens = data.usage.prompt_tokens || inputTokens
								outputTokens = data.usage.completion_tokens || outputTokens
								yield {
									type: "usage",
									inputTokens,
									outputTokens,
								}
							}
						} catch (error) {
							console.error("Failed to parse GPT JSON data:", error)
						}
					}
				}
			}
		} catch (error) {
			console.error("Error streaming GPT completion:", error)
			throw error
		}
	}

	private async *streamCompletionGemini(stream: any, _model: { id: SapAiCoreModelId; info: ModelInfo }): ApiStream {
		let promptTokens = 0
		let outputTokens = 0
		let cacheReadTokens = 0
		let thoughtsTokenCount = 0

		try {
			for await (const chunk of stream) {
				const lines = chunk.toString().split("\n").filter(Boolean)
				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const jsonData = line.slice(6)
						try {
							const data = JSON.parse(jsonData)

							// Use Gemini module function to process the chunk
							const processed = processGeminiStreamChunk(data)

							// Yield reasoning if present
							if (processed.reasoning) {
								yield {
									type: "reasoning",
									text: processed.reasoning,
								}
							}

							// Yield text if present
							if (processed.text) {
								yield {
									type: "text",
									text: processed.text,
								}
							}

							if (processed.usageMetadata) {
								promptTokens = processed.usageMetadata.promptTokenCount ?? promptTokens
								outputTokens = processed.usageMetadata.candidatesTokenCount ?? outputTokens
								thoughtsTokenCount = processed.usageMetadata.thoughtsTokenCount ?? thoughtsTokenCount
								cacheReadTokens = processed.usageMetadata.cachedContentTokenCount ?? cacheReadTokens

								yield {
									type: "usage",
									inputTokens: promptTokens - cacheReadTokens,
									outputTokens,
								}
							}
						} catch (error) {
							console.error("Failed to parse Gemini JSON data:", error)
						}
					}
				}
			}
		} catch (error) {
			console.error("Error streaming Gemini completion:", error)
			throw error
		}
	}
	async completePrompt(prompt: string): Promise<string> {
		// For SAP AI Core, we'll use the standard createMessage flow
		// and extract the text response
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: prompt,
			},
		]

		let result = ""
		for await (const chunk of this.createMessage("", messages)) {
			if (chunk.type === "text") {
				result += chunk.text
			}
		}

		return result
	}

	override getModel(): { id: SapAiCoreModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		const models = sapAiCoreModels as Record<string, ModelInfo>

		if (modelId && modelId in models) {
			const id = modelId as SapAiCoreModelId
			return { id, info: models[id] }
		}

		// If modelId is provided but not found in models, return it as-is for proper error handling
		if (modelId) {
			const id = modelId as SapAiCoreModelId
			// Use default model info as fallback to prevent crashes, but preserve the unsupported ID
			return { id, info: models[sapAiCoreDefaultModelId] }
		}

		return { id: sapAiCoreDefaultModelId, info: models[sapAiCoreDefaultModelId] }
	}
}
