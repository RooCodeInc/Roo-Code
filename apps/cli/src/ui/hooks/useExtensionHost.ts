import { useEffect, useRef, useCallback, useMemo } from "react"
import { useApp } from "ink"
import { randomUUID } from "crypto"
import pWaitFor from "p-wait-for"
import type { ExtensionMessage, HistoryItem, WebviewMessage } from "@roo-code/types"

import { ExtensionHostInterface, ExtensionHostOptions } from "@/agent/index.js"
import { arePathsEqual } from "@/lib/utils/path.js"

import { useCLIStore } from "../store.js"

const TASK_HISTORY_WAIT_TIMEOUT_MS = 2_000

function extractTaskHistory(message: ExtensionMessage): HistoryItem[] | undefined {
	if (message.type === "state" && Array.isArray(message.state?.taskHistory)) {
		return message.state.taskHistory as HistoryItem[]
	}

	if (message.type === "taskHistoryUpdated" && Array.isArray(message.taskHistory)) {
		return message.taskHistory as HistoryItem[]
	}

	return undefined
}

function getMostRecentTaskId(taskHistory: HistoryItem[], workspacePath: string): string | undefined {
	const workspaceTasks = taskHistory.filter(
		(item) => typeof item.workspace === "string" && arePathsEqual(item.workspace, workspacePath),
	)

	if (workspaceTasks.length === 0) {
		return undefined
	}

	const sorted = [...workspaceTasks].sort((a, b) => b.ts - a.ts)
	return sorted[0]?.id
}

// TODO: Unify with TUIAppProps?
export interface UseExtensionHostOptions extends ExtensionHostOptions {
	initialPrompt?: string
	initialSessionId?: string
	continueSession?: boolean
	onExtensionMessage: (msg: ExtensionMessage) => void
	createExtensionHost: (options: ExtensionHostOptions) => ExtensionHostInterface
}

export interface UseExtensionHostReturn {
	isReady: boolean
	sendToExtension: ((msg: WebviewMessage) => void) | null
	runTask: ((prompt: string) => Promise<void>) | null
	cleanup: () => Promise<void>
}

/**
 * Hook to manage the extension host lifecycle.
 *
 * Responsibilities:
 * - Initialize the extension host
 * - Set up event listeners for messages, task completion, and errors
 * - Handle cleanup/disposal
 * - Expose methods for sending messages and running tasks
 */
export function useExtensionHost({
	initialPrompt,
	initialSessionId,
	continueSession,
	mode,
	reasoningEffort,
	user,
	provider,
	apiKey,
	model,
	workspacePath,
	extensionPath,
	nonInteractive,
	ephemeral,
	debug,
	exitOnComplete,
	onExtensionMessage,
	createExtensionHost,
}: UseExtensionHostOptions): UseExtensionHostReturn {
	const { exit } = useApp()
	const { addMessage, setComplete, setLoading, setHasStartedTask, setError, setCurrentTaskId, setIsResumingTask } =
		useCLIStore()

	const hostRef = useRef<ExtensionHostInterface | null>(null)
	const isReadyRef = useRef(false)

	const cleanup = useCallback(async () => {
		if (hostRef.current) {
			await hostRef.current.dispose()
			hostRef.current = null
			isReadyRef.current = false
		}
	}, [])

	useEffect(() => {
		const init = async () => {
			try {
				const requestedSessionId = initialSessionId?.trim()
				let taskHistorySnapshot: HistoryItem[] = []
				let hasReceivedTaskHistory = false

				const host = createExtensionHost({
					mode,
					user,
					reasoningEffort,
					provider,
					apiKey,
					model,
					workspacePath,
					extensionPath,
					nonInteractive,
					ephemeral,
					debug,
					exitOnComplete,
					disableOutput: true,
				})

				hostRef.current = host
				isReadyRef.current = true

				host.on("extensionWebviewMessage", (msg) => {
					const extensionMessage = msg as ExtensionMessage
					const taskHistory = extractTaskHistory(extensionMessage)

					if (taskHistory) {
						taskHistorySnapshot = taskHistory
						hasReceivedTaskHistory = true
					}

					onExtensionMessage(extensionMessage)
				})

				host.client.on("taskCompleted", async () => {
					setComplete(true)
					setLoading(false)

					if (exitOnComplete) {
						await cleanup()
						exit()
						setTimeout(() => process.exit(0), 100)
					}
				})

				host.client.on("error", (err: Error) => {
					setError(err.message)
					setLoading(false)
				})

				await host.activate()

				// Request initial state from extension (triggers
				// postStateToWebview which includes taskHistory).
				host.sendToExtension({ type: "requestCommands" })
				host.sendToExtension({ type: "requestModes" })

				if (requestedSessionId || continueSession) {
					await pWaitFor(() => hasReceivedTaskHistory, {
						interval: 25,
						timeout: TASK_HISTORY_WAIT_TIMEOUT_MS,
					}).catch(() => undefined)

					if (requestedSessionId && hasReceivedTaskHistory) {
						const hasRequestedTask = taskHistorySnapshot.some((item) => item.id === requestedSessionId)

						if (!hasRequestedTask) {
							throw new Error(`Session not found in task history: ${requestedSessionId}`)
						}
					}

					const resolvedSessionId =
						requestedSessionId || getMostRecentTaskId(taskHistorySnapshot, workspacePath)

					if (continueSession && !resolvedSessionId) {
						throw new Error("No previous tasks found to continue in this workspace.")
					}

					if (resolvedSessionId) {
						setCurrentTaskId(resolvedSessionId)
						setIsResumingTask(true)
						setHasStartedTask(true)
						setLoading(true)
						host.sendToExtension({ type: "showTaskWithId", text: resolvedSessionId })
						return
					}
				}

				setLoading(false)

				if (initialPrompt) {
					setHasStartedTask(true)
					setLoading(true)
					addMessage({ id: randomUUID(), role: "user", content: initialPrompt })
					await host.runTask(initialPrompt)
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err))
				setLoading(false)
			}
		}

		init()

		return () => {
			cleanup()
		}
	}, []) // Run once on mount

	// Stable sendToExtension - uses ref to always access current host.
	// This function reference never changes, preventing downstream
	// useCallback/useMemo invalidations.
	const sendToExtension = useCallback((msg: WebviewMessage) => {
		hostRef.current?.sendToExtension(msg)
	}, [])

	// Stable runTask - uses ref to always access current host.
	const runTask = useCallback((prompt: string): Promise<void> => {
		if (!hostRef.current) {
			return Promise.reject(new Error("Extension host not ready"))
		}

		return hostRef.current.runTask(prompt)
	}, [])

	// Memoized return object to prevent unnecessary re-renders in consumers.
	return useMemo(
		() => ({ isReady: isReadyRef.current, sendToExtension, runTask, cleanup }),
		[sendToExtension, runTask, cleanup],
	)
}
