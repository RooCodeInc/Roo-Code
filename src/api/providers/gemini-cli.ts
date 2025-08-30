import type { Anthropic } from "@anthropic-ai/sdk"
import {
	GeminiClient,
	Config,
	ConfigParameters,
	AuthType,
	ContentGeneratorConfig,
	createContentGeneratorConfig,
} from "@google/gemini-cli-core"
import { Content, GenerateContentResponse } from "@google/genai"

import { type ModelInfo, type GeminiCliModelId, geminiCliDefaultModelId, geminiCliModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { t } from "i18next"
import type { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { convertAnthropicContentToGemini, convertAnthropicMessageToGemini } from "../transform/gemini-format"
import { v4 as uuidv4 } from "uuid"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"

/**
 * Handler for Google Gemini CLI integration using OAuth authentication.
 * This provider uses the @google/gemini-cli-core library to authenticate
 * and interact with Gemini models through the official CLI OAuth flow.
 */
export class GeminiCliHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client?: GeminiClient
	private config: Config
	private initialized = false

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// Create configuration for the Gemini CLI client
		const configParams: ConfigParameters = {
			sessionId: uuidv4(),
			targetDir: process.cwd(),
			cwd: process.cwd(),
			debugMode: false,
			model: this.getModel().id,
			interactive: false,
		}

		this.config = new Config(configParams)
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.config.initialize()
			this.client = this.config.getGeminiClient()

			// Initialize the content generator with OAuth
			const contentGeneratorConfig: ContentGeneratorConfig = createContentGeneratorConfig(
				this.config,
				AuthType.LOGIN_WITH_GOOGLE,
			)

			await this.client.initialize(contentGeneratorConfig)
			this.initialized = true
		}
	}

	/**
	 * Creates a streaming message response using the Gemini CLI client.
	 * @param systemInstruction - System prompt to guide the model's behavior
	 * @param messages - Array of conversation messages
	 * @param metadata - Optional metadata for the API call
	 * @yields Stream of response chunks including text, reasoning, and usage data
	 */
	async *createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.ensureInitialized()

		if (!this.client) {
			throw new Error("Gemini CLI client not initialized")
		}

		const { id: model, info } = this.getModel()
		const contents = messages.map(convertAnthropicMessageToGemini)

		try {
			// Start a chat session
			await this.client.startChat()

			// Add system instruction as initial context
			if (systemInstruction) {
				await this.client.addHistory({
					role: "user",
					parts: [{ text: `System: ${systemInstruction}` }],
				})
			}

			// Add message history
			for (const content of contents) {
				await this.client.addHistory(content)
			}

			// Get the last user message
			const lastUserMessage = contents[contents.length - 1]
			if (!lastUserMessage || !lastUserMessage.parts || lastUserMessage.parts.length === 0) {
				throw new Error("No user message found")
			}

			// Send the message and stream the response
			const abortController = new AbortController()
			const promptId = uuidv4()

			const stream = this.client.sendMessageStream(lastUserMessage.parts, abortController.signal, promptId)

			let totalInputTokens = 0
			let totalOutputTokens = 0
			let turnResult: any = null

			for await (const event of stream) {
				// The stream returns Turn objects at the end
				turnResult = event as any

				// Handle content events
				if (event.type === "content" && event.value) {
					yield { type: "text", text: event.value }
				}

				// Handle thought events (reasoning)
				if (event.type === "thought" && event.value) {
					const thought = event.value
					yield { type: "reasoning", text: `${thought.subject}: ${thought.description}` }
				}
			}

			// The Turn object contains debug responses with usage metadata
			if (turnResult && turnResult.getDebugResponses) {
				const responses = turnResult.getDebugResponses()
				if (responses && responses.length > 0) {
					const lastResponse = responses[responses.length - 1]
					if (lastResponse.usageMetadata) {
						totalInputTokens = lastResponse.usageMetadata.promptTokenCount || 0
						totalOutputTokens = lastResponse.usageMetadata.candidatesTokenCount || 0
					}
				}
			}

			// Yield usage information
			if (totalInputTokens > 0 || totalOutputTokens > 0) {
				yield {
					type: "usage",
					inputTokens: totalInputTokens,
					outputTokens: totalOutputTokens,
					totalCost: this.calculateCost({
						info,
						inputTokens: totalInputTokens,
						outputTokens: totalOutputTokens,
					}),
				}
			}
		} catch (error) {
			if (error instanceof Error) {
				// Check if it's an authentication error
				if (error.message.includes("auth") || error.message.includes("OAuth")) {
					throw new Error(
						t("common:errors.gemini_cli.auth_failed", {
							error: error.message,
							help: "Please authenticate using the Gemini CLI",
						}),
					)
				}
				throw new Error(t("common:errors.gemini_cli.generate_stream", { error: error.message }))
			}
			throw error
		}
	}

	/**
	 * Gets the model configuration for the current provider settings.
	 * @returns Model ID and information including pricing and capabilities
	 */
	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in geminiCliModels ? (modelId as GeminiCliModelId) : geminiCliDefaultModelId
		let info: ModelInfo = geminiCliModels[id]
		const params = getModelParams({ format: "gemini", modelId: id, model: info, settings: this.options })

		return { id, info, ...params }
	}

	/**
	 * Completes a single prompt without streaming.
	 * @param prompt - The prompt text to complete
	 * @returns The completed text response
	 */
	async completePrompt(prompt: string): Promise<string> {
		await this.ensureInitialized()

		if (!this.client) {
			throw new Error("Gemini CLI client not initialized")
		}

		try {
			const { id: model } = this.getModel()

			// Use generateContent method from the client
			const contents: Content[] = [{ role: "user", parts: [{ text: prompt }] }]

			const response = await this.client.generateContent(
				contents,
				{
					temperature: this.options.modelTemperature ?? 0,
					maxOutputTokens: this.options.modelMaxTokens,
				},
				new AbortController().signal,
				model,
			)

			// Extract text from the response
			if (response && response.candidates && response.candidates.length > 0) {
				const candidate = response.candidates[0]
				if (candidate.content && candidate.content.parts) {
					const textParts = candidate.content.parts
						.filter((part) => "text" in part)
						.map((part) => part.text)
						.join("")
					return textParts
				}
			}

			return ""
		} catch (error) {
			if (error instanceof Error) {
				// Check if it's an authentication error
				if (error.message.includes("auth") || error.message.includes("OAuth")) {
					throw new Error(
						t("common:errors.gemini_cli.auth_failed", {
							error: error.message,
							help: "Please authenticate using the Gemini CLI",
						}),
					)
				}
				throw new Error(t("common:errors.gemini_cli.generate_complete_prompt", { error: error.message }))
			}
			throw error
		}
	}

	/**
	 * Counts tokens for the given content blocks.
	 * Note: The Gemini CLI library doesn't expose a direct token counting method,
	 * so this falls back to the base implementation using tiktoken.
	 * @param content - Array of content blocks to count tokens for
	 * @returns The estimated token count
	 */
	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		// The Gemini CLI library doesn't expose a direct token counting method
		// Fall back to the base implementation
		return super.countTokens(content)
	}

	private calculateCost({
		info,
		inputTokens,
		outputTokens,
		cacheReadTokens = 0,
	}: {
		info: ModelInfo
		inputTokens: number
		outputTokens: number
		cacheReadTokens?: number
	}) {
		if (!info.inputPrice || !info.outputPrice) {
			return undefined
		}

		let inputPrice = info.inputPrice
		let outputPrice = info.outputPrice
		let cacheReadsPrice = info.cacheReadsPrice || 0

		// If there's tiered pricing then adjust the input and output token prices
		// based on the input tokens used.
		if (info.tiers) {
			const tier = info.tiers.find((tier) => inputTokens <= tier.contextWindow)

			if (tier) {
				inputPrice = tier.inputPrice ?? inputPrice
				outputPrice = tier.outputPrice ?? outputPrice
				cacheReadsPrice = tier.cacheReadsPrice ?? cacheReadsPrice
			}
		}

		// Subtract the cached input tokens from the total input tokens.
		const uncachedInputTokens = inputTokens - cacheReadTokens

		let cacheReadCost = cacheReadTokens > 0 ? cacheReadsPrice * (cacheReadTokens / 1_000_000) : 0

		const inputTokensCost = inputPrice * (uncachedInputTokens / 1_000_000)
		const outputTokensCost = outputPrice * (outputTokens / 1_000_000)
		const totalCost = inputTokensCost + outputTokensCost + cacheReadCost

		return totalCost
	}
}
