/**
 * OpenAI-compatible provider base class using Vercel AI SDK.
 * This provides a parallel implementation to OpenAiHandler using @ai-sdk/openai-compatible.
 */

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { streamText, generateText, LanguageModel, ToolSet, ModelMessage } from "ai"

import type { ModelInfo, ProviderName } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	consumeAiSdkStream,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { applyPromptCacheToMessages, mergeProviderOptions } from "../transform/prompt-cache"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { normalizeProviderUsage } from "./utils/normalize-provider-usage"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

/**
 * Configuration options for creating an OpenAI-compatible provider.
 */
export interface OpenAICompatibleConfig {
	/** Provider name for identification */
	providerName: string
	/** Base URL for the API endpoint */
	baseURL: string
	/** API key for authentication */
	apiKey: string
	/** Model ID to use */
	modelId: string
	/** Model information */
	modelInfo: ModelInfo
	/** Optional custom headers */
	headers?: Record<string, string>
	/** Whether to include max_tokens in requests (default: false uses max_completion_tokens) */
	useMaxTokens?: boolean
	/** User-configured max tokens override */
	modelMaxTokens?: number
	/** Temperature setting */
	temperature?: number
	/** Canonical provider key used for prompt caching overrides. */
	cacheOverrideKey: ProviderName
	/** Optional usage profile key for shared usage normalization. Defaults to cacheOverrideKey. */
	usageProfileKey?: string
}

/**
 * Base class for OpenAI-compatible API providers using Vercel AI SDK.
 * Extends BaseProvider and implements SingleCompletionHandler.
 */
export abstract class OpenAICompatibleHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected config: OpenAICompatibleConfig
	protected provider: ReturnType<typeof createOpenAICompatible>

	constructor(options: ApiHandlerOptions, config: OpenAICompatibleConfig) {
		super()
		this.options = options
		this.config = config

		// Create the OpenAI-compatible provider using AI SDK
		this.provider = createOpenAICompatible({
			name: config.providerName,
			baseURL: config.baseURL,
			apiKey: config.apiKey,
			headers: {
				...DEFAULT_HEADERS,
				...(config.headers || {}),
			},
		})
	}

	/**
	 * Get the language model for the configured model ID.
	 */
	protected getLanguageModel(): LanguageModel {
		return this.provider(this.config.modelId)
	}

	/**
	 * Get the model information. Must be implemented by subclasses.
	 */
	abstract override getModel(): { id: string; info: ModelInfo; maxTokens?: number; temperature?: number }

	/**
	 * Process usage metrics from the AI SDK response.
	 * Can be overridden by subclasses to handle provider-specific usage formats.
	 */
	protected processUsageMetrics(
		usage: {
			inputTokens?: number
			outputTokens?: number
			inputTokenDetails?: {
				cacheReadTokens?: number
			}
			outputTokenDetails?: {
				reasoningTokens?: number
			}
			cachedInputTokens?: number
			reasoningTokens?: number
			details?: {
				cachedInputTokens?: number
				reasoningTokens?: number
			}
			raw?: Record<string, unknown>
		},
		providerMetadata?: Record<string, unknown>,
	): ApiStreamUsageChunk {
		const { chunk } = normalizeProviderUsage({
			provider: this.config.usageProfileKey ?? this.config.cacheOverrideKey ?? "openai-compatible",
			apiProtocol: "openai",
			usage: usage as any,
			providerMetadata,
			modelInfo: this.getModel().info,
		})
		return chunk
	}

	/**
	 * Get the max tokens parameter to include in the request.
	 */
	protected getMaxOutputTokens(): number | undefined {
		const modelInfo = this.config.modelInfo
		const maxTokens = this.config.modelMaxTokens || modelInfo.maxTokens

		return maxTokens ?? undefined
	}

	/**
	 * Create a message stream using the AI SDK.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()
		const languageModel = this.getLanguageModel()

		// Convert messages to AI SDK format
		const aiSdkMessages = messages as ModelMessage[]

		const promptCache = applyPromptCacheToMessages({
			adapter: "ai-sdk",
			overrideKey: this.config.cacheOverrideKey,
			messages: aiSdkMessages,
			modelInfo: {
				supportsPromptCache: model.info.supportsPromptCache,
				promptCacheRetention: model.info.promptCacheRetention,
			},
			settings: this.options,
		})

		// Convert tools to OpenAI format first, then to AI SDK format
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools, {
			functionToolProviderOptions: promptCache.toolProviderOptions,
		}) as ToolSet | undefined

		const providerOptions = mergeProviderOptions(undefined, promptCache.providerOptionsPatch)

		// Build the request options
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: promptCache.systemProviderOptions
				? ({ role: "system", content: systemPrompt, providerOptions: promptCache.systemProviderOptions } as any)
				: systemPrompt,
			messages: aiSdkMessages,
			temperature: model.temperature ?? this.config.temperature ?? 0,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			...(providerOptions ? ({ providerOptions } as Record<string, unknown>) : {}),
		}

		// Use streamText for streaming responses
		const result = streamText(requestOptions)

		try {
			const processUsage = this.processUsageMetrics.bind(this)
			yield* consumeAiSdkStream(result, async function* () {
				const [usage, providerMetadata] = await Promise.all([result.usage, result.providerMetadata])
				yield processUsage(usage, providerMetadata as Record<string, unknown> | undefined)
			})
		} catch (error) {
			// Handle AI SDK errors (AI_RetryError, AI_APICallError, etc.)
			throw handleAiSdkError(error, this.config.providerName)
		}
	}

	/**
	 * Complete a prompt using the AI SDK generateText.
	 */
	async completePrompt(prompt: string): Promise<string> {
		const languageModel = this.getLanguageModel()

		const { text } = await generateText({
			model: languageModel,
			prompt,
			maxOutputTokens: this.getMaxOutputTokens(),
			temperature: this.config.temperature ?? 0,
		})

		return text
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
