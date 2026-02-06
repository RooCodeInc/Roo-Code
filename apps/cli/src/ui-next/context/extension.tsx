/**
 * Extension context provider - bridges ExtensionHost to SolidJS store.
 *
 * This replaces the React hooks: useExtensionHost, useMessageHandlers, useTaskSubmit
 * with a single SolidJS context that manages the extension lifecycle and state.
 */

import { createStore, produce } from "solid-js/store"
import { batch, onCleanup, onMount } from "solid-js"
import { randomUUID } from "crypto"

import type {
	ClineAsk,
	ClineMessage,
	ClineSay,
	ExtensionMessage,
	TodoItem,
	TokenUsage,
	WebviewMessage,
} from "@roo-code/types"
import { consolidateTokenUsage, consolidateApiRequests, consolidateCommands } from "@roo-code/core/cli"

import type { ExtensionHostInterface, ExtensionHostOptions } from "../../agent/index.js"

import type {
	TUIMessage,
	PendingAsk,
	ToolData,
	FileResult,
	SlashCommandResult,
	ModeResult,
	TaskHistoryItem,
} from "../types.js"
import {
	extractToolData,
	formatToolOutput,
	formatToolAskMessage,
	parseTodosFromToolInfo,
} from "../../ui/utils/tools.js"
import { getGlobalCommand, getGlobalCommandsForAutocomplete } from "../../lib/utils/commands.js"
import { createSimpleContext } from "./helper.js"

/** Streaming message debounce configuration. */
const STREAMING_DEBOUNCE_MS = 150

export interface ExtensionStore {
	messages: TUIMessage[]
	pendingAsk: PendingAsk | null
	isLoading: boolean
	isComplete: boolean
	hasStartedTask: boolean
	error: string | null
	isResumingTask: boolean

	// Autocomplete data
	fileSearchResults: FileResult[]
	allSlashCommands: SlashCommandResult[]
	availableModes: ModeResult[]

	// Task history
	taskHistory: TaskHistoryItem[]
	currentTaskId: string | null

	// Mode
	currentMode: string | null

	// Metrics
	tokenUsage: TokenUsage | null

	// Todos
	currentTodos: TodoItem[]
	previousTodos: TodoItem[]
}

const initialState: ExtensionStore = {
	messages: [],
	pendingAsk: null,
	isLoading: false,
	isComplete: false,
	hasStartedTask: false,
	error: null,
	isResumingTask: false,
	fileSearchResults: [],
	allSlashCommands: [],
	availableModes: [],
	taskHistory: [],
	currentTaskId: null,
	currentMode: null,
	tokenUsage: null,
	currentTodos: [],
	previousTodos: [],
}

export interface ExtensionContextProps {
	options: ExtensionHostOptions
	initialPrompt?: string
	createExtensionHost: (options: ExtensionHostOptions) => ExtensionHostInterface
	onExit?: () => void
}

export const { use: useExtension, provider: ExtensionProvider } = createSimpleContext({
	name: "Extension",
	init: (props: ExtensionContextProps) => {
		const [store, setStore] = createStore<ExtensionStore>({ ...initialState })

		let host: ExtensionHostInterface | null = null
		const seenMessageIds = new Set<string>()
		let firstTextMessageSkipped = false
		let pendingCommandRef: string | null = null

		// Streaming debounce state
		const pendingStreamUpdates = new Map<string, { id: string; content: string; partial: boolean }>()
		let streamingDebounceTimer: ReturnType<typeof setTimeout> | null = null

		// ================================================================
		// Message handling (ported from useMessageHandlers)
		// ================================================================

		function addMessage(msg: TUIMessage) {
			const existingIndex = store.messages.findIndex((m) => m.id === msg.id)

			if (existingIndex === -1) {
				setStore("messages", (msgs) => [...msgs, msg])
				return
			}

			if (msg.partial) {
				pendingStreamUpdates.set(msg.id, {
					id: msg.id,
					content: msg.content,
					partial: true,
				})

				if (!streamingDebounceTimer) {
					streamingDebounceTimer = setTimeout(() => {
						const updates = Array.from(pendingStreamUpdates.values())
						pendingStreamUpdates.clear()
						streamingDebounceTimer = null

						if (updates.length === 0) return

						setStore(
							"messages",
							produce((msgs) => {
								for (const update of updates) {
									const idx = msgs.findIndex((m) => m.id === update.id)
									if (idx !== -1 && msgs[idx]) {
										msgs[idx]!.content = update.content
										msgs[idx]!.partial = update.partial
									}
								}
							}),
						)
					}, STREAMING_DEBOUNCE_MS)
				}
				return
			}

			// Non-partial update
			pendingStreamUpdates.delete(msg.id)
			setStore(
				"messages",
				produce((msgs) => {
					msgs[existingIndex] = msg
				}),
			)
		}

		function handleSayMessage(ts: number, say: ClineSay, text: string, partial: boolean) {
			const messageId = ts.toString()

			if (say === "checkpoint_saved" || say === "api_req_started" || say === "user_feedback") {
				if (say === "user_feedback") seenMessageIds.add(messageId)
				return
			}

			if (say === "text" && !firstTextMessageSkipped && !store.isResumingTask) {
				firstTextMessageSkipped = true
				seenMessageIds.add(messageId)
				return
			}

			if (seenMessageIds.has(messageId) && !partial) return

			let role: TUIMessage["role"] = "assistant"
			let toolName: string | undefined
			let toolDisplayName: string | undefined
			let toolDisplayOutput: string | undefined
			let toolData: ToolData | undefined

			if (say === "command_output") {
				role = "tool"
				toolName = "execute_command"
				toolDisplayName = "bash"
				toolDisplayOutput = text
				const trackedCommand = pendingCommandRef
				toolData = { tool: "execute_command", command: trackedCommand || undefined, output: text }
				pendingCommandRef = null
			} else if (say === "reasoning") {
				role = "thinking"
			}

			seenMessageIds.add(messageId)

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
		}

		function handleAskMessage(ts: number, ask: ClineAsk, text: string, partial: boolean) {
			const messageId = ts.toString()

			if (partial) return
			if (seenMessageIds.has(messageId)) return
			if (ask === "command_output") {
				seenMessageIds.add(messageId)
				return
			}

			if (ask === "resume_task" || ask === "resume_completed_task") {
				seenMessageIds.add(messageId)
				batch(() => {
					setStore("isLoading", false)
					setStore("hasStartedTask", true)
					setStore("isResumingTask", false)
				})
				return
			}

			if (ask === "completion_result") {
				seenMessageIds.add(messageId)
				batch(() => {
					setStore("isComplete", true)
					setStore("isLoading", false)
				})

				try {
					const completionInfo = JSON.parse(text) as Record<string, unknown>
					const toolDataVal: ToolData = {
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
						toolData: toolDataVal,
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

			if (ask === "command") {
				pendingCommandRef = text
			}

			if (props.options.nonInteractive && ask !== "followup") {
				seenMessageIds.add(messageId)

				if (ask === "tool") {
					let localToolName: string | undefined
					let localToolDisplayName: string | undefined
					let localToolDisplayOutput: string | undefined
					let formattedContent = text || ""
					let localToolData: ToolData | undefined
					let todos: TodoItem[] | undefined
					let previousTodos: TodoItem[] | undefined

					try {
						const toolInfo = JSON.parse(text) as Record<string, unknown>
						localToolName = toolInfo.tool as string
						localToolDisplayName = toolInfo.tool as string
						localToolDisplayOutput = formatToolOutput(toolInfo)
						formattedContent = formatToolAskMessage(toolInfo)
						localToolData = extractToolData(toolInfo)

						if (localToolName === "update_todo_list" || localToolName === "updateTodoList") {
							const parsedTodos = parseTodosFromToolInfo(toolInfo)
							if (parsedTodos && parsedTodos.length > 0) {
								todos = parsedTodos
								previousTodos = [...store.currentTodos]
								setStore("previousTodos", store.currentTodos)
								setStore("currentTodos", parsedTodos)
							}
						}
					} catch {
						// Use raw text
					}

					addMessage({
						id: messageId,
						role: "tool",
						content: formattedContent,
						toolName: localToolName,
						toolDisplayName: localToolDisplayName,
						toolDisplayOutput: localToolDisplayOutput,
						originalType: ask,
						toolData: localToolData,
						todos,
						previousTodos,
					})
				} else {
					addMessage({
						id: messageId,
						role: "assistant",
						content: text || "",
						originalType: ask,
					})
				}
				return
			}

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

			seenMessageIds.add(messageId)

			setStore("pendingAsk", {
				id: messageId,
				type: ask,
				content: questionText,
				suggestions,
			})
		}

		function handleExtensionMessage(msg: ExtensionMessage) {
			if (msg.type === "state") {
				const state = msg.state
				if (!state) return

				batch(() => {
					const newMode = state.mode
					if (newMode) setStore("currentMode", newMode)

					const newTaskHistory = state.taskHistory
					if (newTaskHistory && Array.isArray(newTaskHistory)) {
						setStore("taskHistory", newTaskHistory as TaskHistoryItem[])
					}

					const clineMessages = state.clineMessages
					if (clineMessages) {
						for (const clineMsg of clineMessages) {
							const { ts, type, say, ask, text = "", partial = false } = clineMsg
							if (type === "say" && say) handleSayMessage(ts, say, text, partial as boolean)
							else if (type === "ask" && ask) handleAskMessage(ts, ask, text, partial as boolean)
						}

						if (clineMessages.length > 1) {
							const processed = consolidateApiRequests(
								consolidateCommands(clineMessages.slice(1) as ClineMessage[]),
							)
							const metrics = consolidateTokenUsage(processed)
							setStore("tokenUsage", metrics)
						}
					}

					if (store.isResumingTask) {
						setStore("isResumingTask", false)
					}
				})
			} else if (msg.type === "messageUpdated") {
				const clineMessage = msg.clineMessage
				if (!clineMessage) return

				const { ts, type, say, ask, text = "", partial = false } = clineMessage
				if (type === "say" && say) handleSayMessage(ts, say, text, partial as boolean)
				else if (type === "ask" && ask) handleAskMessage(ts, ask, text, partial as boolean)
			} else if (msg.type === "fileSearchResults") {
				setStore("fileSearchResults", (msg.results as FileResult[]) || [])
			} else if (msg.type === "commands") {
				setStore("allSlashCommands", (msg.commands as SlashCommandResult[]) || [])
			} else if (msg.type === "modes") {
				setStore("availableModes", (msg.modes as ModeResult[]) || [])
			} else if (msg.type === "routerModels") {
				// We can add routerModels to the store if needed
			}
		}

		// ================================================================
		// Task actions (ported from useTaskSubmit)
		// ================================================================

		function sendToExtension(msg: WebviewMessage) {
			host?.sendToExtension(msg)
		}

		async function runTask(prompt: string) {
			if (!host) throw new Error("Extension host not ready")
			return host.runTask(prompt)
		}

		async function handleSubmit(text: string) {
			if (!host || !text.trim()) return

			const trimmedText = text.trim()
			if (trimmedText === "__CUSTOM__") return

			// Check for CLI global action commands
			if (trimmedText.startsWith("/")) {
				const commandMatch = trimmedText.match(/^\/(\w+)(?:\s|$)/)
				if (commandMatch && commandMatch[1]) {
					const globalCommand = getGlobalCommand(commandMatch[1])
					if (globalCommand?.action === "clearTask") {
						// Reset state
						batch(() => {
							setStore("messages", [])
							setStore("pendingAsk", null)
							setStore("isLoading", false)
							setStore("isComplete", false)
							setStore("hasStartedTask", false)
							setStore("error", null)
							setStore("isResumingTask", false)
							setStore("tokenUsage", null)
							setStore("currentTodos", [])
							setStore("previousTodos", [])
						})
						seenMessageIds.clear()
						firstTextMessageSkipped = false
						sendToExtension({ type: "clearTask" })
						sendToExtension({ type: "requestCommands" })
						sendToExtension({ type: "requestModes" })
						return
					}
				}
			}

			if (store.pendingAsk) {
				addMessage({ id: randomUUID(), role: "user", content: trimmedText })
				sendToExtension({
					type: "askResponse",
					askResponse: "messageResponse",
					text: trimmedText,
				})
				batch(() => {
					setStore("pendingAsk", null)
					setStore("isLoading", true)
				})
			} else if (!store.hasStartedTask) {
				batch(() => {
					setStore("hasStartedTask", true)
					setStore("isLoading", true)
				})
				addMessage({ id: randomUUID(), role: "user", content: trimmedText })
				try {
					await runTask(trimmedText)
				} catch (err) {
					batch(() => {
						setStore("error", err instanceof Error ? err.message : String(err))
						setStore("isLoading", false)
					})
				}
			} else {
				if (store.isComplete) setStore("isComplete", false)
				setStore("isLoading", true)
				addMessage({ id: randomUUID(), role: "user", content: trimmedText })
				sendToExtension({
					type: "askResponse",
					askResponse: "messageResponse",
					text: trimmedText,
				})
			}
		}

		function handleApprove() {
			if (!host) return
			sendToExtension({ type: "askResponse", askResponse: "yesButtonClicked" })
			batch(() => {
				setStore("pendingAsk", null)
				setStore("isLoading", true)
			})
		}

		function handleReject() {
			if (!host) return
			sendToExtension({ type: "askResponse", askResponse: "noButtonClicked" })
			batch(() => {
				setStore("pendingAsk", null)
				setStore("isLoading", true)
			})
		}

		// ================================================================
		// Lifecycle
		// ================================================================

		onMount(async () => {
			try {
				host = props.createExtensionHost({
					...props.options,
					disableOutput: true,
				})

				host.on("extensionWebviewMessage", (msg) => {
					handleExtensionMessage(msg as ExtensionMessage)
				})

				host.client.on("taskCompleted", async () => {
					batch(() => {
						setStore("isComplete", true)
						setStore("isLoading", false)
					})

					if (props.options.exitOnComplete) {
						await host?.dispose()
						props.onExit?.()
						setTimeout(() => process.exit(0), 100)
					}
				})

				host.client.on("error", (err: Error) => {
					batch(() => {
						setStore("error", err.message)
						setStore("isLoading", false)
					})
				})

				await host.activate()

				sendToExtension({ type: "requestCommands" })
				sendToExtension({ type: "requestModes" })

				setStore("isLoading", false)

				if (props.initialPrompt) {
					batch(() => {
						setStore("hasStartedTask", true)
						setStore("isLoading", true)
					})
					addMessage({ id: randomUUID(), role: "user", content: props.initialPrompt })
					await host.runTask(props.initialPrompt)
				}
			} catch (err) {
				batch(() => {
					setStore("error", err instanceof Error ? err.message : String(err))
					setStore("isLoading", false)
				})
			}
		})

		onCleanup(async () => {
			if (streamingDebounceTimer) clearTimeout(streamingDebounceTimer)
			if (host) {
				await host.dispose()
				host = null
			}
		})

		return {
			get state() {
				return store
			},
			sendToExtension,
			runTask,
			handleSubmit,
			handleApprove,
			handleReject,
			searchFiles(query: string) {
				sendToExtension({ type: "searchFiles", query })
			},
			cancelTask() {
				sendToExtension({ type: "cancelTask" })
			},
			resumeTask(taskId: string) {
				batch(() => {
					setStore("isResumingTask", true)
					setStore("hasStartedTask", true)
					setStore("isLoading", true)
					setStore("isComplete", false)
				})
				sendToExtension({ type: "showTaskWithId", text: taskId })
			},
		}
	},
})
