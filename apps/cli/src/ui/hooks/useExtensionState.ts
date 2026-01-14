/**
 * useExtensionState - Handle non-message extension state updates
 *
 * This hook handles extension state that is NOT part of ClineMessage processing:
 * - Mode changes (current mode, available modes)
 * - File search results
 * - Slash commands list
 * - Task history
 * - Router models
 *
 * ClineMessage processing is handled by useClientEvents, which subscribes to
 * ExtensionClient events (the unified approach for both TUI and non-TUI modes).
 */

import { useCallback } from "react"
import type { ExtensionMessage } from "@roo-code/types"

import type { FileResult, SlashCommandResult, ModeResult } from "../components/autocomplete/index.js"
import { useCLIStore } from "../store.js"

export interface UseExtensionStateReturn {
	handleExtensionState: (msg: ExtensionMessage) => void
}

/**
 * Hook to handle non-message extension state updates.
 * This is used alongside useClientEvents which handles ClineMessage events.
 */
export function useExtensionState(): UseExtensionStateReturn {
	const {
		setFileSearchResults,
		setAllSlashCommands,
		setAvailableModes,
		setCurrentMode,
		setTaskHistory,
		setRouterModels,
	} = useCLIStore()

	/**
	 * Handle extension messages that contain state updates.
	 * Only processes non-ClineMessage state.
	 */
	const handleExtensionState = useCallback(
		(msg: ExtensionMessage) => {
			if (msg.type === "state") {
				const state = msg.state

				if (!state) {
					return
				}

				// Extract and update current mode from state
				const newMode = state.mode

				if (newMode) {
					setCurrentMode(newMode)
				}

				// Extract and update task history from state
				const newTaskHistory = state.taskHistory

				if (newTaskHistory && Array.isArray(newTaskHistory)) {
					setTaskHistory(newTaskHistory)
				}

				// Note: ClineMessages are handled by useClientEvents via ExtensionClient events
			} else if (msg.type === "fileSearchResults") {
				setFileSearchResults((msg.results as FileResult[]) || [])
			} else if (msg.type === "commands") {
				setAllSlashCommands((msg.commands as SlashCommandResult[]) || [])
			} else if (msg.type === "modes") {
				setAvailableModes((msg.modes as ModeResult[]) || [])
			} else if (msg.type === "routerModels") {
				if (msg.routerModels) {
					setRouterModels(msg.routerModels)
				}
			}
		},
		[setFileSearchResults, setAllSlashCommands, setAvailableModes, setCurrentMode, setTaskHistory, setRouterModels],
	)

	return { handleExtensionState }
}
