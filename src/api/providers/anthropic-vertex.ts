import { createVertexAnthropic, type GoogleVertexAnthropicProvider } from "@ai-sdk/google-vertex/anthropic"
import { streamText, generateText, type ToolSet, type SystemModelMessage } from "ai"

import {
	type ModelInfo,
	type VertexModelId,
	vertexDefaultModelId,
	vertexModels,
	ANTHROPIC_DEFAULT_MAX_TOKENS,
	VERTEX_1M_CONTEXT_MODEL_IDS,
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
import type { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { buildCachedSystemMessage, applyCacheBreakpoints } from "../transform/caching"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { calculateApiCostAnthropic } from "../../shared/cost"

/**
 * Anthropic on Vertex AI provider using the AI SDK (@ai-sdk/google-vertex/anthropic).
 * Supports extended thinking, prompt caching (4-block limit), 1M context beta, and cache cost metrics.
 *
 * @see https://docs.anthropic.com/en/api/claude-on-vertex-ai
 */
export class AnthropicVertexHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private readonly providerName = "AnthropicVertex"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	override isAiSdkProvider(): boolean {
		return true
	}

	/**
	 * Create the AI SDK Vertex Anthropic provider with appropriate configuration.
	 * Handles three auth paths: JSON credentials, key file, or default ADC.
	 */
	protected createProvider(): GoogleVertexAnthropicProvider {
		const projectId = this.options.vertexProjectId ?? "not-provided"
		const region = this.options.vertexRegion ?? "us-east5"

		// Build googleAuthOptions based on provided credentials
		let googleAuthOptions: { credentials?: object; keyFile?: string } | undefined

		if (this.options.vertexJsonCredentials) {
			try {
				googleAuthOptions = { credentials: JSON.parse(this.options.vertexJsonCredentials) }
			} catch {
				// If JSON parsing fails, fall through to other auth methods
			}
		} else if (this.options.vertexKeyFile) {
			googleAuthOptions = { keyFile: this.options.vertexKeyFile }
		}

		return createVertexAnthropic({
			project: projectId,
			location: region,
			googleAuthOptions,
			headers: { ...DEFAULT_HEADERS },
		})
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in vertexModels ? (modelId as VertexModelId) : vertexDefaultModelId
		let info: ModelInfo = vertexModels[id]

		// Check if 1M context beta should be enabled for supported models
		const supports1MContext = VERTEX_1M_CONTEXT_MODEL_IDS.includes(
			id as (typeof VERTEX_1M_CONTEXT_MODEL_IDS)[number],
		)
		const enable1MContext = supports1MContext && this.options.vertex1MContext

		// If 1M context beta is enabled, update the model info with tier pricing
		if (enable1MContext) {
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

		// Build betas array for request headers
		const betas: string[] = []

		// Add 1M context beta flag if enabled for supported models
		if (enable1MContext) {
			betas.push("context-1m-2025-08-07")
		}

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Anthropic's API does not have this
		// suffix.
		return {
			id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id,
			info,
			betas: betas.length > 0 ? betas : undefined,
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

	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info: modelInfo, maxTokens, temperature, reasoning, betas } = this.getModel()

		const provider = this.createProvider()
		const model = provider.languageModel(modelId)

		// Convert messages and tools
		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		// Build system prompt with optional cache control for prompt caching models.
		// Vertex has a 4-block limit for cache_control:
		// - 1 block for system prompt
		// - Up to 2 blocks for user messages (last 2 user messages)
		let system: string | SystemModelMessage = systemPrompt

		if (modelInfo.supportsPromptCache) {
			system = buildCachedSystemMessage(systemPrompt, "anthropic")
			applyCacheBreakpoints(aiSdkMessages, "anthropic")
		}

		// Build provider options for thinking
		const providerOptions = this.buildProviderOptions(reasoning)

		// Build per-request headers with betas (e.g. 1M context)
		const headers = betas?.length ? { "anthropic-beta": betas.join(",") } : undefined

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
		const model = provider.languageModel(modelId)

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
