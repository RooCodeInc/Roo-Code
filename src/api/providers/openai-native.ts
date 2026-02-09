import * as os from "os"
import { v7 as uuidv7 } from "uuid"
import { createOpenAI } from "@ai-sdk/openai"
import { streamText, generateText, ToolSet } from "ai"

import { Package } from "../../shared/package"
import {
	type ModelInfo,
	openAiNativeDefaultModelId,
	OpenAiNativeModelId,
	openAiNativeModels,
	OPENAI_NATIVE_DEFAULT_TEMPERATURE,
	type VerbosityLevel,
	type ReasoningEffortExtended,
	type ServiceTier,
	ApiProviderError,
} from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import type { NeutralMessageParam } from "../../core/task-persistence"
import type { ModelMessage } from "ai"
import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

export type OpenAiNativeModel = ReturnType<OpenAiNativeHandler["getModel"]>

// ---------------------------------------------------------------------------
// Encrypted reasoning helpers (used by createMessage for OpenAI Responses API)
// ---------------------------------------------------------------------------

/**
 * An encrypted reasoning item extracted from the conversation history.
 * These are standalone items injected by `buildCleanConversationHistory` with
 * `{ type: "reasoning", encrypted_content: "...", id: "...", summary: [...] }`.
 */
export interface EncryptedReasoningItem {
	id: string
	encrypted_content: string
	summary?: Array<{ type: string; text: string }>
	originalIndex: number
}

/**
 * Strip plain-text reasoning blocks from assistant message content arrays.
 *
 * Plain-text reasoning blocks (`{ type: "reasoning", text: "..." }`) inside
 * assistant content arrays would be converted by `convertToAiSdkMessages`
 * into AI SDK reasoning parts WITHOUT `providerOptions.openai.itemId`.
 * The `@ai-sdk/openai` Responses provider rejects those with console warnings.
 *
 * This function removes them BEFORE conversion. If an assistant message's
 * content becomes empty after filtering, the message is removed entirely.
 */
export function stripPlainTextReasoningBlocks(messages: NeutralMessageParam[]): NeutralMessageParam[] {
	return messages.reduce<NeutralMessageParam[]>((acc, msg) => {
		if (msg.role !== "assistant" || typeof msg.content === "string") {
			acc.push(msg)
			return acc
		}

		const filteredContent = msg.content.filter((block) => {
			const b = block as unknown as Record<string, unknown>
			// Remove blocks that are plain-text reasoning:
			// type === "reasoning" AND has "text" AND does NOT have "encrypted_content"
			if (b.type === "reasoning" && typeof b.text === "string" && !b.encrypted_content) {
				return false
			}
			return true
		})

		// Only include the message if it still has content
		if (filteredContent.length > 0) {
			acc.push({ ...msg, content: filteredContent })
		}

		return acc
	}, [])
}

/**
 * Collect encrypted reasoning items from the messages array.
 *
 * These are standalone items with `type: "reasoning"` and `encrypted_content`,
 * injected by `buildCleanConversationHistory` for OpenAI Responses API
 * reasoning continuity.
 */
export function collectEncryptedReasoningItems(messages: NeutralMessageParam[]): EncryptedReasoningItem[] {
	const items: EncryptedReasoningItem[] = []
	messages.forEach((msg, index) => {
		const m = msg as unknown as Record<string, unknown>
		if (m.type === "reasoning" && m.encrypted_content) {
			items.push({
				id: m.id as string,
				encrypted_content: m.encrypted_content as string,
				summary: m.summary as Array<{ type: string; text: string }> | undefined,
				originalIndex: index,
			})
		}
	})
	return items
}

/**
 * Inject encrypted reasoning parts into AI SDK messages.
 *
 * For each encrypted reasoning item, a reasoning part (with
 * `providerOptions.openai.itemId` and `reasoningEncryptedContent`) is injected
 * at the **beginning** of the next assistant message's content in the AI SDK
 * messages array.
 *
 * @param aiSdkMessages  - The converted AI SDK messages (mutated in place).
 * @param encryptedItems - Encrypted reasoning items with their original indices.
 * @param originalMessages - The original (unfiltered) messages array, used to
 *   determine which assistant message each encrypted item precedes.
 */
export function injectEncryptedReasoning(
	aiSdkMessages: ModelMessage[],
	encryptedItems: EncryptedReasoningItem[],
	originalMessages: NeutralMessageParam[],
): void {
	if (encryptedItems.length === 0) return

	// Map: original-array index of an assistant message -> encrypted items that precede it.
	const itemsByAssistantOrigIdx = new Map<number, EncryptedReasoningItem[]>()

	for (const item of encryptedItems) {
		// Walk forward from the encrypted item to find its corresponding assistant message,
		// skipping over any other encrypted reasoning items.
		for (let i = item.originalIndex + 1; i < originalMessages.length; i++) {
			const msg = originalMessages[i] as unknown as Record<string, unknown>
			if (msg.type === "reasoning" && msg.encrypted_content) continue
			if ((msg as { role?: string }).role === "assistant") {
				const existing = itemsByAssistantOrigIdx.get(i) || []
				existing.push(item)
				itemsByAssistantOrigIdx.set(i, existing)
				break
			}
			// Non-assistant, non-encrypted message — keep searching
		}
	}

	if (itemsByAssistantOrigIdx.size === 0) return

	// Collect the original indices of assistant messages that remain after
	// encrypted reasoning items have been filtered out (order preserved).
	const standardAssistantOriginalIndices: number[] = []
	for (let i = 0; i < originalMessages.length; i++) {
		const msg = originalMessages[i] as unknown as Record<string, unknown>
		if (msg.type === "reasoning" && msg.encrypted_content) continue
		if ((msg as { role?: string }).role === "assistant") {
			standardAssistantOriginalIndices.push(i)
		}
	}

	// Collect assistant-role indices in the AI SDK messages array.
	const aiSdkAssistantIndices: number[] = []
	for (let i = 0; i < aiSdkMessages.length; i++) {
		if (aiSdkMessages[i].role === "assistant") {
			aiSdkAssistantIndices.push(i)
		}
	}

	// Match: Nth standard assistant (by original index) -> Nth AI SDK assistant.
	for (let n = 0; n < standardAssistantOriginalIndices.length && n < aiSdkAssistantIndices.length; n++) {
		const origIdx = standardAssistantOriginalIndices[n]
		const items = itemsByAssistantOrigIdx.get(origIdx)
		if (!items || items.length === 0) continue

		const aiIdx = aiSdkAssistantIndices[n]
		const msg = aiSdkMessages[aiIdx] as Record<string, unknown>
		const content = Array.isArray(msg.content) ? (msg.content as unknown[]) : []

		const reasoningParts = items.map((item) => ({
			type: "reasoning" as const,
			text: item.summary?.map((s) => s.text).join("\n") || "",
			providerOptions: {
				openai: {
					itemId: item.id,
					reasoningEncryptedContent: item.encrypted_content,
				},
			},
		}))

		msg.content = [...reasoningParts, ...content]
	}
}

/**
 * OpenAI Native provider using the AI SDK (@ai-sdk/openai) with the Responses API.
 * Supports GPT-4o/4.1, o-series reasoning models, GPT-5 family, and Codex models.
 */
export class OpenAiNativeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private readonly providerName = "OpenAI Native"
	// Session ID for request tracking (persists for the lifetime of the handler)
	private readonly sessionId: string
	// Resolved service tier from last response
	private lastServiceTier: ServiceTier | undefined
	// Last response ID from Responses API
	private lastResponseId: string | undefined
	// Last encrypted reasoning content for stateless continuity
	private lastEncryptedContent: { encrypted_content: string; id?: string } | undefined

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.sessionId = uuidv7()
		// Default to including reasoning summaries unless explicitly disabled
		if (this.options.enableResponsesReasoningSummary === undefined) {
			this.options.enableResponsesReasoningSummary = true
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId

		const id =
			modelId && modelId in openAiNativeModels ? (modelId as OpenAiNativeModelId) : openAiNativeDefaultModelId

		const info: ModelInfo = openAiNativeModels[id]

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: OPENAI_NATIVE_DEFAULT_TEMPERATURE,
		})

		// The o3-mini models are named like "o3-mini-[reasoning-effort]",
		// which are not valid model ids, so strip the suffix.
		return { id: id.startsWith("o3-mini") ? "o3-mini" : id, info, ...params, verbosity: params.verbosity }
	}

	override isAiSdkProvider(): boolean {
		return true
	}

	/**
	 * Create the AI SDK OpenAI provider with per-request headers.
	 * Headers include session tracking, originator, and User-Agent.
	 */
	private createProvider(metadata?: ApiHandlerCreateMessageMetadata) {
		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		const baseUrl = this.options.openAiNativeBaseUrl
		const taskId = metadata?.taskId
		const userAgent = `roo-code/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`

		return createOpenAI({
			apiKey,
			baseURL: baseUrl || undefined,
			headers: {
				originator: "roo-code",
				session_id: taskId || this.sessionId,
				"User-Agent": userAgent,
			},
		})
	}

	/**
	 * Get the reasoning effort for models that support it.
	 */
	private getReasoningEffort(model: OpenAiNativeModel): ReasoningEffortExtended | undefined {
		const selected =
			(this.options.reasoningEffort as ReasoningEffortExtended | undefined) ??
			(model.info.reasoningEffort as ReasoningEffortExtended | undefined)
		return selected && selected !== ("disable" as string) ? selected : undefined
	}

	/**
	 * Returns the appropriate prompt cache retention policy for the given model.
	 */
	private getPromptCacheRetention(model: OpenAiNativeModel): "24h" | undefined {
		if (!model.info.supportsPromptCache) return undefined
		if (model.info.promptCacheRetention === "24h") return "24h"
		return undefined
	}

	/**
	 * Returns a shallow-cloned ModelInfo with pricing overridden for the given tier.
	 */
	private applyServiceTierPricing(info: ModelInfo, tier?: ServiceTier): ModelInfo {
		if (!tier || tier === "default") return info
		const tierInfo = info.tiers?.find((t) => t.name === tier)
		if (!tierInfo) return info
		return {
			...info,
			inputPrice: tierInfo.inputPrice ?? info.inputPrice,
			outputPrice: tierInfo.outputPrice ?? info.outputPrice,
			cacheReadsPrice: tierInfo.cacheReadsPrice ?? info.cacheReadsPrice,
			cacheWritesPrice: tierInfo.cacheWritesPrice ?? info.cacheWritesPrice,
		}
	}

	/**
	 * Build the providerOptions for the Responses API.
	 * Maps all Roo-specific settings to AI SDK's OpenAIResponsesProviderOptions.
	 */
	private buildProviderOptions(
		model: OpenAiNativeModel,
		metadata?: ApiHandlerCreateMessageMetadata,
	): Record<string, unknown> {
		const { verbosity } = model
		const reasoningEffort = this.getReasoningEffort(model)
		const promptCacheRetention = this.getPromptCacheRetention(model)

		// Validate service tier against model support
		const requestedTier = (this.options.openAiNativeServiceTier as ServiceTier | undefined) || undefined
		const allowedTierNames = new Set(model.info.tiers?.map((t) => t.name).filter(Boolean) || [])

		const opts: Record<string, unknown> = {
			// Always use stateless operation
			store: false,
			// Reasoning configuration
			...(reasoningEffort
				? {
						reasoningEffort,
						include: ["reasoning.encrypted_content"],
					}
				: {}),
			...(reasoningEffort && this.options.enableResponsesReasoningSummary ? { reasoningSummary: "auto" } : {}),
			// Service tier
			...(requestedTier && (requestedTier === "default" || allowedTierNames.has(requestedTier))
				? { serviceTier: requestedTier }
				: {}),
			// Verbosity for GPT-5 models
			...(model.info.supportsVerbosity === true
				? { textVerbosity: (verbosity || "medium") as VerbosityLevel }
				: {}),
			// Prompt cache retention
			...(promptCacheRetention ? { promptCacheRetention } : {}),
			// Tool configuration
			parallelToolCalls: metadata?.parallelToolCalls ?? true,
		}

		return opts
	}

	/**
	 * Process usage metrics from the AI SDK response with cost calculation.
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
		providerMetadata: Record<string, Record<string, unknown>> | undefined,
		model: OpenAiNativeModel,
	): ApiStreamUsageChunk {
		const openaiMeta = providerMetadata?.openai as Record<string, unknown> | undefined

		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0
		const cacheReadTokens = usage.details?.cachedInputTokens ?? (openaiMeta?.cachedInputTokens as number) ?? 0
		const cacheWriteTokens = (openaiMeta?.cacheCreationInputTokens as number) ?? 0
		const reasoningTokens = usage.details?.reasoningTokens

		// Calculate cost with service tier pricing
		const effectiveTier =
			this.lastServiceTier || (this.options.openAiNativeServiceTier as ServiceTier | undefined) || undefined
		const effectiveInfo = this.applyServiceTierPricing(model.info, effectiveTier)
		const { totalCost } = calculateApiCostOpenAI(
			effectiveInfo,
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
		)

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens: cacheWriteTokens || undefined,
			cacheReadTokens: cacheReadTokens || undefined,
			...(typeof reasoningTokens === "number" ? { reasoningTokens } : {}),
			totalCost,
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()

		// Reset per-request state
		this.lastServiceTier = undefined
		this.lastResponseId = undefined
		this.lastEncryptedContent = undefined

		const provider = this.createProvider(metadata)
		const languageModel = provider.responses(model.id)

		// Convert messages and tools to AI SDK format
		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		// Build provider options for Responses API features
		const openaiProviderOptions = this.buildProviderOptions(model, metadata)

		// Determine temperature (some models like GPT-5 don't support it)
		const temperature =
			model.info.supportsTemperature !== false
				? (this.options.modelTemperature ?? OPENAI_NATIVE_DEFAULT_TEMPERATURE)
				: undefined

		const result = streamText({
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature,
			maxOutputTokens: model.maxTokens || undefined,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			providerOptions: {
				openai: openaiProviderOptions as Record<string, string>,
			},
		})

		try {
			// Process the full stream
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			// Extract provider metadata after streaming
			const usage = await result.usage
			const providerMetadata = await result.providerMetadata
			const openaiMeta = (providerMetadata as Record<string, Record<string, unknown>> | undefined)?.openai

			// Store response ID and service tier for getResponseId() / cost calculation
			if (openaiMeta?.responseId) {
				this.lastResponseId = openaiMeta.responseId as string
			}
			if (openaiMeta?.serviceTier) {
				this.lastServiceTier = openaiMeta.serviceTier as ServiceTier
			}

			// Extract encrypted reasoning content from response for stateless continuity
			try {
				const response = await result.response
				if (response?.messages) {
					for (const message of response.messages) {
						if (!Array.isArray(message.content)) continue
						for (const contentPart of message.content) {
							if (contentPart.type === "reasoning") {
								const reasoningMeta = (
									contentPart as {
										providerMetadata?: {
											openai?: {
												itemId?: string
												reasoningEncryptedContent?: string
											}
										}
									}
								).providerMetadata?.openai
								if (reasoningMeta?.reasoningEncryptedContent) {
									this.lastEncryptedContent = {
										encrypted_content: reasoningMeta.reasoningEncryptedContent,
										...(reasoningMeta.itemId ? { id: reasoningMeta.itemId } : {}),
									}
								}
							}
						}
					}
				}
			} catch {
				// Encrypted content extraction is best-effort
			}

			// Yield usage metrics with cost calculation
			if (usage) {
				yield this.processUsageMetrics(
					usage,
					providerMetadata as Record<string, Record<string, unknown>> | undefined,
					model,
				)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, model.id, "createMessage")
			TelemetryService.instance.captureException(apiError)
			throw handleAiSdkError(error, "OpenAI Native")
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const model = this.getModel()
			const provider = this.createProvider()
			const languageModel = provider.responses(model.id)
			const openaiProviderOptions = this.buildProviderOptions(model)

			const temperature =
				model.info.supportsTemperature !== false
					? (this.options.modelTemperature ?? OPENAI_NATIVE_DEFAULT_TEMPERATURE)
					: undefined

			const { text } = await generateText({
				model: languageModel,
				prompt,
				temperature,
				maxOutputTokens: model.maxTokens || undefined,
				providerOptions: {
					openai: openaiProviderOptions as Record<string, string>,
				},
			})

			return text
		} catch (error) {
			const errorModel = this.getModel()
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, errorModel.id, "completePrompt")
			TelemetryService.instance.captureException(apiError)

			if (error instanceof Error) {
				throw new Error(`OpenAI Native completion error: ${error.message}`)
			}
			throw error
		}
	}

	/**
	 * Extracts encrypted_content from the last response's reasoning items.
	 * Used for stateless API continuity across requests.
	 */
	getEncryptedContent(): { encrypted_content: string; id?: string } | undefined {
		return this.lastEncryptedContent
	}

	/**
	 * Returns the last response ID from the Responses API.
	 */
	getResponseId(): string | undefined {
		return this.lastResponseId
	}
}
