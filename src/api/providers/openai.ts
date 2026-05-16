import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI, { AzureOpenAI } from "openai"
import axios from "axios"

import {
	type ModelInfo,
	azureOpenAiDefaultApiVersion,
	openAiModelInfoSaneDefaults,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	OPENAI_AZURE_AI_INFERENCE_PATH,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { TagMatcher } from "../../utils/tag-matcher"
import { sanitizeOpenAiCallId } from "../../utils/tool-id"
import { isMcpTool } from "../../utils/mcp-name"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { getApiRequestTimeout } from "./utils/timeout-config"
import { handleOpenAIError } from "./utils/openai-error-handler"

// TODO: Rename this to OpenAICompatibleHandler. Also, I think the
// `OpenAINativeHandler` can subclass from this, since it's obviously
// compatible with the OpenAI API. We can also rename it to `OpenAIHandler`.
export class OpenAiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected client: OpenAI
	private readonly providerName = "OpenAI"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const baseURL = this.options.openAiBaseUrl || "https://api.openai.com/v1"
		const apiKey = this.options.openAiApiKey ?? "not-provided"
		const isAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)
		const urlHost = this._getUrlHost(this.options.openAiBaseUrl)
		const isAzureOpenAi = urlHost === "azure.com" || urlHost.endsWith(".azure.com") || options.openAiUseAzure

		const headers = {
			...DEFAULT_HEADERS,
			...(this.options.openAiHeaders || {}),
		}

		const timeout = getApiRequestTimeout()

		if (isAzureAiInference) {
			// Azure AI Inference Service (e.g., for DeepSeek) uses a different path structure
			this.client = new OpenAI({
				baseURL,
				apiKey,
				defaultHeaders: headers,
				defaultQuery: { "api-version": this.options.azureApiVersion || "2024-05-01-preview" },
				timeout,
			})
		} else if (isAzureOpenAi) {
			// Azure API shape slightly differs from the core API shape:
			// https://github.com/openai/openai-node?tab=readme-ov-file#microsoft-azure-openai
			this.client = new AzureOpenAI({
				baseURL,
				apiKey,
				apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
				defaultHeaders: headers,
				timeout,
			})
		} else {
			this.client = new OpenAI({
				baseURL,
				apiKey,
				defaultHeaders: headers,
				timeout,
			})
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { info: modelInfo, reasoning } = this.getModel()
		const modelUrl = this.options.openAiBaseUrl ?? ""
		const modelId = this.options.openAiModelId ?? ""
		const enabledR1Format = this.options.openAiR1FormatEnabled ?? false
		const isAzureAiInference = this._isAzureAiInference(modelUrl)
		const deepseekReasoner = modelId.includes("deepseek-reasoner") || enabledR1Format

		if (this._isCodexModel(modelId)) {
			yield* this.handleCodexMessage(systemPrompt, messages, metadata)
			return
		}

		if (modelId.includes("o1") || modelId.includes("o3") || modelId.includes("o4")) {
			yield* this.handleO3FamilyMessage(modelId, systemPrompt, messages, metadata)
			return
		}

		let systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
			role: "system",
			content: systemPrompt,
		}

		if (this.options.openAiStreamingEnabled ?? true) {
			let convertedMessages

			if (deepseekReasoner) {
				convertedMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
			} else {
				if (modelInfo.supportsPromptCache) {
					systemMessage = {
						role: "system",
						content: [
							{
								type: "text",
								text: systemPrompt,
								// @ts-ignore-next-line
								cache_control: { type: "ephemeral" },
							},
						],
					}
				}

				convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]

				if (modelInfo.supportsPromptCache) {
					// Note: the following logic is copied from openrouter:
					// Add cache_control to the last two user messages
					// (note: this works because we only ever add one user message at a time, but if we added multiple we'd need to mark the user message before the last assistant message)
					const lastTwoUserMessages = convertedMessages.filter((msg) => msg.role === "user").slice(-2)

					lastTwoUserMessages.forEach((msg) => {
						if (typeof msg.content === "string") {
							msg.content = [{ type: "text", text: msg.content }]
						}

						if (Array.isArray(msg.content)) {
							// NOTE: this is fine since env details will always be added at the end. but if it weren't there, and the user added a image_url type message, it would pop a text part before it and then move it after to the end.
							let lastTextPart = msg.content.filter((part) => part.type === "text").pop()

							if (!lastTextPart) {
								lastTextPart = { type: "text", text: "..." }
								msg.content.push(lastTextPart)
							}

							// @ts-ignore-next-line
							lastTextPart["cache_control"] = { type: "ephemeral" }
						}
					})
				}
			}

			const isGrokXAI = this._isGrokXAI(this.options.openAiBaseUrl)

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: modelId,
				temperature: this.options.modelTemperature ?? (deepseekReasoner ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
				messages: convertedMessages,
				stream: true as const,
				...(isGrokXAI ? {} : { stream_options: { include_usage: true } }),
				...(reasoning && reasoning),
				tools: this.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: metadata?.parallelToolCalls ?? true,
			}

			// Add max_tokens if needed
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let stream
			try {
				stream = await this.client.chat.completions.create(
					requestOptions,
					isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
				)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			const matcher = new TagMatcher(
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
					for (const chunk of matcher.update(delta.content)) {
						yield chunk
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

			for (const chunk of matcher.final()) {
				yield chunk
			}

			if (lastUsage) {
				yield this.processUsageMetrics(lastUsage, modelInfo)
			}
		} else {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: deepseekReasoner
					? convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
					: [systemMessage, ...convertToOpenAiMessages(messages)],
				// Tools are always present (minimum ALWAYS_AVAILABLE_TOOLS)
				tools: this.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: metadata?.parallelToolCalls ?? true,
			}

			// Add max_tokens if needed
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let response
			try {
				response = await this.client.chat.completions.create(
					requestOptions,
					this._isAzureAiInference(modelUrl) ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
				)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			const message = response.choices?.[0]?.message

			if (message?.tool_calls) {
				for (const toolCall of message.tool_calls) {
					if (toolCall.type === "function") {
						yield {
							type: "tool_call",
							id: toolCall.id,
							name: toolCall.function.name,
							arguments: toolCall.function.arguments,
						}
					}
				}
			}

			yield {
				type: "text",
				text: message?.content || "",
			}

			yield this.processUsageMetrics(response.usage, modelInfo)
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
		const id = this.options.openAiModelId ?? ""
		const info: ModelInfo = this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})
		return { id, info, ...params }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const model = this.getModel()
			const modelId = model.id
			const modelInfo = model.info

			// Codex models must use the Responses API
			if (this._isCodexModel(modelId)) {
				return this._completePromptWithResponsesApi(prompt, model)
			}

			const isAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: [{ role: "user", content: prompt }],
			}

			// Add max_tokens if needed
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let response
			try {
				response = await this.client.chat.completions.create(
					requestOptions,
					isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
				)
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
	 * Complete a prompt using the Responses API (for codex models).
	 */
	private async _completePromptWithResponsesApi(
		prompt: string,
		model: ReturnType<OpenAiHandler["getModel"]>,
	): Promise<string> {
		const requestBody: any = {
			model: model.id,
			input: [
				{
					role: "user",
					content: [{ type: "input_text", text: prompt }],
				},
			],
			stream: false,
			store: false,
		}

		// Add max_output_tokens if needed
		if (this.options.includeMaxTokens === true) {
			requestBody.max_output_tokens = this.options.modelMaxTokens || model.info.maxTokens
		}

		let response
		try {
			response = await (this.client as any).responses.create(requestBody)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}

		// Extract text from the Responses API response
		if (response?.output && Array.isArray(response.output)) {
			for (const outputItem of response.output) {
				if (outputItem.type === "message" && outputItem.content) {
					for (const content of outputItem.content) {
						if (content.type === "output_text" && content.text) {
							return content.text
						}
					}
				}
			}
		}

		// Fallback: check for direct text in response
		if (response?.text) {
			return response.text
		}

		return ""
	}

	private async *handleO3FamilyMessage(
		modelId: string,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const modelInfo = this.getModel().info
		const methodIsAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)

		if (this.options.openAiStreamingEnabled ?? true) {
			const isGrokXAI = this._isGrokXAI(this.options.openAiBaseUrl)

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: modelId,
				messages: [
					{
						role: "developer",
						content: `Formatting re-enabled\n${systemPrompt}`,
					},
					...convertToOpenAiMessages(messages),
				],
				stream: true,
				...(isGrokXAI ? {} : { stream_options: { include_usage: true } }),
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
				// Tools are always present (minimum ALWAYS_AVAILABLE_TOOLS)
				tools: this.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: metadata?.parallelToolCalls ?? true,
			}

			// O3 family models do not support the deprecated max_tokens parameter
			// but they do support max_completion_tokens (the modern OpenAI parameter)
			// This allows O3 models to limit response length when includeMaxTokens is enabled
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let stream
			try {
				stream = await this.client.chat.completions.create(
					requestOptions,
					methodIsAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
				)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			yield* this.handleStreamResponse(stream)
		} else {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: [
					{
						role: "developer",
						content: `Formatting re-enabled\n${systemPrompt}`,
					},
					...convertToOpenAiMessages(messages),
				],
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
				// Tools are always present (minimum ALWAYS_AVAILABLE_TOOLS)
				tools: this.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: metadata?.parallelToolCalls ?? true,
			}

			// O3 family models do not support the deprecated max_tokens parameter
			// but they do support max_completion_tokens (the modern OpenAI parameter)
			// This allows O3 models to limit response length when includeMaxTokens is enabled
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let response
			try {
				response = await this.client.chat.completions.create(
					requestOptions,
					methodIsAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
				)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			const message = response.choices?.[0]?.message
			if (message?.tool_calls) {
				for (const toolCall of message.tool_calls) {
					if (toolCall.type === "function") {
						yield {
							type: "tool_call",
							id: toolCall.id,
							name: toolCall.function.name,
							arguments: toolCall.function.arguments,
						}
					}
				}
			}

			yield {
				type: "text",
				text: message?.content || "",
			}
			yield this.processUsageMetrics(response.usage)
		}
	}

	private async *handleStreamResponse(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>): ApiStream {
		const activeToolCallIds = new Set<string>()

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta
			const finishReason = chunk.choices?.[0]?.finish_reason

			if (delta) {
				if (delta.content) {
					yield {
						type: "text",
						text: delta.content,
					}
				}

				yield* this.processToolCalls(delta, finishReason, activeToolCallIds)
			}

			if (chunk.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
				}
			}
		}
	}

	/**
	 * Helper generator to process tool calls from a stream chunk.
	 * Tracks active tool call IDs and yields tool_call_partial and tool_call_end events.
	 * @param delta - The delta object from the stream chunk
	 * @param finishReason - The finish_reason from the stream chunk
	 * @param activeToolCallIds - Set to track active tool call IDs (mutated in place)
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
		// This ensures tool calls are finalized even if the stream doesn't properly close
		if (finishReason === "tool_calls" && activeToolCallIds.size > 0) {
			for (const id of activeToolCallIds) {
				yield { type: "tool_call_end", id }
			}
			activeToolCallIds.clear()
		}
	}

	/**
	 * Checks if the model is a codex model that requires the Responses API.
	 * Azure-hosted GPT-5.x codex models (e.g., gpt-5.3-codex) do not support
	 * the Chat Completions API and must use the Responses API instead.
	 */
	protected _isCodexModel(modelId: string): boolean {
		return modelId.toLowerCase().includes("codex")
	}

	/**
	 * Handles message creation for codex models using the OpenAI Responses API.
	 * Codex models (e.g., gpt-5.3-codex on Azure) only support the Responses API,
	 * not the Chat Completions API.
	 */
	private async *handleCodexMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()

		// Format conversation for the Responses API
		const formattedInput = this._formatConversationForResponsesApi(messages)

		// Build tools in Responses API format (flat structure, not nested under function)
		const tools = this._convertToolsForResponsesApi(metadata?.tools)

		// Build the request body
		const requestBody: any = {
			model: model.id,
			input: formattedInput,
			stream: true,
			store: false,
			instructions: systemPrompt,
			...(tools && tools.length > 0 ? { tools } : {}),
			...(metadata?.tool_choice ? { tool_choice: metadata.tool_choice } : {}),
			parallel_tool_calls: metadata?.parallelToolCalls ?? true,
		}

		// Add temperature
		if (model.info.supportsTemperature !== false) {
			requestBody.temperature = this.options.modelTemperature ?? 0
		}

		// Add max_output_tokens if needed
		if (this.options.includeMaxTokens === true) {
			requestBody.max_output_tokens = this.options.modelMaxTokens || model.info.maxTokens
		}

		// State tracking for streaming
		let pendingToolCallId: string | undefined
		let pendingToolCallName: string | undefined
		let sawTextOutput = false
		const streamedToolCallIds = new Set<string>()

		try {
			const stream = (await (this.client as any).responses.create(requestBody)) as AsyncIterable<any>

			for await (const event of stream) {
				// Handle text deltas
				if (event?.type === "response.text.delta" || event?.type === "response.output_text.delta") {
					if (event?.delta) {
						sawTextOutput = true
						yield { type: "text", text: event.delta }
					}
					continue
				}

				// Handle done-only text for variants that skip delta events
				if (event?.type === "response.text.done" || event?.type === "response.output_text.done") {
					const doneText =
						typeof event?.text === "string"
							? event.text
							: typeof event?.output_text === "string"
								? event.output_text
								: undefined
					if (!sawTextOutput && doneText) {
						sawTextOutput = true
						yield { type: "text", text: doneText }
					}
					continue
				}

				// Handle content part events
				if (event?.type === "response.content_part.added" || event?.type === "response.content_part.done") {
					const part = event?.part
					if (
						!sawTextOutput &&
						(part?.type === "text" || part?.type === "output_text") &&
						typeof part?.text === "string" &&
						part.text
					) {
						sawTextOutput = true
						yield { type: "text", text: part.text }
					}
					continue
				}

				// Handle reasoning deltas
				if (
					event?.type === "response.reasoning.delta" ||
					event?.type === "response.reasoning_text.delta" ||
					event?.type === "response.reasoning_summary.delta" ||
					event?.type === "response.reasoning_summary_text.delta"
				) {
					if (event?.delta) {
						yield { type: "reasoning", text: event.delta }
					}
					continue
				}

				// Handle refusal deltas
				if (event?.type === "response.refusal.delta") {
					if (event?.delta) {
						sawTextOutput = true
						yield { type: "text", text: `[Refusal] ${event.delta}` }
					}
					continue
				}

				// Handle output item events (track tool identity)
				if (event?.type === "response.output_item.added" || event?.type === "response.output_item.done") {
					const item = event?.item
					if (item) {
						// Capture tool identity for subsequent argument deltas
						if (item.type === "function_call" || item.type === "tool_call") {
							const callId = item.call_id || item.tool_call_id || item.id
							const name = item.name || item.function?.name
							if (typeof callId === "string" && callId.length > 0) {
								pendingToolCallId = callId
								pendingToolCallName = typeof name === "string" ? name : undefined
							}
						}

						if (event.type === "response.output_item.added") {
							if ((item.type === "text" || item.type === "output_text") && item.text) {
								sawTextOutput = true
								yield { type: "text", text: item.text }
							} else if (item.type === "message" && Array.isArray(item.content)) {
								for (const content of item.content) {
									if (
										(content?.type === "text" || content?.type === "output_text") &&
										content?.text
									) {
										sawTextOutput = true
										yield { type: "text", text: content.text }
									}
								}
							}
						} else if (
							event.type === "response.output_item.done" &&
							(item.type === "function_call" || item.type === "tool_call")
						) {
							const callId = item.call_id || item.tool_call_id || item.id
							const name = item.name || item.function?.name
							const argsRaw = item.arguments || item.function?.arguments || item.input
							const args =
								typeof argsRaw === "string"
									? argsRaw
									: argsRaw && typeof argsRaw === "object"
										? JSON.stringify(argsRaw)
										: ""

							if (
								typeof callId === "string" &&
								callId.length > 0 &&
								typeof name === "string" &&
								name.length > 0 &&
								!streamedToolCallIds.has(callId)
							) {
								yield { type: "tool_call", id: callId, name, arguments: args }
							}
						} else if (!sawTextOutput) {
							if ((item.type === "text" || item.type === "output_text") && item.text) {
								sawTextOutput = true
								yield { type: "text", text: item.text }
							} else if (item.type === "message" && Array.isArray(item.content)) {
								for (const content of item.content) {
									if (
										(content?.type === "text" || content?.type === "output_text") &&
										content?.text
									) {
										sawTextOutput = true
										yield { type: "text", text: content.text }
									}
								}
							}
						}
					}
					continue
				}

				// Handle tool/function call argument deltas
				if (
					event?.type === "response.tool_call_arguments.delta" ||
					event?.type === "response.function_call_arguments.delta"
				) {
					const callId = event.call_id || event.tool_call_id || event.id || pendingToolCallId || undefined
					const name = event.name || event.function_name || pendingToolCallName || undefined
					const args = event.delta || event.arguments

					if (
						typeof name === "string" &&
						name.length > 0 &&
						typeof callId === "string" &&
						callId.length > 0
					) {
						streamedToolCallIds.add(callId)
						yield {
							type: "tool_call_partial",
							index: event.index ?? 0,
							id: callId,
							name,
							arguments: args,
						}
					}
					continue
				}

				// Handle tool/function call completion
				if (
					event?.type === "response.tool_call_arguments.done" ||
					event?.type === "response.function_call_arguments.done"
				) {
					continue
				}

				// Handle completion events with usage
				if (event?.type === "response.done" || event?.type === "response.completed") {
					// Fallback text extraction from final payload
					if (!sawTextOutput && Array.isArray(event?.response?.output)) {
						for (const outputItem of event.response.output) {
							if (
								(outputItem?.type === "text" || outputItem?.type === "output_text") &&
								outputItem?.text
							) {
								sawTextOutput = true
								yield { type: "text", text: outputItem.text }
								continue
							}
							if (outputItem?.type === "message" && Array.isArray(outputItem.content)) {
								for (const content of outputItem.content) {
									if (
										(content?.type === "text" || content?.type === "output_text") &&
										content?.text
									) {
										sawTextOutput = true
										yield { type: "text", text: content.text }
									}
								}
							}
						}
					}

					// Extract usage
					const usage = event?.response?.usage || event?.usage
					if (usage) {
						yield {
							type: "usage",
							inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
							outputTokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
							cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
							cacheReadTokens: usage.cache_read_input_tokens || undefined,
						}
					}
					continue
				}

				// Handle error events
				if (event?.type === "response.error" || event?.type === "error") {
					if (event.error || event.message) {
						throw new Error(
							`Responses API error: ${event.error?.message || event.message || "Unknown error"}`,
						)
					}
				}

				// Handle failed event
				if (event?.type === "response.failed") {
					if (event.error || event.message) {
						throw new Error(
							`Response failed: ${event.error?.message || event.message || "Unknown failure"}`,
						)
					}
				}

				// Fallback for older formats
				if (event?.choices?.[0]?.delta?.content) {
					yield { type: "text", text: event.choices[0].delta.content }
				}

				if (event?.usage) {
					yield {
						type: "usage",
						inputTokens: event.usage.input_tokens ?? event.usage.prompt_tokens ?? 0,
						outputTokens: event.usage.output_tokens ?? event.usage.completion_tokens ?? 0,
					}
				}
			}
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}

	/**
	 * Formats an Anthropic message array into the Responses API input format.
	 */
	private _formatConversationForResponsesApi(messages: Anthropic.Messages.MessageParam[]): any[] {
		const formattedInput: any[] = []

		for (const message of messages) {
			if (message.role === "user") {
				const content: any[] = []
				const toolResults: any[] = []

				if (typeof message.content === "string") {
					content.push({ type: "input_text", text: message.content })
				} else if (Array.isArray(message.content)) {
					for (const block of message.content) {
						if (block.type === "text") {
							content.push({ type: "input_text", text: block.text })
						} else if (block.type === "image") {
							const image = block as Anthropic.Messages.ImageBlockParam
							const imageUrl = `data:${image.source.media_type};base64,${image.source.data}`
							content.push({ type: "input_image", image_url: imageUrl })
						} else if (block.type === "tool_result") {
							const result =
								typeof block.content === "string"
									? block.content
									: block.content?.map((c: any) => (c.type === "text" ? c.text : "")).join("") || ""
							toolResults.push({
								type: "function_call_output",
								call_id: sanitizeOpenAiCallId(block.tool_use_id),
								output: result,
							})
						}
					}
				}

				if (content.length > 0) {
					formattedInput.push({ role: "user", content })
				}
				if (toolResults.length > 0) {
					formattedInput.push(...toolResults)
				}
			} else if (message.role === "assistant") {
				const content: any[] = []
				const toolCalls: any[] = []

				if (typeof message.content === "string") {
					content.push({ type: "output_text", text: message.content })
				} else if (Array.isArray(message.content)) {
					for (const block of message.content) {
						if (block.type === "text") {
							content.push({ type: "output_text", text: block.text })
						} else if (block.type === "tool_use") {
							toolCalls.push({
								type: "function_call",
								call_id: sanitizeOpenAiCallId(block.id),
								name: block.name,
								arguments: JSON.stringify(block.input),
							})
						}
					}
				}

				if (content.length > 0) {
					formattedInput.push({ role: "assistant", content })
				}
				if (toolCalls.length > 0) {
					formattedInput.push(...toolCalls)
				}
			}
		}

		return formattedInput
	}

	/**
	 * Converts tools from the Chat Completions format to the Responses API format.
	 * The Responses API uses a flat structure: {type, name, description, parameters, strict}
	 * instead of the nested {type, function: {name, description, parameters}} format.
	 */
	private _convertToolsForResponsesApi(tools: any[] | undefined): any[] | undefined {
		if (!tools || tools.length === 0) {
			return undefined
		}

		return tools
			.filter((tool: any) => tool.type === "function")
			.map((tool: any) => {
				const isMcp = isMcpTool(tool.function.name)
				return {
					type: "function",
					name: tool.function.name,
					description: tool.function.description,
					parameters: isMcp
						? tool.function.parameters
						: this.convertToolSchemaForOpenAI(tool.function.parameters),
					strict: !isMcp,
				}
			})
	}

	protected _getUrlHost(baseUrl?: string): string {
		try {
			return new URL(baseUrl ?? "").host
		} catch (error) {
			return ""
		}
	}

	private _isGrokXAI(baseUrl?: string): boolean {
		const urlHost = this._getUrlHost(baseUrl)
		return urlHost.includes("x.ai")
	}

	protected _isAzureAiInference(baseUrl?: string): boolean {
		const urlHost = this._getUrlHost(baseUrl)
		return urlHost.endsWith(".services.ai.azure.com")
	}

	/**
	 * Adds max_completion_tokens to the request body if needed based on provider configuration
	 * Note: max_tokens is deprecated in favor of max_completion_tokens as per OpenAI documentation
	 * O3 family models handle max_tokens separately in handleO3FamilyMessage
	 */
	protected addMaxTokensIfNeeded(
		requestOptions:
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
		modelInfo: ModelInfo,
	): void {
		// Only add max_completion_tokens if includeMaxTokens is true
		if (this.options.includeMaxTokens === true) {
			// Use user-configured modelMaxTokens if available, otherwise fall back to model's default maxTokens
			// Using max_completion_tokens as max_tokens is deprecated
			requestOptions.max_completion_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}
	}
}

export async function getOpenAiModels(baseUrl?: string, apiKey?: string, openAiHeaders?: Record<string, string>) {
	try {
		if (!baseUrl) {
			return []
		}

		// Trim whitespace from baseUrl to handle cases where users accidentally include spaces
		const trimmedBaseUrl = baseUrl.trim()

		if (!URL.canParse(trimmedBaseUrl)) {
			return []
		}

		const config: Record<string, any> = {}
		const headers: Record<string, string> = {
			...DEFAULT_HEADERS,
			...(openAiHeaders || {}),
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		if (Object.keys(headers).length > 0) {
			config["headers"] = headers
		}

		const response = await axios.get(`${trimmedBaseUrl}/models`, config)
		const modelsArray = response.data?.data?.map((model: any) => model.id) || []
		return [...new Set<string>(modelsArray)]
	} catch (error) {
		return []
	}
}
