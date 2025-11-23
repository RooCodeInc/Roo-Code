import { Anthropic } from "@anthropic-ai/sdk"
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/streaming"
import { CacheControlEphemeral } from "@anthropic-ai/sdk/resources"
import { AzureOpenAI } from "openai"
import type OpenAI from "openai"

import {
	type ModelInfo,
	type AzureModelId,
	azureDefaultModelId,
	azureModels,
	AZURE_1M_CONTEXT_MODEL_IDS,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { XmlMatcher } from "../../utils/xml-matcher"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { DEFAULT_HEADERS } from "./constants"
import { handleOpenAIError } from "./utils/openai-error-handler"

/**
 * Validates an Azure endpoint URL for correctness and security
 *
 * Azure OpenAI Services supports multiple endpoint patterns depending on the deployment type:
 * - Claude models: https://<your-resource>.services.ai.azure.com/anthropic/
 * - GPT models: https://<your-resource>.cognitiveservices.azure.com/
 * - Custom/regional: https://<your-custom-endpoint>/
 *
 * This function ensures:
 * - URL uses HTTPS protocol for secure communication
 * - URL format is valid and parseable
 * - Known Azure domain patterns are recognized
 * - Custom domains are allowed for flexibility
 *
 * @param url - The Azure endpoint URL to validate
 * @param context - Context string for error messages (e.g., "Claude", "GPT")
 * @returns void - Throws an error if validation fails
 * @throws {Error} If URL is invalid, uses HTTP, or has malformed structure
 *
 * @example
 * // Valid Claude endpoint
 * validateAzureUrl("https://my-resource.services.ai.azure.com/anthropic/", "Claude")
 *
 * @example
 * // Valid GPT endpoint
 * validateAzureUrl("https://my-resource.cognitiveservices.azure.com/", "GPT")
 *
 * @example
 * // Valid custom endpoint
 * validateAzureUrl("https://my-custom-endpoint.com/", "Custom")
 *
 * Common Issues and Solutions:
 * - "URL must use HTTPS": Replace 'http://' with 'https://' in your endpoint URL
 * - "Invalid URL format": Check for typos, ensure proper URL structure
 * - "Azure endpoint URL is required": Provide the azureBaseUrl in your configuration
 */
function validateAzureUrl(url: string, context: string): void {
	if (!url || url.trim() === "") {
		throw new Error(
			`Azure endpoint URL is required for ${context} models. ` +
				`Please configure 'azureBaseUrl' in your settings.\n\n` +
				`Examples:\n` +
				`- Claude: https://<your-resource>.services.ai.azure.com/anthropic/\n` +
				`- GPT: https://<your-resource>.cognitiveservices.azure.com/\n` +
				`- Custom: https://<your-endpoint>/\n\n` +
				`See Azure documentation: https://learn.microsoft.com/azure/ai-services/openai/`,
		)
	}

	let parsedUrl: URL
	try {
		parsedUrl = new URL(url)
	} catch (error) {
		throw new Error(
			`Invalid Azure endpoint URL format for ${context}: "${url}"\n\n` +
				`Error: ${(error as Error).message}\n\n` +
				`Please ensure your URL is properly formatted:\n` +
				`- Must include protocol (https://)\n` +
				`- Must have valid domain structure\n` +
				`- Example: https://my-resource.cognitiveservices.azure.com/`,
		)
	}

	// Enforce HTTPS for security
	if (parsedUrl.protocol !== "https:") {
		throw new Error(
			`Azure endpoint URL must use HTTPS protocol for ${context}. ` +
				`Found: ${parsedUrl.protocol}\n\n` +
				`Please update your URL to use HTTPS:\n` +
				`Current: ${url}\n` +
				`Should be: ${url.replace(/^http:/, "https:")}`,
		)
	}

	// Validate known Azure domain patterns (optional - allows custom domains too)
	const knownAzurePatterns = [
		/\.cognitiveservices\.azure\.com$/i,
		/\.services\.ai\.azure\.com$/i,
		/\.openai\.azure\.com$/i, // Legacy pattern
	]

	const isKnownAzureDomain = knownAzurePatterns.some((pattern) => pattern.test(parsedUrl.hostname))

	// If not a known Azure domain, just log a warning but allow it (for custom deployments)
	if (!isKnownAzureDomain) {
		console.warn(
			`Azure Provider: Using custom endpoint domain "${parsedUrl.hostname}" for ${context}. ` +
				`If this is not intentional, please verify your azureBaseUrl configuration.`,
		)
	}
}

/**
 * Normalizes an Azure endpoint URL by handling common formatting issues and model-specific requirements
 *
 * This function handles several normalization tasks:
 * 1. Removes trailing slashes for consistency
 * 2. Converts URLs to lowercase for case-insensitive comparison (hostname only)
 * 3. For Claude models: ensures the URL ends with /anthropic
 * 4. For GPT models: ensures the URL does NOT end with /anthropic
 * 5. Handles edge cases like double slashes, mixed protocols
 *
 * @param url - The Azure endpoint URL to normalize
 * @param isClaudeModel - Whether this URL is for a Claude model (requires /anthropic suffix)
 * @returns Normalized URL string
 *
 * @example
 * // Claude model URL normalization
 * normalizeAzureUrl("https://resource.services.ai.azure.com/", true)
 * // Returns: "https://resource.services.ai.azure.com/anthropic"
 *
 * @example
 * // GPT model URL normalization (removes /anthropic if present)
 * normalizeAzureUrl("https://resource.cognitiveservices.azure.com/anthropic/", false)
 * // Returns: "https://resource.cognitiveservices.azure.com"
 *
 * @example
 * // Handles multiple trailing slashes
 * normalizeAzureUrl("https://resource.cognitiveservices.azure.com///", false)
 * // Returns: "https://resource.cognitiveservices.azure.com"
 *
 * Background:
 * - Azure hosts Claude models through the Anthropic Foundry SDK which requires /anthropic path
 * - Azure hosts GPT models through the OpenAI SDK which does not use /anthropic path
 * - Different Azure regions may have slightly different URL patterns
 */
function normalizeAzureUrl(url: string, isClaudeModel: boolean): string {
	// Remove all trailing slashes
	let normalized = url.replace(/\/+$/, "")

	// For Claude models, ensure /anthropic suffix
	if (isClaudeModel) {
		// Remove /anthropic if it exists (to re-add it cleanly)
		normalized = normalized.replace(/\/anthropic$/i, "")
		// Add /anthropic suffix
		normalized = `${normalized}/anthropic`
	} else {
		// For non-Claude models (GPT), remove /anthropic if present
		normalized = normalized.replace(/\/anthropic$/i, "")
	}

	return normalized
}

export class AzureHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private claudeClient?: any // AnthropicFoundry - will be dynamically imported
	private openaiClient?: AzureOpenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		/**
		 * Initialize OpenAI client for GPT models
		 *
		 * Azure OpenAI Service provides access to GPT models through the OpenAI-compatible API.
		 * The endpoint URL must point to a valid Azure Cognitive Services resource.
		 *
		 * Configuration:
		 * - baseURL: Azure endpoint (e.g., https://<resource>.cognitiveservices.azure.com/)
		 * - apiKey: Azure API key for authentication
		 * - apiVersion: API version (default: 2024-12-01-preview for latest features)
		 *
		 * The baseURL is validated and normalized to ensure:
		 * - HTTPS protocol is used
		 * - No /anthropic suffix (GPT models don't use this)
		 * - Trailing slashes are handled consistently
		 */
		const baseURL = this.options.azureBaseUrl || ""
		const apiKey = this.options.azureApiKey || this.options.apiKey || ""
		const apiVersion = this.options.azureApiVersion || "2024-12-01-preview"

		// Validate URL if provided (allow empty for delayed initialization)
		if (baseURL) {
			try {
				validateAzureUrl(baseURL, "GPT/OpenAI")
			} catch (error) {
				// Provide helpful context in error message
				throw new Error(
					`Azure OpenAI client initialization failed:\n${(error as Error).message}\n\n` +
						`Please check your Azure configuration in settings.`,
				)
			}
		}

		// Normalize URL for GPT models (removes /anthropic if present)
		const normalizedBaseURL = baseURL ? normalizeAzureUrl(baseURL, false) : baseURL

		try {
			this.openaiClient = new AzureOpenAI({
				baseURL: normalizedBaseURL,
				apiKey,
				apiVersion,
				defaultHeaders: DEFAULT_HEADERS,
			})
		} catch (error) {
			throw new Error(
				`Failed to initialize Azure OpenAI client:\n${(error as Error).message}\n\n` +
					`Configuration:\n` +
					`- baseURL: ${normalizedBaseURL}\n` +
					`- apiVersion: ${apiVersion}\n\n` +
					`Please verify your Azure OpenAI Service deployment is configured correctly.`,
			)
		}
	}

	/**
	 * Initializes the Claude client for Azure-hosted Claude models
	 *
	 * Azure hosts Claude models through the Anthropic Foundry SDK, which requires:
	 * - A specific endpoint URL ending with /anthropic
	 * - The @anthropic-ai/foundry-sdk package (dynamically imported)
	 * - Valid Azure API credentials
	 *
	 * This method is called lazily (only when a Claude model is used) to:
	 * - Avoid loading the Foundry SDK unless needed
	 * - Validate configuration at the point of use
	 * - Provide clear error messages if setup is incorrect
	 *
	 * Configuration Requirements:
	 * - azureBaseUrl must be set to your Azure AI Services endpoint
	 * - URL must end with /anthropic (will be added if missing)
	 * - azureApiKey must be provided for authentication
	 *
	 * @throws {Error} If the SDK cannot be loaded, URL is invalid, or configuration is incorrect
	 * @private
	 */
	private async initClaudeClient() {
		if (this.claudeClient) return

		const baseURL = this.options.azureBaseUrl || ""
		const apiKey = this.options.azureApiKey || this.options.apiKey || ""

		// Validate URL before attempting to use it
		if (!baseURL) {
			throw new Error(
				`Azure endpoint URL is required for Claude models.\n\n` +
					`Please configure 'azureBaseUrl' in your settings.\n` +
					`Example: https://<your-resource>.services.ai.azure.com/anthropic/\n\n` +
					`See Azure documentation: https://learn.microsoft.com/azure/ai-services/openai/`,
			)
		}

		try {
			validateAzureUrl(baseURL, "Claude")
		} catch (error) {
			throw new Error(
				`Azure Claude client initialization failed:\n${(error as Error).message}\n\n` +
					`Please check your Azure configuration in settings.`,
			)
		}

		// Normalize URL for Claude models (ensures /anthropic suffix)
		const normalizedBaseURL = normalizeAzureUrl(baseURL, true)

		// Dynamically import AnthropicFoundry only when needed to reduce bundle size
		try {
			const { default: AnthropicFoundry } = await import("@anthropic-ai/foundry-sdk")

			this.claudeClient = new AnthropicFoundry({
				apiKey,
				baseURL: normalizedBaseURL,
			})
		} catch (error) {
			// Check if this is an import error vs configuration error
			const errorMessage = (error as Error).message
			if (errorMessage.includes("Cannot find module") || errorMessage.includes("Failed to resolve")) {
				throw new Error(
					`Failed to load Azure Claude SDK:\n${errorMessage}\n\n` +
						`The @anthropic-ai/foundry-sdk package may not be installed.\n` +
						`Please ensure it is included in your dependencies.`,
				)
			}

			throw new Error(
				`Failed to initialize Azure Claude client:\n${errorMessage}\n\n` +
					`Configuration:\n` +
					`- baseURL: ${normalizedBaseURL}\n` +
					`- API Key: ${apiKey ? "[provided]" : "[missing]"}\n\n` +
					`Please verify your Azure AI Services deployment is configured correctly.`,
			)
		}
	}

	private isClaudeModel(modelId: string): boolean {
		return modelId.includes("claude")
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId } = this.getModel()

		if (this.isClaudeModel(modelId)) {
			yield* this.createClaudeMessage(systemPrompt, messages, metadata)
		} else {
			yield* this.createOpenAIMessage(systemPrompt, messages, metadata)
		}
	}

	private async *createClaudeMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.initClaudeClient()

		const { id: modelId, maxTokens, temperature } = this.getModel()
		const deploymentName = this.options.azureDeploymentName || modelId
		const cacheControl: CacheControlEphemeral = { type: "ephemeral" }

		// Prepare beta flags array
		const betas: string[] = []

		// Add 1M context beta flag if enabled for Claude Sonnet 4.5
		if (AZURE_1M_CONTEXT_MODEL_IDS.includes(modelId as any) && this.options.azureBeta1MContext) {
			betas.push("context-1m-2025-08-07")
		}

		// Add prompt caching beta
		betas.push("prompt-caching-2024-07-31")

		// Apply prompt caching to system and last two user messages
		const userMsgIndices = messages.reduce(
			(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
			[] as number[],
		)

		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

		const stream: AnthropicStream<any> = await this.claudeClient.messages.create(
			{
				model: deploymentName,
				max_tokens: maxTokens ?? 64_000,
				temperature,
				system: [{ text: systemPrompt, type: "text", cache_control: cacheControl }],
				messages: messages.map((message, index) => {
					if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
						return {
							...message,
							content:
								typeof message.content === "string"
									? [{ type: "text", text: message.content, cache_control: cacheControl }]
									: message.content.map((content, contentIndex) =>
											contentIndex === message.content.length - 1
												? { ...content, cache_control: cacheControl }
												: content,
										),
						}
					}
					return message
				}),
				stream: true,
			},
			{
				headers: {
					"anthropic-beta": betas.join(","),
				},
			},
		)

		let inputTokens = 0
		let outputTokens = 0
		let cacheWriteTokens = 0
		let cacheReadTokens = 0

		for await (const chunk of stream) {
			switch (chunk.type) {
				case "message_start": {
					const {
						input_tokens = 0,
						output_tokens = 0,
						cache_creation_input_tokens,
						cache_read_input_tokens,
					} = chunk.message.usage

					yield {
						type: "usage",
						inputTokens: input_tokens,
						outputTokens: output_tokens,
						cacheWriteTokens: cache_creation_input_tokens || undefined,
						cacheReadTokens: cache_read_input_tokens || undefined,
					}

					inputTokens += input_tokens
					outputTokens += output_tokens
					cacheWriteTokens += cache_creation_input_tokens || 0
					cacheReadTokens += cache_read_input_tokens || 0

					break
				}
				case "message_delta":
					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage.output_tokens || 0,
					}
					break
				case "content_block_start":
					switch (chunk.content_block.type) {
						case "thinking":
							if (chunk.index > 0) {
								yield { type: "reasoning", text: "\n" }
							}
							yield { type: "reasoning", text: chunk.content_block.thinking }
							break
						case "text":
							if (chunk.index > 0) {
								yield { type: "text", text: "\n" }
							}
							yield { type: "text", text: chunk.content_block.text }
							break
					}
					break
				case "content_block_delta":
					switch (chunk.delta.type) {
						case "thinking_delta":
							yield { type: "reasoning", text: chunk.delta.thinking }
							break
						case "text_delta":
							yield { type: "text", text: chunk.delta.text }
							break
					}
					break
			}
		}
	}

	private async *createOpenAIMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		if (!this.openaiClient) {
			throw new Error("Azure OpenAI client not initialized")
		}

		const { id: modelId, info: modelInfo, reasoning } = this.getModel()
		const deploymentName = this.options.azureDeploymentName || modelId
		const temperature = this.options.modelTemperature ?? (modelInfo.supportsTemperature ? 0 : undefined)

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: deploymentName,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true as const,
			stream_options: { include_usage: true },
			...(reasoning && reasoning),
			...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
		}

		// Add max_completion_tokens if needed
		if (this.options.includeMaxTokens === true) {
			requestOptions.max_completion_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}

		let stream
		try {
			stream = await this.openaiClient.chat.completions.create(requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, "Azure OpenAI")
		}

		const matcher = new XmlMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>()

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta
			const finishReason = chunk.choices?.[0]?.finish_reason

			if (delta?.content) {
				for (const processedChunk of matcher.update(delta.content)) {
					yield processedChunk
				}
			}

			if (delta && "reasoning_content" in delta) {
				const reasoning_content = (delta.reasoning_content as string | undefined) || ""
				if (reasoning_content?.trim()) {
					yield { type: "reasoning", text: reasoning_content }
				}
			}

			if (delta?.tool_calls) {
				for (const toolCall of delta.tool_calls) {
					const index = toolCall.index
					const existing = toolCallAccumulator.get(index)

					if (existing) {
						if (toolCall.function?.arguments) {
							existing.arguments += toolCall.function.arguments
						}
					} else {
						toolCallAccumulator.set(index, {
							id: toolCall.id || "",
							name: toolCall.function?.name || "",
							arguments: toolCall.function?.arguments || "",
						})
					}
				}
			}

			if (finishReason === "tool_calls") {
				for (const toolCall of toolCallAccumulator.values()) {
					yield {
						type: "tool_call",
						id: toolCall.id,
						name: toolCall.name,
						arguments: toolCall.arguments,
					}
				}
				toolCallAccumulator.clear()
			}

			if (chunk.usage) {
				// Azure OpenAI may include cache usage properties
				const usage = chunk.usage as any
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
					cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
					cacheReadTokens: usage.cache_read_input_tokens || undefined,
				}
			}
		}

		for (const processedChunk of matcher.final()) {
			yield processedChunk
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId
		const id = modelId && modelId in azureModels ? (modelId as AzureModelId) : azureDefaultModelId
		let info: ModelInfo = azureModels[id]

		// Handle Claude and GPT models separately to maintain type safety
		if (this.isClaudeModel(id)) {
			// If 1M context beta is enabled for Claude Sonnet 4.5, update the model info
			if (AZURE_1M_CONTEXT_MODEL_IDS.includes(id as any) && this.options.azureBeta1MContext) {
				// Use the tier pricing for 1M context
				const tier = info.tiers?.[0]
				if (tier) {
					info = {
						...info,
						contextWindow: tier.contextWindow,
						inputPrice: tier.inputPrice,
						outputPrice: tier.outputPrice,
						cacheWritesPrice: tier.cacheWritesPrice,
						cacheReadsPrice: tier.cacheReadsPrice,
					}
				}
			}

			const params = getModelParams({
				format: "anthropic",
				modelId: id,
				model: info,
				settings: this.options,
			})
			return { id, info, ...params }
		} else {
			const params = getModelParams({
				format: "openai",
				modelId: id,
				model: info,
				settings: this.options,
			})
			return { id, info, ...params }
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId } = this.getModel()

		if (this.isClaudeModel(modelId)) {
			await this.initClaudeClient()
			const deploymentName = this.options.azureDeploymentName || modelId

			const message = await this.claudeClient.messages.create({
				model: deploymentName,
				max_tokens: 8192,
				messages: [{ role: "user", content: prompt }],
				stream: false,
			})

			const content = message.content.find(({ type }: any) => type === "text")
			return content?.type === "text" ? content.text : ""
		} else {
			if (!this.openaiClient) {
				throw new Error("Azure OpenAI client not initialized")
			}

			const deploymentName = this.options.azureDeploymentName || modelId

			const response = await this.openaiClient.chat.completions.create({
				model: deploymentName,
				messages: [{ role: "user", content: prompt }],
			})

			return response.choices?.[0]?.message.content || ""
		}
	}
}
