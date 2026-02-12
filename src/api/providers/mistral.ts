import { Anthropic } from "@anthropic-ai/sdk"
import { createMistral } from "@ai-sdk/mistral"
import { streamText, generateText, ToolSet, LanguageModel, ModelMessage } from "ai"

import {
	mistralModels,
	mistralDefaultModelId,
	type MistralModelId,
	type ModelInfo,
	MISTRAL_DEFAULT_TEMPERATURE,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { convertToAiSdkMessages, convertToolsForAiSdk, consumeAiSdkStream, handleAiSdkError } from "../transform/ai-sdk"
import { applyToolCacheOptions } from "../transform/cache-breakpoints"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

/**
 * Mistral provider using the dedicated @ai-sdk/mistral package.
 * Provides access to Mistral AI models including Codestral, Mistral Large, and more.
 */
export class MistralHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createMistral>

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const modelId = options.apiModelId ?? mistralDefaultModelId

		// Determine the base URL based on the model (Codestral uses a different endpoint)
		const baseURL = modelId.startsWith("codestral-")
			? options.mistralCodestralUrl || "https://codestral.mistral.ai/v1"
			: "https://api.mistral.ai/v1"

		// Create the Mistral provider using AI SDK
		this.provider = createMistral({
			apiKey: options.mistralApiKey ?? "not-provided",
			baseURL,
			headers: DEFAULT_HEADERS,
		})
	}

	override getModel(): { id: string; info: ModelInfo; maxTokens?: number; temperature?: number } {
		const id = (this.options.apiModelId ?? mistralDefaultModelId) as MistralModelId
		const info = mistralModels[id as keyof typeof mistralModels] || mistralModels[mistralDefaultModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})
		return { id, info, ...params }
	}

	/**
	 * Get the language model for the configured model ID.
	 */
	protected getLanguageModel(): LanguageModel {
		const { id } = this.getModel()
		// Type assertion needed due to version mismatch between @ai-sdk/mistral and ai packages
		return this.provider(id) as unknown as LanguageModel
	}

	/**
	 * Process usage metrics from the AI SDK response.
	 */
	protected processUsageMetrics(usage: {
		inputTokens?: number
		outputTokens?: number
		details?: {
			cachedInputTokens?: number
			reasoningTokens?: number
		}
	}): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage.inputTokens || 0,
			outputTokens: usage.outputTokens || 0,
			cacheReadTokens: usage.details?.cachedInputTokens,
			reasoningTokens: usage.details?.reasoningTokens,
		}
	}

	/**
	 * Map OpenAI tool_choice to AI SDK toolChoice format.
	 */
	protected mapToolChoice(
		toolChoice: any,
	): "auto" | "none" | "required" | { type: "tool"; toolName: string } | undefined {
		if (!toolChoice) {
			return undefined
		}

		// Handle string values
		if (typeof toolChoice === "string") {
			switch (toolChoice) {
				case "auto":
					return "auto"
				case "none":
					return "none"
				case "required":
				case "any":
					return "required"
				default:
					return "auto"
			}
		}

		// Handle object values (OpenAI ChatCompletionNamedToolChoice format)
		if (typeof toolChoice === "object" && "type" in toolChoice) {
			if (toolChoice.type === "function" && "function" in toolChoice && toolChoice.function?.name) {
				return { type: "tool", toolName: toolChoice.function.name }
			}
		}

		return undefined
	}

	/**
	 * Get the max tokens parameter to include in the request.
	 */
	protected getMaxOutputTokens(): number | undefined {
		const { info } = this.getModel()
		return this.options.modelMaxTokens || info.maxTokens || undefined
	}

	/**
	 * Create a message stream using the AI SDK.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const languageModel = this.getLanguageModel()

		// Convert messages to AI SDK format
		const aiSdkMessages = messages as ModelMessage[]

		// Convert tools to OpenAI format first, then to AI SDK format
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined
		applyToolCacheOptions(aiSdkTools as Parameters<typeof applyToolCacheOptions>[0], metadata?.toolProviderOptions)

		// Build the request options
		// Use MISTRAL_DEFAULT_TEMPERATURE (1) as fallback to match original behavior
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt || undefined,
			messages: aiSdkMessages,
			temperature: this.options.modelTemperature ?? MISTRAL_DEFAULT_TEMPERATURE,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: this.mapToolChoice(metadata?.tool_choice),
		}

		// Use streamText for streaming responses
		const result = streamText(requestOptions)

		try {
			const processUsage = this.processUsageMetrics.bind(this)
			yield* consumeAiSdkStream(result, async function* () {
				const usage = await result.usage
				yield processUsage(usage)
			})
		} catch (error) {
			throw handleAiSdkError(error, "Mistral")
		}
	}

	/**
	 * Complete a prompt using the AI SDK generateText.
	 */
	async completePrompt(prompt: string): Promise<string> {
		const languageModel = this.getLanguageModel()

		// Use MISTRAL_DEFAULT_TEMPERATURE (1) as fallback to match original behavior
		const { text } = await generateText({
			model: languageModel,
			prompt,
			maxOutputTokens: this.getMaxOutputTokens(),
			temperature: this.options.modelTemperature ?? MISTRAL_DEFAULT_TEMPERATURE,
		})

		return text
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
