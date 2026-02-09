import * as os from "os"
import { v7 as uuidv7 } from "uuid"
import { Anthropic } from "@anthropic-ai/sdk"
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
} from "@roo-code/types"

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
	): Record<string, any> {
		const reasoningEffort = this.getReasoningEffort(model)
		const promptCacheRetention = this.getPromptCacheRetention(model)

		const requestedTier = (this.options.openAiNativeServiceTier as ServiceTier | undefined) || undefined
		const allowedTierNames = new Set(model.info.tiers?.map((t) => t.name).filter(Boolean) || [])

		const openaiOptions: Record<string, any> = {
			store: false,
			parallelToolCalls: metadata?.parallelToolCalls ?? true,
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
		const cacheWriteTokens = providerMetadata?.openai?.cacheWriteTokens ?? 0
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

		const aiSdkMessages = convertToAiSdkMessages(messages)

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const taskId = metadata?.taskId
		const userAgent = `roo-code/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`
		const requestHeaders: Record<string, string> = {
			originator: "roo-code",
			session_id: taskId || this.sessionId,
			"User-Agent": userAgent,
		}

		const providerOptions = this.buildProviderOptions(model, metadata)

		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt,
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

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			const providerMeta = await result.providerMetadata
			const openaiMeta = (providerMeta as any)?.openai

			if (openaiMeta?.responseId) {
				this.lastResponseId = openaiMeta.responseId
			}
			if (openaiMeta?.serviceTier) {
				this.lastServiceTier = openaiMeta.serviceTier as ServiceTier
			}

			// Capture encrypted content from reasoning parts in the response
			try {
				const content = await (result as any).content
				if (Array.isArray(content)) {
					for (const part of content) {
						if (part.type === "reasoning" && part.providerMetadata) {
							const partMeta = (part.providerMetadata as any)?.openai
							if (partMeta?.reasoningEncryptedContent) {
								this.lastEncryptedContent = {
									encrypted_content: partMeta.reasoningEncryptedContent,
									...(partMeta.itemId ? { id: partMeta.itemId } : {}),
								}
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
				yield this.processUsageMetrics(usage, model, providerMeta as any)
			}
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
