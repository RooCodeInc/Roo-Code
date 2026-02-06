import type { Anthropic } from "@anthropic-ai/sdk"
import { createAnthropic, type AnthropicProvider } from "@ai-sdk/anthropic"
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

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
} from "../transform/ai-sdk"
import type { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { addAiSdkAnthropicCacheBreakpoints } from "../transform/caching/ai-sdk-anthropic"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"
import { DEFAULT_HEADERS } from "./constants"
import { calculateApiCostAnthropic } from "../../shared/cost"

/**
 * Models that support Anthropic prompt caching.
 * These models require the `prompt-caching-2024-07-31` beta header.
 */
const CACHE_SUPPORTED_MODELS = new Set<string>([
	"claude-sonnet-4-5",
	"claude-sonnet-4-20250514",
	"claude-opus-4-6",
	"claude-opus-4-5-20251101",
	"claude-opus-4-1-20250805",
	"claude-opus-4-20250514",
	"claude-3-7-sonnet-20250219",
	"claude-3-5-sonnet-20241022",
	"claude-3-5-haiku-20241022",
	"claude-3-opus-20240229",
	"claude-haiku-4-5-20251001",
	"claude-3-haiku-20240307",
])

/**
 * Models that support the 1M context beta.
 */
const CONTEXT_1M_MODELS = new Set<string>(["claude-sonnet-4-20250514", "claude-sonnet-4-5", "claude-opus-4-6"])

export class AnthropicHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private provider: AnthropicProvider
	private readonly providerName = "Anthropic"
	private lastThoughtSignature: string | undefined
	private lastRedactedBlocks: Array<{ type: "redacted_thinking"; data: string }> | undefined

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const useAuthToken = !!(this.options.anthropicBaseUrl && this.options.anthropicUseAuthToken)

		const headers: Record<string, string> = { ...DEFAULT_HEADERS }
		if (useAuthToken && this.options.apiKey) {
			headers["Authorization"] = `Bearer ${this.options.apiKey}`
		}

		this.provider = createAnthropic({
			apiKey: useAuthToken ? "" : (this.options.apiKey ?? "not-provided"),
			baseURL: this.options.anthropicBaseUrl || undefined,
			headers,
		})
	}

	async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const {
			id: modelId,
			betas = ["fine-grained-tool-streaming-2025-05-14"],
			maxTokens,
			temperature,
			reasoning: thinking,
		} = this.getModel()

		// Build beta headers
		const betaHeaders = [...betas]

		if (CACHE_SUPPORTED_MODELS.has(modelId)) {
			betaHeaders.push("prompt-caching-2024-07-31")
		}

		if (CONTEXT_1M_MODELS.has(modelId) && this.options.anthropicBeta1MContext) {
			betaHeaders.push("context-1m-2025-08-07")
		}

		// Convert messages to AI SDK format (handles filtering of reasoning/thinking/etc. blocks)
		const aiSdkMessages = convertToAiSdkMessages(messages)

		// Add cache breakpoints to the last 2 user messages
		const useCache = CACHE_SUPPORTED_MODELS.has(modelId)
		const cachedMessages = useCache ? addAiSdkAnthropicCacheBreakpoints(aiSdkMessages) : aiSdkMessages

		// Convert tools to AI SDK format
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined
		const toolChoice = mapToolChoice(metadata?.tool_choice)

		// Map Anthropic thinking config from snake_case to camelCase for AI SDK
		const thinkingProviderOptions = thinking
			? {
					thinking:
						thinking.type === "enabled"
							? {
									type: "enabled" as const,
									budgetTokens: (thinking as { budget_tokens: number }).budget_tokens,
								}
							: thinking,
				}
			: undefined

		// Build system prompt — with cache control for supported models
		// Cast to any to bypass strict typing: the AI SDK Anthropic provider accepts
		// text parts with providerOptions at runtime for system prompt caching.
		const system: any = useCache
			? [
					{
						type: "text" as const,
						text: systemPrompt,
						providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
					},
				]
			: systemPrompt

		// Build the request options
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: this.provider(modelId),
			system,
			messages: cachedMessages,
			maxOutputTokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
			temperature,
			tools: aiSdkTools,
			toolChoice,
			headers: { "anthropic-beta": betaHeaders.join(",") },
			...(thinkingProviderOptions && {
				providerOptions: { anthropic: thinkingProviderOptions } as any,
			}),
		}

		try {
			// Reset reasoning state for this request
			this.lastThoughtSignature = undefined
			this.lastRedactedBlocks = undefined

			const result = streamText(requestOptions)

			// Process the full stream
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			// After stream completes, capture reasoning data for signatures and redacted thinking
			const reasoning = await result.reasoning
			if (reasoning && Array.isArray(reasoning)) {
				for (const entry of reasoning) {
					// The AI SDK types reasoning parts as { type: "reasoning" } but the
					// Anthropic provider returns richer types at runtime including "text"
					// (with signature) and "redacted" (with data). Use any cast.
					const entryAny = entry as any
					if (entryAny.type === "text" && entryAny.signature) {
						this.lastThoughtSignature = entryAny.signature
					}
					if (entryAny.type === "redacted" && entryAny.data) {
						if (!this.lastRedactedBlocks) {
							this.lastRedactedBlocks = []
						}
						this.lastRedactedBlocks.push({
							type: "redacted_thinking",
							data: entryAny.data,
						})
					}
				}
			}

			// Yield usage metrics at the end
			const usage = await result.usage
			const providerMetadata = await result.providerMetadata

			if (usage) {
				yield this.processUsageMetrics(usage, this.getModel().info, providerMetadata)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			TelemetryService.instance.captureException(
				new ApiProviderError(errorMessage, this.providerName, modelId, "createMessage"),
			)
			throw error
		}
	}

	getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in anthropicModels ? (modelId as AnthropicModelId) : anthropicDefaultModelId
		let info: ModelInfo = anthropicModels[id]

		// If 1M context beta is enabled for supported models, update the model info
		if (CONTEXT_1M_MODELS.has(id) && this.options.anthropicBeta1MContext) {
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

	async completePrompt(prompt: string) {
		const { id: model, temperature } = this.getModel()

		try {
			const result = await generateText({
				model: this.provider(model),
				prompt,
				maxOutputTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
				temperature,
			})

			return result.text ?? ""
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			TelemetryService.instance.captureException(
				new ApiProviderError(errorMessage, this.providerName, model, "completePrompt"),
			)
			throw error
		}
	}

	/**
	 * Process usage metrics from the AI SDK response.
	 * Handles Anthropic-specific cache tokens from providerMetadata.
	 */
	private processUsageMetrics(
		usage: {
			inputTokens?: number
			outputTokens?: number
			details?: {
				cachedInputTokens?: number
				reasoningTokens?: number
			}
		},
		info: ModelInfo,
		providerMetadata?: Record<string, unknown>,
	): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0
		const cacheReadTokens = usage.details?.cachedInputTokens

		// Cache write tokens come from Anthropic-specific provider metadata
		const anthropicMeta = providerMetadata?.anthropic as { cacheCreationInputTokens?: number } | undefined
		const cacheWriteTokens = anthropicMeta?.cacheCreationInputTokens

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
			cacheWriteTokens,
			cacheReadTokens,
			totalCost,
		}
	}

	override isAiSdkProvider(): boolean {
		return true
	}

	/**
	 * Returns the thought signature captured from the last Anthropic response.
	 * Anthropic extended thinking returns a signature on thinking blocks
	 * that must be round-tripped for tool use continuations.
	 */
	getThoughtSignature(): string | undefined {
		return this.lastThoughtSignature
	}

	/**
	 * Returns redacted thinking blocks from the last Anthropic response.
	 * These blocks are returned when safety filters trigger on reasoning content
	 * and must be passed back verbatim for proper reasoning continuity.
	 */
	getRedactedThinkingBlocks(): Array<{ type: "redacted_thinking"; data: string }> | undefined {
		return this.lastRedactedBlocks
	}
}
