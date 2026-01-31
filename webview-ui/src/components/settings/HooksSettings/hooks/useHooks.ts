import { useState, useCallback, useMemo, useEffect } from "react"

import type { HookEventType, HookWithMetadata, HookConfig } from "@roo-code/types"

import { vscode } from "@/utils/vscode"

export interface UseHooksReturn {
	/** All hooks */
	hooks: HookWithMetadata[]

	/** Loading state */
	isLoading: boolean

	/** Error state */
	error: string | null

	/** Global hooks enabled state */
	hooksEnabled: boolean

	/** Toggle global hooks enabled state */
	setHooksEnabled: (enabled: boolean) => void

	/** Get hooks filtered by event type */
	getHooksByEventType: (eventType: HookEventType) => HookWithMetadata[]

	/** Update a hook */
	updateHook: (hookId: string, updates: Partial<HookWithMetadata>) => void

	/** Toggle a hook's enabled state */
	toggleHookEnabled: (hookId: string) => void

	/** Delete a hook */
	deleteHook: (hookId: string, eventType: HookEventType) => void

	/** Create a new hook */
	createHook: (eventType: HookEventType, hook: HookWithMetadata, source: "global" | "project") => void

	/** Check if a hook ID is unique */
	isHookIdUnique: (id: string) => boolean

	/** Get all existing hook IDs */
	getAllHookIds: () => string[]

	/** Reload hooks from backend */
	reloadHooks: () => void

	/** Open global hooks folder */
	openGlobalFolder: () => void

	/** Open project hooks folder */
	openProjectFolder: () => void

	/**
	 * Move a hook to a different event type group.
	 * Used for cross-container drag and drop.
	 */
	moveHook: (hookId: string, fromEventType: HookEventType, toEventType: HookEventType, newIndex: number) => void

	/**
	 * Reorder hooks within the same event type group.
	 * Used for within-container drag and drop.
	 */
	reorderHooks: (eventType: HookEventType, activeId: string, overId: string) => void
}

/**
 * Custom hook for managing hooks state with backend integration.
 * Communicates with the extension backend via postMessage/onMessage.
 */
export function useHooks(): UseHooksReturn {
	const [hooks, setHooks] = useState<HookWithMetadata[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [hooksEnabled, setHooksEnabled] = useState(true)

	// Load hooks on mount and listen for messages from the extension
	useEffect(() => {
		// Request initial hooks load
		vscode.postMessage({ type: "hooks/load" })

		// Listen for messages from the extension
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "hooks/loaded") {
				setHooks(message.hooks || [])
				setIsLoading(false)
				setError(null)
			} else if (message.type === "hooks/error") {
				setError(message.error || "Unknown error")
				setIsLoading(false)
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const getHooksByEventType = useCallback(
		(eventType: HookEventType): HookWithMetadata[] => {
			return hooks.filter((hook) => hook.eventType === eventType)
		},
		[hooks],
	)

	/**
	 * Convert HookWithMetadata to HookConfig by stripping metadata fields.
	 */
	const stripMetadata = useCallback((hook: HookWithMetadata): HookConfig => {
		const { source: _source, filePath: _filePath, ...config } = hook
		return config as HookConfig
	}, [])

	const updateHook = useCallback(
		(hookId: string, updates: Partial<HookWithMetadata>) => {
			// Find the existing hook to get its eventType and source
			const existingHook = hooks.find((h) => h.id === hookId)
			if (!existingHook) {
				console.error(`[useHooks] Hook not found: ${hookId}`)
				return
			}

			// Merge updates with existing hook
			const updatedHook: HookWithMetadata = { ...existingHook, ...updates }
			const hookConfig = stripMetadata(updatedHook)

			// Send update to backend
			vscode.postMessage({
				type: "hooks/save",
				hook: hookConfig,
				eventType: updatedHook.eventType,
				source: updatedHook.source,
			})

			// Optimistically update local state
			setHooks((prevHooks) => prevHooks.map((hook) => (hook.id === hookId ? updatedHook : hook)))
		},
		[hooks, stripMetadata],
	)

	const toggleHookEnabled = useCallback(
		(hookId: string) => {
			const hook = hooks.find((h) => h.id === hookId)
			if (hook) {
				updateHook(hookId, { enabled: !hook.enabled })
			}
		},
		[hooks, updateHook],
	)

	const deleteHook = useCallback(
		(hookId: string, eventType: HookEventType) => {
			// Find the hook to determine its source
			const hook = hooks.find((h) => h.id === hookId)
			if (!hook) {
				console.error(`[useHooks] Hook not found: ${hookId}`)
				return
			}

			// Send delete to backend
			vscode.postMessage({
				type: "hooks/delete",
				hookId,
				eventType,
				source: hook.source,
			})

			// Optimistically update local state
			setHooks((prevHooks) => prevHooks.filter((h) => h.id !== hookId))
		},
		[hooks],
	)

	const createHook = useCallback(
		(eventType: HookEventType, hook: HookWithMetadata, source: "global" | "project") => {
			// Ensure the hook has the correct eventType
			const newHook: HookWithMetadata = {
				...hook,
				eventType,
				source,
				filePath: source === "global" ? "~/.roo/hooks/.hooks" : ".roo/hooks/.hooks",
			}

			const hookConfig = stripMetadata(newHook)

			// Send create to backend
			vscode.postMessage({
				type: "hooks/save",
				hook: hookConfig,
				eventType,
				source,
			})

			// Optimistically update local state
			setHooks((prevHooks) => [...prevHooks, newHook])
		},
		[stripMetadata],
	)

	const isHookIdUnique = useCallback(
		(id: string): boolean => {
			return !hooks.some((hook) => hook.id === id)
		},
		[hooks],
	)

	const getAllHookIds = useCallback((): string[] => {
		return hooks.map((hook) => hook.id)
	}, [hooks])

	const reloadHooks = useCallback(() => {
		setIsLoading(true)
		setError(null)
		vscode.postMessage({ type: "hooks/reload" })
	}, [])

	const openGlobalFolder = useCallback(() => {
		vscode.postMessage({ type: "hooks/openFolder", source: "global" })
	}, [])

	const openProjectFolder = useCallback(() => {
		vscode.postMessage({ type: "hooks/openFolder", source: "project" })
	}, [])

	/**
	 * Move a hook to a different event type group at a specific index.
	 * Updates the hook's eventType property and repositions it.
	 *
	 * Uses a single atomic 'hooks/move' message to prevent race conditions
	 * that could occur with separate delete + save operations.
	 */
	const moveHook = useCallback(
		(hookId: string, fromEventType: HookEventType, toEventType: HookEventType, newIndex: number) => {
			// Find the hook to move
			const hook = hooks.find((h) => h.id === hookId)
			if (!hook || hook.eventType !== fromEventType) return

			// Create updated hook with new event type
			const updatedHook: HookWithMetadata = {
				...hook,
				eventType: toEventType,
			}

			// Use atomic move operation - sends a single message to the backend
			// that removes from source and adds to target in one file write
			const hookConfig = stripMetadata(updatedHook)
			vscode.postMessage({
				type: "hooks/move",
				hook: hookConfig,
				fromEventType,
				toEventType,
				source: hook.source,
			})

			// Optimistically update local state
			setHooks((prevHooks) => {
				// Remove hook from its current position
				const newHooks = prevHooks.filter((h) => h.id !== hookId)

				// Find all hooks in the target container to calculate insertion point
				const targetContainerHooks = newHooks.filter((h) => h.eventType === toEventType)
				const adjustedIndex = Math.min(newIndex, targetContainerHooks.length)

				// Find the actual position to insert in the full array
				if (adjustedIndex === 0) {
					// Insert before the first hook of this type, or at the end if none exist
					const firstTargetIndex = newHooks.findIndex((h) => h.eventType === toEventType)
					if (firstTargetIndex === -1) {
						// No hooks in target container, add at the end
						newHooks.push(updatedHook)
					} else {
						newHooks.splice(firstTargetIndex, 0, updatedHook)
					}
				} else {
					// Find the position after the hook at (adjustedIndex - 1) in the target container
					let count = 0
					let insertPosition = newHooks.length
					for (let i = 0; i < newHooks.length; i++) {
						if (newHooks[i].eventType === toEventType) {
							count++
							if (count === adjustedIndex) {
								insertPosition = i + 1
								break
							}
						}
					}
					newHooks.splice(insertPosition, 0, updatedHook)
				}

				return newHooks
			})
		},
		[hooks, stripMetadata],
	)

	/**
	 * Reorder hooks within the same event type group.
	 * Moves the active hook to the position of the over hook.
	 */
	const reorderHooks = useCallback(
		(eventType: HookEventType, activeId: string, overId: string) => {
			// Get hooks for this event type in their current order
			const eventTypeHooks = hooks.filter((h) => h.eventType === eventType)

			const activeIndex = eventTypeHooks.findIndex((h) => h.id === activeId)
			const overIndex = eventTypeHooks.findIndex((h) => h.id === overId)

			if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
				return
			}

			// Reorder within the event type group
			const reorderedHooks = [...eventTypeHooks]
			const [movedHook] = reorderedHooks.splice(activeIndex, 1)
			reorderedHooks.splice(overIndex, 0, movedHook)

			// Get hook IDs in new order
			const hookIds = reorderedHooks.map((h) => h.id)

			// Determine the source (use the active hook's source)
			const activeHook = hooks.find((h) => h.id === activeId)
			if (!activeHook) return

			// Send reorder to backend
			vscode.postMessage({
				type: "hooks/reorder",
				eventType,
				hookIds,
				source: activeHook.source,
			})

			// Optimistically update local state
			setHooks((prevHooks) => {
				// Rebuild the full array preserving the order by event type
				const result: HookWithMetadata[] = []
				const eventTypeIndices = new Map<HookEventType, number>()

				// Initialize indices for tracking position within each event type
				for (const hook of prevHooks) {
					if (!eventTypeIndices.has(hook.eventType)) {
						eventTypeIndices.set(hook.eventType, 0)
					}
				}

				// Rebuild array in original order pattern but with reordered hooks for the target event type
				for (const hook of prevHooks) {
					if (hook.eventType === eventType) {
						const idx = eventTypeIndices.get(eventType)!
						result.push(reorderedHooks[idx])
						eventTypeIndices.set(eventType, idx + 1)
					} else {
						result.push(hook)
					}
				}

				return result
			})
		},
		[hooks],
	)

	return useMemo(
		() => ({
			hooks,
			isLoading,
			error,
			hooksEnabled,
			setHooksEnabled,
			getHooksByEventType,
			updateHook,
			toggleHookEnabled,
			deleteHook,
			createHook,
			isHookIdUnique,
			getAllHookIds,
			reloadHooks,
			openGlobalFolder,
			openProjectFolder,
			moveHook,
			reorderHooks,
		}),
		[
			hooks,
			isLoading,
			error,
			hooksEnabled,
			getHooksByEventType,
			updateHook,
			toggleHookEnabled,
			deleteHook,
			createHook,
			isHookIdUnique,
			getAllHookIds,
			reloadHooks,
			openGlobalFolder,
			openProjectFolder,
			moveHook,
			reorderHooks,
		],
	)
}
