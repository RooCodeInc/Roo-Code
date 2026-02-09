import * as os from "os"
import { v7 as uuidv7 } from "uuid"
import { createOpenAI } from "@ai-sdk/openai"
import { streamText, generateText, ToolSet } from "ai"

import {
	type ModelInfo,
	openAiCodexDefaultModelId,
	OpenAiCodexModelId,
	openAiCodexModels,
	type ReasoningEffortExtended,
	ApiProviderError,
} from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Package } from "../../shared/package"
import type { NeutralMessageParam } from "../../core/task-persistence"
import type { ApiHandlerOptions } from "../../shared/api"

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
import { openAiCodexOAuthManager } from "../../integrations/openai-codex/oauth"
import { t } from "../../i18n"

export type OpenAiCodexModel = ReturnType<OpenAiCodexHandler["getModel"]>

/**
 * OpenAI Codex base URL for API requests.
 * Per the implementation guide: requests are routed to chatgpt.com/backend-api/codex
 */
const CODEX_API_BASE_URL = "https://chatgpt.com/backend-api/codex"

/**
 * OpenAI Codex provider using the AI SDK (@ai-sdk/openai) with the Responses API.
 *
 * Key differences from OpenAiNativeHandler:
 * - Uses OAuth Bearer tokens instead of API keys
 * - Routes requests to Codex backend (chatgpt.com/backend-api/codex)
 * - Subscription-based pricing (no per-token costs, totalCost always 0)
 * - No temperature, max_output_tokens, or promptCacheRetention support
 * - Auth retry logic: attempt once, if 401/auth error → force token refresh → retry
 */
export class OpenAiCodexHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private readonly providerName = "OpenAI Codex"
	// Session ID for request tracking (persists for the lifetime of the handler)
	private readonly sessionId: string
	// Last response ID from Responses API
	private lastResponseId: string | undefined
	// Last encrypted reasoning content for stateless continuity
	private lastEncryptedContent: { encrypted_content: string; id?: string } | undefined

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.sessionId = uuidv7()
	}

	override getModel() {
		const modelId = this.options.apiModelId

		const id = modelId && modelId in openAiCodexModels ? (modelId as OpenAiCodexModelId) : openAiCodexDefaultModelId

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

	/**
	 * Retrieve OAuth credentials from the Codex OAuth manager.
	 * Throws a localized error if not authenticated.
	 */
	private async getOAuthCredentials(): Promise<{ token: string; accountId: string | null }> {
		const token = await openAiCodexOAuthManager.getAccessToken()
		if (!token) {
			throw new Error(
				t("common:errors.openAiCodex.notAuthenticated", {
					defaultValue:
						"Not authenticated with OpenAI Codex. Please sign in using the OpenAI Codex OAuth flow.",
				}),
			)
		}
		const accountId = await openAiCodexOAuthManager.getAccountId()
		return { token, accountId }
	}

	/**
	 * Create the AI SDK OpenAI provider with per-request OAuth headers.
	 * The Bearer token is passed as apiKey; additional Codex-specific headers
	 * include originator, session tracking, User-Agent, and ChatGPT-Account-Id.
	 */
	private createProvider(token: string, accountId: string | null, metadata?: ApiHandlerCreateMessageMetadata) {
		const taskId = metadata?.taskId
		const userAgent = `roo-code/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`

		return createOpenAI({
			apiKey: token,
			baseURL: CODEX_API_BASE_URL,
			headers: {
				originator: "roo-code",
				session_id: taskId || this.sessionId,
				"User-Agent": userAgent,
				...(accountId ? { "ChatGPT-Account-Id": accountId } : {}),
			},
		})
	}

	/**
	 * Get the reasoning effort for models that support it.
	 */
	private getReasoningEffort(model: OpenAiCodexModel): ReasoningEffortExtended | undefined {
		const selected =
			(this.options.reasoningEffort as ReasoningEffortExtended | undefined) ??
			(model.info.reasoningEffort as ReasoningEffortExtended | undefined)
		return selected && selected !== ("disable" as string) && selected !== ("none" as string) ? selected : undefined
	}

	/**
	 * Build the providerOptions for the Responses API.
	 * Codex-specific: no max_output_tokens, no promptCacheRetention, no temperature.
	 */
	private buildProviderOptions(
		model: OpenAiCodexModel,
		metadata?: ApiHandlerCreateMessageMetadata,
	): Record<string, unknown> {
		const reasoningEffort = this.getReasoningEffort(model)

		const opts: Record<string, unknown> = {
			// Always use stateless operation
			store: false,
			// Reasoning configuration
			...(reasoningEffort
				? {
						reasoningEffort,
						include: ["reasoning.encrypted_content"],
						reasoningSummary: "auto",
					}
				: {}),
			// Tool configuration
			parallelToolCalls: metadata?.parallelToolCalls ?? true,
			// NOTE: Codex backend rejects max_output_tokens and promptCacheRetention
		}

		return opts
	}

	/**
	 * Process usage metrics from the AI SDK response.
	 * Subscription-based pricing: totalCost is always 0.
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
	): ApiStreamUsageChunk {
		const openaiMeta = providerMetadata?.openai as Record<string, unknown> | undefined

		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0
		const cacheReadTokens = usage.details?.cachedInputTokens ?? (openaiMeta?.cachedInputTokens as number) ?? 0
		const cacheWriteTokens = (openaiMeta?.cacheCreationInputTokens as number) ?? 0
		const reasoningTokens = usage.details?.reasoningTokens

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens: cacheWriteTokens || undefined,
			cacheReadTokens: cacheReadTokens || undefined,
			...(typeof reasoningTokens === "number" ? { reasoningTokens } : {}),
			totalCost: 0, // Subscription-based pricing
		}
	}

	/**
	 * Check if an error is an authentication/authorization failure.
	 */
	private isAuthError(error: unknown): boolean {
		const message = error instanceof Error ? error.message : String(error)
		return /unauthorized|invalid token|not authenticated|authentication|401/i.test(message)
	}

	/**
	 * Create a streaming message with auth retry logic.
	 * Attempts once; if auth error, forces token refresh and retries.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		try {
			yield* this._createMessageImpl(systemPrompt, messages, metadata)
		} catch (error) {
			if (this.isAuthError(error)) {
				const refreshed = await openAiCodexOAuthManager.forceRefreshAccessToken()
				if (!refreshed) {
					throw new Error(
						t("common:errors.openAiCodex.notAuthenticated", {
							defaultValue:
								"Not authenticated with OpenAI Codex. Please sign in using the OpenAI Codex OAuth flow.",
						}),
					)
				}
				yield* this._createMessageImpl(systemPrompt, messages, metadata)
			} else {
				throw error
			}
		}
	}

	/**
	 * Internal streaming implementation using AI SDK streamText with Responses API.
	 */
	private async *_createMessageImpl(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()

		// Reset per-request state
		this.lastResponseId = undefined
		this.lastEncryptedContent = undefined

		const { token, accountId } = await this.getOAuthCredentials()
		const provider = this.createProvider(token, accountId, metadata)
		const languageModel = provider.responses(model.id)

		// Convert messages and tools to AI SDK format
		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		// Build provider options for Responses API features
		const openaiProviderOptions = this.buildProviderOptions(model, metadata)

		const result = streamText({
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			// NOTE: No temperature — Codex backend does not support it
			// NOTE: No maxOutputTokens — Codex backend rejects this parameter
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

			// Store response ID for getResponseId()
			if (openaiMeta?.responseId) {
				this.lastResponseId = openaiMeta.responseId as string
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

			// Yield usage metrics (subscription: totalCost always 0)
			if (usage) {
				yield this.processUsageMetrics(
					usage,
					providerMetadata as Record<string, Record<string, unknown>> | undefined,
				)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, model.id, "createMessage")
			TelemetryService.instance.captureException(apiError)
			throw handleAiSdkError(error, "OpenAI Codex")
		}
	}

	/**
	 * Complete a prompt with auth retry logic.
	 */
	async completePrompt(prompt: string): Promise<string> {
		try {
			return await this._completePromptImpl(prompt)
		} catch (error) {
			if (this.isAuthError(error)) {
				const refreshed = await openAiCodexOAuthManager.forceRefreshAccessToken()
				if (!refreshed) {
					throw new Error(
						t("common:errors.openAiCodex.notAuthenticated", {
							defaultValue:
								"Not authenticated with OpenAI Codex. Please sign in using the OpenAI Codex OAuth flow.",
						}),
					)
				}
				return this._completePromptImpl(prompt)
			}
			throw error
		}
	}

	/**
	 * Internal prompt completion implementation using AI SDK generateText.
	 */
	private async _completePromptImpl(prompt: string): Promise<string> {
		try {
			const model = this.getModel()
			const { token, accountId } = await this.getOAuthCredentials()
			const provider = this.createProvider(token, accountId)
			const languageModel = provider.responses(model.id)
			const openaiProviderOptions = this.buildProviderOptions(model)

			const { text } = await generateText({
				model: languageModel,
				prompt,
				// NOTE: No temperature — Codex backend does not support it
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
				throw new Error(t("common:errors.openAiCodex.completionError", { message: error.message }))
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
