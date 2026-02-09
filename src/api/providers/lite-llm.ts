import { streamText, generateText, ToolSet } from "ai"

import { litellmDefaultModelId, litellmDefaultModelInfo, type ModelInfo, type ModelRecord } from "@roo-code/types"

import type { NeutralMessageParam } from "../../core/task-persistence"
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
import { sanitizeOpenAiCallId } from "../../utils/tool-id"

import { OpenAICompatibleHandler, type OpenAICompatibleConfig } from "./openai-compatible"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"

/**
 * LiteLLM provider handler using AI SDK.
 *
 * Uses @ai-sdk/openai-compatible with transformRequestBody to handle
 * LiteLLM-specific wire-format requirements: prompt caching, Gemini
 * thought signatures, GPT-5 max_completion_tokens, and tool ID normalization.
 */
export class LiteLLMHandler extends OpenAICompatibleHandler {
	private models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		const modelId = options.litellmModelId ?? litellmDefaultModelId
		const cached = getModelsFromCache("litellm")
		const modelInfo = (cached && modelId && cached[modelId]) || litellmDefaultModelInfo

		const config: OpenAICompatibleConfig = {
			providerName: "litellm",
			baseURL: options.litellmBaseUrl || "http://localhost:4000",
			apiKey: options.litellmApiKey || "dummy-key",
			modelId,
			modelInfo,
		}

		super(options, config)
	}

	// ── Helper methods ──────────────────────────────────────────────

	private isGpt5(modelId: string): boolean {
		// Match gpt-5, gpt5, and variants like gpt-5o, gpt-5-turbo, gpt5-preview, gpt-5.1
		// Avoid matching gpt-50, gpt-500, etc.
		return /\bgpt-?5(?!\d)/i.test(modelId)
	}

	/**
	 * Detect if the model is a Gemini model that requires thought signature handling.
	 * Gemini 3 models validate thought signatures for tool/function calling steps.
	 */
	private isGeminiModel(modelId: string): boolean {
		const lowerModelId = modelId.toLowerCase()
		return (
			lowerModelId.includes("gemini-3") ||
			lowerModelId.includes("gemini-2.5") ||
			lowerModelId.includes("gemini 3") ||
			lowerModelId.includes("gemini 2.5") ||
			/\b(gemini|google|vertex_ai|vertex)\/gemini[-\s](3|2\.5)/i.test(modelId)
		)
	}

	/**
	 * Inject thought signatures for Gemini models via provider_specific_fields.
	 * Operates on OpenAI-format messages in the wire request body.
	 *
	 * Per LiteLLM documentation:
	 * - The dummy signature base64("skip_thought_signature_validator") bypasses validation
	 * - Injected on EVERY tool call to ensure Gemini doesn't reject tool calls from other models
	 */
	private injectThoughtSignatureForGemini(messages: Record<string, unknown>[]): Record<string, unknown>[] {
		const dummySignature = Buffer.from("skip_thought_signature_validator").toString("base64")

		return messages.map((msg) => {
			if (msg.role === "assistant") {
				const toolCalls = msg.tool_calls as Record<string, unknown>[] | undefined
				if (toolCalls && toolCalls.length > 0) {
					const updatedToolCalls = toolCalls.map((tc) => ({
						...tc,
						provider_specific_fields: {
							...((tc.provider_specific_fields as Record<string, unknown>) || {}),
							thought_signature: dummySignature,
						},
					}))
					return { ...msg, tool_calls: updatedToolCalls }
				}
			}
			return msg
		})
	}

	/**
	 * Apply prompt caching to wire-format messages.
	 * Adds cache_control: { type: "ephemeral" } to system message and last 2 user messages.
	 */
	private applyPromptCaching(messages: Record<string, unknown>[]): Record<string, unknown>[] {
		const result = messages.map((msg, index) => {
			// Apply cache control to system message (always first)
			if (index === 0 && msg.role === "system") {
				const content =
					typeof msg.content === "string"
						? [{ type: "text", text: msg.content, cache_control: { type: "ephemeral" } }]
						: msg.content
				return { ...msg, content }
			}
			return msg
		})

		// Find last 2 user messages and apply cache control
		const userMsgIndices = result.reduce(
			(acc: number[], msg, index) => (msg.role === "user" ? [...acc, index] : acc),
			[],
		)
		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastUserMsgIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

		return result.map((msg, index) => {
			if ((index === lastUserMsgIndex || index === secondLastUserMsgIndex) && msg.role === "user") {
				if (typeof msg.content === "string") {
					return {
						...msg,
						content: [{ type: "text", text: msg.content, cache_control: { type: "ephemeral" } }],
					}
				} else if (Array.isArray(msg.content)) {
					return {
						...msg,
						content: (msg.content as Record<string, unknown>[]).map(
							(content: Record<string, unknown>, contentIndex: number) =>
								contentIndex === (msg.content as unknown[]).length - 1
									? { ...content, cache_control: { type: "ephemeral" } }
									: content,
						),
					}
				}
			}
			return msg
		})
	}

	/**
	 * Sanitize tool call IDs in wire-format messages for Bedrock compatibility.
	 */
	private sanitizeToolCallIds(messages: Record<string, unknown>[]): Record<string, unknown>[] {
		return messages.map((msg) => {
			if (msg.role === "assistant" && msg.tool_calls) {
				return {
					...msg,
					tool_calls: (msg.tool_calls as Record<string, unknown>[]).map((tc) => ({
						...tc,
						id: sanitizeOpenAiCallId(tc.id as string),
					})),
				}
			}
			if (msg.role === "tool" && msg.tool_call_id) {
				return {
					...msg,
					tool_call_id: sanitizeOpenAiCallId(msg.tool_call_id as string),
				}
			}
			return msg
		})
	}

	// ── Model resolution ────────────────────────────────────────────

	public async fetchModel() {
		this.models = await getModels({
			provider: "litellm",
			apiKey: this.config.apiKey,
			baseUrl: this.config.baseURL,
		})
		const model = this.getModel()
		this.config.modelInfo = model.info
		return model
	}

	override getModel() {
		const id = this.options.litellmModelId ?? litellmDefaultModelId
		const cached = getModelsFromCache("litellm")
		const info: ModelInfo = (cached && id && cached[id]) || this.models[id] || litellmDefaultModelInfo

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		return { id, info, ...params }
	}

	// ── Custom language model with transformRequestBody ─────────────

	/**
	 * Create a language model with transformRequestBody for LiteLLM-specific
	 * wire-format modifications (GPT-5 tokens, Gemini signatures, caching, tool IDs).
	 */
	private createLiteLLMModel(modelId: string) {
		const isGemini = this.isGeminiModel(modelId)
		const isGPT5 = this.isGpt5(modelId)
		const usePromptCache = !!(this.options.litellmUsePromptCache && this.config.modelInfo.supportsPromptCache)

		return this.provider.languageModel(modelId, {
			transformRequestBody: (body: Record<string, unknown>) => {
				const modified = { ...body }

				// GPT-5: use max_completion_tokens instead of max_tokens
				if (isGPT5 && modified.max_tokens !== undefined) {
					modified.max_completion_tokens = modified.max_tokens
					delete modified.max_tokens
				}

				if (modified.messages && Array.isArray(modified.messages)) {
					let messages = [...(modified.messages as Record<string, unknown>[])]

					// Sanitize tool call IDs for Bedrock compatibility
					messages = this.sanitizeToolCallIds(messages)

					// Inject thought signatures for Gemini models
					if (isGemini) {
						messages = this.injectThoughtSignatureForGemini(messages)
					}

					// Apply prompt caching
					if (usePromptCache) {
						messages = this.applyPromptCaching(messages)
					}

					modified.messages = messages
				}

				return modified
			},
		})
	}

	// ── API methods ─────────────────────────────────────────────────

	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.fetchModel()
		const model = this.getModel()
		const languageModel = this.createLiteLLMModel(model.id)

		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const result = streamText({
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature: model.temperature ?? 0,
			maxOutputTokens: model.maxTokens,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
		})

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			const usage = await result.usage
			if (usage) {
				yield this.processUsageMetrics(usage)
			}
		} catch (error) {
			throw handleAiSdkError(error, this.config.providerName)
		}
	}

	override async completePrompt(prompt: string): Promise<string> {
		await this.fetchModel()
		const model = this.getModel()
		const languageModel = this.createLiteLLMModel(model.id)

		const { text } = await generateText({
			model: languageModel,
			prompt,
			maxOutputTokens: model.maxTokens,
			temperature: model.temperature ?? 0,
		})

		return text
	}

	// ── Usage metrics ───────────────────────────────────────────────

	protected override processUsageMetrics(usage: {
		inputTokens?: number
		outputTokens?: number
		details?: { cachedInputTokens?: number; reasoningTokens?: number }
		raw?: Record<string, unknown>
	}): ApiStreamUsageChunk {
		const rawUsage = usage.raw as LiteLLMRawUsage | undefined

		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0
		const cacheWriteTokens = rawUsage?.cache_creation_input_tokens || rawUsage?.prompt_cache_miss_tokens || 0
		const cacheReadTokens =
			rawUsage?.prompt_tokens_details?.cached_tokens ||
			rawUsage?.cache_read_input_tokens ||
			rawUsage?.prompt_cache_hit_tokens ||
			usage.details?.cachedInputTokens ||
			0

		const modelInfo = this.getModel().info
		const { totalCost } = calculateApiCostOpenAI(
			modelInfo,
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
}

/** LiteLLM raw usage data with cache-related fields */
interface LiteLLMRawUsage {
	prompt_tokens?: number
	completion_tokens?: number
	cache_creation_input_tokens?: number
	cache_read_input_tokens?: number
	prompt_cache_miss_tokens?: number
	prompt_cache_hit_tokens?: number
	prompt_tokens_details?: { cached_tokens?: number }
}
