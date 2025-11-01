import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	vercelAiGatewayDefaultModelId,
	vercelAiGatewayDefaultModelInfo,
	VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE,
	VERCEL_AI_GATEWAY_PROMPT_CACHING_MODELS,
} from "@roo-code/types"

import { ApiHandlerOptions } from "../../shared/api"

import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { addCacheBreakpoints } from "../transform/caching/vercel-ai-gateway"
import { ToolCallProcessor } from "../transform/tool-call-processor"
import { toolSpecToOpenAITool, type ToolSpec } from "../transform/tool-converters"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { RouterProvider } from "./router-provider"

// Extend OpenAI's CompletionUsage to include Vercel AI Gateway specific fields
interface VercelAiGatewayUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
	cost?: number
}

export class VercelAiGatewayHandler extends RouterProvider implements SingleCompletionHandler {
	private toolCallProcessor: ToolCallProcessor

	constructor(options: ApiHandlerOptions) {
		super({
			options,
			name: "vercel-ai-gateway",
			baseURL: "https://ai-gateway.vercel.sh/v1",
			apiKey: options.vercelAiGatewayApiKey,
			modelId: options.vercelAiGatewayModelId,
			defaultModelId: vercelAiGatewayDefaultModelId,
			defaultModelInfo: vercelAiGatewayDefaultModelInfo,
		})
		this.toolCallProcessor = new ToolCallProcessor()
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		tools?: ToolSpec[],
	): ApiStream {
		// Reset tool call processor for new message
		this.toolCallProcessor.reset()

		// Convert tools to OpenAI format if provided
		const openAITools = tools?.map(toolSpecToOpenAITool)
		const nativeToolsOn = openAITools && openAITools.length > 0

		const { id: modelId, info } = await this.fetchModel()

		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		if (VERCEL_AI_GATEWAY_PROMPT_CACHING_MODELS.has(modelId) && info.supportsPromptCache) {
			addCacheBreakpoints(systemPrompt, openAiMessages)
		}

		const body: OpenAI.Chat.ChatCompletionCreateParams = {
			model: modelId,
			messages: openAiMessages,
			temperature: this.supportsTemperature(modelId)
				? (this.options.modelTemperature ?? VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE)
				: undefined,
			max_completion_tokens: info.maxTokens,
			stream: true,
			// Add native tool calling support
			...(nativeToolsOn && {
				tools: openAITools,
				tool_choice: "auto" as const,
				parallel_tool_calls: false,
			}),
		}

		const completion = await this.client.chat.completions.create(body)

		for await (const chunk of completion) {
			const delta = chunk.choices[0]?.delta

			// Handle native tool calls
			if (nativeToolsOn && delta?.tool_calls) {
				for (const toolCallChunk of this.toolCallProcessor.processToolCallDeltas(delta.tool_calls)) {
					yield toolCallChunk
				}
			}

			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (chunk.usage) {
				const usage = chunk.usage as VercelAiGatewayUsage
				yield {
					type: "usage",
					inputTokens: usage.prompt_tokens || 0,
					outputTokens: usage.completion_tokens || 0,
					cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
					cacheReadTokens: usage.prompt_tokens_details?.cached_tokens || undefined,
					totalCost: usage.cost ?? 0,
				}
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info } = await this.fetchModel()

		try {
			const requestOptions: OpenAI.Chat.ChatCompletionCreateParams = {
				model: modelId,
				messages: [{ role: "user", content: prompt }],
				stream: false,
			}

			if (this.supportsTemperature(modelId)) {
				requestOptions.temperature = this.options.modelTemperature ?? VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE
			}

			requestOptions.max_completion_tokens = info.maxTokens

			const response = await this.client.chat.completions.create(requestOptions)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Vercel AI Gateway completion error: ${error.message}`)
			}
			throw error
		}
	}
}
