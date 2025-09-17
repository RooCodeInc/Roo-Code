import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelInfo, type WatsonxModelId, watsonxDefaultModelId, watsonxModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { getApiRequestTimeout } from "./utils/timeout-config"
import { handleOpenAIError } from "./utils/openai-error-handler"

export class WatsonxHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private readonly providerName = "IBM watsonx"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// Construct the base URL for watsonx API
		// Default to US South region if not specified
		const region = this.options.watsonxRegion || "us-south"
		const baseURL = this.options.watsonxBaseUrl || `https://${region}.ml.cloud.ibm.com/ml/v1`
		const apiKey = this.options.watsonxApiKey || "not-provided"

		const headers = {
			...DEFAULT_HEADERS,
			"X-Watson-Project-Id": this.options.watsonxProjectId || "",
		}

		const timeout = getApiRequestTimeout()

		this.client = new OpenAI({
			baseURL,
			apiKey,
			defaultHeaders: headers,
			timeout,
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info: modelInfo } = this.getModel()

		// Combine system prompt with messages for watsonx format
		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
			role: "system",
			content: systemPrompt,
		}

		const convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature: this.options.modelTemperature ?? 0.7,
			messages: convertedMessages,
			stream: true as const,
			stream_options: { include_usage: true },
		}

		// Add max_tokens if needed
		if (this.options.includeMaxTokens === true) {
			requestOptions.max_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}

		let stream
		try {
			stream = await this.client.chat.completions.create(requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}

		let lastUsage

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta ?? {}

			if (delta.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, modelInfo)
		}
	}

	protected processUsageMetrics(usage: any, modelInfo?: ModelInfo): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in watsonxModels ? (modelId as WatsonxModelId) : watsonxDefaultModelId
		let info: ModelInfo = watsonxModels[id]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const model = this.getModel()
			const modelInfo = model.info

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: model.id,
				messages: [{ role: "user", content: prompt }],
			}

			// Add max_tokens if needed
			if (this.options.includeMaxTokens === true) {
				requestOptions.max_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
			}

			let response
			try {
				response = await this.client.chat.completions.create(requestOptions)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`${this.providerName} completion error: ${error.message}`)
			}

			throw error
		}
	}
}

/**
 * Helper function to get available watsonx models.
 *
 * Currently returns a static list of models defined in watsonxModels.
 * IBM watsonx doesn't provide a public API endpoint for dynamically listing available models,
 * so we maintain a curated list of supported models that are known to work with the watsonx platform.
 *
 * @returns Array of available model IDs
 */
export async function getWatsonxModels(): Promise<string[]> {
	// Return the static list of supported watsonx models
	// This list is maintained based on IBM's documentation and includes
	// both IBM Granite models and third-party models available on watsonx
	return Object.keys(watsonxModels)
}
