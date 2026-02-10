import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { streamText, generateText } from "ai"

import {
	type ModelRecord,
	type ModelInfo,
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
	OPENROUTER_DEFAULT_PROVIDER_NAME,
	OPEN_ROUTER_PROMPT_CACHING_MODELS,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	ApiProviderError,
} from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

import {
	convertToOpenAiMessages,
	sanitizeGeminiMessages,
	consolidateReasoningDetails,
	type ReasoningDetail,
} from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import { addCacheBreakpoints as addAnthropicCacheBreakpoints } from "../transform/caching/anthropic"
import { addCacheBreakpoints as addGeminiCacheBreakpoints } from "../transform/caching/gemini"
import { getModelParams } from "../transform/model-params"
import { convertToAiSdkMessages, convertToolsForAiSdk, processAiSdkStreamPart } from "../transform/ai-sdk"

import { BaseProvider } from "./base-provider"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"
import { getModelEndpoints } from "./fetchers/modelEndpointCache"
import { applyRouterToolPreferences } from "./utils/router-tool-preferences"
import { generateImageWithProvider, ImageGenerationResult } from "./utils/image-generation"

import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import type { ApiStreamChunk, ApiStreamUsageChunk } from "../transform/stream"

export class OpenRouterHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected models: ModelRecord = {}
	protected endpoints: ModelRecord = {}
	private readonly providerName = "OpenRouter"
	private currentReasoningDetails: ReasoningDetail[] = []

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.loadDynamicModels().catch((error) => {
			console.error("[OpenRouterHandler] Failed to load dynamic models:", error)
		})
	}

	private async loadDynamicModels(): Promise<void> {
		try {
			const [models, endpoints] = await Promise.all([
				getModels({ provider: "openrouter" }),
				getModelEndpoints({
					router: "openrouter",
					modelId: this.options.openRouterModelId,
					endpoint: this.options.openRouterSpecificProvider,
				}),
			])
			this.models = models
			this.endpoints = endpoints
		} catch (error) {
			console.error("[OpenRouterHandler] Error loading dynamic models:", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})
		}
	}

	private createOpenRouterProvider(options?: {
		reasoning?: { effort?: string; max_tokens?: number; exclude?: boolean }
		headers?: Record<string, string>
		openAiMessages?: OpenAI.Chat.ChatCompletionMessageParam[]
	}) {
		const apiKey = this.options.openRouterApiKey ?? "not-provided"
		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"
		const extraBody: Record<string, unknown> = {}
		if (options?.reasoning) {
			extraBody.reasoning = options.reasoning
		}
		if (options?.openAiMessages) {
			extraBody.messages = options.openAiMessages
		}
		return createOpenRouter({
			apiKey,
			baseURL,
			...(Object.keys(extraBody).length > 0 && { extraBody }),
			...(options?.headers && { headers: options.headers }),
		})
	}

	getReasoningDetails(): ReasoningDetail[] | undefined {
		return this.currentReasoningDetails.length > 0 ? this.currentReasoningDetails : undefined
	}

	private normalizeUsage(
		usage: { inputTokens: number; outputTokens: number },
		providerMetadata: Record<string, any> | undefined,
		modelInfo: ModelInfo,
	): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens ?? 0
		const outputTokens = usage.outputTokens ?? 0
		const openrouterMeta = providerMetadata?.openrouter ?? {}
		const cacheReadTokens =
			openrouterMeta.cachedInputTokens ??
			openrouterMeta.cache_read_input_tokens ??
			openrouterMeta.cacheReadTokens ??
			openrouterMeta.cached_tokens ??
			0
		const cacheWriteTokens =
			openrouterMeta.cacheCreationInputTokens ??
			openrouterMeta.cache_creation_input_tokens ??
			openrouterMeta.cacheWriteTokens ??
			0
		const reasoningTokens =
			openrouterMeta.reasoningOutputTokens ??
			openrouterMeta.reasoning_tokens ??
			openrouterMeta.output_tokens_details?.reasoning_tokens ??
			undefined
		const { totalCost } = calculateApiCostOpenAI(
			modelInfo,
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
		)
		return {
			type: "usage",
			inputTokens,
			outputTokens,
			...(cacheWriteTokens > 0 ? { cacheWriteTokens } : {}),
			...(cacheReadTokens > 0 ? { cacheReadTokens } : {}),
			...(typeof reasoningTokens === "number" && reasoningTokens > 0 ? { reasoningTokens } : {}),
			totalCost,
		}
	}

	private buildOpenAiMessages(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		modelId: string,
	): OpenAI.Chat.ChatCompletionMessageParam[] | undefined {
		const isR1 = modelId.startsWith("deepseek/deepseek-r1") || modelId === "perplexity/sonar-reasoning"
		const isGemini = modelId.startsWith("google/gemini")
		const needsCaching = OPEN_ROUTER_PROMPT_CACHING_MODELS.has(modelId)
		if (!isR1 && !isGemini && !needsCaching) {
			return undefined
		}
		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[]
		if (isR1) {
			openAiMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
		} else {
			openAiMessages = [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)]
		}
		if (isGemini) {
			openAiMessages = sanitizeGeminiMessages(openAiMessages, modelId)
			openAiMessages = openAiMessages.map((msg) => {
				if (msg.role === "assistant") {
					const toolCalls = (msg as any).tool_calls as any[] | undefined
					const existingDetails = (msg as any).reasoning_details as any[] | undefined
					if (toolCalls && toolCalls.length > 0) {
						const hasEncrypted = existingDetails?.some((d) => d.type === "reasoning.encrypted") ?? false
						if (!hasEncrypted) {
							const fakeEncrypted = {
								type: "reasoning.encrypted",
								data: "skip_thought_signature_validator",
								id: toolCalls[0].id,
								format: "google-gemini-v1",
								index: 0,
							}
							return {
								...msg,
								reasoning_details: [...(existingDetails ?? []), fakeEncrypted],
							}
						}
					}
				}
				return msg
			})
		}
		if (needsCaching) {
			if (modelId.startsWith("google/")) {
				addGeminiCacheBreakpoints(systemPrompt, openAiMessages)
			} else {
				addAnthropicCacheBreakpoints(systemPrompt, openAiMessages)
			}
		}
		return openAiMessages
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): AsyncGenerator<ApiStreamChunk> {
		this.currentReasoningDetails = []
		const model = await this.fetchModel()
		let { id: modelId, maxTokens, temperature, topP, reasoning } = model

		if (
			(modelId === "google/gemini-2.5-pro-preview" || modelId === "google/gemini-2.5-pro") &&
			typeof reasoning === "undefined"
		) {
			reasoning = { exclude: true }
		}

		const isAnthropic = modelId.startsWith("anthropic/")
		const headers: Record<string, string> | undefined = isAnthropic
			? { "x-anthropic-beta": "fine-grained-tool-streaming-2025-05-14" }
			: undefined

		const openAiMessages = this.buildOpenAiMessages(systemPrompt, messages, modelId)
		const openrouter = this.createOpenRouterProvider({ reasoning, headers, openAiMessages })

		const coreMessages = openAiMessages
			? convertToAiSdkMessages([{ role: "user", content: "." }])
			: convertToAiSdkMessages(messages)

		const tools = convertToolsForAiSdk(metadata?.tools)

		const providerOptions:
			| {
					openrouter?: {
						provider?: { order: string[]; only: string[]; allow_fallbacks: boolean }
					}
			  }
			| undefined =
			this.options.openRouterSpecificProvider &&
			this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME
				? {
						openrouter: {
							provider: {
								order: [this.options.openRouterSpecificProvider],
								only: [this.options.openRouterSpecificProvider],
								allow_fallbacks: false,
							},
						},
					}
				: undefined

		let accumulatedReasoningText = ""

		try {
			const result = streamText({
				model: openrouter.chat(modelId),
				...(openAiMessages ? {} : { system: systemPrompt }),
				messages: coreMessages,
				maxOutputTokens: maxTokens && maxTokens > 0 ? maxTokens : undefined,
				temperature,
				topP,
				tools,
				toolChoice: metadata?.tool_choice as any,
				providerOptions,
			})

			for await (const part of result.fullStream) {
				if (part.type === "reasoning-delta") {
					accumulatedReasoningText += part.text
				}
				yield* processAiSdkStreamPart(part)
			}

			if (accumulatedReasoningText) {
				this.currentReasoningDetails.push({
					type: "reasoning.text",
					text: accumulatedReasoningText,
					index: 0,
				})
			}

			const providerMetadata =
				(await result.providerMetadata) ?? (await (result as any).experimental_providerMetadata)

			const providerReasoningDetails = providerMetadata?.openrouter?.reasoning_details as
				| ReasoningDetail[]
				| undefined

			if (providerReasoningDetails && providerReasoningDetails.length > 0) {
				this.currentReasoningDetails = consolidateReasoningDetails(providerReasoningDetails)
			}

			const usage = await result.usage
			const totalUsage = await result.totalUsage
			const usageChunk = this.normalizeUsage(
				{
					inputTokens: totalUsage.inputTokens ?? usage.inputTokens ?? 0,
					outputTokens: totalUsage.outputTokens ?? usage.outputTokens ?? 0,
				},
				providerMetadata,
				model.info,
			)
			yield usageChunk
		} catch (error: any) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "createMessage")
			TelemetryService.instance.captureException(apiError)
			yield {
				type: "error",
				error: "OpenRouterError",
				message: `${this.providerName} API Error: ${errorMessage}`,
			}
		}
	}

	public async fetchModel() {
		const [models, endpoints] = await Promise.all([
			getModels({ provider: "openrouter" }),
			getModelEndpoints({
				router: "openrouter",
				modelId: this.options.openRouterModelId,
				endpoint: this.options.openRouterSpecificProvider,
			}),
		])
		this.models = models
		this.endpoints = endpoints
		return this.getModel()
	}

	override getModel() {
		const id = this.options.openRouterModelId ?? openRouterDefaultModelId
		let info = this.models[id]
		if (!info) {
			const cachedModels = getModelsFromCache("openrouter")
			if (cachedModels?.[id]) {
				this.models = cachedModels
				info = cachedModels[id]
			}
		}
		if (this.options.openRouterSpecificProvider && this.endpoints[this.options.openRouterSpecificProvider]) {
			info = this.endpoints[this.options.openRouterSpecificProvider]
		}
		if (!info) {
			info = openRouterDefaultModelInfo
		}
		info = applyRouterToolPreferences(id, info)
		const isDeepSeekR1 = id.startsWith("deepseek/deepseek-r1") || id === "perplexity/sonar-reasoning"
		const params = getModelParams({
			format: "openrouter",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0,
		})
		return { id, info, topP: isDeepSeekR1 ? 0.95 : undefined, ...params }
	}

	async completePrompt(prompt: string): Promise<string> {
		let { id: modelId, maxTokens, temperature, topP, reasoning } = await this.fetchModel()

		if (
			(modelId === "google/gemini-2.5-pro-preview" || modelId === "google/gemini-2.5-pro") &&
			typeof reasoning === "undefined"
		) {
			reasoning = { exclude: true }
		}

		const isAnthropic = modelId.startsWith("anthropic/")
		const headers: Record<string, string> | undefined = isAnthropic
			? { "x-anthropic-beta": "fine-grained-tool-streaming-2025-05-14" }
			: undefined

		const openrouter = this.createOpenRouterProvider({ reasoning, headers })

		const providerOptions:
			| {
					openrouter?: {
						provider?: { order: string[]; only: string[]; allow_fallbacks: boolean }
					}
			  }
			| undefined =
			this.options.openRouterSpecificProvider &&
			this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME
				? {
						openrouter: {
							provider: {
								order: [this.options.openRouterSpecificProvider],
								only: [this.options.openRouterSpecificProvider],
								allow_fallbacks: false,
							},
						},
					}
				: undefined

		try {
			const result = await generateText({
				model: openrouter.chat(modelId),
				prompt,
				maxOutputTokens: maxTokens && maxTokens > 0 ? maxTokens : undefined,
				temperature,
				topP,
				providerOptions,
			})
			return result.text
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "completePrompt")
			TelemetryService.instance.captureException(apiError)
			throw new Error(`${this.providerName} completion error: ${errorMessage}`)
		}
	}

	async generateImage(
		prompt: string,
		model: string,
		apiKey: string,
		inputImage?: string,
	): Promise<ImageGenerationResult> {
		if (!apiKey) {
			return {
				success: false,
				error: "OpenRouter API key is required for image generation",
			}
		}
		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"
		return generateImageWithProvider({
			baseURL,
			authToken: apiKey,
			model,
			prompt,
			inputImage,
		})
	}
}
