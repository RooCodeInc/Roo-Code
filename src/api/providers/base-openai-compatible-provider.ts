import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelInfo, toolNames } from "@roo-code/types"

import { type ApiHandlerOptions, getModelMaxOutputTokens } from "../../shared/api"
import { XmlMatcher } from "../../utils/xml-matcher"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { calculateApiCostOpenAI } from "../../shared/cost"
import { getApiRequestTimeout } from "./utils/timeout-config"

type BaseOpenAiCompatibleProviderOptions<ModelName extends string> = ApiHandlerOptions & {
	providerName: string
	baseURL: string
	defaultProviderModelId: ModelName
	providerModels: Record<ModelName, ModelInfo>
	defaultTemperature?: number
}

export abstract class BaseOpenAiCompatibleProvider<ModelName extends string>
	extends BaseProvider
	implements SingleCompletionHandler
{
	protected readonly providerName: string
	protected readonly baseURL: string
	protected readonly defaultTemperature: number
	protected readonly defaultProviderModelId: ModelName
	protected readonly providerModels: Record<ModelName, ModelInfo>

	protected readonly options: ApiHandlerOptions

	protected client: OpenAI

	constructor({
		providerName,
		baseURL,
		defaultProviderModelId,
		providerModels,
		defaultTemperature,
		...options
	}: BaseOpenAiCompatibleProviderOptions<ModelName>) {
		super()

		this.providerName = providerName
		this.baseURL = baseURL
		this.defaultProviderModelId = defaultProviderModelId
		this.providerModels = providerModels
		this.defaultTemperature = defaultTemperature ?? 0

		this.options = options

		if (!this.options.apiKey) {
			throw new Error("API key is required")
		}

		this.client = new OpenAI({
			baseURL,
			apiKey: this.options.apiKey,
			defaultHeaders: DEFAULT_HEADERS,
			timeout: getApiRequestTimeout(),
		})
	}

	protected createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
	) {
		const { id: model, info } = this.getModel()

		// Centralized cap: clamp to 20% of the context window (unless provider-specific exceptions apply)
		const max_tokens =
			getModelMaxOutputTokens({
				modelId: model,
				model: info,
				settings: this.options,
				format: "openai",
			}) ?? undefined

		const temperature = this.options.modelTemperature ?? this.defaultTemperature

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
			...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
			...(metadata?.toolProtocol === "native" && {
				parallel_tool_calls: metadata.parallelToolCalls ?? false,
			}),
		}

		// Add thinking parameter if reasoning is enabled and model supports it
		if (this.options.enableReasoningEffort && info.supportsReasoningBinary) {
			;(params as any).thinking = { type: "enabled" }
		}

		try {
			return this.client.chat.completions.create(params, requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const stream = await this.createStream(systemPrompt, messages, metadata)

		const matcher = new XmlMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		let lastUsage: OpenAI.CompletionUsage | undefined
		let thinkingContent = ""
		let hasRegularContent = false

		for await (const chunk of stream) {
			// Check for provider-specific error responses (e.g., MiniMax base_resp)
			const chunkAny = chunk as any
			if (chunkAny.base_resp?.status_code && chunkAny.base_resp.status_code !== 0) {
				throw new Error(
					`${this.providerName} API Error (${chunkAny.base_resp.status_code}): ${chunkAny.base_resp.status_msg || "Unknown error"}`,
				)
			}

			const delta = chunk.choices?.[0]?.delta

			if (delta?.content) {
				for (const processedChunk of matcher.update(delta.content)) {
					// Track if we have regular content outside thinking tags
					if (processedChunk.type === "text") {
						hasRegularContent = true
					} else if (processedChunk.type === "reasoning") {
						// Accumulate thinking content for later processing
						thinkingContent += processedChunk.text
					}
					yield processedChunk
				}
			}

			if (delta) {
				for (const key of ["reasoning_content", "reasoning"] as const) {
					if (key in delta) {
						const reasoning_content = ((delta as any)[key] as string | undefined) || ""
						if (reasoning_content?.trim()) {
							thinkingContent += reasoning_content
							yield { type: "reasoning", text: reasoning_content }
						}
						break
					}
				}
			}

			// Emit raw tool call chunks - NativeToolCallParser handles state management
			if (delta?.tool_calls) {
				hasRegularContent = true // Tool calls count as regular content
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

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, this.getModel().info)
		}

		// Process any remaining content
		for (const processedChunk of matcher.final()) {
			if (processedChunk.type === "text") {
				hasRegularContent = true
			} else if (processedChunk.type === "reasoning") {
				thinkingContent += processedChunk.text
			}
			yield processedChunk
		}

		// If we only have thinking content and no regular content/tool calls,
		// try to extract tool calls from the thinking content
		if (!hasRegularContent && thinkingContent) {
			yield* this.extractToolCallsFromThinking(thinkingContent)
		}
	}

	/**
	 * Extract tool calls from thinking content when no regular content exists.
	 * This handles cases where models like kimi-k2-thinking embed tool calls
	 * within <think> tags.
	 */
	private *extractToolCallsFromThinking(thinkingContent: string): Generator<any> {
		// Look for tool call patterns in the thinking content
		// Common patterns include XML-like tags for tool calls
		const toolCallPatterns = [
			// Pattern 1: <tool_name>...</tool_name>
			/<(\w+)>([\s\S]*?)<\/\1>/g,
			// Pattern 2: <tool_name param="value" />
			/<(\w+)\s+([^>]+)\/>/g,
		]

		let toolCallIndex = 0

		for (const pattern of toolCallPatterns) {
			let match
			while ((match = pattern.exec(thinkingContent)) !== null) {
				const toolName = match[1]
				const content = match[2] || ""

				// Check if this looks like a known tool call
				if (this.isKnownTool(toolName)) {
					// Generate a unique ID for this tool call
					const toolCallId = `tool_${Date.now()}_${toolCallIndex}`

					// Try to parse arguments from the content
					let args = {}
					try {
						// First try to parse as JSON
						if (content.trim().startsWith("{")) {
							args = JSON.parse(content)
						} else {
							// Try to extract structured data from the content
							args = this.parseToolArguments(toolName, content)
						}
					} catch (e) {
						// If parsing fails, pass the raw content
						args = { content: content.trim() }
					}

					// Emit tool call partial chunks
					yield {
						type: "tool_call_partial",
						index: toolCallIndex,
						id: toolCallId,
						name: toolName,
						arguments: JSON.stringify(args),
					}

					toolCallIndex++
				}
			}
		}
	}

	/**
	 * Check if a string matches a known tool name.
	 * Uses toolNames from @roo-code/types as the source of truth,
	 * and also recognizes dynamically generated MCP tools (mcp_* prefix).
	 */
	private isKnownTool(name: string): boolean {
		const lowerName = name.toLowerCase()

		// Check against the canonical tool names from @roo-code/types
		if ((toolNames as readonly string[]).includes(lowerName)) {
			return true
		}

		// Also recognize dynamically generated MCP tools (format: mcp_serverName_toolName)
		if (lowerName.startsWith("mcp_")) {
			return true
		}

		return false
	}

	/**
	 * Parse tool arguments from content string.
	 */
	private parseToolArguments(toolName: string, content: string): any {
		// Try to extract structured arguments from content
		const args: any = {}

		// Look for common parameter patterns
		// Pattern: <param>value</param>
		const paramPattern = /<(\w+)>([\s\S]*?)<\/\1>/g
		let paramMatch
		while ((paramMatch = paramPattern.exec(content)) !== null) {
			const paramName = paramMatch[1]
			const paramValue = paramMatch[2]
			args[paramName] = paramValue
		}

		// If no structured params found, use content as the main parameter
		if (Object.keys(args).length === 0) {
			if (content.trim()) {
				// Map to the primary parameter for each tool
				// This covers all 22 tools from @roo-code/types
				const primaryParams: Record<string, string> = {
					// File operations
					read_file: "files",
					write_to_file: "content",
					apply_diff: "diff",
					search_and_replace: "operations",
					search_replace: "old_string",
					apply_patch: "patch",
					// Search and list operations
					list_files: "path",
					search_files: "regex",
					list_code_definition_names: "path",
					codebase_search: "query",
					// Command execution
					execute_command: "command",
					run_slash_command: "command",
					// Browser operations
					browser_action: "action",
					// MCP operations
					use_mcp_tool: "arguments",
					access_mcp_resource: "uri",
					// Task and mode operations
					ask_followup_question: "question",
					attempt_completion: "result",
					update_todo_list: "todos",
					switch_mode: "mode_slug",
					new_task: "message",
					fetch_instructions: "task",
					// Image generation
					generate_image: "prompt",
				}

				const primaryParam = primaryParams[toolName.toLowerCase()]
				if (primaryParam) {
					args[primaryParam] = content.trim()
				} else {
					// Fallback: use 'content' as a generic parameter name
					// This handles dynamically generated MCP tools (mcp_serverName_toolName)
					args["content"] = content.trim()
				}
			}
		}

		return args
	}

	protected processUsageMetrics(usage: any, modelInfo?: any): ApiStreamUsageChunk {
		const inputTokens = usage?.prompt_tokens || 0
		const outputTokens = usage?.completion_tokens || 0
		const cacheWriteTokens = usage?.prompt_tokens_details?.cache_write_tokens || 0
		const cacheReadTokens = usage?.prompt_tokens_details?.cached_tokens || 0

		const { totalCost } = modelInfo
			? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
			: { totalCost: 0 }

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens: cacheWriteTokens || undefined,
			cacheReadTokens: cacheReadTokens || undefined,
			totalCost,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info: modelInfo } = this.getModel()

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
			model: modelId,
			messages: [{ role: "user", content: prompt }],
		}

		// Add thinking parameter if reasoning is enabled and model supports it
		if (this.options.enableReasoningEffort && modelInfo.supportsReasoningBinary) {
			;(params as any).thinking = { type: "enabled" }
		}

		try {
			const response = await this.client.chat.completions.create(params)

			// Check for provider-specific error responses (e.g., MiniMax base_resp)
			const responseAny = response as any
			if (responseAny.base_resp?.status_code && responseAny.base_resp.status_code !== 0) {
				throw new Error(
					`${this.providerName} API Error (${responseAny.base_resp.status_code}): ${responseAny.base_resp.status_msg || "Unknown error"}`,
				)
			}

			return response.choices?.[0]?.message.content || ""
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}

	override getModel() {
		const id =
			this.options.apiModelId && this.options.apiModelId in this.providerModels
				? (this.options.apiModelId as ModelName)
				: this.defaultProviderModelId

		return { id, info: this.providerModels[id] }
	}
}
