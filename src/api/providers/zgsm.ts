import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI, { AzureOpenAI } from "openai"
import { v7 as uuidv7 } from "uuid"

import {
	type ModelInfo,
	azureOpenAiDefaultApiVersion,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	OPENAI_AZURE_AI_INFERENCE_PATH,
	zgsmDefaultModelId,
	zgsmModels,
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

const autoModeModelId = "Auto"

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
		await this.updateModelInfo()
		const fromWorkflow =
			metadata?.zgsmWorkflowMode ||
			metadata?.mode === "strict" ||
			metadata?.rooTaskMode === "strict" ||
			metadata?.parentTaskMode === "strict" ||
			metadata?.zgsmCodeMode === "strict"
		this.apiResponseRenderModeInfo = getApiResponseRenderMode()
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
			if (fromWorkflow) {
				requestOptions.extra_body.prompt_mode = "strict"
			}
			const isAuto = this.options.zgsmModelId === autoModeModelId
			let stream: any
			let selectedLLM: string | undefined = this.options.zgsmModelId
			let selectReason: string | undefined
			try {
				this.logger.info(`[RequestID]:`, requestId)

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
				this.logger.info(`[ResponseID]:`, response.headers.get("x-request-id"))
				if (isAuto) {
					selectedLLM = response.headers.get("x-select-llm") || ""
					selectReason = response.headers.get("x-select-reason") || ""
					const isDev = process.env.NODE_ENV === "development"

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

			// 6. Optimize stream processing - use batch processing and buffer
			yield* this.handleOptimizedStream(stream, modelInfo, isAuto, selectedLLM, selectReason)
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
			if (fromWorkflow) {
				requestOptions.extra_body.prompt_mode = "strict"
			}
			let response
			try {
				this.logger.info(`[RequestID]:`, requestId)
				response = await this.client.chat.completions.create(
					requestOptions,
					Object.assign(isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {}, {
						headers: _headers,
						signal: this.abortController.signal,
					}),
				)
				this.logger.info(`[ResponseId]:`, response._request_id)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			yield {
				type: "text",
				text: response.choices?.[0]?.message.content || "",
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

			convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]
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

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
			model: modelId,
			messages: isDeepseekReasoner
				? convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
				: isLegacyFormat
					? [systemMessage, ...convertToSimpleMessages(messages)]
					: [systemMessage, ...convertToOpenAiMessages(messages)],
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
	): ApiStream {
		const matcher = new XmlMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		let lastUsage

		// Use content buffer to reduce matcher.update() calls
		const contentBuffer: string[] = []
		let time = Date.now()
		let isPrinted = false
		const isDev = process.env.NODE_ENV === "development"

		// Yield selected LLM info if available (for Auto model mode)
		if (isAuto) {
			yield {
				type: "automodel",
				text: selectReason ? ` (${selectReason})` : "",
				originModelId: this.options.zgsmModelId,
				selectedLLM,
			}
		}

		// chunk
		for await (const chunk of stream) {
			if (this.abortController?.signal.aborted) {
				break
			}

			const delta = chunk.choices?.[0]?.delta ?? {}

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

			// Cache usage information
			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		// Process remaining content
		if (contentBuffer.length > 0) {
			const remainingContent = contentBuffer.join("")
			for (const processedChunk of matcher.update(remainingContent)) {
				yield processedChunk
			}
		}

		// Output final results
		for (const chunk of matcher.final()) {
			yield chunk
		}

		// Process usage metrics
		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, modelInfo)
		}
	}

	async updateModelInfo() {
		const id = this.options.zgsmModelId ?? zgsmDefaultModelId
		const info =
			(
				await getModels({
					provider: "zgsm",
					baseUrl: `${this.options.zgsmBaseUrl?.trim() || ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl()}`,
					apiKey: this.options.zgsmAccessToken,
				})
			)[id] ?? zgsmModels.default

		if (id.toLowerCase().includes("gemini")) {
			Object.assign(info, {
				supportsNativeTools: false,
			})
		}

		this.modelInfo = info
	}

	override getModel() {
		const id = this.options.zgsmModelId ?? zgsmDefaultModelId
		const defaultInfo = this.modelInfo
		const info = this.options.useZgsmCustomConfig
			? (this.options.zgsmAiCustomModelInfo ?? defaultInfo)
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
					timeout: 15000,
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
	): ApiStream {
		await this.updateModelInfo()
		const modelInfo = this.getModel()
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
					...convertToOpenAiMessages(messages),
				],
				stream: true,
				...(isGrokXAI ? {} : { stream_options: { include_usage: true } }),
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
			}

			// O3 family models do not support the deprecated max_tokens parameter
			// but they do support max_completion_tokens (the modern OpenAI parameter)
			// This allows O3 models to limit response length when includeMaxTokens is enabled
			this.addMaxTokensIfNeeded(requestOptions, modelInfo.info)
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
					...convertToOpenAiMessages(messages),
				],
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
			}

			// O3 family models do not support the deprecated max_tokens parameter
			// but they do support max_completion_tokens (the modern OpenAI parameter)
			// This allows O3 models to limit response length when includeMaxTokens is enabled
			this.addMaxTokensIfNeeded(requestOptions, modelInfo.info)

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

			yield {
				type: "text",
				text: response.choices?.[0]?.message.content || "",
			}
			yield this.processUsageMetrics(response.usage)
		}
	}

	private async *handleStreamResponse(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>): ApiStream {
		for await (const chunk of stream) {
			if (this.abortController?.signal.aborted) {
				break
			}
			const delta = chunk.choices?.[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
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
		const _m = requestOptions.model.toLocaleLowerCase()

		// Only add max_completion_tokens if includeMaxTokens is true
		if (this.options.useZgsmCustomConfig) {
			const maxTokens = this.options.modelMaxTokens || modelInfo.maxTokens
			// Use user-configured modelMaxTokens if available, otherwise fall back to model's default maxTokens
			// Using max_completion_tokens as max_tokens is deprecated
			if (this.options.includeMaxTokens) {
				Object.assign(requestOptions, {
					[modelInfo.maxTokensKey || "max_completion_tokens"]: maxTokens,
				})
			}
		} else if (modelInfo.maxTokensKey) {
			Object.assign(requestOptions, {
				[modelInfo.maxTokensKey]: modelInfo.maxTokens,
			})
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
			if (reason === "user_cancelled") {
				this.logger.info(`[cancelChat] User Cancelled chat request: ${reason}`)
			} else {
				this.logger.info(`[cancelChat] AI Cancelled chat request: ${reason}`)
			}
			this.abortController?.abort(reason)
		} catch (error) {
			this.logger.info(`Error while cancelling message ${error}`)
		}
	}
}
