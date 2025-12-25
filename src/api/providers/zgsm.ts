import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI, { AzureOpenAI } from "openai"
import { v7 as uuidv7 } from "uuid"

import {
	type ModelInfo,
	azureOpenAiDefaultApiVersion,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	OPENAI_AZURE_AI_INFERENCE_PATH,
	NATIVE_TOOL_DEFAULTS,
	zgsmDefaultModelId,
	zgsmModelsConfig as zgsmModels,
	// TOOL_PROTOCOL,
	isNativeProtocol,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { XmlMatcher } from "../../utils/xml-matcher"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import { convertToSimpleMessages } from "../transform/simple-format"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { ZgsmAuthConfig, ZgsmAuthService } from "../../core/costrict/auth"
import { getClientId } from "../../utils/getClientId"
import { getWorkspacePath } from "../../utils/path"
import { getApiRequestTimeout } from "./utils/timeout-config"
import { getApiResponseRenderMode, renderModes } from "./utils/response-render-config"
import { createLogger, ILogger } from "../../utils/logger"
import { Package } from "../../shared/package"
import { COSTRICT_DEFAULT_HEADERS } from "../../shared/headers"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { getModels } from "./fetchers/modelCache"
import { ClineApiReqCancelReason } from "../../shared/ExtensionMessage"
import { getEditorType } from "../../utils/getEditorType"
import { ChatCompletionChunk } from "openai/resources/index.mjs"

const autoModeModelId = "Auto"
const isDev = process.env.NODE_ENV === "development"

export class ZgsmAiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private readonly providerName = "zgsm"
	private baseURL: string
	private chatType?: "user" | "system"
	private modelInfo = {} as ModelInfo
	private apiResponseRenderModeInfo = renderModes.fast
	private logger: ILogger
	private abortController?: AbortController

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.logger = createLogger(Package.outputChannel)
		this.baseURL = `${this.options.zgsmBaseUrl?.trim() || ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl()}/chat-rag/api/v1`
		const apiKey = options.zgsmAccessToken || "not-provided"
		const isAzureAiInference = this._isAzureAiInference(this.baseURL)
		const urlHost = this._getUrlHost(this.baseURL)
		const isAzureOpenAi = urlHost === "azure.com" || urlHost.endsWith(".azure.com") || options.openAiUseAzure

		this.updateModelInfo()
		const timeout = getApiRequestTimeout()
		this.apiResponseRenderModeInfo = getApiResponseRenderMode()
		if (isAzureAiInference) {
			// Azure AI Inference Service (e.g., for DeepSeek) uses a different path structure
			this.client = new OpenAI({
				baseURL: this.baseURL,
				apiKey,
				timeout,
				maxRetries: 0,
				defaultHeaders: COSTRICT_DEFAULT_HEADERS,
				defaultQuery: { "api-version": this.options.azureApiVersion || "2024-05-01-preview" },
			})
		} else if (isAzureOpenAi) {
			// Azure API shape slightly differs from the core API shape:
			// https://github.com/openai/openai-node?tab=readme-ov-file#microsoft-azure-openai
			this.client = new AzureOpenAI({
				baseURL: this.baseURL,
				apiKey,
				timeout,
				maxRetries: 0,
				apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
				defaultHeaders: COSTRICT_DEFAULT_HEADERS,
			})
		} else {
			this.client = new OpenAI({
				baseURL: this.baseURL,
				apiKey,
				timeout,
				maxRetries: 0,
				defaultHeaders: COSTRICT_DEFAULT_HEADERS,
			})
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Performance monitoring log
		this.abortController = new AbortController()
		const requestId = uuidv7()
		const workflowModes = ["strict", "plan"] as Array<string | undefined>
		await this.updateModelInfo()
		const fromWorkflow =
			metadata?.zgsmWorkflowMode ||
			workflowModes.includes(metadata?.mode) ||
			workflowModes.includes(metadata?.rooTaskMode) ||
			workflowModes.includes(metadata?.parentTaskMode) ||
			workflowModes.includes(metadata?.zgsmCodeMode)
		this.apiResponseRenderModeInfo = getApiResponseRenderMode()
		if ("review" === metadata?.mode) {
			this.client.maxRetries = 1
		}
		// 1. Cache calculation results and configuration
		const { info: modelInfo, reasoning } = this.getModel()
		const modelUrl = this.baseURL || ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl()
		const modelId = this.options.zgsmModelId || zgsmDefaultModelId
		const enabledR1Format = this.options.openAiR1FormatEnabled ?? false
		const enabledLegacyFormat = this.options.openAiLegacyFormat ?? false

		// Cache boolean calculation results
		const isAzureAiInference = this._isAzureAiInference(modelUrl)
		const isDeepseekReasoner = modelId.includes("deepseek-reasoner")
		const deepseekReasoner = isDeepseekReasoner || enabledR1Format
		const isArk = modelUrl.includes(".volces.com")
		const ark = isArk
		const isGrokXAI = this._isGrokXAI(this.baseURL)
		const isO1Family = modelId.includes("o1") || modelId.includes("o3") || modelId.includes("o4")

		// 2. Cache async call results
		const cachedClientId = getClientId()
		const cachedWorkspacePath = getWorkspacePath()

		// 3. Pre-build headers to avoid repeated creation
		const _headers = this.buildHeaders(metadata, requestId, cachedClientId, cachedWorkspacePath, this.chatType)

		// 4. Handle O1 family models
		if (isO1Family) {
			yield* this.handleO3FamilyMessage(modelId, systemPrompt, messages)
			return
		}

		try {
			const tokens = await ZgsmAuthService.getInstance()?.getTokens()
			this.client.apiKey = tokens?.access_token || "not-provided"
		} catch (error) {
			this.logger.info(
				`[createMessage] getting new tokens failed \n\nuse old tokens: ${this.client.apiKey} \n\n${error.message}`,
			)
		}

		try {
			// 5. Handle streaming and non-streaming requests
			if (this.options.openAiStreamingEnabled ?? true) {
				const convertedMessages = this.convertMessages(
					systemPrompt,
					messages,
					deepseekReasoner,
					ark,
					enabledLegacyFormat,
					modelInfo,
				)

				const requestOptions = this.buildStreamingRequestOptions(
					modelId,
					convertedMessages,
					deepseekReasoner,
					isGrokXAI,
					reasoning,
					modelInfo,
					metadata,
				)
				requestOptions.extra_body.prompt_mode = fromWorkflow ? (metadata?.zgsmCodeMode ?? "vibe") : "vibe"
				const isAuto = this.options.zgsmModelId === autoModeModelId
				let stream: any
				let selectedLLM: string | undefined = this.options.zgsmModelId
				let selectReason: string | undefined
				let requestIdTimestamp: number | undefined
				let responseIdTimestamp: number | undefined
				try {
					requestIdTimestamp = Date.now()
					this.logger.info(`[RequestID ${modelId}]:`, requestId)

					if (metadata?.onRequestHeadersReady && typeof metadata.onRequestHeadersReady === "function") {
						metadata.onRequestHeadersReady(_headers)
					}

					const { data, response } = await this.client.chat.completions
						.create(
							requestOptions,
							Object.assign(isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {}, {
								headers: _headers,
								signal: this.abortController.signal,
							}),
						)
						.withResponse()
					this.logger.info(`[ResponseID ${modelId}]:`, response.headers.get("x-request-id"))
					responseIdTimestamp = Date.now()
					if (isAuto) {
						selectedLLM = response.headers.get("x-select-llm") || ""
						selectReason = response.headers.get("x-select-reason") || ""

						const userInputHeader = isDev ? response.headers.get("x-user-input") : null
						if (userInputHeader) {
							const decodedUserInput = Buffer.from(userInputHeader, "base64").toString("utf-8")
							this.logger.info(`[x-user-input]: ${decodedUserInput}`)
						}
					}

					stream = data
				} catch (error) {
					throw handleOpenAIError(error, this.providerName)
				}

				// eslint-disable-next-line @typescript-eslint/no-unused-expressions
				isDev && this.logger.info(`[ResponseID ${modelId} sse render start]:`, requestId)

				// 6. Optimize stream processing - use batch processing and buffer
				yield* this.handleOptimizedStream(
					stream,
					modelInfo,
					isAuto,
					selectedLLM,
					selectReason,
					requestId,
					isNativeProtocol(metadata?.toolProtocol),
					responseIdTimestamp,
					requestIdTimestamp,
					metadata?.onPerformanceTiming,
				)
			} else {
				// Non-streaming processing
				const requestOptions = this.buildNonStreamingRequestOptions(
					modelId,
					systemPrompt,
					messages,
					deepseekReasoner,
					enabledLegacyFormat,
					modelInfo,
					metadata,
				)
				let response
				requestOptions.extra_body.prompt_mode = fromWorkflow ? "strict" : "vibe"
				let requestIdTimestamp: number | undefined
				let responseIdTimestamp: number | undefined
				try {
					requestIdTimestamp = Date.now()
					this.logger.info(`[RequestID]:`, requestId)
					response = await this.client.chat.completions.create(
						requestOptions,
						Object.assign(isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {}, {
							headers: _headers,
							signal: this.abortController.signal,
						}),
					)
					this.logger.info(`[ResponseId]:`, response._request_id)
					responseIdTimestamp = Date.now()
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
					text: message.content || "",
				}

				yield this.processUsageMetrics(response.usage, modelInfo)

				// Emit performance timing data via callback (frontend will calculate metrics)
				const responseEndTimestamp = Date.now()
				if (responseIdTimestamp && requestIdTimestamp && response.usage?.completion_tokens) {
					// Emit timing data via callback
					if (metadata?.onPerformanceTiming) {
						metadata
							.onPerformanceTiming({
								requestIdTimestamp,
								responseIdTimestamp,
								responseEndTimestamp,
								completionTokens: response.usage.completion_tokens,
							})
							.catch(() => {})
					}
				}
			}
		} catch (err) {
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			isDev && this.logger.error(`[createMessage] ${err}`)
			throw err
		} finally {
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			isDev && this.logger.info(`[ResponseID ${modelId} sse createMessage end]:`, requestId)
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

	/**
	 * Build request headers (optimize memory allocation)
	 */
	private buildHeaders(
		metadata: ApiHandlerCreateMessageMetadata | undefined,
		requestId: string,
		clientId: string,
		workspacePath: string,
		chatType?: "user" | "system",
	): Record<string, string> {
		return {
			"Accept-Language": metadata?.language || "en",
			...COSTRICT_DEFAULT_HEADERS,
			...(this.options.useZgsmCustomConfig ? (this.options.openAiHeaders ?? {}) : {}),
			"x-quota-identity": chatType || "system",
			"X-Request-ID": requestId,
			"x-user-id": metadata?.userId || "",
			"zgsm-task-id": metadata?.taskId || "",
			"zgsm-request-id": requestId,
			"zgsm-client-id": clientId,
			"zgsm-provider": metadata?.provider,
			"x-costrict-idea": getEditorType(),
			"zgsm-project-path": encodeURI(workspacePath),
			"x-caller": metadata?.mode === "review" ? "review-checker" : "chat",
		}
	}

	/**
	 * Unified message conversion logic (using strategy pattern)
	 */
	private convertMessages(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		isDeepseekReasoner: boolean,
		isArk: boolean,
		isLegacyFormat: boolean,
		modelInfo: ModelInfo,
	): OpenAI.Chat.ChatCompletionMessageParam[] {
		let convertedMessages: OpenAI.Chat.ChatCompletionMessageParam[]

		if (isDeepseekReasoner) {
			convertedMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
		} else if (isArk || isLegacyFormat) {
			convertedMessages = [{ role: "system", content: systemPrompt }, ...convertToSimpleMessages(messages)]
		} else {
			const systemMessage = modelInfo.supportsPromptCache
				? {
						role: "system" as const,
						content: [
							{
								type: "text" as const,
								text: systemPrompt,
								cache_control: { type: "ephemeral" },
							},
						],
					}
				: { role: "system" as const, content: systemPrompt }

			convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages, { mergeToolResultText: true })]
		}

		// Apply cache control logic
		this.applyCacheControlLogic(convertedMessages, modelInfo)

		return convertedMessages
	}

	/**
	 * Apply cache control logic (extracted as separate method)
	 */
	private applyCacheControlLogic(messages: OpenAI.Chat.ChatCompletionMessageParam[], modelInfo: ModelInfo): void {
		if (!modelInfo.supportsPromptCache) {
			return
		}

		const lastTwoUserMessages = messages.filter((msg) => msg.role === "user").slice(-2)

		for (const msg of lastTwoUserMessages) {
			if (typeof msg.content === "string") {
				msg.content = [{ type: "text", text: msg.content }]
			}

			if (Array.isArray(msg.content)) {
				let lastTextPart = msg.content.filter((part) => part.type === "text").pop()

				if (!lastTextPart) {
					lastTextPart = { type: "text", text: "..." }
					msg.content.push(lastTextPart)
				}

				// @ts-ignore-next-line
				lastTextPart["cache_control"] = { type: "ephemeral" }
			}
		}
	}

	/**
	 * Build streaming request options
	 */
	private buildStreamingRequestOptions(
		modelId: string,
		messages: OpenAI.Chat.ChatCompletionMessageParam[],
		isDeepseekReasoner: boolean,
		isGrokXAI: boolean,
		reasoning: any,
		modelInfo: ModelInfo,
		metadata?: ApiHandlerCreateMessageMetadata,
	): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & { extra_body: any } {
		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature:
				this.options.modelTemperature ?? (isDeepseekReasoner ? DEEP_SEEK_DEFAULT_TEMPERATURE : undefined),
			messages,
			stream: true as const,
			...(isGrokXAI ? {} : { stream_options: { include_usage: true } }),
			...(reasoning && reasoning),
			...(isNativeProtocol(metadata?.toolProtocol)
				? {
						...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
						...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
						...{ parallel_tool_calls: metadata?.parallelToolCalls ?? false },
					}
				: undefined),
			extra_body: {
				mode: metadata?.mode,
			},
		}

		this.addMaxTokensIfNeeded(requestOptions, modelInfo)
		return requestOptions as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & { extra_body: any }
	}

	/**
	 * Build non-streaming request options
	 */
	private buildNonStreamingRequestOptions(
		modelId: string,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		isDeepseekReasoner: boolean,
		isLegacyFormat: boolean,
		modelInfo: ModelInfo,
		metadata?: ApiHandlerCreateMessageMetadata,
	): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & { extra_body: any } {
		const systemMessage: OpenAI.Chat.ChatCompletionUserMessageParam = {
			role: "user",
			content: systemPrompt,
		}
		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & { extra_body: any } = {
			model: modelId,
			messages: isDeepseekReasoner
				? convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
				: isLegacyFormat
					? [systemMessage, ...convertToSimpleMessages(messages)]
					: [systemMessage, ...convertToOpenAiMessages(messages, { mergeToolResultText: true })],
			...(isNativeProtocol(metadata?.toolProtocol)
				? {
						...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
						...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
						...{ parallel_tool_calls: metadata?.parallelToolCalls ?? false },
					}
				: undefined),
			extra_body: {
				prompt_mode: metadata?.mode,
			},
		}

		this.addMaxTokensIfNeeded(requestOptions, modelInfo)
		return requestOptions as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & { extra_body: any }
	}

	/**
	 * Optimized stream processing method (improves memory usage and performance)
	 */
	private async *handleOptimizedStream(
		stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
		modelInfo: ModelInfo,
		isAuto?: boolean,
		selectedLLM?: string,
		selectReason?: string,
		requestId?: string,
		isNative?: boolean,
		responseIdTimestamp?: number,
		requestIdTimestamp?: number,
		onPerformanceTiming?: (timing: {
			requestIdTimestamp?: number
			responseIdTimestamp?: number
			responseEndTimestamp?: number
			completionTokens?: number
		}) => Promise<void>,
	): ApiStream {
		// Check if request was aborted
		if (this.abortController?.signal.aborted) {
			return
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

		// Use content buffer to reduce matcher.update() calls
		const contentBuffer: string[] = []
		let time = Date.now()
		let isPrinted = false

		// Yield selected LLM info if available (for Auto model mode)
		if (isAuto) {
			yield {
				type: "automodel",
				text: selectReason ? ` (${selectReason})` : "",
				originModelId: this.options.zgsmModelId,
				selectedLLM,
			}
		}

		const lastDeltaInfo = {
			activeToolCallIds,
		} as {
			delta?: ChatCompletionChunk.Choice["delta"]
			finishReason?: ChatCompletionChunk.Choice["finish_reason"]
			activeToolCallIds?: Set<string>
		}

		// chunk
		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta ?? {}
			const finishReason = chunk.choices?.[0]?.finish_reason
			lastDeltaInfo.finishReason = finishReason
			lastDeltaInfo.delta = delta
			// Cache content for batch processing
			if (delta.content) {
				contentBuffer.push(delta.content)
				if (isDev && !isPrinted && chunk.model && isAuto) {
					this.logger.info(`[Current Model]: ${chunk.model}`)
					isPrinted = true
				}
				const now = Date.now()
				// Process in batch when threshold is reached
				if (
					contentBuffer.length >= this.apiResponseRenderModeInfo.limit &&
					time + this.apiResponseRenderModeInfo.interval <= now
				) {
					const batchedContent = contentBuffer.join("")
					for (const processedChunk of matcher.update(batchedContent)) {
						yield processedChunk
					}
					contentBuffer.length = 0 // Clear buffer
					// eslint-disable-next-line @typescript-eslint/no-unused-expressions
					isDev &&
						this.logger.info(
							`[ResponseID ${this.options.zgsmModelId} sse rendering]:`,
							requestId,
							batchedContent,
						)
					time = now
				}
			}

			// Process reasoning content
			if ("reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					text: (delta.reasoning_content as string | undefined) || "",
				}
			}

			yield* this.processToolCalls(delta, finishReason, activeToolCallIds, contentBuffer.length > 0)

			// Cache usage information
			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		// Process remaining content
		if (contentBuffer.length > 0) {
			const remainingContent = contentBuffer.join("")
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			isDev &&
				this.logger.info(
					`[ResponseID ${this.options.zgsmModelId} sse render end]:`,
					requestId,
					remainingContent,
				)
			for (const processedChunk of matcher.update(remainingContent)) {
				yield processedChunk
			}
			contentBuffer.length = 0 // Clear buffer
			yield* this.processToolCalls(lastDeltaInfo.delta, lastDeltaInfo.finishReason, activeToolCallIds)
		}

		// Output final results
		for (const chunk of matcher.final()) {
			yield chunk
		}

		// Process usage metrics
		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, modelInfo)

			// Emit performance timing data via callback (frontend will calculate metrics)
			const responseEndTimestamp = Date.now()
			if (onPerformanceTiming && responseIdTimestamp && requestIdTimestamp && lastUsage.completion_tokens) {
				// Emit timing data via callback
				onPerformanceTiming({
					requestIdTimestamp,
					responseIdTimestamp,
					responseEndTimestamp,
					completionTokens: lastUsage.completion_tokens,
				}).catch(() => {})
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
		skip: boolean = false,
	): Generator<
		| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }
		| { type: "tool_call_end"; id: string }
	> {
		if (skip) {
			return
		}

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

	async updateModelInfo() {
		try {
			const id = this.options.zgsmModelId ?? zgsmDefaultModelId
			const info =
				(
					await getModels({
						provider: "zgsm",
						baseUrl: `${this.options.zgsmBaseUrl?.trim() || ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl()}`,
						apiKey: this.options.zgsmAccessToken,
					})
				)[id] ?? zgsmModels.default

			this.modelInfo = info
		} catch (error) {
			this.logger.error(`[updateModelInfo] ${error.message}`)
			this.modelInfo = zgsmModels.default
		}
	}

	override getModel() {
		const id = this.options.zgsmModelId ?? zgsmDefaultModelId
		const defaultInfo = this.modelInfo
		const info = this.options.useZgsmCustomConfig
			? {
					...NATIVE_TOOL_DEFAULTS,
					...(this.options.zgsmAiCustomModelInfo ?? defaultInfo),
				}
			: defaultInfo
		const params = getModelParams({ format: "zgsm", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	async completePrompt(prompt: string, systemPrompt?: string, metadata?: any): Promise<string> {
		const isAzureAiInference = this._isAzureAiInference(this.baseURL)
		await this.updateModelInfo()
		const model = this.getModel()
		const modelInfo = model?.info
		const requestId = uuidv7()
		const cachedClientId = getClientId()
		const cachedWorkspacePath = getWorkspacePath()
		const messages = [{ role: "user", content: prompt }] as any[]
		if (systemPrompt) {
			messages.unshift({ role: "system", content: systemPrompt })
		}
		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & { extra_body: any } = {
			model: metadata?.modelId || model.id,
			messages: messages,
			temperature: 0.9,
			max_tokens: metadata?.maxLength ?? 300,
			extra_body: {
				prompt_mode: "raw",
			},
		}

		// Add max_tokens if needed
		this.addMaxTokensIfNeeded(requestOptions, modelInfo)
		try {
			const response = await this.client.chat.completions.create(
				requestOptions,
				Object.assign(isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {}, {
					headers: {
						...this.buildHeaders(
							{ language: metadata?.language, taskId: requestId, provider: metadata?.provider },
							requestId,
							cachedClientId,
							cachedWorkspacePath,
							"user",
						),
					},
					timeout: 60_000,
					signal: metadata?.signal,
				}),
			)
			return response.choices?.[0]?.message?.content || ""
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}

	private async *handleO3FamilyMessage(
		modelId: string,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.updateModelInfo()
		const modelInfo = this.getModel().info
		const methodIsAzureAiInference = this._isAzureAiInference(this.baseURL)

		if (this.options.openAiStreamingEnabled ?? true) {
			const isGrokXAI = this._isGrokXAI(this.baseURL)

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: modelId,
				messages: [
					{
						role: "developer",
						content: `Formatting re-enabled\n${systemPrompt}`,
					},
					...convertToOpenAiMessages(messages, { mergeToolResultText: true }),
				],
				stream: true,
				...(isGrokXAI ? {} : { stream_options: { include_usage: true } }),
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
				...(isNativeProtocol(metadata?.toolProtocol)
					? {
							...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
							...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
							...{ parallel_tool_calls: metadata?.parallelToolCalls ?? false },
						}
					: undefined),
			}

			// O3 family models do not support the deprecated max_tokens parameter
			// but they do support max_completion_tokens (the modern OpenAI parameter)
			// This allows O3 models to limit response length when includeMaxTokens is enabled
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)
			let stream
			try {
				stream = await this.client.chat.completions.create(
					requestOptions,
					Object.assign(methodIsAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {}, {
						signal: this.abortController?.signal,
					}),
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
					...convertToOpenAiMessages(messages, { mergeToolResultText: true }),
				],
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
				...(isNativeProtocol(metadata?.toolProtocol)
					? {
							...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
							...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
							...{ parallel_tool_calls: metadata?.parallelToolCalls ?? false },
						}
					: undefined),
			}

			// O3 family models do not support the deprecated max_tokens parameter
			// but they do support max_completion_tokens (the modern OpenAI parameter)
			// This allows O3 models to limit response length when includeMaxTokens is enabled
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let response
			try {
				response = await this.client.chat.completions.create(
					requestOptions,
					Object.assign(methodIsAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {}, {
						signal: this.abortController?.signal,
					}),
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
		// Check if request was aborted
		if (this.abortController?.signal.aborted) {
			return
		}
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

	private _getUrlHost(baseUrl?: string): string {
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

	private _isAzureAiInference(baseUrl?: string): boolean {
		const urlHost = this._getUrlHost(baseUrl)
		return urlHost.endsWith(".services.ai.azure.com")
	}

	/**
	 * Adds max_completion_tokens to the request body if needed based on provider configuration
	 * Note: max_tokens is deprecated in favor of max_completion_tokens as per OpenAI documentation
	 * O3 family models handle max_tokens separately in handleO3FamilyMessage
	 */
	private addMaxTokensIfNeeded(
		requestOptions:
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
		modelInfo: ModelInfo,
	): void {
		// Check if it's auto mode
		const isAutoMode = modelInfo.id === "Auto" || modelInfo.id === "auto"

		// Only add max_completion_tokens if includeMaxTokens is true
		if (this.options.useZgsmCustomConfig) {
			const maxTokens = this.options.modelMaxTokens || modelInfo.maxTokens
			// Use user-configured modelMaxTokens if available, otherwise fall back to model's default maxTokens
			// Using max_completion_tokens as max_tokens is deprecated
			if (this.options.includeMaxTokens) {
				Object.assign(requestOptions, {
					[modelInfo.maxTokensKey || "max_completion_tokens"]: maxTokens,
				})
			} else {
				Object.assign(requestOptions, {
					max_tokens: modelInfo.maxTokens,
					max_completion_tokens: modelInfo.maxTokens,
				})
			}
		} else {
			// If maxTokensKey exists, use it directly
			if (modelInfo.maxTokensKey) {
				Object.assign(requestOptions, {
					[modelInfo.maxTokensKey]: modelInfo.maxTokens,
				})
			} else if (!isAutoMode) {
				// Logic for non-auto mode
				// If maxTokensKey doesn't exist, use both max_tokens and max_completion_tokens
				Object.assign(requestOptions, {
					max_tokens: modelInfo.maxTokens,
					max_completion_tokens: modelInfo.maxTokens,
				})
			}
		}
	}

	setChatType(type: "user" | "system"): void {
		this.chatType = type
	}

	getChatType() {
		return this.chatType
	}

	cancelChat(reason?: ClineApiReqCancelReason): void {
		try {
			if (!this.abortController) return
			if (reason === "user_cancelled") {
				this.logger.info(`[cancelChat] User Cancelled chat request: ${reason}`)
			} else {
				this.logger.info(`[cancelChat] AI Cancelled chat request: ${reason}`)
			}
			this.abortController?.abort(reason)
			this.abortController = undefined
		} catch (error) {
			this.logger.info(`Error while cancelling message ${error}`)
		}
	}
}
