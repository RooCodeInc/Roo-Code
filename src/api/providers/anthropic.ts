import { createAnthropic } from "@ai-sdk/anthropic"
import { streamText, generateText, ToolSet } from "ai"

import {
	type ModelInfo,
	type AnthropicModelId,
	anthropicDefaultModelId,
	anthropicModels,
	ANTHROPIC_DEFAULT_MAX_TOKENS,
	ApiProviderError,
} from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import type { ApiHandlerOptions } from "../../shared/api"
import { shouldUseReasoningBudget } from "../../shared/api"

import type { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
	yieldResponseMessage,
} from "../transform/ai-sdk"
import { applyToolCacheOptions, applySystemPromptCaching } from "../transform/cache-breakpoints"
import { calculateApiCostAnthropic } from "../../shared/cost"
import { sanitizeMessagesForProvider } from "../transform/sanitize-messages"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

export class AnthropicHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private provider: ReturnType<typeof createAnthropic>
	private readonly providerName = "Anthropic"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const useAuthToken = Boolean(options.anthropicBaseUrl && options.anthropicUseAuthToken)

		// Build beta headers for model-specific features
		const betas: string[] = []
		const modelId = options.apiModelId

		if (modelId === "claude-3-7-sonnet-20250219:thinking") {
			betas.push("output-128k-2025-02-19")
		}

		if (
			(modelId === "claude-sonnet-4-20250514" ||
				modelId === "claude-sonnet-4-5" ||
				modelId === "claude-opus-4-6") &&
			options.anthropicBeta1MContext
		) {
			betas.push("context-1m-2025-08-07")
		}

		this.provider = createAnthropic({
			baseURL: options.anthropicBaseUrl || undefined,
			...(useAuthToken ? { authToken: options.apiKey } : { apiKey: options.apiKey }),
			headers: {
				...DEFAULT_HEADERS,
				...(betas.length > 0 ? { "anthropic-beta": betas.join(",") } : {}),
			},
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const modelConfig = this.getModel()

		// Sanitize messages for the provider API (allowlist: role, content, providerOptions).
		const aiSdkMessages = sanitizeMessagesForProvider(messages)

		// Convert tools to AI SDK format
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined
		applyToolCacheOptions(aiSdkTools as Parameters<typeof applyToolCacheOptions>[0], metadata?.toolProviderOptions)

		// Build Anthropic provider options
		const anthropicProviderOptions: Record<string, unknown> = {}

		// Configure thinking/reasoning if the model supports it
		const isThinkingEnabled =
			shouldUseReasoningBudget({ model: modelConfig.info, settings: this.options }) &&
			modelConfig.reasoning &&
			modelConfig.reasoningBudget

		if (isThinkingEnabled) {
			anthropicProviderOptions.thinking = {
				type: "enabled",
				budgetTokens: modelConfig.reasoningBudget,
			}
		}

		// Forward parallelToolCalls setting
		// When parallelToolCalls is explicitly false, disable parallel tool use
		if (metadata?.parallelToolCalls === false) {
			anthropicProviderOptions.disableParallelToolUse = true
		}

		// Breakpoint 1: System prompt caching — inject as cached system message
		// AI SDK v6 does not support providerOptions on the system string parameter,
		// so cache-aware providers convert it to a system message with providerOptions.
		const effectiveSystemPrompt = applySystemPromptCaching(
			systemPrompt,
			aiSdkMessages,
			metadata?.systemProviderOptions,
		)

		// Build streamText request
		// Cast providerOptions to any to bypass strict JSONObject typing — the AI SDK accepts the correct runtime values
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: this.provider(modelConfig.id),
			system: effectiveSystemPrompt,
			messages: aiSdkMessages,
			temperature: modelConfig.temperature,
			maxOutputTokens: modelConfig.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			...(Object.keys(anthropicProviderOptions).length > 0 && {
				providerOptions: { anthropic: anthropicProviderOptions } as any,
			}),
		}

		try {
			const result = streamText(requestOptions)

			let lastStreamError: string | undefined
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					if (chunk.type === "error") {
						lastStreamError = chunk.message
					}
					yield chunk
				}
			}

			// Yield usage metrics at the end, including cache metrics from providerMetadata
			try {
				const usage = await result.usage
				const providerMetadata = await result.providerMetadata
				if (usage) {
					yield this.processUsageMetrics(usage, modelConfig.info, providerMetadata)
				}
			} catch (usageError) {
				if (lastStreamError) {
					throw new Error(lastStreamError)
				}
				throw usageError
			}

			yield* yieldResponseMessage(result)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			TelemetryService.instance.captureException(
				new ApiProviderError(errorMessage, this.providerName, modelConfig.id, "createMessage"),
			)
			throw handleAiSdkError(error, this.providerName)
		}
	}

	/**
	 * Process usage metrics from the AI SDK response, including Anthropic's cache metrics.
	 */
	private processUsageMetrics(
		usage: { inputTokens?: number; outputTokens?: number },
		info: ModelInfo,
		providerMetadata?: Record<string, Record<string, unknown>>,
	): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens ?? 0
		const outputTokens = usage.outputTokens ?? 0

		// Extract cache metrics from Anthropic's providerMetadata.
		// In @ai-sdk/anthropic v3.0.38+, cacheReadInputTokens may only exist at
		// usage.cache_read_input_tokens rather than the top-level property.
		const anthropicMeta = providerMetadata?.anthropic as
			| {
					cacheCreationInputTokens?: number
					cacheReadInputTokens?: number
					usage?: { cache_read_input_tokens?: number }
			  }
			| undefined
		const cacheWriteTokens = anthropicMeta?.cacheCreationInputTokens ?? 0
		const cacheReadTokens =
			anthropicMeta?.cacheReadInputTokens ?? anthropicMeta?.usage?.cache_read_input_tokens ?? 0

		const { totalCost } = calculateApiCostAnthropic(
			info,
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
		)

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens: cacheWriteTokens > 0 ? cacheWriteTokens : undefined,
			cacheReadTokens: cacheReadTokens > 0 ? cacheReadTokens : undefined,
			totalCost,
		}
	}

	getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in anthropicModels ? (modelId as AnthropicModelId) : anthropicDefaultModelId
		let info: ModelInfo = anthropicModels[id]

		// If 1M context beta is enabled for supported models, update the model info
		if (
			(id === "claude-sonnet-4-20250514" || id === "claude-sonnet-4-5" || id === "claude-opus-4-6") &&
			this.options.anthropicBeta1MContext
		) {
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
			...params,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id, temperature } = this.getModel()

		try {
			const { text } = await generateText({
				model: this.provider(id),
				prompt,
				maxOutputTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
				temperature,
			})

			return text
		} catch (error) {
			TelemetryService.instance.captureException(
				new ApiProviderError(
					error instanceof Error ? error.message : String(error),
					this.providerName,
					id,
					"completePrompt",
				),
			)
			throw handleAiSdkError(error, this.providerName)
		}
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
