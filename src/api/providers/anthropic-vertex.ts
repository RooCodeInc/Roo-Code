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
} from "../transform/ai-sdk"
import { calculateApiCostAnthropic } from "../../shared/cost"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

// https://docs.anthropic.com/en/api/claude-on-vertex-ai
export class AnthropicVertexHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private provider: ReturnType<typeof createVertexAnthropic>
	private readonly providerName = "Vertex (Anthropic)"
	private lastThoughtSignature: string | undefined
	private lastRedactedThinkingBlocks: Array<{ type: "redacted_thinking"; data: string }> = []

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
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const modelConfig = this.getModel()

		// Reset thinking state for this request
		this.lastThoughtSignature = undefined
		this.lastRedactedThinkingBlocks = []

		// Convert messages to AI SDK format
		const aiSdkMessages = convertToAiSdkMessages(messages)

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

		/**
		 * Vertex API has specific limitations for prompt caching:
		 * 1. Maximum of 4 blocks can have cache_control
		 * 2. Only text blocks can be cached (images and other content types cannot)
		 * 3. Cache control can only be applied to user messages, not assistant messages
		 *
		 * Our caching strategy:
		 * - Cache the system prompt (1 block)
		 * - Cache the last text block of the second-to-last user message (1 block)
		 * - Cache the last text block of the last user message (1 block)
		 * This ensures we stay under the 4-block limit while maintaining effective caching
		 * for the most relevant context.
		 */
		const cacheProviderOption = { anthropic: { cacheControl: { type: "ephemeral" as const } } }

		const userMsgIndices = messages.reduce(
			(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
			[] as number[],
		)

		const targetIndices = new Set<number>()
		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastUserMsgIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

		if (lastUserMsgIndex >= 0) targetIndices.add(lastUserMsgIndex)
		if (secondLastUserMsgIndex >= 0) targetIndices.add(secondLastUserMsgIndex)

		if (targetIndices.size > 0) {
			this.applyCacheControlToAiSdkMessages(messages, aiSdkMessages, targetIndices, cacheProviderOption)
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
		originalMessages: Anthropic.Messages.MessageParam[],
		aiSdkMessages: { role: string; providerOptions?: Record<string, Record<string, unknown>> }[],
		targetOriginalIndices: Set<number>,
		cacheProviderOption: Record<string, Record<string, unknown>>,
	): void {
		let aiSdkIdx = 0
		for (let origIdx = 0; origIdx < originalMessages.length; origIdx++) {
			const origMsg = originalMessages[origIdx]

			if (typeof origMsg.content === "string") {
				if (targetOriginalIndices.has(origIdx) && aiSdkIdx < aiSdkMessages.length) {
					aiSdkMessages[aiSdkIdx].providerOptions = {
						...aiSdkMessages[aiSdkIdx].providerOptions,
						...cacheProviderOption,
					}
				}
				aiSdkIdx++
			} else if (origMsg.role === "user") {
				const hasToolResults = origMsg.content.some((part) => (part as { type: string }).type === "tool_result")
				const hasNonToolContent = origMsg.content.some(
					(part) => (part as { type: string }).type === "text" || (part as { type: string }).type === "image",
				)

				if (hasToolResults && hasNonToolContent) {
					const userMsgIdx = aiSdkIdx + 1
					if (targetOriginalIndices.has(origIdx) && userMsgIdx < aiSdkMessages.length) {
						aiSdkMessages[userMsgIdx].providerOptions = {
							...aiSdkMessages[userMsgIdx].providerOptions,
							...cacheProviderOption,
						}
					}
					aiSdkIdx += 2
				} else if (hasToolResults) {
					if (targetOriginalIndices.has(origIdx) && aiSdkIdx < aiSdkMessages.length) {
						aiSdkMessages[aiSdkIdx].providerOptions = {
							...aiSdkMessages[aiSdkIdx].providerOptions,
							...cacheProviderOption,
						}
					}
					aiSdkIdx++
				} else {
					if (targetOriginalIndices.has(origIdx) && aiSdkIdx < aiSdkMessages.length) {
						aiSdkMessages[aiSdkIdx].providerOptions = {
							...aiSdkMessages[aiSdkIdx].providerOptions,
							...cacheProviderOption,
						}
					}
					aiSdkIdx++
				}
			} else {
				aiSdkIdx++
			}
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
