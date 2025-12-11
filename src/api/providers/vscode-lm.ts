import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"

import {
	type ModelInfo,
	openAiModelInfoSaneDefaults,
	mergeModelInfoWithRegistry,
	mergeModelInfoWithFetched,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { SELECTOR_SEPARATOR, stringifyVsCodeLmModelSelector } from "../../shared/vsCodeSelectorUtils"

import { ApiStream } from "../transform/stream"
import { convertToVsCodeLmMessages, extractTextCountFromMessage } from "../transform/vscode-lm-format"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

/**
 * Handles interaction with VS Code's Language Model API for chat-based operations.
 * This handler extends BaseProvider to provide VS Code LM specific functionality.
 *
 * @extends {BaseProvider}
 *
 * @remarks
 * The handler manages a VS Code language model chat client and provides methods to:
 * - Create and manage chat client instances
 * - Stream messages using VS Code's Language Model API
 * - Retrieve model information
 *
 * @example
 * ```typescript
 * const options = {
 *   vsCodeLmModelSelector: { vendor: "copilot", family: "gpt-4" }
 * };
 * const handler = new VsCodeLmHandler(options);
 *
 * // Stream a conversation
 * const systemPrompt = "You are a helpful assistant";
 * const messages = [{ role: "user", content: "Hello!" }];
 * for await (const chunk of handler.createMessage(systemPrompt, messages)) {
 *   console.log(chunk);
 * }
 * ```
 */
export class VsCodeLmHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: vscode.LanguageModelChat | null
	private disposable: vscode.Disposable | null
	private currentRequestCancellation: vscode.CancellationTokenSource | null
	private cachedModelInfo: Partial<ModelInfo> | null = null

	// Token counting cache to avoid redundant API calls
	private tokenCountCache: Map<string, { count: number; timestamp: number }> = new Map()
	private static readonly TOKEN_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
	private static readonly TOKEN_CACHE_MAX_SIZE = 100 // Max cached entries

	// Average characters per token for estimation (avoids API calls)
	// GPT-4/Claude average ~4 chars per token for English text
	private static readonly CHARS_PER_TOKEN_ESTIMATE = 4

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.client = null
		this.disposable = null
		this.currentRequestCancellation = null

		try {
			// Listen for model changes and reset client
			this.disposable = vscode.workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration("lm")) {
					try {
						this.client = null
						this.cachedModelInfo = null
						this.ensureCleanState()
					} catch (error) {
						console.error("Error during configuration change cleanup:", error)
					}
				}
			})
			this.initializeClient()
		} catch (error) {
			// Ensure cleanup if constructor fails
			this.dispose()

			throw new Error(
				`Roo Code <Language Model API>: Failed to initialize handler: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
		}
	}
	/**
	 * Initializes the VS Code Language Model client.
	 * This method is called during the constructor to set up the client.
	 * This useful when the client is not created yet and call getModel() before the client is created.
	 * @returns Promise<void>
	 * @throws Error when client initialization fails
	 */
	async initializeClient(): Promise<void> {
		try {
			// Check if the client is already initialized
			if (this.client) {
				console.debug("Roo Code <Language Model API>: Client already initialized")
				return
			}
			// Create a new client instance
			this.client = await this.createClient(this.options.vsCodeLmModelSelector || {})
			console.debug("Roo Code <Language Model API>: Client initialized successfully")

			// Fetch model info in background
			if (this.client) {
				const modelParts = [this.client.vendor, this.client.family, this.client.version].filter(Boolean)
				const modelId = this.client.id || modelParts.join(SELECTOR_SEPARATOR)

				try {
					this.cachedModelInfo = await mergeModelInfoWithFetched(
						modelId,
						this.client.maxInputTokens,
						openAiModelInfoSaneDefaults.contextWindow,
					)
				} catch (error) {
					console.error("Roo Code <Language Model API>: Failed to fetch model info:", error)
				}
			}
		} catch (error) {
			// Handle errors during client initialization
			const errorMessage = error instanceof Error ? error.message : "Unknown error"
			console.error("Roo Code <Language Model API>: Client initialization failed:", errorMessage)
			throw new Error(`Roo Code <Language Model API>: Failed to initialize client: ${errorMessage}`)
		}
	}
	/**
	 * Creates a language model chat client based on the provided selector.
	 *
	 * @param selector - Selector criteria to filter language model chat instances
	 * @returns Promise resolving to the first matching language model chat instance
	 * @throws Error when no matching models are found with the given selector
	 *
	 * @example
	 * const selector = { vendor: "copilot", family: "gpt-4o" };
	 * const chatClient = await createClient(selector);
	 */
	async createClient(selector: vscode.LanguageModelChatSelector): Promise<vscode.LanguageModelChat> {
		try {
			const models = await vscode.lm.selectChatModels(selector)

			// Use first available model or create a minimal model object
			if (models && Array.isArray(models) && models.length > 0) {
				return models[0]
			}

			// Create a minimal model if no models are available
			return {
				id: "default-lm",
				name: "Default Language Model",
				vendor: "vscode",
				family: "lm",
				version: "1.0",
				maxInputTokens: 8192,
				sendRequest: async (_messages, _options, _token) => {
					// Provide a minimal implementation
					return {
						stream: (async function* () {
							yield new vscode.LanguageModelTextPart(
								"Language model functionality is limited. Please check VS Code configuration.",
							)
						})(),
						text: (async function* () {
							yield "Language model functionality is limited. Please check VS Code configuration."
						})(),
					}
				},
				countTokens: async () => 0,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error"
			throw new Error(`Roo Code <Language Model API>: Failed to select model: ${errorMessage}`)
		}
	}

	/**
	 * Checks if a chunk is a LanguageModelThinkingPart (proposed API).
	 * This is a duck-typing check since the class may not be available in all VS Code versions.
	 *
	 * @param chunk - The chunk to check
	 * @returns true if the chunk appears to be a ThinkingPart
	 */
	private isThinkingPart(chunk: unknown): boolean {
		if (!chunk || typeof chunk !== "object") {
			return false
		}

		// Check by constructor name first (if LanguageModelThinkingPart class exists)
		const constructorName = (chunk as { constructor?: { name?: string } })?.constructor?.name
		if (constructorName === "LanguageModelThinkingPart") {
			return true
		}

		// Duck-type check: ThinkingPart has 'value' and optionally 'id' and 'metadata'
		// but NOT 'callId' (which would be a ToolCallPart) and NOT just 'value' as string with no other fields
		const chunkObj = chunk as Record<string, unknown>
		const hasValue = "value" in chunkObj
		const hasIdOrMetadata = "id" in chunkObj || "metadata" in chunkObj
		const isNotToolCall = !("callId" in chunkObj) && !("name" in chunkObj)

		// It's likely a ThinkingPart if it has value + (id or metadata) and isn't a tool call
		return hasValue && hasIdOrMetadata && isNotToolCall
	}
	/**
	 * Checks if an object is a LanguageModelChatMessage.
	 * Uses duck-typing since instanceof doesn't work reliably with VS Code's mock objects.
	 */
	private isLanguageModelChatMessage(obj: unknown): obj is vscode.LanguageModelChatMessage {
		if (!obj || typeof obj !== "object") {
			return false
		}
		const msgObj = obj as Record<string, unknown>
		return "role" in msgObj && "content" in msgObj
	}

	/**
	 * Checks if a chunk is a LanguageModelTextPart using duck-typing.
	 */
	private isTextPart(chunk: unknown): chunk is vscode.LanguageModelTextPart {
		if (!chunk || typeof chunk !== "object") {
			return false
		}
		const chunkObj = chunk as Record<string, unknown>
		return "value" in chunkObj && typeof chunkObj.value === "string" && !("callId" in chunkObj)
	}

	/**
	 * Checks if a chunk is a LanguageModelToolCallPart using duck-typing.
	 */
	private isToolCallPart(chunk: unknown): chunk is vscode.LanguageModelToolCallPart {
		if (!chunk || typeof chunk !== "object") {
			return false
		}
		const chunkObj = chunk as Record<string, unknown>
		return "callId" in chunkObj && "name" in chunkObj && "input" in chunkObj
	}

	/**
	 * Extracts text from a LanguageModelChatMessage using duck-typing.
	 */
	private extractTextFromMessage(message: vscode.LanguageModelChatMessage): string {
		let text = ""
		if (Array.isArray(message.content)) {
			for (const part of message.content) {
				const partObj = part as unknown as Record<string, unknown>
				if ("value" in partObj && typeof partObj.value === "string") {
					text += partObj.value
				}
			}
		} else if (typeof message.content === "string") {
			text += message.content
		}
		return text
	}

	/**
	 * Creates and streams a message using the VS Code Language Model API.
	 *
	 * @param systemPrompt - The system prompt to initialize the conversation context
	 * @param messages - An array of message parameters following the Anthropic message format
	 * @param metadata - Optional metadata for the message
	 *
	 * @yields {ApiStream} An async generator that yields either text chunks or tool calls from the model response
	 *
	 * @throws {Error} When vsCodeLmModelSelector option is not provided
	 * @throws {Error} When the response stream encounters an error
	 *
	 * @remarks
	 * This method handles the initialization of the VS Code LM client if not already created,
	 * converts the messages to VS Code LM format, and streams the response chunks.
	 * Tool calls handling is currently a work in progress.
	 */
	dispose(): void {
		if (this.disposable) {
			this.disposable.dispose()
		}

		if (this.currentRequestCancellation) {
			this.currentRequestCancellation.cancel()
			this.currentRequestCancellation.dispose()
		}

		this.tokenCountCache.clear()
	}

	/**
	 * Fast token estimation without API calls.
	 * Uses character count divided by average chars per token.
	 * This avoids consuming API quota for token counting.
	 */
	private estimateTokens(text: string): number {
		if (!text) return 0
		// Simple heuristic: ~4 characters per token for English
		// Add 10% buffer for safety
		return Math.ceil((text.length / VsCodeLmHandler.CHARS_PER_TOKEN_ESTIMATE) * 1.1)
	}

	/**
	 * Get a cache key for token counting
	 */
	private getTokenCacheKey(text: string): string {
		// Use first 100 chars + length as a quick hash
		// This is fast and handles most cases well
		return `${text.length}:${text.substring(0, 100)}`
	}

	/**
	 * Clean up old cache entries
	 */
	private pruneTokenCache(): void {
		const now = Date.now()
		const entries = Array.from(this.tokenCountCache.entries())

		// Remove expired entries
		for (const [key, value] of entries) {
			if (now - value.timestamp > VsCodeLmHandler.TOKEN_CACHE_TTL_MS) {
				this.tokenCountCache.delete(key)
			}
		}

		// If still too large, remove oldest entries
		if (this.tokenCountCache.size > VsCodeLmHandler.TOKEN_CACHE_MAX_SIZE) {
			const sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
			const toRemove = sortedEntries.slice(0, this.tokenCountCache.size - VsCodeLmHandler.TOKEN_CACHE_MAX_SIZE)
			for (const [key] of toRemove) {
				this.tokenCountCache.delete(key)
			}
		}
	}

	/**
	 * Implements the ApiHandler countTokens interface method
	 * Provides token counting for Anthropic content blocks
	 * Uses fast estimation to avoid API calls
	 *
	 * @param content The content blocks to count tokens for
	 * @returns A promise resolving to the token count
	 */
	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		// Convert Anthropic content blocks to a string for VSCode LM token counting
		let textContent = ""

		for (const block of content) {
			if (block.type === "text") {
				textContent += block.text || ""
			} else if (block.type === "image") {
				// Images use roughly 85 tokens per tile (varies by size)
				// Estimate ~1000 tokens for average image
				textContent += " ".repeat(4000) // 4000 chars ≈ 1000 tokens
			}
		}

		// Use fast estimation instead of API call to save quota
		return this.estimateTokens(textContent)
	}

	/**
	 * Private implementation of token counting used internally by VsCodeLmHandler
	 * Uses caching and estimation to minimize API calls
	 *
	 * OPTIMIZATION: We use fast estimation instead of API calls to save quota.
	 * The API's countTokens() method counts against your usage limit!
	 */
	private async internalCountTokens(text: string | vscode.LanguageModelChatMessage): Promise<number> {
		// Validate input
		if (!text) {
			return 0
		}

		// Extract text content based on input type
		let textContent: string

		if (typeof text === "string") {
			textContent = text
		} else if (this.isLanguageModelChatMessage(text)) {
			// For chat messages, extract text content
			if (!text.content || (Array.isArray(text.content) && text.content.length === 0)) {
				return 0
			}
			textContent = this.extractTextFromMessage(text)
		} else {
			return 0
		}

		// Check cache first
		const cacheKey = this.getTokenCacheKey(textContent)
		const cached = this.tokenCountCache.get(cacheKey)
		if (cached && Date.now() - cached.timestamp < VsCodeLmHandler.TOKEN_CACHE_TTL_MS) {
			return cached.count
		}

		// Use fast estimation instead of API call to save quota
		// This is ~95% accurate for English text and saves API calls
		const estimatedCount = this.estimateTokens(textContent)

		// Cache the result
		this.tokenCountCache.set(cacheKey, {
			count: estimatedCount,
			timestamp: Date.now(),
		})

		// Prune cache if needed
		if (this.tokenCountCache.size > VsCodeLmHandler.TOKEN_CACHE_MAX_SIZE) {
			this.pruneTokenCache()
		}

		return estimatedCount
	}

	private async calculateTotalInputTokens(vsCodeLmMessages: vscode.LanguageModelChatMessage[]): Promise<number> {
		// Use estimation for all messages (no API calls)
		let totalTokens = 0
		for (const msg of vsCodeLmMessages) {
			totalTokens += await this.internalCountTokens(msg)
		}
		return totalTokens
	}

	private ensureCleanState(): void {
		if (this.currentRequestCancellation) {
			this.currentRequestCancellation.cancel()
			this.currentRequestCancellation.dispose()
			this.currentRequestCancellation = null
		}
	}

	private async getClient(): Promise<vscode.LanguageModelChat> {
		if (!this.client) {
			console.debug("Roo Code <Language Model API>: Getting client with options:", {
				vsCodeLmModelSelector: this.options.vsCodeLmModelSelector,
				hasOptions: !!this.options,
				selectorKeys: this.options.vsCodeLmModelSelector ? Object.keys(this.options.vsCodeLmModelSelector) : [],
			})

			try {
				// Use default empty selector if none provided to get all available models
				const selector = this.options?.vsCodeLmModelSelector || {}
				console.debug("Roo Code <Language Model API>: Creating client with selector:", selector)
				this.client = await this.createClient(selector)
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unknown error"
				console.error("Roo Code <Language Model API>: Client creation failed:", message)
				throw new Error(`Roo Code <Language Model API>: Failed to create client: ${message}`)
			}
		}

		return this.client
	}

	private cleanMessageContent(content: any): any {
		if (!content) {
			return content
		}

		if (typeof content === "string") {
			return content
		}

		if (Array.isArray(content)) {
			return content.map((item) => this.cleanMessageContent(item))
		}

		if (typeof content === "object") {
			const cleaned: any = {}
			for (const [key, value] of Object.entries(content)) {
				cleaned[key] = this.cleanMessageContent(value)
			}
			return cleaned
		}

		return content
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Ensure clean state before starting a new request
		this.ensureCleanState()
		const client: vscode.LanguageModelChat = await this.getClient()

		// Process messages
		const cleanedMessages = messages.map((msg) => ({
			...msg,
			content: this.cleanMessageContent(msg.content),
		}))

		// Convert Anthropic messages to VS Code LM messages
		const vsCodeLmMessages: vscode.LanguageModelChatMessage[] = [
			vscode.LanguageModelChatMessage.Assistant(systemPrompt),
			...convertToVsCodeLmMessages(cleanedMessages),
		]

		// Initialize cancellation token for the request
		this.currentRequestCancellation = new vscode.CancellationTokenSource()

		// Calculate input tokens before starting the stream
		const totalInputTokens: number = await this.calculateTotalInputTokens(vsCodeLmMessages)

		// Accumulate the text and count at the end of the stream to reduce token counting overhead.
		let accumulatedText: string = ""

		try {
			// Create the response stream with minimal required options
			const requestOptions: vscode.LanguageModelChatRequestOptions = {
				justification: `Roo Code would like to use '${client.name}' from '${client.vendor}', Click 'Allow' to proceed.`,
			}

			// Note: Tool support is currently provided by the VSCode Language Model API directly
			// Extensions can register tools using vscode.lm.registerTool()

			const response: vscode.LanguageModelChatResponse = await client.sendRequest(
				vsCodeLmMessages,
				requestOptions,
				this.currentRequestCancellation.token,
			)

			// Consume the stream and handle both text and tool call chunks
			for await (const chunk of response.stream) {
				if (this.isTextPart(chunk)) {
					// Validate text part value
					if (typeof chunk.value !== "string") {
						console.warn("Roo Code <Language Model API>: Invalid text part value received:", chunk.value)
						continue
					}

					accumulatedText += chunk.value
					yield {
						type: "text",
						text: chunk.value,
					}
				} else if (this.isToolCallPart(chunk)) {
					try {
						// Validate tool call parameters
						if (!chunk.name || typeof chunk.name !== "string") {
							console.warn("Roo Code <Language Model API>: Invalid tool name received:", chunk.name)
							continue
						}

						if (!chunk.callId || typeof chunk.callId !== "string") {
							console.warn("Roo Code <Language Model API>: Invalid tool callId received:", chunk.callId)
							continue
						}

						// Ensure input is a valid object
						if (!chunk.input || typeof chunk.input !== "object") {
							console.warn("Roo Code <Language Model API>: Invalid tool input received:", chunk.input)
							continue
						}

						// Convert tool calls to text format with proper error handling
						const toolCall = {
							type: "tool_call",
							name: chunk.name,
							arguments: chunk.input,
							callId: chunk.callId,
						}

						const toolCallText = JSON.stringify(toolCall)
						accumulatedText += toolCallText

						// Log tool call for debugging
						console.debug("Roo Code <Language Model API>: Processing tool call:", {
							name: chunk.name,
							callId: chunk.callId,
							inputSize: JSON.stringify(chunk.input).length,
						})

						yield {
							type: "text",
							text: toolCallText,
						}
					} catch (error) {
						console.error("Roo Code <Language Model API>: Failed to process tool call:", error)
						// Continue processing other chunks even if one fails
						continue
					}
				} else if (this.isThinkingPart(chunk)) {
					// Handle LanguageModelThinkingPart (proposed API for model reasoning/thinking)
					const thinkingPart = chunk as {
						value?: string | string[]
						id?: string
						metadata?: { readonly [key: string]: unknown }
					}

					// Log thinking part details - may contain cache or usage information
					console.log("Roo Code <Language Model API>: ThinkingPart received:", {
						hasValue: !!thinkingPart.value,
						valueLength: Array.isArray(thinkingPart.value)
							? thinkingPart.value.join("").length
							: (thinkingPart.value?.length ?? 0),
						id: thinkingPart.id,
						hasMetadata: !!thinkingPart.metadata,
						metadataKeys: thinkingPart.metadata ? Object.keys(thinkingPart.metadata) : [],
					})

					// Log full metadata contents for analysis
					if (thinkingPart.metadata) {
						console.log(
							"Roo Code <Language Model API>: ThinkingPart metadata:",
							JSON.stringify(thinkingPart.metadata, null, 2),
						)
					}

					// Extract the thinking text content
					const thinkingText = Array.isArray(thinkingPart.value)
						? thinkingPart.value.join("")
						: (thinkingPart.value ?? "")

					// Optionally yield thinking content (could be useful for extended thinking models)
					if (thinkingText) {
						// For now, we don't include thinking in the output stream
						// but we count it for token estimation
						accumulatedText += thinkingText
					}
				} else {
					// Log unknown chunk types with detailed info for debugging
					console.warn("Roo Code <Language Model API>: Unknown chunk type received:", {
						constructorName: chunk?.constructor?.name,
						type: typeof chunk,
						keys: chunk && typeof chunk === "object" ? Object.keys(chunk) : [],
						chunk: chunk,
					})
				}
			}

			// Count tokens in the accumulated text after stream completion
			const totalOutputTokens: number = await this.internalCountTokens(accumulatedText)

			// Report final usage after stream completion
			yield {
				type: "usage",
				inputTokens: totalInputTokens,
				outputTokens: totalOutputTokens,
			}
		} catch (error: unknown) {
			this.ensureCleanState()

			if (error instanceof vscode.CancellationError) {
				throw new Error("Roo Code <Language Model API>: Request cancelled by user")
			}

			if (error instanceof Error) {
				console.error("Roo Code <Language Model API>: Stream error details:", {
					message: error.message,
					stack: error.stack,
					name: error.name,
				})

				// Return original error if it's already an Error instance
				throw error
			} else if (typeof error === "object" && error !== null) {
				// Handle error-like objects
				const errorDetails = JSON.stringify(error, null, 2)
				console.error("Roo Code <Language Model API>: Stream error object:", errorDetails)
				throw new Error(`Roo Code <Language Model API>: Response stream error: ${errorDetails}`)
			} else {
				// Fallback for unknown error types
				const errorMessage = String(error)
				console.error("Roo Code <Language Model API>: Unknown stream error:", errorMessage)
				throw new Error(`Roo Code <Language Model API>: Response stream error: ${errorMessage}`)
			}
		}
	}

	// Return model information based on the current client state
	override getModel(): { id: string; info: ModelInfo } {
		if (this.client) {
			// Validate client properties
			const requiredProps = {
				id: this.client.id,
				vendor: this.client.vendor,
				family: this.client.family,
				version: this.client.version,
				maxInputTokens: this.client.maxInputTokens,
			}

			// Log what Copilot reports for debugging
			console.log(
				`Roo Code <Language Model API>: Copilot reports maxInputTokens = ${this.client.maxInputTokens} for model ${this.client.family}`,
			)

			// Log any missing properties for debugging
			for (const [prop, value] of Object.entries(requiredProps)) {
				if (!value && value !== 0) {
					console.warn(`Roo Code <Language Model API>: Client missing ${prop} property`)
				}
			}

			// Construct model ID using available information
			const modelParts = [this.client.vendor, this.client.family, this.client.version].filter(Boolean)

			const modelId = this.client.id || modelParts.join(SELECTOR_SEPARATOR)

			let modelInfo: ModelInfo

			if (this.cachedModelInfo) {
				modelInfo = {
					maxTokens: this.cachedModelInfo.maxTokens ?? -1,
					contextWindow: this.cachedModelInfo.contextWindow ?? openAiModelInfoSaneDefaults.contextWindow,
					supportsImages: this.cachedModelInfo.supportsImages ?? false,
					supportsPromptCache: this.cachedModelInfo.supportsPromptCache ?? true,
					supportsReasoningBudget: this.cachedModelInfo.supportsReasoningBudget,
					inputPrice: 0,
					outputPrice: 0,
					description: `VSCode Language Model: ${modelId}`,
				}

				console.log(
					`Roo Code <Language Model API>: Using fetched context window ${modelInfo.contextWindow} for ${modelId}`,
				)
			} else {
				// Use registry to get correct context window (overrides Copilot's artificial limits)
				// Registry has accurate context windows for Claude models (e.g., 200K for Opus 4.5)
				// while Copilot artificially caps at ~128K
				const registryInfo = mergeModelInfoWithRegistry(
					modelId,
					this.client.maxInputTokens,
					openAiModelInfoSaneDefaults.contextWindow,
				)

				// Build model info using registry values (which override Copilot's limits)
				modelInfo = {
					maxTokens: registryInfo.maxTokens ?? -1, // Unlimited tokens by default
					contextWindow: registryInfo.contextWindow ?? openAiModelInfoSaneDefaults.contextWindow,
					supportsImages: registryInfo.supportsImages ?? false,
					supportsPromptCache: registryInfo.supportsPromptCache ?? true,
					supportsReasoningBudget: registryInfo.supportsReasoningBudget,
					inputPrice: 0,
					outputPrice: 0,
					description: `VSCode Language Model: ${modelId}`,
				}

				console.log(
					`Roo Code <Language Model API>: Using registry context window ${modelInfo.contextWindow} for ${modelId} ` +
						`(Copilot reported: ${this.client.maxInputTokens}, Registry override applied)`,
				)
			}

			return { id: modelId, info: modelInfo }
		}

		// Fallback when no client is available
		const fallbackId = this.options.vsCodeLmModelSelector
			? stringifyVsCodeLmModelSelector(this.options.vsCodeLmModelSelector)
			: "vscode-lm"

		console.debug("Roo Code <Language Model API>: No client available, using fallback model info")

		return {
			id: fallbackId,
			info: {
				...openAiModelInfoSaneDefaults,
				description: `VSCode Language Model (Fallback): ${fallbackId}`,
			},
		}
	}

	/**
	 * Simple prompt completion for SingleCompletionHandler interface
	 */
	async completePrompt(prompt: string): Promise<string> {
		const client = await this.getClient()

		// Initialize cancellation token for the request
		this.currentRequestCancellation = new vscode.CancellationTokenSource()

		try {
			const messages = [vscode.LanguageModelChatMessage.User(prompt)]

			const requestOptions: vscode.LanguageModelChatRequestOptions = {
				justification: `Roo Code would like to use '${client.name}' from '${client.vendor}', Click 'Allow' to proceed.`,
			}

			const response = await client.sendRequest(messages, requestOptions, this.currentRequestCancellation.token)

			let result = ""
			for await (const chunk of response.stream) {
				if (this.isTextPart(chunk)) {
					result += chunk.value
				}
			}

			return result
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`VSCode LM completion error: ${error.message}`)
			}
			throw error
		} finally {
			this.ensureCleanState()
		}
	}
}
/**
 * Get available VS Code Language Models for the webview
 * @returns Array of available model selectors
 */
export async function getVsCodeLmModels(): Promise<
	Array<{
		vendor: string
		family: string
		version?: string
		id?: string
		name?: string
		maxInputTokens?: number
	}>
> {
	try {
		const models = await vscode.lm.selectChatModels({})

		return models.map((model) => ({
			vendor: model.vendor,
			family: model.family,
			version: model.version,
			id: model.id,
			name: model.name,
			maxInputTokens: model.maxInputTokens,
		}))
	} catch (error) {
		console.error("Roo Code <Language Model API>: Failed to get models:", error)
		return []
	}
}
