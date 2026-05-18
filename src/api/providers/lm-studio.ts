import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import axios from "axios"

import { type ModelInfo, openAiModelInfoSaneDefaults, LMSTUDIO_DEFAULT_TEMPERATURE } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { NativeToolCallParser } from "../../core/assistant-message/NativeToolCallParser"
import { TagMatcher } from "../../utils/tag-matcher"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToZAiFormat } from "../transform/zai-format"
import { ApiStream } from "../transform/stream"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { getModelsFromCache } from "./fetchers/modelCache"
import { getApiRequestTimeout } from "./utils/timeout-config"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { detectGlmModel, logGlmDetection, type GlmModelConfig } from "./utils/glm-model-detection"

export class LmStudioHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private readonly providerName = "LM Studio"
	private glmConfig: GlmModelConfig

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// LM Studio uses "noop" as a placeholder API key
		const apiKey = "noop"

		this.client = new OpenAI({
			baseURL: (this.options.lmStudioBaseUrl || "http://localhost:1234") + "/v1",
			apiKey: apiKey,
			timeout: getApiRequestTimeout(),
		})

		// Detect if this is a GLM model and apply optimizations
		this.glmConfig = detectGlmModel(this.options.lmStudioModelId)
		if (this.options.lmStudioModelId) {
			logGlmDetection(this.providerName, this.options.lmStudioModelId, this.glmConfig)
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// For GLM models, use Z.ai format with mergeToolResultText to prevent conversation flow disruption
		// For other models, use standard OpenAI format
		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[]
		if (this.glmConfig.isGlm && this.glmConfig.mergeToolResultText) {
			// Use Z.ai format converter which merges text after tool results into tool messages
			const convertedMessages = convertToZAiFormat(messages, { mergeToolResultText: true })
			openAiMessages = [{ role: "system", content: systemPrompt }, ...convertedMessages]
		} else {
			openAiMessages = [
				{ role: "system", content: systemPrompt },
				...convertToOpenAiMessages(messages),
			]
		}

		// -------------------------
		// Track token usage
		// -------------------------
		const toContentBlocks = (
			blocks: Anthropic.Messages.MessageParam[] | string,
		): Anthropic.Messages.ContentBlockParam[] => {
			if (typeof blocks === "string") {
				return [{ type: "text", text: blocks }]
			}

			const result: Anthropic.Messages.ContentBlockParam[] = []
			for (const msg of blocks) {
				if (typeof msg.content === "string") {
					result.push({ type: "text", text: msg.content })
				} else if (Array.isArray(msg.content)) {
					for (const part of msg.content) {
						if (part.type === "text") {
							result.push({ type: "text", text: part.text })
						}
					}
				}
			}
			return result
		}

		let inputTokens = 0
		try {
			inputTokens = await this.countTokens([{ type: "text", text: systemPrompt }, ...toContentBlocks(messages)])
		} catch (err) {
			console.error("[LmStudio] Failed to count input tokens:", err)
			inputTokens = 0
		}

		let assistantText = ""

		try {
			// Determine temperature: use GLM default (0.6) for GLM models, otherwise LM Studio default (0)
			const temperature = this.options.modelTemperature ??
				(this.glmConfig.isGlm ? this.glmConfig.temperature : LMSTUDIO_DEFAULT_TEMPERATURE)

			// For GLM models, disable parallel_tool_calls as GLM models may not support it
			const parallelToolCalls = this.glmConfig.isGlm && this.glmConfig.disableParallelToolCalls
				? false
				: (metadata?.parallelToolCalls ?? true)

			if (this.glmConfig.isGlm && this.glmConfig.disableParallelToolCalls) {
				console.log(`[${this.providerName}] parallel_tool_calls disabled for GLM model`)
			}

			const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming & { draft_model?: string } = {
				model: this.getModel().id,
				messages: openAiMessages,
				temperature,
				stream: true,
				tools: this.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: parallelToolCalls,
			}

			if (this.options.lmStudioSpeculativeDecodingEnabled && this.options.lmStudioDraftModelId) {
				params.draft_model = this.options.lmStudioDraftModelId
			}

			let results
			try {
				results = await this.client.chat.completions.create(params)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			const matcher = new TagMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)

			for await (const chunk of results) {
				const delta = chunk.choices[0]?.delta
				const finishReason = chunk.choices[0]?.finish_reason

				if (delta?.content) {
					assistantText += delta.content
					for (const processedChunk of matcher.update(delta.content)) {
						yield processedChunk
					}
				}

				// Handle tool calls in stream - emit partial chunks for NativeToolCallParser
				if (delta?.tool_calls) {
					for (const toolCall of delta.tool_calls) {
						yield {
							type: "tool_call_partial",
							index: toolCall.index,
							id: toolCall.id,
							name: toolCall.function?.name,
							arguments: toolCall.function?.arguments,
						}
					}
				}

				// Process finish_reason to emit tool_call_end events
				if (finishReason) {
					const endEvents = NativeToolCallParser.processFinishReason(finishReason)
					for (const event of endEvents) {
						yield event
					}
				}
			}

			for (const processedChunk of matcher.final()) {
				yield processedChunk
			}

			let outputTokens = 0
			try {
				outputTokens = await this.countTokens([{ type: "text", text: assistantText }])
			} catch (err) {
				console.error("[LmStudio] Failed to count output tokens:", err)
				outputTokens = 0
			}

			yield {
				type: "usage",
				inputTokens,
				outputTokens,
			} as const
		} catch (error) {
			throw new Error(
				"Please check the LM Studio developer logs to debug what went wrong. You may need to load the model with a larger context length to work with Roo Code's prompts.",
			)
		}
	}

	override getModel(): { id: string; info: ModelInfo } {
		const models = getModelsFromCache("lmstudio")
		if (models && this.options.lmStudioModelId && models[this.options.lmStudioModelId]) {
			return {
				id: this.options.lmStudioModelId,
				info: models[this.options.lmStudioModelId],
			}
		} else {
			return {
				id: this.options.lmStudioModelId || "",
				info: openAiModelInfoSaneDefaults,
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			// Determine temperature: use GLM default (0.6) for GLM models, otherwise LM Studio default (0)
			const temperature = this.options.modelTemperature ??
				(this.glmConfig.isGlm ? this.glmConfig.temperature : LMSTUDIO_DEFAULT_TEMPERATURE)

			// Create params object with optional draft model
			const params: any = {
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
				temperature,
				stream: false,
			}

			// Add draft model if speculative decoding is enabled and a draft model is specified
			if (this.options.lmStudioSpeculativeDecodingEnabled && this.options.lmStudioDraftModelId) {
				params.draft_model = this.options.lmStudioDraftModelId
			}

			let response
			try {
				response = await this.client.chat.completions.create(params)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}
			return response.choices[0]?.message.content || ""
		} catch (error) {
			throw new Error(
				"Please check the LM Studio developer logs to debug what went wrong. You may need to load the model with a larger context length to work with Roo Code's prompts.",
			)
		}
	}
}

export async function getLmStudioModels(baseUrl = "http://localhost:1234") {
	try {
		if (!URL.canParse(baseUrl)) {
			return []
		}

		const response = await axios.get(`${baseUrl}/v1/models`)
		const modelsArray = response.data?.data?.map((model: any) => model.id) || []
		return [...new Set<string>(modelsArray)]
	} catch (error) {
		return []
	}
}
