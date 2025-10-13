import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import axios from "axios"

import { type ModelInfo, openAiModelInfoSaneDefaults, LMSTUDIO_DEFAULT_TEMPERATURE } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { XmlMatcher } from "../../utils/xml-matcher"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"
import { getApiRequestTimeout } from "./utils/timeout-config"
import { handleOpenAIError } from "./utils/openai-error-handler"

export class LmStudioHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private readonly providerName = "LM Studio"

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
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

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
			const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming & { draft_model?: string } = {
				model: this.getModel().id,
				messages: openAiMessages,
				temperature: this.options.modelTemperature ?? LMSTUDIO_DEFAULT_TEMPERATURE,
				stream: true,
			}

			if (this.options.lmStudioSpeculativeDecodingEnabled && this.options.lmStudioDraftModelId) {
				params.draft_model = this.options.lmStudioDraftModelId
			}

			let results
			try {
				results = await this.client.chat.completions.create(params)
			} catch (error) {
				// Handle specific error cases
				const errorMessage = error instanceof Error ? error.message : String(error)

				// Check for connection errors
				if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
					throw new Error(
						`Cannot connect to LM Studio at ${this.options.lmStudioBaseUrl || "http://localhost:1234"}. Please ensure LM Studio is running and the server is started.`,
					)
				}

				// Check for model not found errors
				if (
					errorMessage.includes("model") &&
					(errorMessage.includes("not found") || errorMessage.includes("does not exist"))
				) {
					throw new Error(
						`Model "${this.getModel().id}" not found in LM Studio. Please ensure the model is loaded in LM Studio.`,
					)
				}

				// Check for context length errors
				if (
					errorMessage.includes("context") ||
					errorMessage.includes("token") ||
					errorMessage.includes("length")
				) {
					throw new Error(
						`Context length exceeded for model "${this.getModel().id}". Please load the model with a larger context window in LM Studio, or use a different model that supports longer contexts.`,
					)
				}

				// Use the enhanced error handler for other OpenAI-like errors
				throw handleOpenAIError(error, this.providerName)
			}

			const matcher = new XmlMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)

			for await (const chunk of results) {
				const delta = chunk.choices[0]?.delta

				if (delta?.content) {
					assistantText += delta.content
					for (const processedChunk of matcher.update(delta.content)) {
						yield processedChunk
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
			// If error was already processed and re-thrown above, just re-throw it
			if (error instanceof Error && error.message.includes("LM Studio")) {
				throw error
			}

			// Generic fallback error
			throw new Error(
				`LM Studio error: ${error instanceof Error ? error.message : String(error)}. Please check the LM Studio developer logs for more details.`,
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
			// Create params object with optional draft model
			const params: any = {
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
				temperature: this.options.modelTemperature ?? LMSTUDIO_DEFAULT_TEMPERATURE,
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
				// Handle specific error cases
				const errorMessage = error instanceof Error ? error.message : String(error)

				// Check for connection errors
				if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
					throw new Error(
						`Cannot connect to LM Studio at ${this.options.lmStudioBaseUrl || "http://localhost:1234"}. Please ensure LM Studio is running and the server is started.`,
					)
				}

				// Check for model not found errors
				if (
					errorMessage.includes("model") &&
					(errorMessage.includes("not found") || errorMessage.includes("does not exist"))
				) {
					throw new Error(
						`Model "${this.getModel().id}" not found in LM Studio. Please ensure the model is loaded in LM Studio.`,
					)
				}

				// Check for context length errors
				if (
					errorMessage.includes("context") ||
					errorMessage.includes("token") ||
					errorMessage.includes("length")
				) {
					throw new Error(
						`Context length exceeded for model "${this.getModel().id}". Please load the model with a larger context window in LM Studio, or use a different model that supports longer contexts.`,
					)
				}

				// Use the enhanced error handler for other OpenAI-like errors
				throw handleOpenAIError(error, this.providerName)
			}
			return response.choices[0]?.message.content || ""
		} catch (error) {
			// If error was already processed and re-thrown above, just re-throw it
			if (error instanceof Error && error.message.includes("LM Studio")) {
				throw error
			}

			// Generic fallback error
			throw new Error(
				`LM Studio error: ${error instanceof Error ? error.message : String(error)}. Please check the LM Studio developer logs for more details.`,
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
