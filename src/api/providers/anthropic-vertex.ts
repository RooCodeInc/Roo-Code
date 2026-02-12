import type { Anthropic } from "@anthropic-ai/sdk"
import { createVertexAnthropic } from "@ai-sdk/google-vertex/anthropic"
import { streamText, generateText, ToolSet } from "ai"

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

// https://docs.anthropic.com/en/api/claude-on-vertex-ai
export class AnthropicVertexHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private provider: ReturnType<typeof createVertexAnthropic>
	private readonly providerName = "Vertex (Anthropic)"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#regions
		const projectId = this.options.vertexProjectId ?? "not-provided"
		const region = this.options.vertexRegion ?? "us-east5"

		// Build googleAuthOptions based on provided credentials
		let googleAuthOptions: { credentials?: object; keyFile?: string } | undefined
		if (options.vertexJsonCredentials) {
			try {
				googleAuthOptions = { credentials: JSON.parse(options.vertexJsonCredentials) }
			} catch {
				// If JSON parsing fails, ignore and try other auth methods
			}
		} else if (options.vertexKeyFile) {
			googleAuthOptions = { keyFile: options.vertexKeyFile }
		}

		// Build beta headers for 1M context support
		const modelId = options.apiModelId
		const betas: string[] = []

		if (modelId) {
			const supports1MContext = VERTEX_1M_CONTEXT_MODEL_IDS.includes(
				modelId as (typeof VERTEX_1M_CONTEXT_MODEL_IDS)[number],
			)
			if (supports1MContext && options.vertex1MContext) {
				betas.push("context-1m-2025-08-07")
			}
		}

		this.provider = createVertexAnthropic({
			project: projectId,
			location: region,
			googleAuthOptions,
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
			// Anthropic: inputTokens is non-cached only; total = input + cache write + cache read
			totalInputTokens: inputTokens + (cacheWriteTokens ?? 0) + (cacheReadTokens ?? 0),
			totalOutputTokens: outputTokens,
		}
	}

	getModel() {
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

		// Build betas array for request headers (kept for backward compatibility / testing)
		const betas: string[] = []

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
