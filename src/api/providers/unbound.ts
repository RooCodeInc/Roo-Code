import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelInfo, type ModelRecord, unboundDefaultModelId, unboundDefaultModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { OpenAiReasoningParams } from "../transform/reasoning"

import { DEFAULT_HEADERS } from "./constants"
import { getModels } from "./fetchers/modelCache"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { applyRouterToolPreferences } from "./utils/router-tool-preferences"

// Unbound usage includes extra fields for Anthropic cache tokens.
interface UnboundUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
	cache_read_input_tokens?: number
}

type UnboundChatCompletionParamsStreaming = OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & {
	unbound_metadata?: {
		originApp?: string
		taskId?: string
		mode?: string
	}
	thinking?: OpenAiReasoningParams
}

type UnboundChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParams & {
	unbound_metadata?: {
		originApp?: string
		taskId?: string
		mode?: string
	}
	thinking?: OpenAiReasoningParams
}

export class UnboundHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected models: ModelRecord = {}
	private client: OpenAI
	private readonly providerName = "Unbound"

	constructor(options: ApiHandlerOptions) {
		super()

		this.options = options

		const apiKey = this.options.unboundApiKey ?? "not-provided"

		this.client = new OpenAI({
			baseURL: "https://api.getunbound.ai/v1",
			apiKey: apiKey,
			defaultHeaders: {
				...DEFAULT_HEADERS,
				"X-Unbound-Metadata": JSON.stringify({ labels: [{ key: "app", value: "roo-code" }] }),
			},
		})
	}

	public async fetchModel() {
		this.models = await getModels({ provider: "unbound", apiKey: this.options.unboundApiKey })
		return this.getModel()
	}

	override getModel() {
		const id = this.options.unboundModelId ?? unboundDefaultModelId
		const cachedInfo = this.models[id] ?? unboundDefaultModelInfo
		let info: ModelInfo = cachedInfo

		// Apply tool preferences for models accessed through routers (OpenAI, Gemini)
		info = applyRouterToolPreferences(id, info)

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		return { id, info, ...params }
	}

	protected processUsageMetrics(usage: any, modelInfo?: ModelInfo): ApiStreamUsageChunk {
		const unboundUsage = usage as UnboundUsage
		const inputTokens = unboundUsage?.prompt_tokens || 0
		const outputTokens = unboundUsage?.completion_tokens || 0
		const cacheWriteTokens = unboundUsage?.cache_creation_input_tokens || 0
		const cacheReadTokens = unboundUsage?.cache_read_input_tokens || 0
		const { totalCost } = modelInfo
			? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
			: { totalCost: 0 }

		return {
			type: "usage",
			inputTokens: inputTokens,
			outputTokens: outputTokens,
			cacheWriteTokens: cacheWriteTokens,
			cacheReadTokens: cacheReadTokens,
			totalCost: totalCost,
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const {
			id: model,
			info,
			maxTokens: max_tokens,
			temperature,
			reasoningEffort: reasoning_effort,
			reasoning: thinking,
		} = await this.fetchModel()

		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		// Map extended efforts to OpenAI Chat Completions-accepted values (omit unsupported)
		const allowedEffort = (["low", "medium", "high"] as const).includes(reasoning_effort as any)
			? (reasoning_effort as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming["reasoning_effort"])
			: undefined

		const completionParams: UnboundChatCompletionParamsStreaming = {
			messages: openAiMessages,
			model,
			max_tokens,
			temperature,
			...(allowedEffort && { reasoning_effort: allowedEffort }),
			...(thinking && { thinking }),
			stream: true,
			stream_options: { include_usage: true },
			unbound_metadata: { originApp: "roo-code", taskId: metadata?.taskId, mode: metadata?.mode },
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
		}

		let stream
		try {
			stream = await this.client.chat.completions.create(completionParams)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
		let lastUsage: any = undefined

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				yield { type: "text", text: delta.content }
			}

			if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				yield { type: "reasoning", text: (delta.reasoning_content as string | undefined) || "" }
			}

			// Handle native tool calls
			if (delta && "tool_calls" in delta && Array.isArray(delta.tool_calls)) {
				for (const toolCall of delta.tool_calls) {
					yield {
						type: "tool_call_partial",
						index: toolCall.index,
						id: toolCall.id,
						name: toolCall.function?.name,
						arguments: toolCall.function?.arguments,
					}
				}
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, info)
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: model, maxTokens: max_tokens, temperature } = await this.fetchModel()

		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: prompt }]

		const completionParams: UnboundChatCompletionParams = {
			model,
			max_tokens,
			messages: openAiMessages,
			temperature: temperature,
		}

		let response: OpenAI.Chat.ChatCompletion
		try {
			response = await this.client.chat.completions.create(completionParams)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
		return response.choices[0]?.message.content || ""
	}
}
