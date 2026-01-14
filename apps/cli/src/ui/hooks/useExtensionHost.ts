import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useApp } from "ink"
import { randomUUID } from "crypto"
import type { ExtensionMessage, WebviewMessage } from "@roo-code/types"

import { ExtensionClient, ExtensionHostInterface, ExtensionHostOptions } from "@/agent/index.js"

import { useCLIStore } from "../store.js"

export interface UseExtensionHostOptions extends ExtensionHostOptions {
	initialPrompt?: string
	exitOnComplete?: boolean
	/**
	 * Handle non-message extension state (modes, file search, commands, etc.)
	 * ClineMessage processing should use useClientEvents instead.
	 */
	onExtensionState?: (msg: ExtensionMessage) => void
	createExtensionHost: (options: ExtensionHostOptions) => ExtensionHostInterface
}

export interface UseExtensionHostReturn {
	isReady: boolean
	/** ExtensionClient for subscribing to message events */
	client: ExtensionClient | null
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
	exitOnComplete,
	onExtensionState,
	createExtensionHost,
}: UseExtensionHostOptions): UseExtensionHostReturn {
	const { exit } = useApp()
	const { addMessage, setComplete, setLoading, setHasStartedTask, setError } = useCLIStore()

	const hostRef = useRef<ExtensionHostInterface | null>(null)
	// Use state for client so that consumers re-render when it becomes available.
	// This is critical for useClientEvents which needs the client to subscribe to events.
	const [client, setClient] = useState<ExtensionClient | null>(null)
	const isReadyRef = useRef(false)

	const cleanup = useCallback(async () => {
		if (hostRef.current) {
			await hostRef.current.dispose()
			hostRef.current = null
			setClient(null)
			isReadyRef.current = false
		}
	}, [])

	useEffect(() => {
		const init = async () => {
			try {
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
					disableOutput: true,
					ephemeral,
				})

				hostRef.current = host
				// Setting client via state triggers re-render so useClientEvents
				// receives the valid client and can subscribe to events.
				setClient(host.client)
				isReadyRef.current = true

				// Handle non-message state updates (modes, file search, commands, task history)
				if (onExtensionState) {
					host.on("extensionWebviewMessage", (msg) => onExtensionState(msg as ExtensionMessage))
				}

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

	// Return object includes client state directly so consumers re-render when client changes.
	return useMemo(
		() => ({ isReady: isReadyRef.current, client, sendToExtension, runTask, cleanup }),
		[client, sendToExtension, runTask, cleanup],
	)
}
