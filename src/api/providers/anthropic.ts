import type { Anthropic } from "@anthropic-ai/sdk"
import { createAnthropic } from "@ai-sdk/anthropic"
import { streamText, generateText, ToolSet, ModelMessage } from "ai"

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
} from "../transform/ai-sdk"
import { calculateApiCostAnthropic } from "../../shared/cost"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

export class AnthropicHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private provider: ReturnType<typeof createAnthropic>
	private readonly providerName = "Anthropic"
	private lastThoughtSignature: string | undefined
	private lastRedactedThinkingBlocks: Array<{ type: "redacted_thinking"; data: string }> = []

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

		// Reset thinking state for this request
		this.lastThoughtSignature = undefined
		this.lastRedactedThinkingBlocks = []

		// Convert messages to AI SDK format
		const aiSdkMessages = messages as ModelMessage[]

		// Convert tools to AI SDK format
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

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

		// Apply cache control to user messages
		// Strategy: cache the last 2 user messages (write-to-cache + read-from-cache)
		const cacheProviderOption = { anthropic: { cacheControl: { type: "ephemeral" as const } } }

		const userMsgIndices = messages.reduce(
			(acc, msg, index) => ("role" in msg && msg.role === "user" ? [...acc, index] : acc),
			[] as number[],
		)

		const targetIndices = new Set<number>()
		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastUserMsgIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

		if (lastUserMsgIndex >= 0) targetIndices.add(lastUserMsgIndex)
		if (secondLastUserMsgIndex >= 0) targetIndices.add(secondLastUserMsgIndex)

		if (targetIndices.size > 0) {
			this.applyCacheControlToAiSdkMessages(messages as ModelMessage[], targetIndices, cacheProviderOption)
		}

		// Build streamText request
		// Cast providerOptions to any to bypass strict JSONObject typing — the AI SDK accepts the correct runtime values
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: this.provider(modelConfig.id),
			system: systemPrompt,
			...({
				systemProviderOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
			} as Record<string, unknown>),
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
				// Capture thinking signature from stream events
				// The AI SDK's @ai-sdk/anthropic emits the signature as a reasoning-delta
				// event with providerMetadata.anthropic.signature
				const partAny = part as any
				if (partAny.providerMetadata?.anthropic?.signature) {
					this.lastThoughtSignature = partAny.providerMetadata.anthropic.signature
				}

				// Capture redacted thinking blocks from stream events
				if (partAny.providerMetadata?.anthropic?.redactedData) {
					this.lastRedactedThinkingBlocks.push({
						type: "redacted_thinking",
						data: partAny.providerMetadata.anthropic.redactedData,
					})
				}

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

		// Extract cache metrics from Anthropic's providerMetadata
		const anthropicMeta = providerMetadata?.anthropic as
			| { cacheCreationInputTokens?: number; cacheReadInputTokens?: number }
			| undefined
		const cacheWriteTokens = anthropicMeta?.cacheCreationInputTokens ?? 0
		const cacheReadTokens = anthropicMeta?.cacheReadInputTokens ?? 0

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

	/**
	 * Apply cacheControl providerOptions to the correct AI SDK messages by walking
	 * the original Anthropic messages and converted AI SDK messages in parallel.
	 *
	 * convertToAiSdkMessages() can split a single Anthropic user message (containing
	 * tool_results + text) into 2 AI SDK messages (tool role + user role). This method
	 * accounts for that split so cache control lands on the right message.
	 */
	private applyCacheControlToAiSdkMessages(
		aiSdkMessages: { role: string; providerOptions?: Record<string, Record<string, unknown>> }[],
		targetIndices: Set<number>,
		cacheProviderOption: Record<string, Record<string, unknown>>,
	): void {
		for (const idx of targetIndices) {
			if (idx >= 0 && idx < aiSdkMessages.length) {
				aiSdkMessages[idx].providerOptions = {
					...aiSdkMessages[idx].providerOptions,
					...cacheProviderOption,
				}
			}
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

	/**
	 * Returns the thinking signature captured from the last Anthropic response.
	 * Claude models with extended thinking return a cryptographic signature
	 * which must be round-tripped back for multi-turn conversations with tool use.
	 */
	getThoughtSignature(): string | undefined {
		return this.lastThoughtSignature
	}

	/**
	 * Returns any redacted thinking blocks captured from the last Anthropic response.
	 * Anthropic returns these when safety filters trigger on reasoning content.
	 */
	getRedactedThinkingBlocks(): Array<{ type: "redacted_thinking"; data: string }> | undefined {
		return this.lastRedactedThinkingBlocks.length > 0 ? this.lastRedactedThinkingBlocks : undefined
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
