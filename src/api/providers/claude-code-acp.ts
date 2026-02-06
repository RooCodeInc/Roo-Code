import { Anthropic } from "@anthropic-ai/sdk"

import {
	type ModelInfo,
	claudeCodeAcpModels,
	claudeCodeAcpDefaultModelId,
	type ClaudeCodeAcpModelId,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream } from "../transform/stream"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

import { getSharedSessionManager, type AcpSessionUpdate, type AcpTextContent } from "../../integrations/claude-code-acp"

/**
 * Extended options for Claude Code ACP handler
 */
interface ClaudeCodeAcpHandlerOptions extends ApiHandlerOptions {
	claudeCodeAcpExecutablePath?: string
	claudeCodeAcpWorkingDirectory?: string
}

/**
 * Claude Code ACP Handler
 *
 * Integrates Claude Code through the Agent Client Protocol (ACP).
 * Authentication is handled by the Claude Code CLI (stored in system keychain).
 */
export class ClaudeCodeAcpHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ClaudeCodeAcpHandlerOptions
	private sessionId: string | null = null

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
		this.sessionId = session.sessionId

		// Extract only the last user message - ACP sessions maintain their own context
		const lastUserMessage = this.extractLastUserMessage(messages)

		// Collect ALL text from streaming updates using a simple buffer approach
		const textChunks: string[] = []
		let hasYieldedText = false

		// Create a deferred promise pattern for streaming
		const updateQueue: Array<Record<string, unknown>> = []
		let resolveWaiting: (() => void) | null = null
		let isComplete = false
		let promptError: Error | null = null

		const onUpdate = (update: AcpSessionUpdate) => {
			// Store the raw update for processing
			updateQueue.push(update as unknown as Record<string, unknown>)
			if (resolveWaiting) {
				resolveWaiting()
				resolveWaiting = null
			}
		}

		// Start the prompt (don't await - process updates as they arrive)
		const promptPromise = manager
			.sendPrompt(session.sessionId, lastUserMessage, onUpdate)
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
					textChunks.push(text)
					hasYieldedText = true
					yield { type: "text", text }
				}
			}
		}

		// Check for errors
		if (promptError) {
			throw promptError
		}

		// Wait for completion
		await promptPromise

		// If no text was yielded, something went wrong with streaming
		// but the request completed - yield a placeholder
		if (!hasYieldedText) {
			console.warn("[ClaudeCodeAcpHandler] No text received from ACP session updates")
			textChunks.push(
				"[Claude Code ACP: Response received but no text content was streamed. Check the ACP adapter logs for details.]",
			)
		}

		// Synthesize an attempt_completion tool call so Roo Code's task
		// validation sees a proper tool_use block instead of text-only output.
		// The ACP session is a separate agent that doesn't know about Roo Code's
		// tools, so we wrap its response as a completed action.
		const fullText = textChunks.join("")
		yield {
			type: "tool_call",
			id: `acp_${Date.now()}`,
			name: "attempt_completion",
			arguments: JSON.stringify({ result: fullText }),
		}

		// Emit usage estimate
		yield {
			type: "usage",
			inputTokens: Math.ceil(lastUserMessage.length / 4),
			outputTokens: Math.ceil(fullText.length / 4),
		}
	}

	/**
	 * Extract text from any ACP session update.
	 *
	 * Per the ACP spec, updates use a "sessionUpdate" discriminator field
	 * with snake_case values (e.g., "agent_message_chunk", "tool_call").
	 */
	private extractTextFromUpdate(update: Record<string, unknown>): string | null {
		// ACP spec uses "sessionUpdate" as the discriminator field
		const updateType = (update.sessionUpdate ?? update.type) as string | undefined

		if (!updateType) {
			console.debug(
				"[ClaudeCodeAcpHandler] Update without sessionUpdate/type field:",
				JSON.stringify(update).slice(0, 200),
			)
			return null
		}

		// Handle agent message chunks (the main text response)
		if (updateType === "agent_message_chunk" || updateType === "AgentMessageChunk") {
			return this.extractTextFromContent(update.content as Record<string, unknown> | undefined)
		}

		// Handle thought/reasoning chunks
		if (updateType === "agent_thought_chunk" || updateType === "AgentThoughtChunk") {
			const text = this.extractTextFromContent(update.content as Record<string, unknown> | undefined)
			if (text) {
				return text
			}
			return null
		}

		// Handle tool calls - show them as informational text
		if (updateType === "tool_call" || updateType === "ToolCall") {
			const title = (update.title as string) || (update.name as string) || "unknown"
			const status = update.status as string
			if (status === "pending" || status === "in_progress") {
				return `\n[Tool: ${title}]\n`
			}
			return null
		}

		// Handle tool call updates
		// ACP spec sends fields flat (status, content, etc.) not nested under "fields"
		if (updateType === "tool_call_update" || updateType === "ToolCallUpdate") {
			const status = (update.status ?? (update.fields as Record<string, unknown> | undefined)?.status) as
				| string
				| undefined
			if (status === "completed") {
				const content = (update.content ?? (update.fields as Record<string, unknown> | undefined)?.content) as
					| Array<Record<string, unknown>>
					| undefined
				if (content) {
					const texts = content.filter((c) => c.type === "text" && c.text).map((c) => c.text as string)
					if (texts.length > 0) {
						return texts.join("")
					}
				}
			}
			return null
		}

		// Skip plan updates silently (they don't contain streamable text)
		if (updateType === "plan") {
			return null
		}

		// Log any unrecognized update types for debugging
		console.debug(
			`[ClaudeCodeAcpHandler] Unhandled update type: "${updateType}"`,
			JSON.stringify(update).slice(0, 300),
		)
		return null
	}

	/**
	 * Extract text from a content block
	 */
	private extractTextFromContent(content: Record<string, unknown> | undefined): string | null {
		if (!content) return null

		// Direct text content: { type: "text", text: "..." }
		if (content.type === "text" && typeof content.text === "string") {
			return content.text
		}

		// Maybe the content IS the text directly
		if (typeof content.text === "string") {
			return content.text
		}

		return null
	}

	/**
	 * Extract the last user message text from the conversation.
	 * In ACP, the session manages conversation history, so we only send the latest message.
	 */
	private extractLastUserMessage(messages: Anthropic.Messages.MessageParam[]): string {
		// Find the last user message
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === "user") {
				return this.extractTextContent(messages[i].content)
			}
		}

		// Fallback: combine all messages
		return messages
			.map((m) => this.extractTextContent(m.content))
			.filter(Boolean)
			.join("\n\n")
	}

	/**
	 * Extract text content from message content
	 */
	private extractTextContent(content: string | Anthropic.Messages.ContentBlockParam[]): string {
		if (typeof content === "string") {
			return content
		}

		const textParts: string[] = []
		for (const block of content) {
			if (block.type === "text") {
				textParts.push(block.text)
			} else if (block.type === "tool_result") {
				const resultContent =
					typeof block.content === "string"
						? block.content
						: block.content?.map((c) => (c.type === "text" ? c.text : "")).join("") || ""
				if (resultContent) {
					textParts.push(resultContent)
				}
			}
		}

		return textParts.join("\n")
	}

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
