import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { XmlMatcher } from "../../utils/xml-matcher"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import { handleOpenAIError } from "./utils/openai-error-handler"

type BaseOpenAiCompatibleProviderOptions<ModelName extends string> = ApiHandlerOptions & {
	providerName: string
	baseURL: string
	defaultProviderModelId: ModelName
	providerModels: Record<ModelName, ModelInfo>
	defaultTemperature?: number
}

export abstract class BaseOpenAiCompatibleProvider<ModelName extends string>
	extends BaseProvider
	implements SingleCompletionHandler
{
	protected readonly providerName: string
	protected readonly baseURL: string
	protected readonly defaultTemperature: number
	protected readonly defaultProviderModelId: ModelName
	protected readonly providerModels: Record<ModelName, ModelInfo>

	protected readonly options: ApiHandlerOptions

	protected client: OpenAI

	constructor({
		providerName,
		baseURL,
		defaultProviderModelId,
		providerModels,
		defaultTemperature,
		...options
	}: BaseOpenAiCompatibleProviderOptions<ModelName>) {
		super()

		this.providerName = providerName
		this.baseURL = baseURL
		this.defaultProviderModelId = defaultProviderModelId
		this.providerModels = providerModels
		this.defaultTemperature = defaultTemperature ?? 0

		this.options = options

		if (!this.options.apiKey) {
			throw new Error("API key is required")
		}

		this.client = new OpenAI({
			baseURL,
			apiKey: this.options.apiKey,
			defaultHeaders: DEFAULT_HEADERS,
		})
	}

	protected createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
	) {
		const {
			id: model,
			info: { maxTokens: max_tokens },
		} = this.getModel()

		const temperature = this.options.modelTemperature ?? this.defaultTemperature

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
		}

		// Add thinking parameter for GLM-4.6 model only if explicitly enabled
		// This allows for compatibility with endpoints that don't support this parameter
		if (this.isGLM46Model(model) && this.shouldAddThinkingParameter()) {
			// @ts-ignore - GLM-4.6 specific parameter
			params.thinking = { type: "enabled" }
		}

		try {
			return this.client.chat.completions.create(params, requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const stream = await this.createStream(systemPrompt, messages, metadata)
		const { id: model } = this.getModel()
		const isGLM46 = this.isGLM46Model(model)

		// Use XmlMatcher for GLM-4.6 to parse thinking tokens from content
		// This works regardless of whether the endpoint supports the thinking parameter
		const matcher = isGLM46
			? new XmlMatcher(
					"think",
					(chunk) =>
						({
							type: chunk.matched ? "reasoning" : "text",
							text: chunk.data,
						}) as const,
				)
			: null

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta

			if (delta?.content) {
				if (isGLM46 && matcher) {
					// Parse thinking tokens for GLM-4.6 from content
					for (const parsedChunk of matcher.update(delta.content)) {
						yield parsedChunk
					}
				} else {
					yield {
						type: "text",
						text: delta.content,
					}
				}
			}

			// Handle reasoning_content if present (for models/endpoints that support it directly)
			// This ensures compatibility with various implementations including ik_llama.cpp
			if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					text: (delta.reasoning_content as string | undefined) || "",
				}
			}

			if (chunk.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
				}
			}
		}

		// Finalize any remaining content from the matcher
		if (isGLM46 && matcher) {
			for (const parsedChunk of matcher.final()) {
				yield parsedChunk
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId } = this.getModel()

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
		const id =
			this.options.apiModelId && this.options.apiModelId in this.providerModels
				? (this.options.apiModelId as ModelName)
				: this.defaultProviderModelId

		return { id, info: this.providerModels[id] }
	}

	/**
	 * Check if the model is GLM-4.6 which may require special handling for thinking tokens
	 */
	protected isGLM46Model(modelId: string): boolean {
		// Check for various GLM-4.6 model naming patterns
		const lowerModel = modelId.toLowerCase()
		return lowerModel.includes("glm-4.6") || lowerModel.includes("glm-4-6") || lowerModel === "glm-4.6"
	}

	/**
	 * Determine whether to add the thinking parameter to the request
	 * This can be overridden by subclasses or configured via options
	 * Default is conservative (false) to ensure compatibility with endpoints like ik_llama.cpp
	 */
	protected shouldAddThinkingParameter(): boolean {
		// Only add thinking parameter if explicitly enabled via configuration
		// This ensures compatibility with endpoints that don't support this parameter
		// @ts-ignore - Check for future configuration option
		return this.options.openAiEnableThinkingParameter === true
	}
}
