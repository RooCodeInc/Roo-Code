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
import { getWorkspacePath } from "../../utils/path"

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
 * Hard cap for the total proxy prompt size sent to claude-code-acp.
 *
 * ACP adds its own system/context overhead; additionally, Roo can surface very large tool results
 * (e.g., subtask transcripts). Without a hard cap, a fresh ACP session can resend the entire
 * conversation and exceed ACP's internal limits ("Prompt is too long").
 */
const MAX_ACP_PROXY_PROMPT_CHARS = 120_000

/**
 * Marker used when we have to omit earlier conversation due to prompt size constraints.
 */
const OMITTED_CONVERSATION_MARKER = "[... earlier conversation omitted due to length ...]"

/**
 * Essential behavioral rules for the proxy prompt.
 * Curated subset of getRulesSection() — only rules that the model cannot
 * infer from tool descriptions or Claude Code CLI's own system prompt.
 */
const ESSENTIAL_RULES = `RULES:
- All file paths must be relative to the working directory.
- You cannot \`cd\` into a different directory to complete a task. You are stuck operating from the working directory, so pass in the correct 'path' parameter when using tools that require a path.
- Do not ask for more information than necessary. Use the tools provided to accomplish the user's request efficiently. When you've completed your task, you must use the attempt_completion tool to present the result to the user.
- You are only allowed to ask the user questions using the ask_followup_question tool.
- NEVER end attempt_completion result with a question or request to engage in further conversation.
- You are STRICTLY FORBIDDEN from starting your messages with "Great", "Certainly", "Okay", "Sure". Be direct and technical.
- Some modes have restrictions on which files they can edit. If you attempt to edit a restricted file, the operation will be rejected with a FileRestrictionError.
- It is critical you wait for the user's response after each tool use to confirm success before proceeding.`

/**
 * Claude Code ACP Handler — LLM Proxy Mode (Token-Optimized)
 *
 * Uses Claude Code ACP as a raw LLM proxy (not as an autonomous agent).
 *
 * Token optimization strategy:
 * - Only sends minimal context (role + essential rules + custom instructions)
 *   instead of the full Roo Code system prompt (saves ~30-45 KB)
 * - Uses compact function-signature tool definitions instead of full JSON schemas
 *   (saves ~15-35 KB)
 * - Strips environment_details entirely (Claude Code CLI has native workspace access)
 *   (saves ~5-100 KB)
 * - Delta prompts on subsequent turns (only new messages)
 *
 * Result: First-turn prompt ~8-25 KB instead of ~120-360 KB (~90% reduction)
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

	/**
	 * Tool names from the first turn, stored for inclusion in delta prompts.
	 * Without these, the model "forgets" what tools are available and responds
	 * with only text, triggering "no tools used" errors in Roo Code's task loop.
	 */
	private cachedToolNames: string[] = []

	constructor(options: ClaudeCodeAcpHandlerOptions) {
		super()
		this.options = options
	}

	private resolveWorkingDirectory(): string {
		const configuredDirectory = this.options.claudeCodeAcpWorkingDirectory?.trim()
		if (configuredDirectory) {
			return configuredDirectory
		}

		const workspaceDirectory = getWorkspacePath("")
		if (workspaceDirectory) {
			return workspaceDirectory
		}

		return process.cwd()
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()
		const manager = getSharedSessionManager(this.options.claudeCodeAcpExecutablePath)

		// Get working directory from explicit options or active VS Code workspace.
		const workingDirectory = this.resolveWorkingDirectory()

		// Get or create a session
		let session = await manager.getOrCreateSession(workingDirectory, model.id)

		// Detect session change — reset state if new session
		if (this.sessionId !== session.sessionId) {
			this.lastSentMessageCount = 0
			this.isSessionInitialized = false
			this.cachedToolNames = []
		}
		this.sessionId = session.sessionId

		const maxPromptChars = this.getMaxProxyPromptChars(model.info)

		const buildProxyPrompt = (budget: number, forceFull: boolean) =>
			forceFull || !this.isSessionInitialized
				? this.buildFullProxyPrompt(systemPrompt, messages, metadata?.tools, metadata?.tool_choice, budget)
				: this.buildDeltaPrompt(messages, metadata?.tool_choice, budget)

		// Collect all text from streaming updates
		const textChunks: string[] = []
		let totalInputChars = 0

		const sendOnce = async (sessionId: string, prompt: string) => {
			textChunks.length = 0
			totalInputChars += prompt.length
			return this.sendPromptStreaming(sessionId, prompt, (text) => {
				textChunks.push(text)
			})
		}

		// Build prompt: full on first turn, delta on subsequent turns
		let proxyPrompt = buildProxyPrompt(maxPromptChars, false)
		let result = await sendOnce(session.sessionId, proxyPrompt)

		// ACP/Claude Code can still error with "Prompt is too long" even when the model's
		// context window should theoretically support it (ACP adds its own overhead).
		// In that case, retry with progressively smaller prompts in a fresh ACP session.
		if (result.error && this.isPromptTooLongError(result.error)) {
			console.debug("[ClaudeCodeAcpHandler] ACP prompt too long; retrying with smaller prompt in fresh session")

			manager.closeSession(session.sessionId)
			this.sessionId = null
			this.lastSentMessageCount = 0
			this.isSessionInitialized = false
			this.cachedToolNames = []

			const retryBudgets = [
				Math.min(60_000, Math.floor(maxPromptChars * 0.5)),
				Math.min(30_000, Math.floor(maxPromptChars * 0.25)),
			].filter((b) => b >= 10_000)

			for (const budget of retryBudgets) {
				session = await manager.getOrCreateSession(workingDirectory, model.id)
				if (this.sessionId !== session.sessionId) {
					this.lastSentMessageCount = 0
					this.isSessionInitialized = false
					this.cachedToolNames = []
				}
				this.sessionId = session.sessionId

				proxyPrompt = buildProxyPrompt(budget, true)
				result = await sendOnce(session.sessionId, proxyPrompt)
				if (!result.error) break

				if (!this.isPromptTooLongError(result.error)) {
					break
				}

				manager.closeSession(session.sessionId)
				this.sessionId = null
				this.lastSentMessageCount = 0
				this.isSessionInitialized = false
				this.cachedToolNames = []
			}
		}

		if (result.error) {
			// On error, reset session state so next call sends full prompt
			this.isSessionInitialized = false
			this.lastSentMessageCount = 0
			throw result.error
		}

		const fullText = textChunks.join("")

		// Update state AFTER a successful send
		this.lastSentMessageCount = messages.length
		this.isSessionInitialized = true

		// Handle empty response — reset session so next call sends full prompt
		// This triggers Roo Code's task loop to retry, which will send a fresh full prompt
		if (!fullText.trim()) {
			console.debug("[ClaudeCodeAcpHandler] Empty response from ACP, resetting session")
			this.isSessionInitialized = false
			this.lastSentMessageCount = 0
			throw new Error("Empty response from ACP session — no assistant messages received")
		}

		// Parse response for text and tool calls
		let parsed = this.parseProxyResponse(fullText)

		// Check if the model responded with only text (no tool calls).
		// If tool use is required, retry ONCE with a strong enforcement prompt.
		const hasToolCalls = parsed.some((chunk) => chunk.type === "tool_call")
		const toolUseExpected = this.isToolUseRequired(metadata?.tool_choice)

		if (!hasToolCalls && toolUseExpected && fullText.trim().length > 0) {
			console.debug("[ClaudeCodeAcpHandler] Model responded with only text, retrying with tool-use enforcement")

			// Build a smarter retry prompt with intent detection
			const retryPrompt = this.buildToolEnforcementRetryPrompt(fullText)
			const retryChunks: string[] = []
			const retryInputChars = retryPrompt.length

			const retryResult = await this.sendPromptStreaming(session.sessionId, retryPrompt, (text) => {
				retryChunks.push(text)
			})

			if (!retryResult.error) {
				const retryFullText = retryChunks.join("")
				const retryParsed = this.parseProxyResponse(retryFullText)
				const retryHasToolCalls = retryParsed.some((chunk) => chunk.type === "tool_call")

				if (retryHasToolCalls) {
					// Retry succeeded — use the retry response instead
					parsed = retryParsed
					// Add retry tokens to usage estimate
					yield {
						type: "usage",
						inputTokens: Math.ceil((totalInputChars + retryInputChars) / 4),
						outputTokens: Math.ceil((fullText.length + retryFullText.length) / 4),
					}

					for (const chunk of parsed) {
						yield chunk
					}
					return
				}
			}

			// Retry also failed — reset session so Roo Code's NEXT call sends a fresh
			// full proxy prompt with complete instructions, tool definitions, and examples.
			// This is critical: the ACP session context is "polluted" and further retries
			// in the same session won't help. A fresh full prompt gives the model clean context.
			console.debug(
				"[ClaudeCodeAcpHandler] Retry also failed (no tool calls), resetting session for fresh full prompt on next call",
			)
			this.isSessionInitialized = false
			this.lastSentMessageCount = 0
			// Fall through to yield original response — Roo Code's task loop will
			// see "no tools used" and retry, which will now get a fresh full prompt
		}

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
		const DRAIN_GRACE_MS = 75
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

		// Process updates as they arrive, with a short post-completion drain window
		let didDrainAfterComplete = false
		while (true) {
			if (updateQueue.length === 0) {
				if (!isComplete) {
					await new Promise<void>((resolve) => {
						resolveWaiting = resolve
					})
					continue
				}

				if (!didDrainAfterComplete) {
					didDrainAfterComplete = true
					await new Promise<void>((resolve) => {
						const timeout = setTimeout(() => {
							if (resolveWaiting === resolve) {
								resolveWaiting = null
							}
							resolve()
						}, DRAIN_GRACE_MS)

						resolveWaiting = () => {
							clearTimeout(timeout)
							resolve()
						}
					})

					if (updateQueue.length === 0) {
						break
					}
				} else {
					break
				}
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
	 * Token-optimized: sends only essential context instead of the full
	 * Roo Code system prompt. Claude Code CLI already provides its own
	 * system prompt, OS info, workspace awareness, and tool methodology.
	 *
	 * Sections:
	 * 1. Proxy mode instructions (with cwd/mode context)
	 * 2. Minimal system context (role + essential rules + custom instructions)
	 * 3. Compact tool definitions (function-signature style)
	 * 4. Conversation history (environment_details fully stripped)
	 */
	private buildFullProxyPrompt(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		tools?: OpenAI.Chat.ChatCompletionTool[],
		toolChoice?: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"],
		maxPromptChars: number = MAX_ACP_PROXY_PROMPT_CHARS,
	): string {
		const parts: string[] = []
		const workingDirectory = this.resolveWorkingDirectory()

		// Proxy mode instructions (with workspace context)
		parts.push(this.buildProxyInstructions(toolChoice, workingDirectory))

		// Minimal system context (role + essential rules + custom instructions)
		const minimalContext = this.buildMinimalSystemContext(systemPrompt, workingDirectory)
		if (minimalContext) {
			parts.push(`[ROLE AND BEHAVIOR]\n${minimalContext}`)
		}

		// Compact tool definitions (function-signature style)
		if (tools && tools.length > 0) {
			parts.push(this.formatCompactToolDefinitions(tools))
			// Cache tool names for delta prompts
			this.cachedToolNames = tools
				.filter((t) => t.type === "function")
				.map((t) => (t as any).function?.name as string)
				.filter(Boolean)
		}

		const separator = "\n\n---\n\n"
		const conversationHeader = "[CONVERSATION]\n"

		// Conversation history (environment_details fully stripped), constrained to a prompt budget
		// so a fresh ACP session (e.g., after switching tasks/workspaces) can't blow up in size.
		const prefix = parts.join(separator)
		const prefixWithHeader = prefix ? `${prefix}${separator}${conversationHeader}` : conversationHeader
		const maxConversationChars = Math.max(0, maxPromptChars - prefixWithHeader.length)

		const formattedMessages = this.formatConversation(messages, maxConversationChars)
		if (formattedMessages) {
			return `${prefixWithHeader}${formattedMessages}`.slice(0, maxPromptChars)
		}

		return prefixWithHeader.slice(0, maxPromptChars)
	}

	/**
	 * Build a DELTA prompt for subsequent turns in the same ACP session.
	 *
	 * Since the ACP session already has the system prompt, tool definitions,
	 * and previous conversation from earlier turns, we only send:
	 * 1. New messages (tool results, new user content)
	 * 2. Available tool names (so the model remembers what tools exist)
	 * 3. Strong tool-use enforcement instructions
	 *
	 * This prevents O(N²) context growth that causes "Prompt is too long" errors,
	 * while ensuring the model doesn't "forget" to use tools on subsequent turns.
	 */
	private buildDeltaPrompt(
		messages: Anthropic.Messages.MessageParam[],
		toolChoice?: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"],
		maxPromptChars: number = MAX_ACP_PROXY_PROMPT_CHARS,
	): string {
		// Get only the new messages since last prompt
		const newMessages = messages.slice(this.lastSentMessageCount)

		const parts: string[] = []

		// Tool choice guidance
		const toolChoiceInstruction = this.buildToolChoiceInstruction(toolChoice, {
			required: "You MUST use at least one tool in your response.",
			none: "Do NOT use any tools. Respond with text only.",
			auto: "Use tools when helpful. If no tool is needed, a text-only response is acceptable.",
		})
		const requiresToolUse = this.isToolUseRequired(toolChoice)

		// Include available tool names so the model remembers what tools exist.
		// Without this, the model often responds with only text on subsequent turns.
		const toolNamesReminder =
			this.cachedToolNames.length > 0 ? `Available tools: ${this.cachedToolNames.join(", ")}` : ""

		// Concrete example to reinforce the format (model tends to forget XML tags)
		const concreteExample = this.cachedToolNames.includes("read_file")
			? `${TOOL_CALL_OPEN_TAG}\n{"name": "read_file", "arguments": {"path": "package.json"}}\n${TOOL_CALL_CLOSE_TAG}`
			: `${TOOL_CALL_OPEN_TAG}\n{"name": "attempt_completion", "arguments": {"result": "Done."}}\n${TOOL_CALL_CLOSE_TAG}`

		// Strong continuation instructions with tool-use enforcement
		const continuationBlock = [
			`[CONTINUE]`,
			toolChoiceInstruction,
			`Closing tag is mandatory. JSON strings must escape newlines as \\n.`,
			`Tool call format example:`,
			concreteExample,
			toolNamesReminder,
			requiresToolUse
				? `If the task is complete, use attempt_completion. If you need info, use read_file/search_files/list_files. NEVER respond with only text.`
				: `If the task is complete, use attempt_completion. If you need info, use read_file/search_files/list_files.`,
		]
			.filter(Boolean)
			.join("\n")

		// Format new messages (typically tool results + maybe new user text), constrained by the
		// overall prompt budget after reserving space for the continuation block.
		if (newMessages.length > 0) {
			const separatorLen = 2 // "\n\n" between delta messages and continuation block
			const budgetForDelta = Math.max(0, maxPromptChars - continuationBlock.length - separatorLen)
			const deltaText = this.formatDeltaMessages(newMessages, budgetForDelta)
			if (deltaText) {
				parts.push(deltaText)
			}
		}

		parts.push(continuationBlock)

		const prompt = parts.join("\n\n")
		return prompt.length > maxPromptChars ? prompt.slice(0, maxPromptChars) : prompt
	}

	/**
	 * Determine a safe max prompt size for ACP.
	 *
	 * We keep an absolute hard cap (ACP internal limits vary), but also respect the
	 * model's context window as an upper bound (approximate char->token conversion).
	 */
	private getMaxProxyPromptChars(modelInfo: ModelInfo): number {
		const approxCharsPerToken = 4
		const contextWindow = modelInfo.contextWindow ?? 128_000
		const maxTokens = modelInfo.maxTokens ?? 4_096
		const availableTokens = Math.max(0, contextWindow - maxTokens)
		const modelBoundChars = Math.floor(availableTokens * approxCharsPerToken * 0.9)
		// Prefer the stricter bound to avoid ACP-side "Prompt is too long" failures.
		return Math.max(10_000, Math.min(MAX_ACP_PROXY_PROMPT_CHARS, modelBoundChars || MAX_ACP_PROXY_PROMPT_CHARS))
	}

	private isPromptTooLongError(error: Error): boolean {
		const msg = error.message?.toLowerCase?.() ?? ""
		return msg.includes("prompt is too long") || msg.includes("token limit") || msg.includes("context length")
	}

	/**
	 * Build a retry prompt when the model responded with only text (no tool calls).
	 *
	 * Uses intent detection to analyze the text-only response and suggest the
	 * most appropriate tool, making the retry more likely to succeed.
	 */
	private buildToolEnforcementRetryPrompt(previousTextResponse: string): string {
		// Truncate previous response to avoid sending too much back
		const truncatedResponse =
			previousTextResponse.length > 500 ? previousTextResponse.slice(0, 500) + "..." : previousTextResponse

		const toolNamesReminder =
			this.cachedToolNames.length > 0 ? `\nAvailable tools: ${this.cachedToolNames.join(", ")}` : ""

		// Detect intent from the text to suggest the most relevant tool
		const suggestedTool = this.detectToolIntent(previousTextResponse)

		// Build a concrete example using the detected intent
		const concreteExample = suggestedTool.example

		return `[ERROR: RESPONSE REJECTED - NO TOOL CALLS]
Your previous response was REJECTED because it contained only text without any tool calls:
"${truncatedResponse}"

This system REQUIRES at least one tool call in every response. Text-only responses are not accepted.
Closing tag is mandatory. JSON strings must escape newlines as \\n.
${toolNamesReminder}

${suggestedTool.suggestion}

You MUST now respond with at least one tool call using the ${TOOL_CALL_OPEN_TAG} XML format.
Example:
${concreteExample}

IMPORTANT: Do NOT use your built-in tools (Bash, Read, Write, Edit, Glob, Grep, etc.).
ONLY use the ${TOOL_CALL_OPEN_TAG}...${TOOL_CALL_CLOSE_TAG} XML format with tools from the available tools list above.

Respond NOW with the appropriate tool call(s).`
	}

	/**
	 * Detect the likely intent from a text-only response to suggest the best tool.
	 *
	 * Analyzes keywords in the model's text response to determine what it was
	 * "trying" to do, then suggests the appropriate Roo Code tool.
	 */
	private detectToolIntent(text: string): { suggestion: string; example: string } {
		const lowerText = text.toLowerCase()

		// Check for completion/summary patterns — model thinks it's done
		if (
			lowerText.includes("complete") ||
			lowerText.includes("finished") ||
			lowerText.includes("done") ||
			lowerText.includes("summary") ||
			lowerText.includes("conclusion") ||
			lowerText.includes("here is") ||
			lowerText.includes("i have") ||
			lowerText.includes("análise") ||
			lowerText.includes("concluí")
		) {
			return {
				suggestion:
					"It looks like you were summarizing or completing the task. You MUST wrap your result in the attempt_completion tool.",
				example: `${TOOL_CALL_OPEN_TAG}\n{"name": "attempt_completion", "arguments": {"result": "Your completion summary here"}}\n${TOOL_CALL_CLOSE_TAG}`,
			}
		}

		// Check for question patterns — model is asking a question
		if (
			lowerText.includes("?") ||
			lowerText.includes("would you") ||
			lowerText.includes("should i") ||
			lowerText.includes("do you want") ||
			lowerText.includes("gostaria") ||
			lowerText.includes("deseja")
		) {
			return {
				suggestion:
					"It looks like you were asking the user a question. You MUST use the ask_followup_question tool for that.",
				example: `${TOOL_CALL_OPEN_TAG}\n{"name": "ask_followup_question", "arguments": {"question": "Your question here", "follow_up": [{"text": "Option 1", "mode": null}, {"text": "Option 2", "mode": null}]}}\n${TOOL_CALL_CLOSE_TAG}`,
			}
		}

		// Check for file reading intent
		if (
			lowerText.includes("let me read") ||
			lowerText.includes("check the file") ||
			lowerText.includes("look at") ||
			lowerText.includes("examine")
		) {
			return {
				suggestion: "It looks like you want to read a file. Use the read_file tool.",
				example: `${TOOL_CALL_OPEN_TAG}\n{"name": "read_file", "arguments": {"path": "src/index.ts"}}\n${TOOL_CALL_CLOSE_TAG}`,
			}
		}

		// Check for command execution intent
		if (
			lowerText.includes("run") ||
			lowerText.includes("execute") ||
			lowerText.includes("install") ||
			lowerText.includes("npm") ||
			lowerText.includes("build")
		) {
			return {
				suggestion: "It looks like you want to execute a command. Use the execute_command tool.",
				example: `${TOOL_CALL_OPEN_TAG}\n{"name": "execute_command", "arguments": {"command": "your command here"}}\n${TOOL_CALL_CLOSE_TAG}`,
			}
		}

		// Default — suggest attempt_completion as it's the most common case
		// (model usually responds with text when it thinks the task is done)
		return {
			suggestion:
				"Based on your text response, you likely need to use attempt_completion (if done) or a file/search tool (if you need more info).",
			example: `${TOOL_CALL_OPEN_TAG}\n{"name": "attempt_completion", "arguments": {"result": "Your result here"}}\n${TOOL_CALL_CLOSE_TAG}`,
		}
	}

	/**
	 * Build the proxy mode instructions that tell Claude Code to act as a raw LLM.
	 * Includes workspace context (cwd, time) since we no longer send getSystemInfoSection().
	 */
	private buildProxyInstructions(
		toolChoice?: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"],
		cwd?: string,
	): string {
		const toolChoiceInstruction = this.buildToolChoiceInstruction(toolChoice, {
			required: "\nIMPORTANT: You MUST use at least one tool in your response. Never respond with only text.",
			none: "\nIMPORTANT: Do NOT use any tools. Respond with text only.",
			auto: "\nIMPORTANT: Use tools when helpful. If no tool is needed, a text-only response is acceptable.",
		})

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
The "arguments" field must be a JSON object matching the tool's parameter schema.
The closing tag is mandatory. JSON strings must escape newlines as \\n.

If you have completed the task, use the attempt_completion tool.
If you need to delegate work, use the new_task tool.
If you need information, use the appropriate read/search tool.${toolChoiceInstruction}

Working directory: ${cwd || "unknown"}
Current time: ${new Date().toISOString()}`
	}

	private isToolUseRequired(toolChoice?: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"]): boolean {
		return toolChoice === "required" || typeof toolChoice === "object"
	}

	private buildToolChoiceInstruction(
		toolChoice: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"] | undefined,
		messages: { required: string; none: string; auto: string },
	): string {
		if (toolChoice === "none") {
			return messages.none
		}

		if (typeof toolChoice === "object") {
			const fnName = (toolChoice as unknown as { function?: { name?: string } })?.function?.name
			if (fnName) {
				const prefix = messages.required.startsWith("\n") ? "\n" : ""
				return `${prefix}You MUST use the "${fnName}" tool.`
			}
			return messages.required
		}

		if (toolChoice === "required") {
			return messages.required
		}

		return messages.auto
	}

	// ─── Minimal System Context ─────────────────────────────────────────

	/**
	 * Extract only the essential parts from the full Roo Code system prompt.
	 *
	 * The full system prompt (~40-80 KB) contains many sections that are
	 * redundant when using Claude Code CLI as the backend (it has its own
	 * system prompt, OS awareness, tool methodology, etc.).
	 *
	 * We extract only:
	 * 1. roleDefinition — the mode personality (everything before first "====")
	 * 2. ESSENTIAL_RULES — curated behavioral rules (~0.8 KB hardcoded)
	 * 3. Custom instructions — user's .roo/rules/, AGENTS.md, etc.
	 *
	 * This reduces ~40-80 KB to ~3-15 KB (~80% savings).
	 */
	private buildMinimalSystemContext(fullSystemPrompt: string, cwd: string): string {
		const parts: string[] = []

		// 1. Extract roleDefinition: everything before the first "====" delimiter
		const roleDefinition = this.extractRoleDefinition(fullSystemPrompt)
		if (roleDefinition) {
			parts.push(roleDefinition)
		}

		// 2. Essential behavioral rules (hardcoded curated subset)
		parts.push(ESSENTIAL_RULES.replace(/the working directory/g, `'${cwd}'`))

		// 3. Extract custom instructions (user-defined, must always preserve)
		const customInstructions = this.extractCustomInstructions(fullSystemPrompt)
		if (customInstructions) {
			parts.push(customInstructions)
		}

		return parts.filter(Boolean).join("\n\n")
	}

	/**
	 * Extract the roleDefinition from the system prompt.
	 * This is everything before the first "====" section delimiter.
	 * Contains the mode personality (code/architect/ask/debug).
	 */
	private extractRoleDefinition(systemPrompt: string): string {
		// The system prompt starts with roleDefinition, followed by sections
		// separated by "\n====\n" or "\n\n====\n\n"
		const delimiterIndex = systemPrompt.indexOf("\n====\n")
		if (delimiterIndex > 0) {
			return systemPrompt.substring(0, delimiterIndex).trim()
		}
		// Fallback: if no delimiter found, return first 2000 chars as safe limit
		return systemPrompt.substring(0, 2000).trim()
	}

	/**
	 * Extract custom instructions section from the system prompt.
	 * Looks for the "USER'S CUSTOM INSTRUCTIONS" marker and returns everything after it.
	 * This includes: language preference, global instructions, mode-specific instructions,
	 * .roo/rules/ files, AGENTS.md content.
	 */
	private extractCustomInstructions(systemPrompt: string): string {
		const marker = "USER'S CUSTOM INSTRUCTIONS"
		const markerIndex = systemPrompt.indexOf(marker)
		if (markerIndex < 0) {
			return ""
		}

		// Find the "====" before the marker to include the section header
		const sectionStart = systemPrompt.lastIndexOf("====", markerIndex)
		if (sectionStart >= 0) {
			return systemPrompt.substring(sectionStart).trim()
		}

		return systemPrompt.substring(markerIndex).trim()
	}

	// ─── Compact Tool Definitions ───────────────────────────────────────

	/**
	 * Format tool definitions in compact function-signature style.
	 *
	 * Instead of full JSON Schema (~1-2.5 KB per tool), uses TypeScript-like signatures
	 * (~100-200 bytes per tool). Claude models can infer correct argument structure
	 * from parameter names and types alone.
	 *
	 * Example:
	 *   read_file(path: string, start_line?: number, end_line?: number) - Read file contents.
	 *
	 * Saves ~80-90% on tool definitions (from ~15-40 KB to ~3-5 KB).
	 */
	private formatCompactToolDefinitions(tools: OpenAI.Chat.ChatCompletionTool[]): string {
		const toolTexts = tools
			.filter((t) => t.type === "function")
			.map((t) => {
				const fn = (t as any).function as { name: string; description?: string; parameters?: any }
				const params = this.formatCompactParams(fn.parameters)
				// Take first sentence/line of description, cap at 200 chars
				const desc = fn.description ? fn.description.split("\n")[0].slice(0, 200) : "(no description)"
				return `${fn.name}(${params}) - ${desc}`
			})

		return `[AVAILABLE TOOLS]\nWhen using a tool, output JSON in ${TOOL_CALL_OPEN_TAG} with "name" and "arguments" keys.\n\n${toolTexts.join("\n\n")}`
	}

	/**
	 * Format tool parameters as compact TypeScript-like signatures.
	 * Handles required/optional, enums, basic types, and nested objects.
	 *
	 * For nested objects (e.g., array items with properties), recursively
	 * formats inner fields so the model knows the expected structure.
	 * Example: `follow_up: {text: string, mode: string|null}[]`
	 */
	private formatCompactParams(schema: any): string {
		if (!schema?.properties) {
			return ""
		}

		const required = new Set<string>(schema.required || [])

		return Object.entries(schema.properties)
			.map(([name, prop]: [string, any]) => {
				const opt = required.has(name) ? "" : "?"
				// Handle enum types
				if (prop.enum) {
					return `${name}${opt}: ${prop.enum.map((e: string) => `"${e}"`).join("|")}`
				}
				// Handle array of objects with known properties (e.g., follow_up: {text, mode}[])
				if (prop.type === "array" && prop.items?.properties) {
					const innerFields = this.formatCompactParams(prop.items)
					return `${name}${opt}: {${innerFields}}[]`
				}
				// Handle array of simple types
				if (prop.type === "array") {
					const itemType = prop.items?.type || "any"
					return `${name}${opt}: ${itemType}[]`
				}
				// Handle nested object with known properties
				if (prop.type === "object" && prop.properties) {
					const innerFields = this.formatCompactParams(prop)
					return `${name}${opt}: {${innerFields}}`
				}
				// Handle generic object (no known properties)
				if (prop.type === "object") {
					return `${name}${opt}: object`
				}
				// Handle nullable types like ["string", "null"]
				const type = Array.isArray(prop.type)
					? prop.type.filter((t: string) => t !== "null").join("|") +
						(prop.type.includes("null") ? "|null" : "")
					: prop.type || "any"
				return `${name}${opt}: ${type}`
			})
			.join(", ")
	}

	// ─── Conversation Formatting ────────────────────────────────────────

	/**
	 * Format ALL conversation messages for the first turn's proxy prompt.
	 *
	 * Optimizations:
	 * 1. Strips <environment_details> from ALL messages (Claude Code CLI has native workspace access)
	 * 2. Truncates large tool results to MAX_TOOL_RESULT_CHARS
	 */
	private formatConversation(messages: Anthropic.Messages.MessageParam[], maxChars?: number): string {
		const formattedMessages: string[] = []
		for (let i = 0; i < messages.length; i++) {
			// Always strip environment_details — Claude Code CLI has native workspace access
			const formatted = this.formatSingleMessage(messages[i], false)
			if (formatted) {
				formattedMessages.push(formatted)
			}
		}

		return this.fitFormattedMessagesToBudget(formattedMessages, maxChars)
	}

	/**
	 * Format only NEW messages for delta prompts (subsequent turns).
	 *
	 * These are typically tool_result blocks from Roo Code after executing
	 * the tools the model requested in its previous response.
	 */
	private formatDeltaMessages(messages: Anthropic.Messages.MessageParam[], maxChars?: number): string {
		const parts: string[] = []

		for (const msg of messages) {
			// Always strip environment_details in delta mode
			const formatted = this.formatSingleMessage(msg, false)
			if (formatted) {
				parts.push(formatted)
			}
		}

		return this.fitFormattedMessagesToBudget(parts, maxChars)
	}

	/**
	 * Fit a list of already-formatted message strings to an optional character budget.
	 *
	 * If the budget is exceeded, keeps the most recent messages that fit and inserts a marker.
	 * This prevents ACP failures like "-32603: Internal error: Prompt is too long", which can
	 * happen when returning from subtasks with large transcripts.
	 */
	private fitFormattedMessagesToBudget(formattedMessages: string[], maxChars?: number): string {
		const joined = formattedMessages.join("\n\n")
		if (maxChars === undefined || maxChars <= 0 || joined.length <= maxChars) {
			return joined
		}

		const last = formattedMessages[formattedMessages.length - 1] || ""
		if (!last) return ""

		if (maxChars < OMITTED_CONVERSATION_MARKER.length + 10) {
			return this.truncateText(last, maxChars)
		}

		const kept: string[] = []
		let keptLen = 0
		const separatorLen = 2 // "\n\n"
		const budget = Math.max(0, maxChars - OMITTED_CONVERSATION_MARKER.length - separatorLen)

		for (let i = formattedMessages.length - 1; i >= 0; i--) {
			const msg = formattedMessages[i]
			const addLen = msg.length + (kept.length > 0 ? separatorLen : 0)
			if (keptLen + addLen > budget) {
				continue
			}
			kept.unshift(msg)
			keptLen += addLen
		}

		if (kept.length === 0) {
			return this.truncateText(last, maxChars)
		}

		console.debug("[ClaudeCodeAcpHandler] Truncated conversation for ACP prompt budget", {
			originalChars: joined.length,
			maxChars,
			totalMessages: formattedMessages.length,
			keptMessages: kept.length,
		})

		return `${OMITTED_CONVERSATION_MARKER}\n\n${kept.join("\n\n")}`
	}

	private truncateText(text: string, maxChars: number): string {
		if (maxChars <= 0) return ""
		if (text.length <= maxChars) return text
		if (maxChars <= 30) return text.slice(0, maxChars)
		return `${text.slice(0, maxChars - 18)}...[truncated]`
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

				// Truncate large tool results (keep head + tail; important details often appear at the end)
				if (content.length > MAX_TOOL_RESULT_CHARS) {
					const headChars = Math.min(6_000, MAX_TOOL_RESULT_CHARS - 1_200)
					const tailChars = Math.min(1_000, MAX_TOOL_RESULT_CHARS - headChars)
					const head = content.slice(0, headChars)
					const tail = content.slice(-tailChars)
					content = `${head}\n[...truncated, showing first ${headChars} and last ${tailChars} of ${content.length} chars]\n${tail}`
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
	 * These are appended by Roo Code to every user message and contain the full
	 * workspace file tree (5-100 KB). Claude Code CLI has native workspace access,
	 * so this information is 100% redundant in the ACP proxy.
	 */
	private stripEnvironmentDetails(text: string): string {
		return text.replace(/<environment_details>[\s\S]*?<\/environment_details>/g, "")
	}

	private extractFirstJsonObject(text: string): { json: string; start: number; end: number } | null {
		let inString = false
		let escaped = false
		let depth = 0
		let start = -1

		for (let i = 0; i < text.length; i++) {
			const ch = text[i]

			if (escaped) {
				escaped = false
				continue
			}

			if (inString) {
				if (ch === "\\") {
					escaped = true
					continue
				}
				if (ch === '"') {
					inString = false
				}
				continue
			}

			if (ch === '"') {
				inString = true
				continue
			}

			if (ch === "{") {
				if (depth === 0) {
					start = i
				}
				depth++
				continue
			}

			if (ch === "}") {
				if (depth > 0) {
					depth--
					if (depth === 0 && start >= 0) {
						return { json: text.slice(start, i + 1), start, end: i + 1 }
					}
				}
			}
		}

		return null
	}

	private parseToolCallContent(
		raw: string,
	): { toolName: string; toolArgs: unknown; beforeText?: string; afterText?: string } | null {
		const trimmed = raw.trim()
		try {
			const toolCall = JSON.parse(trimmed)
			const toolName = toolCall?.name as string | undefined
			if (toolName) {
				return { toolName, toolArgs: toolCall.arguments }
			}
		} catch {
			// Fall back to extracting the first JSON object below
		}

		const extracted = this.extractFirstJsonObject(raw)
		if (!extracted) return null

		try {
			const toolCall = JSON.parse(extracted.json)
			const toolName = toolCall?.name as string | undefined
			if (!toolName) return null

			return {
				toolName,
				toolArgs: toolCall.arguments,
				beforeText: raw.slice(0, extracted.start),
				afterText: raw.slice(extracted.end),
			}
		} catch {
			return null
		}
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

			const parsedTool = this.parseToolCallContent(match[1])
			if (parsedTool) {
				const beforeText = parsedTool.beforeText?.trim()
				if (beforeText) {
					chunks.push({ type: "text", text: beforeText })
				}

				const toolArgs = parsedTool.toolArgs
				chunks.push({
					type: "tool_call",
					id: `acp_proxy_${Date.now()}_${toolCallIndex++}`,
					name: parsedTool.toolName,
					arguments: typeof toolArgs === "string" ? toolArgs : JSON.stringify(toolArgs ?? {}),
				})

				const afterText = parsedTool.afterText?.trim()
				if (afterText) {
					chunks.push({ type: "text", text: afterText })
				}
			} else {
				// Invalid tool call format — yield as text
				console.debug("[ClaudeCodeAcpHandler] Failed to parse tool call JSON:", match[1].slice(0, 200))
				chunks.push({ type: "text", text: match[0] })
			}

			lastIndex = match.index + match[0].length
		}

		// Remaining text after last tool call
		const remaining = text.slice(lastIndex)
		const trailingOpenIndex = remaining.indexOf(TOOL_CALL_OPEN_TAG)
		if (trailingOpenIndex !== -1) {
			const beforeTrailing = remaining.slice(0, trailingOpenIndex).trim()
			if (beforeTrailing) {
				chunks.push({ type: "text", text: beforeTrailing })
			}

			const trailingPayload = remaining.slice(trailingOpenIndex + TOOL_CALL_OPEN_TAG.length)
			const parsedTrailing = this.parseToolCallContent(trailingPayload)
			if (parsedTrailing) {
				const beforeText = parsedTrailing.beforeText?.trim()
				if (beforeText) {
					chunks.push({ type: "text", text: beforeText })
				}

				const toolArgs = parsedTrailing.toolArgs
				chunks.push({
					type: "tool_call",
					id: `acp_proxy_${Date.now()}_${toolCallIndex++}`,
					name: parsedTrailing.toolName,
					arguments: typeof toolArgs === "string" ? toolArgs : JSON.stringify(toolArgs ?? {}),
				})

				const afterText = parsedTrailing.afterText?.trim()
				if (afterText) {
					chunks.push({ type: "text", text: afterText })
				}
			} else {
				const trailingRaw = remaining.slice(trailingOpenIndex).trim()
				if (trailingRaw) {
					chunks.push({ type: "text", text: trailingRaw })
				}
			}
		} else {
			const remainingTrimmed = remaining.trim()
			if (remainingTrimmed) {
				chunks.push({ type: "text", text: remainingTrimmed })
			}
		}

		return chunks
	}

	/**
	 * Escape special regex characters in a string.
	 */
	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	}

	// --- ACP Update Extraction ---

	/**
	 * Extract text from an ACP session update.
	 *
	 * In proxy mode, we only extract text from agent_message_chunk events.
	 * Tool calls from the ACP agent are ignored since we told it not to use them.
	 */
	private extractTextFromUpdate(update: Record<string, unknown>): string | null {
		const updateType = (update.sessionUpdate ?? update.type) as string | undefined
		if (updateType) {
			// Agent message chunks — the main text response
			if (
				updateType === "agent_message_chunk" ||
				updateType === "AgentMessageChunk" ||
				updateType === "assistant_message_chunk" ||
				updateType === "assistant_message"
			) {
				return this.extractTextFromContent(update.content)
			}

			// Thought/reasoning chunks — include as text
			if (updateType === "agent_thought_chunk" || updateType === "AgentThoughtChunk") {
				return this.extractTextFromContent(update.content)
			}
		}

		// In proxy mode, skip tool_call and tool_call_update events
		// (if the agent uses its own tools despite our instructions, we ignore them)
		const fallbackText = this.extractTextFromContent(update.content)
		if (fallbackText) return fallbackText

		const messageContent = (update as { message?: { content?: unknown } })?.message?.content
		return this.extractTextFromContent(messageContent)
	}

	/**
	 * Extract text from a content block.
	 */
	private extractTextFromContent(content: unknown): string | null {
		if (!content) return null

		if (typeof content === "string") {
			return content
		}

		if (Array.isArray(content)) {
			const parts = content
				.map((item) => this.extractTextFromContent(item))
				.filter((text): text is string => !!text && text.trim().length > 0)
			return parts.length > 0 ? parts.join("") : null
		}

		const typedContent = content as { type?: unknown; text?: unknown }
		if (typedContent.type === "text" && typeof typedContent.text === "string") {
			return typedContent.text
		}

		if (typeof typedContent.text === "string") {
			return typedContent.text
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
		const workingDirectory = this.resolveWorkingDirectory()

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
