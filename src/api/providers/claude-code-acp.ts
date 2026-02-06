import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	type ModelInfo,
	claudeCodeAcpModels,
	claudeCodeAcpDefaultModelId,
	type ClaudeCodeAcpModelId,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream, ApiStreamChunk } from "../transform/stream"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

import { getSharedSessionManager, type AcpSessionUpdate } from "../../integrations/claude-code-acp"

/**
 * Extended options for Claude Code ACP handler
 */
interface ClaudeCodeAcpHandlerOptions extends ApiHandlerOptions {
	claudeCodeAcpExecutablePath?: string
	claudeCodeAcpWorkingDirectory?: string
}

/**
 * Tag used in the proxy prompt to delimit tool calls in the model's response.
 * The model outputs JSON tool calls wrapped in these tags.
 */
const TOOL_CALL_OPEN_TAG = "<roo_tool_call>"
const TOOL_CALL_CLOSE_TAG = "</roo_tool_call>"

/**
 * Maximum characters per individual tool result content.
 * Larger results are truncated with a marker.
 */
const MAX_TOOL_RESULT_CHARS = 8_000

/**
 * Claude Code ACP Handler — LLM Proxy Mode
 *
 * Uses Claude Code ACP as a raw LLM proxy (not as an autonomous agent).
 * The model receives the full system prompt, conversation history, and tool
 * definitions on the FIRST turn. Subsequent turns only send delta messages
 * (new tool results) to avoid duplicating context in the ACP session.
 *
 * This makes the ACP provider behave like other providers (OpenAI, Anthropic):
 * the model decides which Roo Code tools to call, and Roo Code's task loop
 * handles execution and continuation.
 */
export class ClaudeCodeAcpHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ClaudeCodeAcpHandlerOptions
	private sessionId: string | null = null

	/**
	 * Tracks number of messages sent in the last prompt.
	 * Used to compute delta (new messages only) for subsequent ACP turns.
	 * Reset when session changes.
	 */
	private lastSentMessageCount = 0
	private isSessionInitialized = false

	constructor(options: ClaudeCodeAcpHandlerOptions) {
		super()
		this.options = options
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()
		const manager = getSharedSessionManager(this.options.claudeCodeAcpExecutablePath)

		// Get working directory from options or use current
		const workingDirectory = this.options.claudeCodeAcpWorkingDirectory || process.cwd()

		// Get or create a session
		const session = await manager.getOrCreateSession(workingDirectory, model.id)

		// Detect session change — reset state if new session
		if (this.sessionId !== session.sessionId) {
			this.lastSentMessageCount = 0
			this.isSessionInitialized = false
		}
		this.sessionId = session.sessionId

		// Build prompt: full on first turn, delta on subsequent turns
		const proxyPrompt = this.isSessionInitialized
			? this.buildDeltaPrompt(messages, metadata?.tool_choice)
			: this.buildFullProxyPrompt(systemPrompt, messages, metadata?.tools, metadata?.tool_choice)

		// Update state BEFORE sending (so if we crash, we don't re-send full prompt)
		this.lastSentMessageCount = messages.length
		this.isSessionInitialized = true

		// Collect all text from streaming updates
		const textChunks: string[] = []
		const totalInputChars = proxyPrompt.length

		const result = await this.sendPromptStreaming(session.sessionId, proxyPrompt, (text) => {
			textChunks.push(text)
		})

		if (result.error) {
			// On error, reset session state so next call sends full prompt
			this.isSessionInitialized = false
			this.lastSentMessageCount = 0
			throw result.error
		}

		const fullText = textChunks.join("")

		// Parse response for text and tool calls
		const parsed = this.parseProxyResponse(fullText)

		// Yield all parsed chunks
		for (const chunk of parsed) {
			yield chunk
		}

		// Emit usage estimate
		yield {
			type: "usage",
			inputTokens: Math.ceil(totalInputChars / 4),
			outputTokens: Math.ceil(fullText.length / 4),
		}
	}

	/**
	 * Send a prompt to the ACP session and collect streaming text.
	 */
	private async sendPromptStreaming(
		sessionId: string,
		prompt: string,
		onText: (text: string) => void,
	): Promise<{ stopReason?: string; error?: Error }> {
		const manager = getSharedSessionManager(this.options.claudeCodeAcpExecutablePath)

		const updateQueue: Array<Record<string, unknown>> = []
		let resolveWaiting: (() => void) | null = null
		let isComplete = false
		let promptError: Error | null = null

		const onUpdate = (update: AcpSessionUpdate) => {
			const rawUpdate = update as unknown as Record<string, unknown>
			updateQueue.push(rawUpdate)
			if (resolveWaiting) {
				resolveWaiting()
				resolveWaiting = null
			}
		}

		// Start the prompt (don't await - process updates as they arrive)
		const promptPromise = manager
			.sendPrompt(sessionId, prompt, onUpdate)
			.then((result) => {
				isComplete = true
				if (resolveWaiting) {
					resolveWaiting()
					resolveWaiting = null
				}
				return result
			})
			.catch((error) => {
				promptError = error instanceof Error ? error : new Error(String(error))
				isComplete = true
				if (resolveWaiting) {
					resolveWaiting()
					resolveWaiting = null
				}
				return undefined
			})

		// Process updates as they arrive
		while (!isComplete || updateQueue.length > 0) {
			if (updateQueue.length === 0 && !isComplete) {
				await new Promise<void>((resolve) => {
					resolveWaiting = resolve
				})
			}

			while (updateQueue.length > 0) {
				const rawUpdate = updateQueue.shift()!
				const text = this.extractTextFromUpdate(rawUpdate)
				if (text) {
					onText(text)
				}
			}
		}

		const promptResult = await promptPromise

		return {
			stopReason: promptResult?.stopReason,
			error: promptError ?? undefined,
		}
	}

	// ─── Proxy Prompt Building ───────────────────────────────────────────

	/**
	 * Build the FULL proxy prompt for the first turn in an ACP session.
	 *
	 * Includes everything the model needs:
	 * 1. Proxy mode instructions
	 * 2. Full system prompt from Roo Code
	 * 3. Tool definitions
	 * 4. Conversation history (environment_details stripped from old messages)
	 */
	private buildFullProxyPrompt(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		tools?: OpenAI.Chat.ChatCompletionTool[],
		toolChoice?: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"],
	): string {
		const parts: string[] = []

		// Proxy mode instructions
		parts.push(this.buildProxyInstructions(toolChoice))

		// Full system prompt
		if (systemPrompt) {
			parts.push(`[SYSTEM PROMPT]\n${systemPrompt}`)
		}

		// Tool definitions
		if (tools && tools.length > 0) {
			parts.push(this.formatToolDefinitions(tools))
		}

		// Conversation history (with environment_details stripping)
		const formattedMessages = this.formatConversation(messages)
		if (formattedMessages) {
			parts.push(`[CONVERSATION]\n${formattedMessages}`)
		}

		return parts.join("\n\n---\n\n")
	}

	/**
	 * Build a DELTA prompt for subsequent turns in the same ACP session.
	 *
	 * Since the ACP session already has the system prompt, tool definitions,
	 * and previous conversation from earlier turns, we only send:
	 * 1. New messages (tool results, new user content)
	 * 2. A brief continuation reminder
	 *
	 * This prevents O(N²) context growth that causes "Prompt is too long" errors.
	 */
	private buildDeltaPrompt(
		messages: Anthropic.Messages.MessageParam[],
		toolChoice?: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"],
	): string {
		// Get only the new messages since last prompt
		const newMessages = messages.slice(this.lastSentMessageCount)

		const parts: string[] = []

		// Format new messages (typically tool results + maybe new user text)
		if (newMessages.length > 0) {
			parts.push(this.formatDeltaMessages(newMessages))
		}

		// Brief continuation instruction
		let toolChoiceReminder = ""
		if (toolChoice === "required") {
			toolChoiceReminder = " You MUST use at least one tool."
		} else if (toolChoice === "none") {
			toolChoiceReminder = " Do NOT use any tools, respond with text only."
		} else if (typeof toolChoice === "object") {
			const fnName = (toolChoice as unknown as { function?: { name?: string } })?.function?.name
			if (fnName) {
				toolChoiceReminder = ` You MUST use the "${fnName}" tool.`
			}
		}

		parts.push(
			`Continue with your task. Remember to use ${TOOL_CALL_OPEN_TAG} format for tool calls.${toolChoiceReminder}`,
		)

		return parts.join("\n\n")
	}

	/**
	 * Build the proxy mode instructions that tell Claude Code to act as a raw LLM.
	 */
	private buildProxyInstructions(toolChoice?: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"]): string {
		let toolChoiceInstruction = ""
		if (toolChoice === "required") {
			toolChoiceInstruction = "\nIMPORTANT: You MUST use at least one tool in your response."
		} else if (toolChoice === "none") {
			toolChoiceInstruction = "\nIMPORTANT: Do NOT use any tools. Respond with text only."
		} else if (typeof toolChoice === "object") {
			// OpenAI v5 types: ChatCompletionNamedToolChoice has .function.name
			const fnName = (toolChoice as unknown as { function?: { name?: string } })?.function?.name
			if (fnName) {
				toolChoiceInstruction = `\nIMPORTANT: You MUST use the "${fnName}" tool.`
			}
		}

		return `[LLM PROXY MODE]
You are acting as a direct LLM assistant for Roo Code. CRITICAL RULES:

1. Do NOT use your built-in tools (Bash, Read, Write, Edit, Glob, Grep, Task, etc.)
2. Instead, express ALL tool calls using the ${TOOL_CALL_OPEN_TAG} XML format shown below
3. Your text response and tool calls will be parsed by Roo Code's system
4. Roo Code will execute the tools and provide results in follow-up messages
5. Respond EXACTLY as if you were a Claude API being called directly

TOOL CALL FORMAT — when you want to use a tool, output EXACTLY:
${TOOL_CALL_OPEN_TAG}
{"name": "tool_name", "arguments": {"param1": "value1", "param2": "value2"}}
${TOOL_CALL_CLOSE_TAG}

You can mix text and tool calls freely. Each tool call must be in its own tag block.
The "arguments" field must be a JSON object matching the tool's parameter schema.${toolChoiceInstruction}`
	}

	/**
	 * Format tool definitions as text for inclusion in the proxy prompt.
	 */
	private formatToolDefinitions(tools: OpenAI.Chat.ChatCompletionTool[]): string {
		const toolTexts = tools
			.filter((t) => t.type === "function")
			.map((t) => {
				// Use `any` cast like base-provider.ts does for OpenAI v5 compatibility
				const fn = (t as any).function as { name: string; description?: string; parameters?: unknown }
				// Compact JSON (no indentation) to save ~30% on schema size
				const params = fn.parameters ? JSON.stringify(fn.parameters) : "{}"
				return `### ${fn.name}\n${fn.description || "(no description)"}\nParameters: ${params}`
			})

		return `[AVAILABLE TOOLS]\n${toolTexts.join("\n\n")}`
	}

	// ─── Conversation Formatting ────────────────────────────────────────

	/**
	 * Format ALL conversation messages for the first turn's proxy prompt.
	 *
	 * Optimizations:
	 * 1. Strips <environment_details> from all messages except the last user message
	 * 2. Truncates large tool results to MAX_TOOL_RESULT_CHARS
	 */
	private formatConversation(messages: Anthropic.Messages.MessageParam[]): string {
		// Find the index of the last user message (to preserve its environment_details)
		let lastUserMsgIndex = -1
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === "user") {
				lastUserMsgIndex = i
				break
			}
		}

		const formattedMessages: string[] = []
		for (let i = 0; i < messages.length; i++) {
			const formatted = this.formatSingleMessage(messages[i], i === lastUserMsgIndex)
			if (formatted) {
				formattedMessages.push(formatted)
			}
		}

		return formattedMessages.join("\n\n")
	}

	/**
	 * Format only NEW messages for delta prompts (subsequent turns).
	 *
	 * These are typically tool_result blocks from Roo Code after executing
	 * the tools the model requested in its previous response.
	 */
	private formatDeltaMessages(messages: Anthropic.Messages.MessageParam[]): string {
		const parts: string[] = []

		for (const msg of messages) {
			// In delta mode, strip environment_details from all messages
			// (the model already has the workspace context from the first turn)
			const formatted = this.formatSingleMessage(msg, false)
			if (formatted) {
				parts.push(formatted)
			}
		}

		return parts.join("\n\n")
	}

	/**
	 * Format a single message (user or assistant) for inclusion in the prompt.
	 */
	private formatSingleMessage(
		msg: Anthropic.Messages.MessageParam,
		preserveEnvironmentDetails: boolean,
	): string | null {
		const role = msg.role === "user" ? "Human" : "Assistant"

		if (typeof msg.content === "string") {
			const text = preserveEnvironmentDetails ? msg.content : this.stripEnvironmentDetails(msg.content)
			return `[${role}]:\n${text}`
		}

		const blockTexts: string[] = []
		for (const block of msg.content) {
			if (block.type === "text") {
				const text = preserveEnvironmentDetails ? block.text : this.stripEnvironmentDetails(block.text)
				blockTexts.push(text)
			} else if (block.type === "tool_use") {
				blockTexts.push(
					`${TOOL_CALL_OPEN_TAG}\n${JSON.stringify({ name: block.name, arguments: block.input })}\n${TOOL_CALL_CLOSE_TAG}`,
				)
			} else if (block.type === "tool_result") {
				let content =
					typeof block.content === "string"
						? block.content
						: block.content
								?.map((c) => (c.type === "text" ? c.text : ""))
								.filter(Boolean)
								.join("\n") || ""

				// Truncate large tool results
				if (content.length > MAX_TOOL_RESULT_CHARS) {
					content =
						content.slice(0, MAX_TOOL_RESULT_CHARS) +
						`\n[...truncated, showing first ${MAX_TOOL_RESULT_CHARS} of ${content.length} chars]`
				}

				// Strip environment_details from tool results too
				content = this.stripEnvironmentDetails(content)

				const errorFlag = block.is_error ? " [ERROR]" : ""
				blockTexts.push(`[Tool Result${errorFlag} for ${block.tool_use_id}]:\n${content}`)
			}
		}

		if (blockTexts.length > 0) {
			return `[${role}]:\n${blockTexts.join("\n\n")}`
		}

		return null
	}

	/**
	 * Strip <environment_details>...</environment_details> blocks from text.
	 * These are appended by Roo Code to every user message and are very large
	 * (full workspace file tree). Only needed once in the first turn.
	 */
	private stripEnvironmentDetails(text: string): string {
		return text.replace(/<environment_details>[\s\S]*?<\/environment_details>/g, "[environment_details omitted]")
	}

	// ─── Response Parsing ────────────────────────────────────────────────

	/**
	 * Parse the proxy response to extract text and tool calls.
	 *
	 * Scans for <roo_tool_call> blocks, parses their JSON content,
	 * and yields ApiStreamChunks for both text and tool calls.
	 */
	private parseProxyResponse(text: string): ApiStreamChunk[] {
		const chunks: ApiStreamChunk[] = []
		const regex = new RegExp(
			`${this.escapeRegex(TOOL_CALL_OPEN_TAG)}\\s*([\\s\\S]*?)\\s*${this.escapeRegex(TOOL_CALL_CLOSE_TAG)}`,
			"g",
		)

		let lastIndex = 0
		let match: RegExpExecArray | null
		let toolCallIndex = 0

		while ((match = regex.exec(text)) !== null) {
			// Text before this tool call
			const textBefore = text.slice(lastIndex, match.index).trim()
			if (textBefore) {
				chunks.push({ type: "text", text: textBefore })
			}

			// Parse the tool call JSON
			try {
				const toolCall = JSON.parse(match[1])
				const toolName = toolCall.name as string
				const toolArgs = toolCall.arguments

				if (toolName) {
					chunks.push({
						type: "tool_call",
						id: `acp_proxy_${Date.now()}_${toolCallIndex++}`,
						name: toolName,
						arguments: typeof toolArgs === "string" ? toolArgs : JSON.stringify(toolArgs ?? {}),
					})
				} else {
					// Invalid tool call format — yield as text
					chunks.push({ type: "text", text: match[0] })
				}
			} catch {
				// JSON parse error — yield raw text
				console.debug("[ClaudeCodeAcpHandler] Failed to parse tool call JSON:", match[1].slice(0, 200))
				chunks.push({ type: "text", text: match[0] })
			}

			lastIndex = match.index + match[0].length
		}

		// Remaining text after last tool call
		const remaining = text.slice(lastIndex).trim()
		if (remaining) {
			chunks.push({ type: "text", text: remaining })
		}

		return chunks
	}

	/**
	 * Escape special regex characters in a string.
	 */
	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	}

	// ─── ACP Update Extraction ───────────────────────────────────────────

	/**
	 * Extract text from an ACP session update.
	 *
	 * In proxy mode, we only extract text from agent_message_chunk events.
	 * Tool calls from the ACP agent are ignored since we told it not to use them.
	 */
	private extractTextFromUpdate(update: Record<string, unknown>): string | null {
		const updateType = (update.sessionUpdate ?? update.type) as string | undefined
		if (!updateType) return null

		// Agent message chunks — the main text response
		if (updateType === "agent_message_chunk" || updateType === "AgentMessageChunk") {
			return this.extractTextFromContent(update.content as Record<string, unknown> | undefined)
		}

		// Thought/reasoning chunks — include as text
		if (updateType === "agent_thought_chunk" || updateType === "AgentThoughtChunk") {
			return this.extractTextFromContent(update.content as Record<string, unknown> | undefined)
		}

		// In proxy mode, skip tool_call and tool_call_update events
		// (if the agent uses its own tools despite our instructions, we ignore them)
		return null
	}

	/**
	 * Extract text from a content block.
	 */
	private extractTextFromContent(content: Record<string, unknown> | undefined): string | null {
		if (!content) return null

		if (content.type === "text" && typeof content.text === "string") {
			return content.text
		}

		if (typeof content.text === "string") {
			return content.text
		}

		return null
	}

	// ─── Model & Completion ──────────────────────────────────────────────

	override getModel(): { id: string; info: ModelInfo } {
		const id = (this.options.apiModelId as ClaudeCodeAcpModelId) ?? claudeCodeAcpDefaultModelId
		const info =
			claudeCodeAcpModels[id as keyof typeof claudeCodeAcpModels] ||
			claudeCodeAcpModels[claudeCodeAcpDefaultModelId]
		return { id, info }
	}

	async completePrompt(prompt: string): Promise<string> {
		const manager = getSharedSessionManager(this.options.claudeCodeAcpExecutablePath)
		const model = this.getModel()
		const workingDirectory = this.options.claudeCodeAcpWorkingDirectory || process.cwd()

		const session = await manager.getOrCreateSession(workingDirectory, model.id)

		const textParts: string[] = []
		await manager.sendPrompt(session.sessionId, prompt, (update) => {
			const rawUpdate = update as unknown as Record<string, unknown>
			const text = this.extractTextFromUpdate(rawUpdate)
			if (text) {
				textParts.push(text)
			}
		})

		return textParts.join("")
	}
}
