import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { Message, Ollama, Tool as OllamaTool, type Config as OllamaOptions } from "ollama"
import { ModelInfo, openAiModelInfoSaneDefaults, DEEP_SEEK_DEFAULT_TEMPERATURE } from "@roo-code/types"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import type { ApiHandlerOptions } from "../../shared/api"
import { getOllamaModels } from "./fetchers/ollama"
import { XmlMatcher } from "../../utils/xml-matcher"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { ApiInferenceLogger } from "../logging/ApiInferenceLogger"

interface OllamaChatOptions {
	temperature: number
	num_ctx?: number
}

function convertToOllamaMessages(anthropicMessages: Anthropic.Messages.MessageParam[]): Message[] {
	const ollamaMessages: Message[] = []

	for (const anthropicMessage of anthropicMessages) {
		if (typeof anthropicMessage.content === "string") {
			ollamaMessages.push({
				role: anthropicMessage.role,
				content: anthropicMessage.content,
			})
		} else {
			if (anthropicMessage.role === "user") {
				const { nonToolMessages, toolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolResultBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_result") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						}
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				// Process tool result messages FIRST since they must follow the tool use messages
				const toolResultImages: string[] = []
				toolMessages.forEach((toolMessage) => {
					// The Anthropic SDK allows tool results to be a string or an array of text and image blocks, enabling rich and structured content. In contrast, the Ollama SDK only supports tool results as a single string, so we map the Anthropic tool result parts into one concatenated string to maintain compatibility.
					let content: string

					if (typeof toolMessage.content === "string") {
						content = toolMessage.content
					} else {
						content =
							toolMessage.content
								?.map((part) => {
									if (part.type === "image") {
										// Handle base64 images only (Anthropic SDK uses base64)
										// Ollama expects raw base64 strings, not data URLs
										if ("source" in part && part.source.type === "base64") {
											toolResultImages.push(part.source.data)
										}
										return "(see following user message for image)"
									}
									return part.text
								})
								.join("\n") ?? ""
					}
					ollamaMessages.push({
						role: "user",
						images: toolResultImages.length > 0 ? toolResultImages : undefined,
						content: content,
					})
				})

				// Process non-tool messages
				if (nonToolMessages.length > 0) {
					// Separate text and images for Ollama
					const textContent = nonToolMessages
						.filter((part) => part.type === "text")
						.map((part) => part.text)
						.join("\n")

					const imageData: string[] = []
					nonToolMessages.forEach((part) => {
						if (part.type === "image" && "source" in part && part.source.type === "base64") {
							// Ollama expects raw base64 strings, not data URLs
							imageData.push(part.source.data)
						}
					})

					ollamaMessages.push({
						role: "user",
						content: textContent,
						images: imageData.length > 0 ? imageData : undefined,
					})
				}
			} else if (anthropicMessage.role === "assistant") {
				const { nonToolMessages, toolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolUseBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_use") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						} // assistant cannot send tool_result messages
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				// Process non-tool messages
				let content: string = ""
				if (nonToolMessages.length > 0) {
					content = nonToolMessages
						.map((part) => {
							if (part.type === "image") {
								return "" // impossible as the assistant cannot send images
							}
							return part.text
						})
						.join("\n")
				}

				// Convert tool_use blocks to Ollama tool_calls format
				const toolCalls =
					toolMessages.length > 0
						? toolMessages.map((tool) => ({
								function: {
									name: tool.name,
									arguments: tool.input as Record<string, unknown>,
								},
							}))
						: undefined

				ollamaMessages.push({
					role: "assistant",
					content,
					tool_calls: toolCalls,
				})
			}
		}
	}

	return ollamaMessages
}

export class NativeOllamaHandler extends BaseProvider implements SingleCompletionHandler {
	protected readonly providerName = "Ollama"
	protected options: ApiHandlerOptions
	private client: Ollama | undefined
	protected models: Record<string, ModelInfo> = {}

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	private ensureClient(): Ollama {
		if (!this.client) {
			try {
				const clientOptions: OllamaOptions = {
					host: this.options.ollamaBaseUrl || "http://localhost:11434",
					// Note: The ollama npm package handles timeouts internally
				}

				// Add API key if provided (for Ollama cloud or authenticated instances)
				if (this.options.ollamaApiKey) {
					clientOptions.headers = {
						Authorization: `Bearer ${this.options.ollamaApiKey}`,
					}
				}

				this.client = new Ollama(clientOptions)
			} catch (error: any) {
				throw new Error(`Error creating Ollama client: ${error.message}`)
			}
		}
		return this.client
	}

	/**
	 * Converts OpenAI-format tools to Ollama's native tool format.
	 * This allows NativeOllamaHandler to use the same tool definitions
	 * that are passed to OpenAI-compatible providers.
	 */
	private convertToolsToOllama(tools: OpenAI.Chat.ChatCompletionTool[] | undefined): OllamaTool[] | undefined {
		if (!tools || tools.length === 0) {
			return undefined
		}

		return tools
			.filter((tool): tool is OpenAI.Chat.ChatCompletionTool & { type: "function" } => tool.type === "function")
			.map((tool) => ({
				type: tool.type,
				function: {
					name: tool.function.name,
					description: tool.function.description,
					parameters: tool.function.parameters as OllamaTool["function"]["parameters"],
				},
			}))
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const startedAt = Date.now()
		const shouldLog = ApiInferenceLogger.isEnabled()

		const client = this.ensureClient()
		const { id: modelId, info: modelInfo } = await this.fetchModel()
		const useR1Format = modelId.toLowerCase().includes("deepseek-r1")

		const ollamaMessages: Message[] = [
			{ role: "system", content: systemPrompt },
			...convertToOllamaMessages(messages),
		]

		const matcher = new XmlMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		// Check if we should use native tool calling
		const supportsNativeTools = modelInfo.supportsNativeTools ?? false
		const useNativeTools =
			supportsNativeTools && metadata?.tools && metadata.tools.length > 0 && metadata?.toolProtocol !== "xml"

		try {
			if (shouldLog) {
				ApiInferenceLogger.logRaw(`[API][request][${this.providerName}][${modelId}]`, {
					model: modelId,
					messages: ollamaMessages,
					stream: true,
					options: {
						temperature: this.options.modelTemperature ?? (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
						...(this.options.ollamaNumCtx !== undefined ? { num_ctx: this.options.ollamaNumCtx } : {}),
					},
					...(useNativeTools ? { tools: this.convertToolsToOllama(metadata.tools) } : {}),
				})
			}

			// Build options object conditionally
			const chatOptions: OllamaChatOptions = {
				temperature: this.options.modelTemperature ?? (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
			}

			// Only include num_ctx if explicitly set via ollamaNumCtx
			if (this.options.ollamaNumCtx !== undefined) {
				chatOptions.num_ctx = this.options.ollamaNumCtx
			}

			// Create the actual API request promise
			const stream = await client.chat({
				model: modelId,
				messages: ollamaMessages,
				stream: true,
				options: chatOptions,
				// Native tool calling support
				...(useNativeTools && { tools: this.convertToolsToOllama(metadata.tools) }),
			})

			let totalInputTokens = 0
			let totalOutputTokens = 0
			// Track tool calls across chunks (Ollama may send complete tool_calls in final chunk)
			let toolCallIndex = 0
			const toolCalls: Array<{ id: string; name: string; arguments: unknown }> = []
			let assembledText = ""
			let assembledReasoning = ""

			try {
				for await (const chunk of stream) {
					if (typeof chunk.message.content === "string" && chunk.message.content.length > 0) {
						// Process content through matcher for reasoning detection
						for (const matcherChunk of matcher.update(chunk.message.content)) {
							if (matcherChunk.type === "text") assembledText += matcherChunk.text
							if (matcherChunk.type === "reasoning") assembledReasoning += matcherChunk.text
							yield matcherChunk
						}
					}

					// Handle tool calls - emit partial chunks for NativeToolCallParser compatibility
					if (chunk.message.tool_calls && chunk.message.tool_calls.length > 0) {
						for (const toolCall of chunk.message.tool_calls) {
							// Generate a unique ID for this tool call
							const toolCallId = `ollama-tool-${toolCallIndex}`
							toolCalls.push({
								id: toolCallId,
								name: toolCall.function.name,
								arguments: toolCall.function.arguments,
							})
							yield {
								type: "tool_call_partial",
								index: toolCallIndex,
								id: toolCallId,
								name: toolCall.function.name,
								arguments: JSON.stringify(toolCall.function.arguments),
							}
							toolCallIndex++
						}
					}

					// Handle token usage if available
					if (chunk.eval_count !== undefined || chunk.prompt_eval_count !== undefined) {
						if (chunk.prompt_eval_count) {
							totalInputTokens = chunk.prompt_eval_count
						}
						if (chunk.eval_count) {
							totalOutputTokens = chunk.eval_count
						}
					}
				}

				// Yield any remaining content from the matcher
				for (const chunk of matcher.final()) {
					if (chunk.type === "text") assembledText += chunk.text
					if (chunk.type === "reasoning") assembledReasoning += chunk.text
					yield chunk
				}

				// Yield usage information if available
				if (totalInputTokens > 0 || totalOutputTokens > 0) {
					yield {
						type: "usage",
						inputTokens: totalInputTokens,
						outputTokens: totalOutputTokens,
					}
				}

				if (shouldLog) {
					const durationMs = Date.now() - startedAt
					ApiInferenceLogger.logRaw(
						`[API][response][${this.providerName}][${modelId}][${durationMs}ms][streaming]`,
						{
							model: modelId,
							message: {
								role: "assistant",
								content: assembledText,
								...(assembledReasoning.length > 0 ? { reasoning: assembledReasoning } : {}),
								...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
							},
							usage:
								totalInputTokens > 0 || totalOutputTokens > 0
									? { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
									: undefined,
						},
					)
				}
			} catch (streamError: any) {
				if (shouldLog) {
					const durationMs = Date.now() - startedAt
					ApiInferenceLogger.logRawError(
						`[API][error][${this.providerName}][${modelId}][${durationMs}ms]`,
						streamError,
					)
				}
				console.error("Error processing Ollama stream:", streamError)
				throw new Error(`Ollama stream processing error: ${streamError.message || "Unknown error"}`)
			}
		} catch (error: any) {
			if (shouldLog) {
				const durationMs = Date.now() - startedAt
				ApiInferenceLogger.logRawError(`[API][error][${this.providerName}][${modelId}][${durationMs}ms]`, error)
			}
			// Enhance error reporting
			const statusCode = error.status || error.statusCode
			const errorMessage = error.message || "Unknown error"

			if (error.code === "ECONNREFUSED") {
				throw new Error(
					`Ollama service is not running at ${this.options.ollamaBaseUrl || "http://localhost:11434"}. Please start Ollama first.`,
				)
			} else if (statusCode === 404) {
				throw new Error(
					`Model ${this.getModel().id} not found in Ollama. Please pull the model first with: ollama pull ${this.getModel().id}`,
				)
			}

			console.error(`Ollama API error (${statusCode || "unknown"}): ${errorMessage}`)
			throw error
		}
	}

	async fetchModel() {
		this.models = await getOllamaModels(this.options.ollamaBaseUrl, this.options.ollamaApiKey)
		return this.getModel()
	}

	override getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.ollamaModelId || ""
		return {
			id: modelId,
			info: this.models[modelId] || openAiModelInfoSaneDefaults,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const startedAt = Date.now()
			const shouldLog = ApiInferenceLogger.isEnabled()

			const client = this.ensureClient()
			const { id: modelId } = await this.fetchModel()
			const useR1Format = modelId.toLowerCase().includes("deepseek-r1")

			// Build options object conditionally
			const chatOptions: OllamaChatOptions = {
				temperature: this.options.modelTemperature ?? (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
			}

			// Only include num_ctx if explicitly set via ollamaNumCtx
			if (this.options.ollamaNumCtx !== undefined) {
				chatOptions.num_ctx = this.options.ollamaNumCtx
			}

			if (shouldLog) {
				ApiInferenceLogger.logRaw(`[API][request][${this.providerName}][${modelId}]`, {
					model: modelId,
					messages: [{ role: "user", content: prompt }],
					stream: false,
					options: chatOptions,
				})
			}

			const response = await client.chat({
				model: modelId,
				messages: [{ role: "user", content: prompt }],
				stream: false,
				options: chatOptions,
			})

			if (shouldLog) {
				const durationMs = Date.now() - startedAt
				ApiInferenceLogger.logRaw(
					`[API][response][${this.providerName}][${modelId}][${durationMs}ms]`,
					response,
				)
			}

			return response.message?.content || ""
		} catch (error) {
			const modelId = this.options.ollamaModelId || this.options.apiModelId || "unknown"
			if (ApiInferenceLogger.isEnabled()) {
				ApiInferenceLogger.logRawError(`[API][error][${this.providerName}][${modelId}][0ms]`, error)
			}
			if (error instanceof Error) {
				throw new Error(`Ollama completion error: ${error.message}`)
			}
			throw error
		}
	}
}
