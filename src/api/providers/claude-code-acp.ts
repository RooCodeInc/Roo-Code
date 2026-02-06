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

import { getSharedSessionManager, type AcpSessionUpdate } from "../../integrations/claude-code-acp"

/**
 * Extended options for Claude Code ACP handler
 */
interface ClaudeCodeAcpHandlerOptions extends ApiHandlerOptions {
	claudeCodeAcpExecutablePath?: string
	claudeCodeAcpWorkingDirectory?: string
}

/**
 * Maximum number of continuation retries when tool calls are still pending.
 */
const MAX_CONTINUATION_RETRIES = 3

/**
 * Maximum characters from system prompt to include as context.
 */
const MAX_SYSTEM_PROMPT_CONTEXT = 4000

/**
 * Claude Code ACP Handler
 *
 * Integrates Claude Code through the Agent Client Protocol (ACP).
 * Authentication is handled by the Claude Code CLI (stored in system keychain).
 *
 * Key behaviors:
 * - Includes Roo Code mode context (system prompt) in the prompt sent to the ACP agent
 * - Tracks tool call states to detect incomplete work
 * - Sends continuation prompts when tool calls are still pending at end of turn
 * - Only synthesizes attempt_completion when all work is truly complete
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

		// Build an enriched prompt that includes mode context and completion instructions
		const enrichedPrompt = this.buildEnrichedPrompt(systemPrompt, lastUserMessage)

		// Track tool call states across the entire interaction (including retries)
		const toolCallStates = new Map<string, string>()

		// Collect ALL text from streaming updates
		const textChunks: string[] = []
		let hasYieldedText = false
		let totalInputChars = enrichedPrompt.length

		// Run the first prompt and stream results
		const firstResult = await this.sendPromptStreaming(
			session.sessionId,
			enrichedPrompt,
			toolCallStates,
			(text) => {
				textChunks.push(text)
				hasYieldedText = true
			},
		)

		// Yield all collected text chunks from the first prompt
		for (const chunk of textChunks) {
			yield { type: "text", text: chunk }
		}

		if (firstResult.error) {
			throw firstResult.error
		}

		// Check for pending tool calls and retry if needed
		let retries = 0
		while (this.hasPendingToolCalls(toolCallStates) && retries < MAX_CONTINUATION_RETRIES) {
			retries++
			const pendingTools = this.getPendingToolNames(toolCallStates)
			console.debug(
				`[ClaudeCodeAcpHandler] Retry ${retries}/${MAX_CONTINUATION_RETRIES}: ${pendingTools.length} tool(s) still pending: ${pendingTools.join(", ")}`,
			)

			const continuationPrompt = this.buildContinuationPrompt(pendingTools)
			totalInputChars += continuationPrompt.length

			const retryChunks: string[] = []
			const retryResult = await this.sendPromptStreaming(
				session.sessionId,
				continuationPrompt,
				toolCallStates,
				(text) => {
					retryChunks.push(text)
					textChunks.push(text)
					hasYieldedText = true
				},
			)

			// Yield retry text chunks
			for (const chunk of retryChunks) {
				yield { type: "text", text: chunk }
			}

			if (retryResult.error) {
				console.error("[ClaudeCodeAcpHandler] Continuation prompt error:", retryResult.error)
				break
			}

			// If the agent ended for a non-recoverable reason, stop retrying
			if (retryResult.stopReason === "cancelled" || retryResult.stopReason === "refusal") {
				break
			}
		}

		if (retries >= MAX_CONTINUATION_RETRIES && this.hasPendingToolCalls(toolCallStates)) {
			const pending = this.getPendingToolNames(toolCallStates)
			console.warn(
				`[ClaudeCodeAcpHandler] Max retries reached with ${pending.length} tool(s) still pending: ${pending.join(", ")}`,
			)
		}

		// If no text was yielded, something went wrong with streaming
		if (!hasYieldedText) {
			console.warn("[ClaudeCodeAcpHandler] No text received from ACP session updates")
			textChunks.push(
				"[Claude Code ACP: Response received but no text content was streamed. Check the ACP adapter logs for details.]",
			)
		}

		// Synthesize attempt_completion with the complete response.
		// At this point, either all tool calls completed or we exhausted retries.
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
			inputTokens: Math.ceil(totalInputChars / 4),
			outputTokens: Math.ceil(fullText.length / 4),
		}
	}

	/**
	 * Send a prompt to the ACP session and collect streaming updates.
	 *
	 * This is a non-generator helper that manages the streaming lifecycle.
	 * Text chunks are delivered via the onText callback.
	 * Tool call states are tracked in the provided stateMap.
	 *
	 * Returns the prompt result (including stopReason) or an error.
	 */
	private async sendPromptStreaming(
		sessionId: string,
		prompt: string,
		toolCallStates: Map<string, string>,
		onText: (text: string) => void,
	): Promise<{ stopReason?: string; error?: Error }> {
		const manager = getSharedSessionManager(this.options.claudeCodeAcpExecutablePath)

		const updateQueue: Array<Record<string, unknown>> = []
		let resolveWaiting: (() => void) | null = null
		let isComplete = false
		let promptError: Error | null = null

		const onUpdate = (update: AcpSessionUpdate) => {
			const rawUpdate = update as unknown as Record<string, unknown>
			this.trackToolCallState(rawUpdate, toolCallStates)
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

		// Wait for completion and capture the result directly
		const promptResult = await promptPromise

		return {
			stopReason: promptResult?.stopReason,
			error: promptError ?? undefined,
		}
	}

	/**
	 * Build an enriched prompt that includes Roo Code mode context.
	 *
	 * The system prompt from Roo Code contains critical information about the
	 * current mode (orchestrator, code, architect, etc.), available tools, and
	 * behavioral instructions. Without this context, the ACP agent operates
	 * blindly, potentially ending turns with work still incomplete.
	 */
	private buildEnrichedPrompt(systemPrompt: string, userMessage: string): string {
		const parts: string[] = []

		// Include a truncated system prompt as context
		if (systemPrompt) {
			const truncatedPrompt =
				systemPrompt.length > MAX_SYSTEM_PROMPT_CONTEXT
					? systemPrompt.slice(0, MAX_SYSTEM_PROMPT_CONTEXT) + "\n... [truncated]"
					: systemPrompt

			parts.push(`[Roo Code Mode Context]\n${truncatedPrompt}`)
		}

		// Add completion requirements
		parts.push(`[Completion Requirements]
CRITICAL: You MUST complete ALL work before ending your response. Specifically:
1. Do NOT launch tasks in the background. Wait for every task/subtask to finish before moving on.
2. If you launch parallel tasks, wait for ALL of them to return their results.
3. Provide the COMPLETE final output including all results, analysis, and conclusions.
4. Do NOT end your response with "running tasks..." or "waiting for results..." — include the actual results.
5. Your response will be presented to the user as the FINAL output. There is no follow-up turn.`)

		// Add the actual user message
		parts.push(`[User Request]\n${userMessage}`)

		return parts.join("\n\n---\n\n")
	}

	/**
	 * Build a continuation prompt for when tool calls are still pending.
	 */
	private buildContinuationPrompt(pendingToolNames: string[]): string {
		return `Your previous response ended with ${pendingToolNames.length} tool(s) still running or pending: ${pendingToolNames.join(", ")}.

Please continue and provide the COMPLETE results from ALL tasks. Do not summarize or skip any results. Wait for every pending task to finish and include their full output in your response.`
	}

	/**
	 * Track tool call states from streaming updates.
	 *
	 * Monitors tool_call and tool_call_update events to maintain a map
	 * of each tool call's current status (pending, in_progress, completed, failed).
	 */
	private trackToolCallState(update: Record<string, unknown>, stateMap: Map<string, string>): void {
		const updateType = (update.sessionUpdate ?? update.type) as string | undefined
		if (!updateType) return

		if (updateType === "tool_call" || updateType === "ToolCall") {
			const toolCallId = update.toolCallId as string
			const status = (update.status as string) || "pending"
			if (toolCallId) {
				stateMap.set(toolCallId, status)
			}
		}

		if (updateType === "tool_call_update" || updateType === "ToolCallUpdate") {
			const toolCallId = update.toolCallId as string
			const status = (update.status ?? (update.fields as Record<string, unknown> | undefined)?.status) as
				| string
				| undefined
			if (toolCallId && status) {
				stateMap.set(toolCallId, status)
			}
		}
	}

	/**
	 * Check if any tool calls are still pending or in progress.
	 */
	private hasPendingToolCalls(stateMap: Map<string, string>): boolean {
		for (const status of stateMap.values()) {
			if (status === "pending" || status === "in_progress") {
				return true
			}
		}
		return false
	}

	/**
	 * Get names/IDs of pending tool calls for logging and continuation prompts.
	 */
	private getPendingToolNames(stateMap: Map<string, string>): string[] {
		const pending: string[] = []
		for (const [id, status] of stateMap) {
			if (status === "pending" || status === "in_progress") {
				pending.push(id)
			}
		}
		return pending
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
