import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { s2scopilotDefaultModelId, s2scopilotDefaultModelInfo } from "@roo-code/types"

import { ApiHandlerOptions } from "../../shared/api"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { RouterProvider } from "./router-provider"
import { getModelParams } from "../transform/model-params"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { calculateApiCostOpenAI } from "../../shared/cost"
import { calculateApiCostAnthropic } from "../../shared/cost"
import { convertOpenAIToolsToAnthropic, convertOpenAIToolChoiceToAnthropic } from "../../core/prompts/tools/native-tools/converters"
import { filterNonAnthropicBlocks } from "../transform/anthropic-filter"

/**
 * s2sCopilot provider handler
 *
 * This handler connects to the s2sCopilot API Gateway which provides access to various
 * LLM models through an OpenAI-compatible API with custom CA certificate support.
 */
export class S2sCopilotHandler extends RouterProvider implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		const baseURL = options.s2scopilotBaseUrl || "https://gpt4ifx.icp.infineon.com"

		super({
			options,
			name: "s2scopilot",
			baseURL: baseURL,
			apiKey: options.s2scopilotApiKey || "not-provided",
			modelId: options.s2scopilotModelId,
			defaultModelId: s2scopilotDefaultModelId,
			defaultModelInfo: s2scopilotDefaultModelInfo,
		})

		// Note: Custom HTTPS agent with CA certificate is handled in the fetcher
		// The OpenAI client doesn't support custom agents in browser environments
	}

	/**
	 * Check if the model is a Claude model that needs Anthropic Bedrock format
	 */
	private isClaudeModel(modelId: string): boolean {
		return modelId.toLowerCase().includes('claude')
	}

	/**
	 * Map model ID to the correct Claude model alias for the Infineon endpoint
	 * Supported aliases: claudesonnet4, claudesonnet3.7, claudesonnet3.5, claudesonnet4.5
	 */
	private getClaudeModelAlias(modelId: string): string {
		const lowerModelId = modelId.toLowerCase()
		
		if (lowerModelId.includes('sonnet-4-') || lowerModelId.includes('sonnet4')) {
			return 'claudesonnet4.5'
		} else if (lowerModelId.includes('sonnet-3-7') || lowerModelId.includes('sonnet3.7')) {
			return 'claudesonnet3.7'
		} else if (lowerModelId.includes('sonnet-3-5') || lowerModelId.includes('sonnet3.5')) {
			return 'claudesonnet3.5'
		} else if (lowerModelId.includes('sonnet') || lowerModelId.includes('claude-4')) {
			// Default to latest sonnet
			return 'claudesonnet4.5'
		}
		
		// Fallback to sonnet 3.5 for other Claude models
		return 'claudesonnet3.5'
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: model, info } = await this.fetchModel()

		// Check if this is a Claude model that needs Anthropic Bedrock format
		if (this.isClaudeModel(model)) {
			yield* this.createClaudeMessage(model, systemPrompt, messages, metadata, info)
			return
		}

		const { maxTokens, temperature } = getModelParams({
			format: "openai",
			modelId: model,
			model: info,
			settings: this.options,
		})

		// S2S Copilot API Gateway only supports tools for GPT and functionary-small models
		// Check if the model supports tool calling
		const supportsTools = model.toLowerCase().includes('gpt') || model.toLowerCase().includes('functionary')
		
		// GPT models support stream_options, but Claude models may not
		const isGptModel = model.toLowerCase().includes('gpt')
		
		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model,
			max_tokens: maxTokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			// Only include stream_options for GPT models
			...(isGptModel ? { stream_options: { include_usage: true } } : {}),
			// Only include tools if the model supports them
			...(supportsTools && metadata?.tools ? {
				tools: this.convertToolsForOpenAI(metadata.tools),
				tool_choice: metadata.tool_choice,
				parallel_tool_calls: metadata.parallelToolCalls ?? false,
			} : {}),
		}

		let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>

		try {
			stream = await this.client.chat.completions.create(params)
		} catch (error) {
			throw handleOpenAIError(error, "s2sCopilot")
		}

		let lastUsage: OpenAI.CompletionUsage | undefined
		const activeToolCallIds = new Set<string>()

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta
			const finishReason = chunk.choices?.[0]?.finish_reason

			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			// Handle tool calls
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

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, info)
		}
	}

	/**
	 * Handle Claude models using Anthropic Bedrock format
	 * Endpoint: https://gpt4ifx.icp.infineon.com/model/{model_alias}/invoke
	 */
	private async *createClaudeMessage(
		model: string,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		modelInfo?: any
	): ApiStream {
		const { maxTokens, temperature } = getModelParams({
			format: "anthropic",
			modelId: model,
			model: modelInfo,
			settings: this.options,
		})

		// Get the correct Claude model alias for the endpoint
		const modelAlias = this.getClaudeModelAlias(model)
		const baseURL = this.options.s2scopilotBaseUrl || "https://gpt4ifx.icp.infineon.com"
		const endpoint = `${baseURL}/model/${modelAlias}/invoke`

		// Prepare messages in Anthropic format
		const filteredMessages = filterNonAnthropicBlocks(messages)

		// Build request body in Anthropic Bedrock format
		const requestBody: any = {
			anthropic_version: "bedrock-2023-05-31",
			max_tokens: maxTokens,
			temperature: temperature,
			system: systemPrompt,
			messages: filteredMessages,
		}

		// Add tools if provided
		if (metadata?.tools && metadata.tools.length > 0) {
			requestBody.tools = convertOpenAIToolsToAnthropic(metadata.tools)
			if (metadata.tool_choice) {
				requestBody.tool_choice = convertOpenAIToolChoiceToAnthropic(metadata.tool_choice)
			}
		}

		try {
			// Make request using fetch API with custom CA certificate support
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					...(this.options.s2scopilotApiKey ? { 'Authorization': `Bearer ${this.options.s2scopilotApiKey}` } : {}),
				},
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				const errorText = await response.text()
				throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`)
			}

			const data = await response.json()

			// Process response in Anthropic format
			if (data.content) {
				for (const block of data.content) {
					if (block.type === 'text') {
						yield {
							type: 'text',
							text: block.text,
						}
					} else if (block.type === 'tool_use') {
						yield {
							type: 'tool_call',
							id: block.id,
							name: block.name,
							arguments: JSON.stringify(block.input),
						}
					}
				}
			}

			// Process usage information
			if (data.usage) {
				const inputTokens = data.usage.input_tokens || 0
				const outputTokens = data.usage.output_tokens || 0
				const cacheCreationTokens = data.usage.cache_creation_input_tokens || 0
				const cacheReadTokens = data.usage.cache_read_input_tokens || 0

				const { totalCost } = modelInfo
					? calculateApiCostAnthropic(modelInfo, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens)
					: { totalCost: 0 }

				yield {
					type: 'usage',
					inputTokens,
					outputTokens,
					cacheWriteTokens: cacheCreationTokens || undefined,
					cacheReadTokens: cacheReadTokens || undefined,
					totalCost,
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			throw new Error(`S2S Copilot Claude API error: ${errorMessage}`)
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: model, info } = await this.fetchModel()

		const { maxTokens, temperature } = getModelParams({
			format: "openai",
			modelId: model,
			model: info,
			settings: this.options,
		})

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
			model,
			max_tokens: maxTokens,
			temperature,
			messages: [{ role: "user", content: prompt }],
			stream: false,
		}

		try {
			const response = await this.client.chat.completions.create(params)
			return response.choices[0]?.message?.content || ""
		} catch (error) {
			throw handleOpenAIError(error, "s2sCopilot")
		}
	}

	protected processUsageMetrics(usage: any, modelInfo?: any): ApiStreamUsageChunk {
		const inputTokens = usage?.prompt_tokens || 0
		const outputTokens = usage?.completion_tokens || 0
		const cacheWriteTokens = usage?.prompt_tokens_details?.cache_write_tokens || 0
		const cacheReadTokens = usage?.prompt_tokens_details?.cached_tokens || 0

		const { totalCost } = modelInfo
			? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
			: { totalCost: 0 }

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens: cacheWriteTokens || undefined,
			cacheReadTokens: cacheReadTokens || undefined,
			totalCost,
		}
	}
}
