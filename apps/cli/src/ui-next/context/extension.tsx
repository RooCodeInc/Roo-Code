/**
 * Extension context provider - bridges ExtensionHost to SolidJS store.
 *
 * This replaces the React hooks: useExtensionHost, useMessageHandlers, useTaskSubmit
 * with a single SolidJS context that manages the extension lifecycle and state.
 */

import { createStore, produce } from "solid-js/store"
import { batch, onCleanup, onMount } from "solid-js"
import { randomUUID } from "crypto"

import type { ClineMessage, ExtensionMessage, TodoItem, TokenUsage, WebviewMessage } from "@roo-code/types"
import { consolidateTokenUsage, consolidateApiRequests, consolidateCommands } from "@roo-code/core/cli"

import type { ExtensionHostInterface, ExtensionHostOptions } from "../../agent/index.js"

import type { TUIMessage, PendingAsk, FileResult, SlashCommandResult, ModeResult, TaskHistoryItem } from "../types.js"
import { createSimpleContext } from "./helper.js"
import { processSayMessage, processAskMessage, computeSubmitAction, type MessageContext } from "./extension-logic.js"

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
		// Message handling (delegates to pure functions in extension-logic)
		// ================================================================

		/** Build a MessageContext snapshot for pure functions. */
		function getMessageContext(): MessageContext {
			return {
				seenMessageIds,
				firstTextMessageSkipped,
				isResumingTask: store.isResumingTask,
				pendingCommandRef,
				nonInteractive: props.options.nonInteractive ?? false,
				currentTodos: store.currentTodos,
			}
		}

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

		function handleSayMessage(
			ts: number,
			say: Parameters<typeof processSayMessage>[2],
			text: string,
			partial: boolean,
		) {
			const result = processSayMessage(getMessageContext(), ts, say, text, partial)

			if (result.trackId) seenMessageIds.add(result.trackId)
			if (result.setFirstTextSkipped) firstTextMessageSkipped = true
			if (result.clearPendingCommand) pendingCommandRef = null
			if (result.message) addMessage(result.message)
		}

		function handleAskMessage(
			ts: number,
			ask: Parameters<typeof processAskMessage>[2],
			text: string,
			partial: boolean,
		) {
			const result = processAskMessage(getMessageContext(), ts, ask, text, partial)

			if (result.trackId) seenMessageIds.add(result.trackId)
			if (result.pendingCommand !== undefined) pendingCommandRef = result.pendingCommand

			batch(() => {
				const u = result.storeUpdates
				if (u.isLoading !== undefined) setStore("isLoading", u.isLoading)
				if (u.hasStartedTask !== undefined) setStore("hasStartedTask", u.hasStartedTask)
				if (u.isResumingTask !== undefined) setStore("isResumingTask", u.isResumingTask)
				if (u.isComplete !== undefined) setStore("isComplete", u.isComplete)
				if (result.todoUpdate) {
					setStore("previousTodos", result.todoUpdate.previousTodos)
					setStore("currentTodos", result.todoUpdate.currentTodos)
				}
				if (result.pendingAsk) setStore("pendingAsk", result.pendingAsk)
			})

			if (result.message) addMessage(result.message)
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
			if (!host) return

			const action = computeSubmitAction(
				{
					pendingAsk: store.pendingAsk,
					hasStartedTask: store.hasStartedTask,
					isComplete: store.isComplete,
				},
				text,
				() => randomUUID(),
			)

			switch (action.kind) {
				case "none":
					return

				case "clearTask":
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

				case "respondToAsk":
					addMessage(action.userMessage)
					sendToExtension({
						type: "askResponse",
						askResponse: "messageResponse",
						text: action.text,
					})
					batch(() => {
						setStore("pendingAsk", null)
						setStore("isLoading", true)
					})
					return

				case "startNewTask":
					batch(() => {
						setStore("hasStartedTask", true)
						setStore("isLoading", true)
					})
					addMessage(action.userMessage)
					try {
						await runTask(action.text)
					} catch (err) {
						batch(() => {
							setStore("error", err instanceof Error ? err.message : String(err))
							setStore("isLoading", false)
						})
					}
					return

				case "continueTask":
					if (store.isComplete) setStore("isComplete", false)
					setStore("isLoading", true)
					addMessage(action.userMessage)
					sendToExtension({
						type: "askResponse",
						askResponse: "messageResponse",
						text: action.text,
					})
					return
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
