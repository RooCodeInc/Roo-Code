import { Anthropic } from "@anthropic-ai/sdk"
import { createAnthropic } from "@ai-sdk/anthropic"
import { streamText, generateText, ToolSet, type SystemModelMessage } from "ai"

import {
	type ModelInfo,
	type AnthropicModelId,
	anthropicDefaultModelId,
	anthropicModels,
	ANTHROPIC_DEFAULT_MAX_TOKENS,
	ApiProviderError,
} from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import type { NeutralMessageParam } from "../../core/task-persistence"
import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { buildCachedSystemMessage, applyCacheBreakpoints } from "../transform/caching"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { calculateApiCostAnthropic } from "../../shared/cost"

/**
 * Anthropic provider using the AI SDK (@ai-sdk/anthropic).
 * Supports extended thinking, prompt caching, 1M context beta, and cache cost metrics.
 */
export class AnthropicHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private readonly providerName = "Anthropic"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	override isAiSdkProvider(): boolean {
		return true
	}

	/**
	 * Create the AI SDK Anthropic provider with appropriate configuration.
	 * Handles apiKey vs authToken based on anthropicBaseUrl and anthropicUseAuthToken settings.
	 */
	protected createProvider() {
		const baseURL = this.options.anthropicBaseUrl || undefined
		const useAuthToken = this.options.anthropicBaseUrl && this.options.anthropicUseAuthToken

		return createAnthropic({
			...(useAuthToken ? { authToken: this.options.apiKey } : { apiKey: this.options.apiKey || undefined }),
			baseURL,
			headers: { ...DEFAULT_HEADERS },
		})
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in anthropicModels ? (modelId as AnthropicModelId) : anthropicDefaultModelId
		let info: ModelInfo = anthropicModels[id]

		// If 1M context beta is enabled for supported models, update the model info
		if (
			(id === "claude-sonnet-4-20250514" || id === "claude-sonnet-4-5" || id === "claude-opus-4-6") &&
			this.options.anthropicBeta1MContext
		) {
			// Use the tier pricing for 1M context
			const tier = info.tiers?.[0]
			if (tier) {
				info = {
					...info,
					contextWindow: tier.contextWindow,
					inputPrice: tier.inputPrice,
					outputPrice: tier.outputPrice,
					cacheWritesPrice: tier.cacheWritesPrice,
					cacheReadsPrice: tier.cacheReadsPrice,
				}
			}
		}

		const params = getModelParams({
			format: "anthropic",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Anthropic's API does not have this
		// suffix.
		return {
			id: id === "claude-3-7-sonnet-20250219:thinking" ? "claude-3-7-sonnet-20250219" : id,
			info,
			betas: id === "claude-3-7-sonnet-20250219:thinking" ? ["output-128k-2025-02-19"] : undefined,
			...params,
		}
	}

	/**
	 * Build Anthropic provider options for thinking configuration.
	 * Converts from native Anthropic SDK format (budget_tokens) to AI SDK format (budgetTokens).
	 */
	private buildProviderOptions(reasoning: { type: string; budget_tokens?: number } | undefined) {
		const anthropicOptions: Record<string, unknown> = {}

		if (reasoning) {
			if (reasoning.type === "enabled" && reasoning.budget_tokens) {
				// Convert from native Anthropic SDK format to AI SDK format
				anthropicOptions.thinking = {
					type: "enabled",
					budgetTokens: reasoning.budget_tokens,
				}
			} else {
				anthropicOptions.thinking = reasoning
			}
		}

		return Object.keys(anthropicOptions).length > 0 ? { anthropic: anthropicOptions } : undefined
	}

	/**
	 * Build the anthropic-beta header string for the current model configuration.
	 * Combines base betas (e.g., output-128k for :thinking), fine-grained tool streaming,
	 * prompt caching, and 1M context beta.
	 */
	private buildBetasHeader(
		modelId: string,
		modelInfo: ModelInfo,
		baseBetas?: string[],
	): Record<string, string> | undefined {
		const betas = [...(baseBetas || []), "fine-grained-tool-streaming-2025-05-14"]

		// Add prompt caching beta if model supports it
		if (modelInfo.supportsPromptCache) {
			betas.push("prompt-caching-2024-07-31")
		}

		// Add 1M context beta flag if enabled for supported models
		if (
			(modelId === "claude-sonnet-4-20250514" ||
				modelId === "claude-sonnet-4-5" ||
				modelId === "claude-opus-4-6") &&
			this.options.anthropicBeta1MContext
		) {
			betas.push("context-1m-2025-08-07")
		}

		return betas.length > 0 ? { "anthropic-beta": betas.join(",") } : undefined
	}

	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info: modelInfo, maxTokens, temperature, reasoning, betas } = this.getModel()

		const provider = this.createProvider()
		const model = provider.chat(modelId)

		// Convert messages and tools
		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		// Build system prompt with optional cache control for prompt caching models
		let system: string | SystemModelMessage = systemPrompt

		if (modelInfo.supportsPromptCache) {
			system = buildCachedSystemMessage(systemPrompt, "anthropic")
			applyCacheBreakpoints(aiSdkMessages, "anthropic")
		}

		// Build provider options for thinking
		const providerOptions = this.buildProviderOptions(reasoning)

		// Build per-request headers with betas
		const headers = this.buildBetasHeader(modelId, modelInfo, betas)

		const result = streamText({
			model,
			system,
			messages: aiSdkMessages,
			temperature,
			maxOutputTokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			providerOptions: providerOptions as any,
			headers,
		})

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			const usage = await result.usage
			const providerMetadata = await result.providerMetadata
			if (usage) {
				yield this.processUsageMetrics(
					usage,
					providerMetadata as Record<string, Record<string, unknown>> | undefined,
					modelInfo,
				)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "createMessage")
			TelemetryService.instance.captureException(apiError)
			throw handleAiSdkError(error, this.providerName)
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, temperature } = this.getModel()
		const provider = this.createProvider()
		const model = provider.chat(modelId)

		try {
			const { text } = await generateText({
				model,
				prompt,
				temperature,
			})
			return text
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "completePrompt")
			TelemetryService.instance.captureException(apiError)
			throw handleAiSdkError(error, this.providerName)
		}
	}

	/**
	 * Process usage metrics from the AI SDK response, including Anthropic-specific
	 * cache metrics from providerMetadata.anthropic.
	 */
	protected processUsageMetrics(
		usage: {
			inputTokens?: number
			outputTokens?: number
		},
		providerMetadata?: Record<string, Record<string, unknown>>,
		modelInfo?: ModelInfo,
	): ApiStreamUsageChunk {
		const anthropicMeta = providerMetadata?.anthropic as Record<string, unknown> | undefined
		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0
		const cacheWriteTokens = (anthropicMeta?.cacheCreationInputTokens as number) ?? 0
		const cacheReadTokens = (anthropicMeta?.cacheReadInputTokens as number) ?? 0

		// Calculate cost using Anthropic-specific pricing (cache read/write tokens)
		let totalCost: number | undefined
		if (modelInfo && (inputTokens > 0 || outputTokens > 0 || cacheWriteTokens > 0 || cacheReadTokens > 0)) {
			const { totalCost: cost } = calculateApiCostAnthropic(
				modelInfo,
				inputTokens,
				outputTokens,
				cacheWriteTokens,
				cacheReadTokens,
			)
			totalCost = cost
		}

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens: cacheWriteTokens > 0 ? cacheWriteTokens : undefined,
			cacheReadTokens: cacheReadTokens > 0 ? cacheReadTokens : undefined,
			totalCost,
		}
	}
}
