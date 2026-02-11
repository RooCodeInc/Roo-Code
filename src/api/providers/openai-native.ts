import * as os from "os"
import { v7 as uuidv7 } from "uuid"
import { Anthropic } from "@anthropic-ai/sdk"
import { createOpenAI } from "@ai-sdk/openai"
import { streamText, generateText, ToolSet, type ModelMessage } from "ai"

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
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	consumeAiSdkStream,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

export type OpenAiNativeModel = ReturnType<OpenAiNativeHandler["getModel"]>

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
export function stripPlainTextReasoningBlocks(
	messages: Anthropic.Messages.MessageParam[],
): Anthropic.Messages.MessageParam[] {
	return messages.reduce<Anthropic.Messages.MessageParam[]>((acc, msg) => {
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
export function collectEncryptedReasoningItems(messages: Anthropic.Messages.MessageParam[]): EncryptedReasoningItem[] {
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
	originalMessages: Anthropic.Messages.MessageParam[],
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
 * OpenAI Native provider using the dedicated @ai-sdk/openai package.
 * Uses the OpenAI Responses API by default (AI SDK 5+).
 * Supports reasoning models, service tiers, verbosity control,
 * encrypted reasoning content, and prompt cache retention.
 */
export class OpenAiNativeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createOpenAI>
	private readonly providerName = "OpenAI Native"
	private readonly sessionId: string

	private lastResponseId: string | undefined
	private lastEncryptedContent: { encrypted_content: string; id?: string } | undefined
	private lastServiceTier: ServiceTier | undefined

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.sessionId = uuidv7()

		if (this.options.enableResponsesReasoningSummary === undefined) {
			this.options.enableResponsesReasoningSummary = true
		}

		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		const baseURL = this.options.openAiNativeBaseUrl || undefined
		const userAgent = `roo-code/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`

		this.provider = createOpenAI({
			apiKey,
			baseURL,
			headers: {
				originator: "roo-code",
				session_id: this.sessionId,
				"User-Agent": userAgent,
			},
		})
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

		return { id: id.startsWith("o3-mini") ? "o3-mini" : id, info, ...params, verbosity: params.verbosity }
	}

	/**
	 * Get the language model for the configured model ID.
	 * Uses the Responses API (default for @ai-sdk/openai since AI SDK 5).
	 */
	protected getLanguageModel() {
		const { id } = this.getModel()
		return this.provider.responses(id)
	}

	private getReasoningEffort(model: OpenAiNativeModel): ReasoningEffortExtended | undefined {
		const selected = (this.options.reasoningEffort as any) ?? (model.info.reasoningEffort as any)
		return selected && selected !== "disable" ? (selected as any) : undefined
	}

	/**
	 * Returns the appropriate prompt cache retention policy for the given model, if any.
	 */
	private getPromptCacheRetention(model: OpenAiNativeModel): "24h" | undefined {
		if (!model.info.supportsPromptCache) return undefined
		if (model.info.promptCacheRetention === "24h") return "24h"
		return undefined
	}

	/**
	 * Returns a shallow-cloned ModelInfo with pricing overridden for the given tier, if available.
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
	 * Build OpenAI-specific provider options for the Responses API.
	 */
	private buildProviderOptions(
		model: OpenAiNativeModel,
		metadata?: ApiHandlerCreateMessageMetadata,
		systemPrompt?: string,
	): Record<string, any> {
		const reasoningEffort = this.getReasoningEffort(model)
		const promptCacheRetention = this.getPromptCacheRetention(model)

		const requestedTier = (this.options.openAiNativeServiceTier as ServiceTier | undefined) || undefined
		const allowedTierNames = new Set(model.info.tiers?.map((t) => t.name).filter(Boolean) || [])

		const openaiOptions: Record<string, any> = {
			store: false,
			parallelToolCalls: metadata?.parallelToolCalls ?? true,
			...(systemPrompt !== undefined && { instructions: systemPrompt }),
		}

		if (reasoningEffort) {
			openaiOptions.reasoningEffort = reasoningEffort
			openaiOptions.include = ["reasoning.encrypted_content"]

			if (this.options.enableResponsesReasoningSummary) {
				openaiOptions.reasoningSummary = "auto"
			}
		}

		if (model.info.supportsVerbosity === true) {
			openaiOptions.textVerbosity = (model.verbosity || "medium") as VerbosityLevel
		}

		if (requestedTier && (requestedTier === "default" || allowedTierNames.has(requestedTier))) {
			openaiOptions.serviceTier = requestedTier
		}

		if (promptCacheRetention) {
			openaiOptions.promptCacheRetention = promptCacheRetention
		}

		return { openai: openaiOptions }
	}

	/**
	 * Process usage metrics from the AI SDK response, including OpenAI-specific
	 * cache metrics and service-tier-adjusted pricing.
	 */
	protected processUsageMetrics(
		usage: {
			inputTokens?: number
			outputTokens?: number
			details?: {
				cachedInputTokens?: number
				reasoningTokens?: number
			}
		},
		model: OpenAiNativeModel,
		providerMetadata?: Record<string, any>,
	): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0

		const cacheReadTokens = usage.details?.cachedInputTokens ?? 0
		// The OpenAI Responses API does not report cache write tokens separately;
		// only cached (read) tokens are available via usage.details.cachedInputTokens.
		const cacheWriteTokens = 0
		const reasoningTokens = usage.details?.reasoningTokens

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

	/**
	 * Get the max output tokens parameter.
	 */
	protected getMaxOutputTokens(): number | undefined {
		const model = this.getModel()
		return model.maxTokens ?? undefined
	}

	/**
	 * Create a message stream using the AI SDK.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()
		const languageModel = this.getLanguageModel()

		this.lastResponseId = undefined
		this.lastEncryptedContent = undefined
		this.lastServiceTier = undefined

		// Step 1: Collect encrypted reasoning items and their positions before filtering.
		// These are standalone items injected by buildCleanConversationHistory:
		// { type: "reasoning", encrypted_content: "...", id: "...", summary: [...] }
		const encryptedReasoningItems = collectEncryptedReasoningItems(messages)

		// Step 2: Filter out standalone encrypted reasoning items (they lack role
		// and would break convertToAiSdkMessages which expects user/assistant/tool).
		const standardMessages = messages.filter(
			(msg) =>
				(msg as unknown as Record<string, unknown>).type !== "reasoning" ||
				!(msg as unknown as Record<string, unknown>).encrypted_content,
		)

		// Step 3: Strip plain-text reasoning blocks from assistant content arrays.
		// These would be converted to AI SDK reasoning parts WITHOUT
		// providerOptions.openai.itemId, which the Responses provider rejects.
		const cleanedMessages = stripPlainTextReasoningBlocks(standardMessages)

		// Step 4: Convert to AI SDK messages.
		const aiSdkMessages = convertToAiSdkMessages(cleanedMessages)

		// Step 5: Re-inject encrypted reasoning as properly-formed AI SDK reasoning
		// parts with providerOptions.openai.itemId and reasoningEncryptedContent.
		if (encryptedReasoningItems.length > 0) {
			injectEncryptedReasoning(aiSdkMessages, encryptedReasoningItems, messages)
		}

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const taskId = metadata?.taskId
		const userAgent = `roo-code/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`
		const requestHeaders: Record<string, string> = {
			originator: "roo-code",
			session_id: taskId || this.sessionId,
			"User-Agent": userAgent,
		}

		const providerOptions = this.buildProviderOptions(model, metadata, systemPrompt)

		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			messages: aiSdkMessages,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			headers: requestHeaders,
			providerOptions,
			...(model.info.supportsTemperature !== false && {
				temperature: this.options.modelTemperature ?? OPENAI_NATIVE_DEFAULT_TEMPERATURE,
			}),
			...(model.maxTokens ? { maxOutputTokens: model.maxTokens } : {}),
		}

		const result = streamText(requestOptions)

		const processUsage = this.processUsageMetrics.bind(this)
		const setResponseId = (id: string) => {
			this.lastResponseId = id
		}
		const setServiceTier = (tier: ServiceTier) => {
			this.lastServiceTier = tier
		}
		const setEncryptedContent = (content: { encrypted_content: string; id?: string }) => {
			this.lastEncryptedContent = content
		}
		try {
			yield* consumeAiSdkStream(result, async function* () {
				const providerMeta = await result.providerMetadata
				const openaiMeta = providerMeta?.openai as Record<string, unknown> | undefined

				if (typeof openaiMeta?.responseId === "string") {
					setResponseId(openaiMeta.responseId)
				}
				if (typeof openaiMeta?.serviceTier === "string") {
					setServiceTier(openaiMeta.serviceTier as ServiceTier)
				}

				// Capture encrypted content from reasoning parts in the response
				try {
					const content = await (result as unknown as { content?: Promise<unknown[]> }).content
					if (Array.isArray(content)) {
						for (const part of content) {
							const p = part as Record<string, unknown>
							if (p.type === "reasoning" && p.providerMetadata) {
								const partMeta = (p.providerMetadata as Record<string, Record<string, unknown>>)?.openai
								if (typeof partMeta?.reasoningEncryptedContent === "string") {
									setEncryptedContent({
										encrypted_content: partMeta.reasoningEncryptedContent,
										...(typeof partMeta.itemId === "string" ? { id: partMeta.itemId } : {}),
									})
									break
								}
							}
						}
					}
				} catch {
					// Content parts with encrypted reasoning may not always be available
				}

				const usage = await result.usage
				if (usage) {
					yield processUsage(usage, model, providerMeta as Parameters<typeof processUsage>[2])
				}
			})
		} catch (error) {
			throw handleAiSdkError(error, this.providerName)
		}
	}

	/**
	 * Extracts encrypted_content and id from the last response's reasoning output.
	 */
	getEncryptedContent(): { encrypted_content: string; id?: string } | undefined {
		return this.lastEncryptedContent
	}

	getResponseId(): string | undefined {
		return this.lastResponseId
	}

	/**
	 * Complete a prompt using the AI SDK generateText.
	 */
	async completePrompt(prompt: string): Promise<string> {
		const model = this.getModel()
		const languageModel = this.getLanguageModel()
		const providerOptions = this.buildProviderOptions(model)

		try {
			const { text } = await generateText({
				model: languageModel,
				prompt,
				providerOptions,
				...(model.info.supportsTemperature !== false && {
					temperature: this.options.modelTemperature ?? OPENAI_NATIVE_DEFAULT_TEMPERATURE,
				}),
				...(model.maxTokens ? { maxOutputTokens: model.maxTokens } : {}),
			})

			return text
		} catch (error) {
			throw handleAiSdkError(error, this.providerName)
		}
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
