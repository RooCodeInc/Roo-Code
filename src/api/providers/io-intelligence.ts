import { ioIntelligenceDefaultModelId, ioIntelligenceModels, type IOIntelligenceModelId } from "@roo-code/types"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"
import { BaseProvider } from "./base-provider"
import { getModels } from "./fetchers/modelCache"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { getModelParams } from "../transform/model-params"
import { DEFAULT_HEADERS } from "./constants"
import { handleOpenAIError } from "./utils/openai-error-handler"

export class IOIntelligenceHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	protected models: ModelRecord = {}
	private readonly providerName = "IO Intelligence"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// API key is optional for model discovery, but required for actual API calls
		this.client = new OpenAI({
			baseURL: "https://api.intelligence.io.solutions/api/v1",
			apiKey: options.ioIntelligenceApiKey || "not-provided",
			defaultHeaders: DEFAULT_HEADERS,
		})
	}

	public async fetchModel() {
		try {
			this.models = await getModels({
				provider: "io-intelligence",
				apiKey: this.options.ioIntelligenceApiKey || undefined,
			})
		} catch (error) {
			console.error("Failed to fetch IO Intelligence models, falling back to default models:", error)
			this.models = ioIntelligenceModels
		}
		return this.getModel()
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = await this.fetchModel()

		const { id: modelId, maxTokens, temperature } = model

		// Convert Anthropic messages to OpenAI format
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		const completionParams: OpenAI.Chat.ChatCompletionCreateParams = {
			model: modelId,
			...(maxTokens && maxTokens > 0 && { max_tokens: maxTokens }),
			temperature: temperature ?? 0.7,
			messages: openAiMessages,
			stream: true,
			stream_options: { include_usage: true },
		}

		let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
		try {
			stream = await this.client.chat.completions.create(completionParams)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}

		let lastUsage: OpenAI.Completions.CompletionUsage | undefined = undefined

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				yield { type: "text", text: delta.content }
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield {
				type: "usage",
				inputTokens: lastUsage.prompt_tokens || 0,
				outputTokens: lastUsage.completion_tokens || 0,
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId } = await this.fetchModel()

		try {
			const response = await this.client.chat.completions.create({
				model: modelId,
				messages: [{ role: "user", content: prompt }],
			})

			return response.choices[0]?.message.content || ""
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}

	override getModel() {
		const modelId = this.options.ioIntelligenceModelId || ioIntelligenceDefaultModelId

		// If models haven't been fetched yet, use fallback
		if (!this.models || Object.keys(this.models).length === 0) {
			this.models = ioIntelligenceModels
		}

		let modelInfo = this.models[modelId]

		if (!modelInfo) {
			modelInfo =
				ioIntelligenceModels[modelId as IOIntelligenceModelId] ??
				ioIntelligenceModels[ioIntelligenceDefaultModelId]
		}

		if (!modelInfo) {
			// Return the requested model ID even if not found, with fallback info
			modelInfo = {
				maxTokens: 8192,
				contextWindow: 128000,
				supportsImages: false,
				supportsPromptCache: false,
			}
		}

		const params = getModelParams({
			format: "openai",
			modelId,
			model: modelInfo,
			settings: this.options,
		})

		return { id: modelId, info: modelInfo, ...params }
	}
}
