import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelInfo, openAiModelInfoSaneDefaults, NATIVE_TOOL_DEFAULTS } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { getApiRequestTimeout } from "./utils/timeout-config"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { XmlMatcher } from "../../utils/xml-matcher"

/**
 * Azure Foundry Handler
 *
 * A dedicated provider for Azure AI Foundry that allows users to:
 * - Provide a full Azure Foundry URL (including API version if desired)
 * - Use API key authentication
 * - Avoid Azure-specific parameter incompatibilities (e.g., prompt_cache_retention)
 *
 * This handler is based on the OpenAI handler but customized for Azure Foundry's requirements.
 */
export class AzureFoundryHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected client: OpenAI
	private readonly providerName = "Azure Foundry"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const baseURL = this.options.azureFoundryBaseUrl ?? ""
		const apiKey = this.options.azureFoundryApiKey ?? "not-provided"

		this.client = new OpenAI({
			baseURL,
			apiKey,
			defaultHeaders: DEFAULT_HEADERS,
			timeout: getApiRequestTimeout(),
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { info: modelInfo, reasoning } = this.getModel()
		const modelId = this.options.azureFoundryModelId ?? ""

		let systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
			role: "system",
			content: systemPrompt,
		}

		const convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature: this.options.modelTemperature ?? 0,
			messages: convertedMessages,
			stream: true as const,
			stream_options: { include_usage: true },
			...(reasoning && reasoning),
			...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
			...(metadata?.toolProtocol === "native" &&
				metadata.parallelToolCalls === true && {
					parallel_tool_calls: true,
				}),
		}

		// Add max_tokens if needed
		this.addMaxTokensIfNeeded(requestOptions, modelInfo)

		// Note: We intentionally do NOT add prompt_cache_retention as Azure Foundry doesn't support it
		// This is the main reason for this dedicated provider

		let stream
		try {
			stream = await this.client.chat.completions.create(requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}

		const matcher = new XmlMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		let lastUsage
		const activeToolCallIds = new Set<string>()

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta ?? {}
			const finishReason = chunk.choices?.[0]?.finish_reason

			if (delta.content) {
				for (const processedChunk of matcher.update(delta.content)) {
					yield processedChunk
				}
			}

			if ("reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					text: (delta.reasoning_content as string | undefined) || "",
				}
			}

			yield* this.processToolCalls(delta, finishReason, activeToolCallIds)

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		for (const processedChunk of matcher.final()) {
			yield processedChunk
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, modelInfo)
		}
	}

	protected processUsageMetrics(usage: any, _modelInfo?: ModelInfo): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: usage?.cache_creation_input_tokens || undefined,
			cacheReadTokens: usage?.cache_read_input_tokens || undefined,
		}
	}

	override getModel() {
		const id = this.options.azureFoundryModelId ?? ""
		// Ensure Azure Foundry models default to supporting native tool calling.
		const info: ModelInfo = {
			...NATIVE_TOOL_DEFAULTS,
			...(this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults),
		}
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
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let response
			try {
				response = await this.client.chat.completions.create(requestOptions)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			return response.choices?.[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`${this.providerName} completion error: ${error.message}`)
			}

			throw error
		}
	}

	/**
	 * Helper generator to process tool calls from a stream chunk.
	 */
	private *processToolCalls(
		delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta | undefined,
		finishReason: string | null | undefined,
		activeToolCallIds: Set<string>,
	): Generator<
		| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }
		| { type: "tool_call_end"; id: string }
	> {
		if (delta?.tool_calls) {
			for (const toolCall of delta.tool_calls) {
				if (toolCall.id) {
					activeToolCallIds.add(toolCall.id)
				}
				yield {
					type: "tool_call_partial",
					index: toolCall.index,
					id: toolCall.id,
					name: toolCall.function?.name,
					arguments: toolCall.function?.arguments,
				}
			}
		}

		// Emit tool_call_end events when finish_reason is "tool_calls"
		if (finishReason === "tool_calls" && activeToolCallIds.size > 0) {
			for (const id of activeToolCallIds) {
				yield { type: "tool_call_end", id }
			}
			activeToolCallIds.clear()
		}
	}

	/**
	 * Adds max_completion_tokens to the request body if needed
	 */
	protected addMaxTokensIfNeeded(
		requestOptions:
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
		modelInfo: ModelInfo,
	): void {
		if (this.options.includeMaxTokens === true) {
			requestOptions.max_completion_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}
	}
}
