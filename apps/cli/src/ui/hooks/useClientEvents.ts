/**
 * useClientEvents - Bridge ExtensionClient events to TUI state
 *
 * This hook subscribes to ExtensionClient events (the same events used by
 * non-TUI mode) and transforms them into TUI messages/state updates.
 *
 * This unifies the message handling logic between TUI and non-TUI modes:
 * - Non-TUI: ExtensionClient events → OutputManager/AskDispatcher
 * - TUI: ExtensionClient events → useClientEvents → Zustand store
 */

import { useEffect, useRef, useCallback } from "react"
import type { ClineMessage, ClineAsk, ClineSay, TodoItem } from "@roo-code/types"
import { consolidateTokenUsage, consolidateApiRequests, consolidateCommands, DebugLogger } from "@roo-code/core/cli"

// Debug logger using same pattern as extension-host.ts
const tuiLogger = new DebugLogger("TUI")

import type { ExtensionClient } from "@/agent/index.js"
import type { WaitingForInputEvent, CommandExecutionOutputEvent } from "@/agent/events.js"

import type { TUIMessage, ToolData, PendingAsk } from "../types.js"
import { useCLIStore } from "../store.js"
import { extractToolData, formatToolOutput, formatToolAskMessage, parseTodosFromToolInfo } from "../utils/tools.js"

export interface UseClientEventsOptions {
	client: ExtensionClient | null
	nonInteractive: boolean
}

export interface UseClientEventsReturn {
	/** Reset tracking state (call when starting new task) */
	reset: () => void
}

/**
 * Hook that subscribes to ExtensionClient events and updates TUI state.
 *
 * Key events:
 * - `message`: New ClineMessage → transform to TUIMessage and add to store
 * - `messageUpdated`: Updated ClineMessage → update existing TUIMessage
 * - `waitingForInput`: Ask needing input → set pendingAsk
 */
export function useClientEvents({ client, nonInteractive }: UseClientEventsOptions): UseClientEventsReturn {
	const { addMessage, setPendingAsk, setLoading, setTokenUsage, currentTodos, setTodos } = useCLIStore()

	// Track seen message timestamps to filter duplicates
	const seenMessageIds = useRef<Set<string>>(new Set())
	const firstTextMessageSkipped = useRef(false)

	// Track pending command for injecting into command_output toolData
	const pendingCommandRef = useRef<string | null>(null)

	// Track the message ID of the current command being executed (for streaming updates)
	const currentCommandMessageIdRef = useRef<string | null>(null)

	// Track if we've streamed command output (to skip duplicate command_output say message)
	const hasStreamedCommandOutputRef = useRef(false)

	// Track the message ID of partial tool asks (for streaming file write updates)
	const partialToolMessageIdRef = useRef<string | null>(null)

	/**
	 * Reset tracking state (call when starting new task)
	 */
	const reset = useCallback(() => {
		seenMessageIds.current.clear()
		firstTextMessageSkipped.current = false
		pendingCommandRef.current = null
		currentCommandMessageIdRef.current = null
		hasStreamedCommandOutputRef.current = false
		partialToolMessageIdRef.current = null
	}, [])

	/**
	 * Transform a ClineMessage to TUIMessage and add to store
	 */
	const processClineMessage = useCallback(
		(msg: ClineMessage) => {
			const ts = msg.ts
			const messageId = ts.toString()
			const text = msg.text || ""
			const partial = msg.partial || false
			const isResuming = useCLIStore.getState().isResumingTask

			// DEBUG: Log all ask messages to trace partial handling
			if (msg.type === "ask") {
				tuiLogger.debug("ask:received", {
					ask: msg.ask,
					partial,
					textLen: text.length,
					id: messageId,
				})
			}

			if (msg.type === "say" && msg.say) {
				processSayMessage(messageId, msg.say, text, partial, isResuming)
			} else if (msg.type === "ask" && msg.ask) {
				processAskMessage(messageId, msg.ask, text, partial)
			}
		},
		[nonInteractive, currentTodos],
	)

	/**
	 * Process "say" type messages
	 */
	const processSayMessage = useCallback(
		(messageId: string, say: ClineSay, text: string, partial: boolean, isResuming: boolean) => {
			// Skip certain message types
			if (say === "checkpoint_saved" || say === "api_req_started" || say === "user_feedback") {
				seenMessageIds.current.add(messageId)
				return
			}

			// Skip first text message for new tasks (it's the user's prompt echo)
			if (say === "text" && !firstTextMessageSkipped.current && !isResuming) {
				firstTextMessageSkipped.current = true
				seenMessageIds.current.add(messageId)
				return
			}

			// Skip if already seen (non-partial)
			if (seenMessageIds.current.has(messageId) && !partial) {
				return
			}

			let role: TUIMessage["role"] = "assistant"
			let toolName: string | undefined
			let toolDisplayName: string | undefined
			let toolDisplayOutput: string | undefined
			let toolData: ToolData | undefined

			if (say === "command_output") {
				// Skip command_output say message if we've already streamed the output
				// The streaming updates went to the command ask message directly
				if (hasStreamedCommandOutputRef.current) {
					seenMessageIds.current.add(messageId)
					// Reset for next command
					hasStreamedCommandOutputRef.current = false
					currentCommandMessageIdRef.current = null
					return
				}

				// Non-streamed case: add the command output message
				role = "tool"
				toolName = "execute_command"
				toolDisplayName = "bash"
				toolDisplayOutput = text
				const trackedCommand = pendingCommandRef.current
				toolData = { tool: "execute_command", command: trackedCommand || undefined, output: text }
				pendingCommandRef.current = null
			} else if (say === "reasoning") {
				role = "thinking"
			}

			seenMessageIds.current.add(messageId)

			addMessage({
				id: messageId,
				role,
				content: text || "",
				toolName,
				toolDisplayName,
				toolDisplayOutput,
				partial,
				originalType: say,
				toolData,
			})
		},
		[addMessage],
	)

	/**
	 * Process "ask" type messages
	 */
	const processAskMessage = useCallback(
		(messageId: string, ask: ClineAsk, text: string, partial: boolean) => {
			// DEBUG: Log entry to processAskMessage
			tuiLogger.debug("ask:process", {
				ask,
				partial,
				nonInteractive,
				id: messageId,
			})

			// Handle partial tool asks in nonInteractive mode - stream file content as it arrives
			// This allows FileWriteTool to show immediately and update as content streams
			if (partial && ask === "tool" && nonInteractive) {
				// Parse tool info to extract streaming content
				let toolName: string | undefined
				let toolDisplayName: string | undefined
				let toolDisplayOutput: string | undefined
				let toolData: ToolData | undefined
				let parseError = false

				try {
					const toolInfo = JSON.parse(text) as Record<string, unknown>
					toolName = toolInfo.tool as string
					toolDisplayName = toolInfo.tool as string
					toolDisplayOutput = formatToolOutput(toolInfo)
					toolData = extractToolData(toolInfo)
				} catch {
					// Use raw text if not valid JSON - may happen during early streaming
					parseError = true
				}

				tuiLogger.debug("ask:partial-tool", {
					id: messageId,
					textLen: text.length,
					toolName: toolName || "none",
					hasToolData: !!toolData,
					parseError,
				})

				// Track that we're streaming this tool ask
				partialToolMessageIdRef.current = messageId

				// Add/update the message with partial content
				// Use raw JSON text as content so FileWriteTool can parse live content during streaming
				addMessage({
					id: messageId,
					role: "tool",
					content: text, // Raw JSON text - needed for streaming content parsing
					toolName,
					toolDisplayName,
					toolDisplayOutput,
					partial: true, // Mark as partial for UI to show loading state
					originalType: ask,
					toolData,
				})
				return
			}

			// Skip other partial ask messages - wait for complete
			if (partial) {
				return
			}

			// Skip if already processed (but allow updates to partial tool messages)
			if (seenMessageIds.current.has(messageId) && partialToolMessageIdRef.current !== messageId) {
				return
			}

			// Skip command_output asks (non-blocking)
			if (ask === "command_output") {
				seenMessageIds.current.add(messageId)
				return
			}

			// Handle resume tasks - don't set pendingAsk
			if (ask === "resume_task" || ask === "resume_completed_task") {
				seenMessageIds.current.add(messageId)
				setLoading(false)
				useCLIStore.getState().setHasStartedTask(true)
				useCLIStore.getState().setIsResumingTask(false)
				return
			}

			// Track pending command
			if (ask === "command") {
				pendingCommandRef.current = text
			}

			// Handle completion result
			if (ask === "completion_result") {
				seenMessageIds.current.add(messageId)
				// Completion is handled by taskCompleted event
				// Just add the message for display
				try {
					const completionInfo = JSON.parse(text) as Record<string, unknown>
					const toolData: ToolData = {
						tool: "attempt_completion",
						result: completionInfo.result as string | undefined,
						content: completionInfo.result as string | undefined,
					}

					addMessage({
						id: messageId,
						role: "tool",
						content: text,
						toolName: "attempt_completion",
						toolDisplayName: "Task Complete",
						toolDisplayOutput: formatToolOutput({ tool: "attempt_completion", ...completionInfo }),
						originalType: ask,
						toolData,
					})
				} catch {
					addMessage({
						id: messageId,
						role: "tool",
						content: text || "Task completed",
						toolName: "attempt_completion",
						toolDisplayName: "Task Complete",
						toolDisplayOutput: "✅ Task completed",
						originalType: ask,
						toolData: { tool: "attempt_completion", content: text },
					})
				}
				return
			}

			// For tool/command asks in nonInteractive mode, add as message (auto-approved)
			if (nonInteractive && ask !== "followup") {
				seenMessageIds.current.add(messageId)

				if (ask === "tool") {
					// Clear partial tracking - this is the final message
					const wasPartial = partialToolMessageIdRef.current === messageId
					partialToolMessageIdRef.current = null

					let toolName: string | undefined
					let toolDisplayName: string | undefined
					let toolDisplayOutput: string | undefined
					let toolData: ToolData | undefined
					let todos: TodoItem[] | undefined
					let previousTodos: TodoItem[] | undefined

					try {
						const toolInfo = JSON.parse(text) as Record<string, unknown>
						toolName = toolInfo.tool as string
						toolDisplayName = toolInfo.tool as string
						toolDisplayOutput = formatToolOutput(toolInfo)
						toolData = extractToolData(toolInfo)

						// Handle todo list updates
						if (toolName === "update_todo_list" || toolName === "updateTodoList") {
							const parsedTodos = parseTodosFromToolInfo(toolInfo)
							if (parsedTodos && parsedTodos.length > 0) {
								todos = parsedTodos
								previousTodos = [...currentTodos]
								setTodos(parsedTodos)
							}
						}
					} catch {
						// Use raw text if not valid JSON
					}

					addMessage({
						id: messageId,
						role: "tool",
						content: text, // Raw JSON text - needed for tool renderers to parse live content
						toolName,
						toolDisplayName,
						toolDisplayOutput,
						partial: false, // Final message - not partial
						originalType: ask,
						toolData,
						todos,
						previousTodos,
					})

					// If we were streaming, the update already happened via addMessage
					if (wasPartial) {
						return
					}
				} else if (ask === "command") {
					// For command asks, add as tool message with command but no output yet
					// Store the message ID so streaming can update it
					currentCommandMessageIdRef.current = messageId
					pendingCommandRef.current = text
					addMessage({
						id: messageId,
						role: "tool",
						content: "",
						toolName: "execute_command",
						toolDisplayName: "bash",
						originalType: ask,
						toolData: { tool: "execute_command", command: text },
					})
				} else {
					// Other asks - add as assistant message
					addMessage({
						id: messageId,
						role: "assistant",
						content: text || "",
						originalType: ask,
					})
				}
				return
			}

			// Interactive mode - set pending ask for user input
			seenMessageIds.current.add(messageId)

			let suggestions: Array<{ answer: string; mode?: string | null }> | undefined
			let questionText = text

			if (ask === "followup") {
				try {
					const data = JSON.parse(text)
					questionText = data.question || text
					suggestions = Array.isArray(data.suggest) ? data.suggest : undefined
				} catch {
					// Use raw text
				}
			} else if (ask === "tool") {
				try {
					const toolInfo = JSON.parse(text) as Record<string, unknown>
					questionText = formatToolAskMessage(toolInfo)
				} catch {
					// Use raw text
				}
			}

			const pendingAsk: PendingAsk = {
				id: messageId,
				type: ask,
				content: questionText,
				suggestions,
			}
			setPendingAsk(pendingAsk)
		},
		[addMessage, setPendingAsk, setLoading, nonInteractive, currentTodos, setTodos],
	)

	/**
	 * Handle waitingForInput event from ExtensionClient
	 * This is emitted when an ask message needs user input
	 */
	const handleWaitingForInput = useCallback(
		(event: WaitingForInputEvent) => {
			const msg = event.message
			if (msg.type === "ask" && msg.ask) {
				processAskMessage(msg.ts.toString(), msg.ask, msg.text || "", false)
			}
		},
		[processAskMessage],
	)

	// Subscribe to client events
	useEffect(() => {
		tuiLogger.debug("useEffect:client", { hasClient: !!client })
		if (!client) return
		tuiLogger.debug("useEffect:subscribing", { clientId: "ExtensionClient" })

		// Subscribe to message events
		const unsubMessage = client.on("message", processClineMessage)
		const unsubUpdated = client.on("messageUpdated", processClineMessage)
		const unsubWaiting = client.on("waitingForInput", handleWaitingForInput)

		// Handle streaming terminal output during command execution.
		// This updates the existing command message with live output.
		const unsubCommandOutput = client.on("commandExecutionOutput", (event: CommandExecutionOutputEvent) => {
			// Mark that we've streamed output (to skip the final command_output say message)
			hasStreamedCommandOutputRef.current = true

			// If we have a command message ID, update that message's output by re-adding with same ID
			const msgId = currentCommandMessageIdRef.current
			if (msgId) {
				// Re-add the message with the same ID to update it (addMessage handles updates)
				addMessage({
					id: msgId,
					role: "tool",
					content: event.output,
					toolName: "execute_command",
					toolDisplayName: "bash",
					toolDisplayOutput: event.output, // This is what CommandTool displays
					partial: false, // Non-partial to bypass debounce
					originalType: "command",
					toolData: {
						tool: "execute_command",
						command: pendingCommandRef.current || undefined,
						output: event.output,
					},
				})
			} else {
				// Fallback: create a new message if we don't have a command message ID
				const streamingMsgId = `streaming-cmd-${event.executionId}`
				addMessage({
					id: streamingMsgId,
					role: "tool",
					content: event.output,
					toolName: "execute_command",
					toolDisplayName: "bash",
					toolDisplayOutput: event.output,
					partial: false,
					originalType: "command_output",
					toolData: {
						tool: "execute_command",
						command: pendingCommandRef.current || undefined,
						output: event.output,
					},
				})
			}
		})

		// Update token usage when messages change
		const unsubStateChange = client.on("stateChange", () => {
			const messages = client.getMessages()
			if (messages.length > 1) {
				const processed = consolidateApiRequests(consolidateCommands(messages.slice(1)))
				const metrics = consolidateTokenUsage(processed)
				setTokenUsage(metrics)
			}
		})

		return () => {
			unsubMessage()
			unsubUpdated()
			unsubWaiting()
			unsubCommandOutput()
			unsubStateChange()
		}
	}, [client, processClineMessage, handleWaitingForInput, setTokenUsage])

	return { reset }
}
