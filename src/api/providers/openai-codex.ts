import * as os from "os"
import { v7 as uuidv7 } from "uuid"
import { Anthropic } from "@anthropic-ai/sdk"
import { createOpenAI } from "@ai-sdk/openai"
import { streamText, generateText, ToolSet, ModelMessage } from "ai"

import { Package } from "../../shared/package"
import {
	type ModelInfo,
	openAiCodexDefaultModelId,
	OpenAiCodexModelId,
	openAiCodexModels,
	type ReasoningEffortExtended,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { openAiCodexOAuthManager } from "../../integrations/openai-codex/oauth"
import type { RooMessage } from "../../core/task-persistence/rooMessage"
import {
	stripPlainTextReasoningBlocks,
	collectEncryptedReasoningItems,
	injectEncryptedReasoning,
} from "./openai-native"

export type OpenAiCodexModel = ReturnType<OpenAiCodexHandler["getModel"]>

/**
 * OpenAI Codex base URL for API requests.
 * Per the implementation guide: requests are routed to chatgpt.com/backend-api/codex
 */
const CODEX_API_BASE_URL = "https://chatgpt.com/backend-api/codex"

/**
 * Check whether an error looks like an authentication / authorization failure
 * so the caller can attempt a token refresh and retry.
 */
function isAuthFailure(error: unknown): boolean {
	if (error && typeof error === "object") {
		const status = (error as any).status ?? (error as any).statusCode
		if (status === 401 || status === 403) return true
		const msg = (error as any).message ?? ""
		if (/unauthorized|invalid.*token|expired.*token|auth/i.test(msg)) return true
	}
	return false
}

/**
 * OpenAiCodexHandler – Uses the AI SDK with the OpenAI Responses API and OAuth authentication.
 *
 * Key differences from OpenAiNativeHandler:
 * - Uses OAuth Bearer tokens instead of API keys
 * - Routes requests to Codex backend (chatgpt.com/backend-api/codex)
 * - Subscription-based pricing (no per-token costs → totalCost: 0)
 * - Limited model subset
 * - Custom headers for Codex backend
 * - Provider is created fresh per-request (OAuth tokens expire)
 */
export class OpenAiCodexHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private readonly providerName = "OpenAI Codex"
	private readonly sessionId: string

	private lastResponseId: string | undefined
	private lastEncryptedContent: { encrypted_content: string; id?: string } | undefined

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.sessionId = uuidv7()
	}

	/**
	 * Create a fresh AI SDK OpenAI provider for a single request.
	 * OAuth tokens can expire, so we never cache the provider instance.
	 */
	private async createProvider(accessToken: string, taskId?: string) {
		const accountId = await openAiCodexOAuthManager.getAccountId()
		return createOpenAI({
			apiKey: accessToken,
			baseURL: CODEX_API_BASE_URL,
			headers: {
				originator: "roo-code",
				session_id: taskId || this.sessionId,
				"User-Agent": `roo-code/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`,
				...(accountId ? { "ChatGPT-Account-Id": accountId } : {}),
			},
		})
	}

	/**
	 * Get the language model for the configured model ID.
	 * Uses the Responses API (default for @ai-sdk/openai since AI SDK 5).
	 */
	private getLanguageModel(provider: ReturnType<typeof createOpenAI>) {
		const { id } = this.getModel()
		return provider.responses(id)
	}

	private getReasoningEffort(model: OpenAiCodexModel): ReasoningEffortExtended | undefined {
		const selected = (this.options.reasoningEffort as any) ?? (model.info.reasoningEffort as any)
		return selected && selected !== "disable" && selected !== "none" ? (selected as any) : undefined
	}

	/**
	 * Build OpenAI-specific provider options for the Responses API.
	 */
	private buildProviderOptions(
		model: OpenAiCodexModel,
		metadata?: ApiHandlerCreateMessageMetadata,
		systemPrompt?: string,
	): Record<string, any> {
		const reasoningEffort = this.getReasoningEffort(model)

		const openaiOptions: Record<string, any> = {
			store: false,
			parallelToolCalls: metadata?.parallelToolCalls ?? true,
			...(systemPrompt !== undefined && { instructions: systemPrompt }),
		}

		if (reasoningEffort) {
			openaiOptions.reasoningEffort = reasoningEffort
			openaiOptions.include = ["reasoning.encrypted_content"]
			openaiOptions.reasoningSummary = "auto"
		}

		return { openai: openaiOptions }
	}

	/**
	 * Create a message stream using the AI SDK with auth-retry support.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()

		this.lastResponseId = undefined
		this.lastEncryptedContent = undefined

		// Get initial access token
		let accessToken = await openAiCodexOAuthManager.getAccessToken()
		if (!accessToken) {
			throw new Error("Not authenticated with OpenAI Codex. Please sign in using the OpenAI Codex OAuth flow.")
		}

		// Auth retry loop: 2 attempts max
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const provider = await this.createProvider(accessToken, metadata?.taskId)
				const languageModel = this.getLanguageModel(provider)

				// Step 1: Collect encrypted reasoning items and their positions before filtering.
				const encryptedReasoningItems = collectEncryptedReasoningItems(messages)

				// Step 2: Filter out standalone encrypted reasoning items (they lack role).
				const standardMessages = messages.filter(
					(msg) =>
						(msg as unknown as Record<string, unknown>).type !== "reasoning" ||
						!(msg as unknown as Record<string, unknown>).encrypted_content,
				)

				// Step 3: Strip plain-text reasoning blocks from assistant content arrays.
				const cleanedMessages = stripPlainTextReasoningBlocks(standardMessages)

				// Step 4: Convert to AI SDK messages.
				const aiSdkMessages = cleanedMessages as ModelMessage[]

				// Step 5: Re-inject encrypted reasoning as properly-formed AI SDK reasoning parts.
				if (encryptedReasoningItems.length > 0) {
					injectEncryptedReasoning(aiSdkMessages, encryptedReasoningItems, messages as RooMessage[])
				}

				// Convert tools to OpenAI format first, then to AI SDK format
				const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
				const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

				const providerOptions = this.buildProviderOptions(model, metadata, systemPrompt)

				// Note: maxOutputTokens is intentionally omitted — Codex backend rejects it.
				const result = streamText({
					model: languageModel,
					messages: aiSdkMessages,
					tools: aiSdkTools,
					toolChoice: mapToolChoice(metadata?.tool_choice),
					providerOptions,
					...(model.info.supportsTemperature !== false && {
						temperature: this.options.modelTemperature ?? 0,
					}),
				})

				// Stream parts
				let lastStreamError: string | undefined

				for await (const part of result.fullStream) {
					for (const chunk of processAiSdkStreamPart(part)) {
						if (chunk.type === "error") {
							lastStreamError = chunk.message
						}
						yield chunk
					}
				}

				// Extract metadata and usage — wrap in try/catch for stream error fallback
				try {
					// Extract metadata from completed response
					const providerMeta = await result.providerMetadata
					const openaiMeta = (providerMeta as any)?.openai

					if (openaiMeta?.responseId) {
						this.lastResponseId = openaiMeta.responseId
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

					// Yield usage — subscription pricing means totalCost is always 0
					const usage = await result.usage
					if (usage) {
						const inputTokens = usage.inputTokens || 0
						const outputTokens = usage.outputTokens || 0
						const details = (usage as any).details as
							| { cachedInputTokens?: number; reasoningTokens?: number }
							| undefined
						const cacheReadTokens = details?.cachedInputTokens ?? 0
						// The OpenAI Responses API does not report cache write tokens separately;
						// only cached (read) tokens are available via usage.details.cachedInputTokens.
						const cacheWriteTokens = 0
						const reasoningTokens = details?.reasoningTokens

						yield {
							type: "usage",
							inputTokens,
							outputTokens,
							cacheWriteTokens: cacheWriteTokens || undefined,
							cacheReadTokens: cacheReadTokens || undefined,
							...(typeof reasoningTokens === "number" ? { reasoningTokens } : {}),
							totalCost: 0, // Subscription-based pricing
						}
					}
				} catch (usageError) {
					if (lastStreamError) {
						throw new Error(lastStreamError)
					}
					throw usageError
				}

				// Success — exit the retry loop
				return
			} catch (error) {
				if (attempt === 0 && isAuthFailure(error)) {
					const refreshed = await openAiCodexOAuthManager.forceRefreshAccessToken()
					if (!refreshed) {
						throw new Error(
							"Not authenticated with OpenAI Codex. Please sign in using the OpenAI Codex OAuth flow.",
						)
					}
					accessToken = refreshed
					continue
				}
				throw handleAiSdkError(error, this.providerName)
			}
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

		const accessToken = await openAiCodexOAuthManager.getAccessToken()
		if (!accessToken) {
			throw new Error("Not authenticated with OpenAI Codex. Please sign in using the OpenAI Codex OAuth flow.")
		}

		try {
			const provider = await this.createProvider(accessToken)
			const languageModel = this.getLanguageModel(provider)
			const providerOptions = this.buildProviderOptions(model)

			// Note: maxOutputTokens is intentionally omitted — Codex backend rejects it.
			const { text } = await generateText({
				model: languageModel,
				prompt,
				providerOptions,
				...(model.info.supportsTemperature !== false && {
					temperature: this.options.modelTemperature ?? 0,
				}),
			})

			return text
		} catch (error) {
			throw handleAiSdkError(error, this.providerName)
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId

		let id = modelId && modelId in openAiCodexModels ? (modelId as OpenAiCodexModelId) : openAiCodexDefaultModelId

		const info: ModelInfo = openAiCodexModels[id]

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		return { id, info, ...params }
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
