import { useEffect, useCallback, useMemo, useRef } from "react"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import { AutoApproveSetting } from "../settings/AutoApproveToggle"
import { useAutoApprovalToggles } from "@src/hooks/useAutoApprovalToggles"
import { KEYBOARD_SHORTCUTS, DEFAULT_KEYBOARD_CONFIG } from "@src/constants/autoApproveConstants"

export const AutoApproveKeyboardShortcuts = () => {
	const {
		setAlwaysAllowReadOnly,
		setAlwaysAllowWrite,
		setAlwaysAllowExecute,
		setAlwaysAllowBrowser,
		setAlwaysAllowMcp,
		setAlwaysAllowModeSwitch,
		setAlwaysAllowSubtasks,
		setAlwaysApproveResubmit,
		setAlwaysAllowFollowupQuestions,
		setAlwaysAllowUpdateTodoList,
		alwaysApproveResubmit,
	} = useExtensionState()

	const baseToggles = useAutoApprovalToggles()
	const toggles = useMemo(
		() => ({
			...baseToggles,
			alwaysApproveResubmit,
		}),
		[baseToggles, alwaysApproveResubmit],
	)

	const handleToggle = useCallback(
		(key: AutoApproveSetting) => {
			const currentValue = toggles[key]
			const newValue = !currentValue

			// Send message to extension
			vscode.postMessage({ type: key, bool: newValue })

			// Update local state
			switch (key) {
				case "alwaysAllowReadOnly":
					setAlwaysAllowReadOnly(newValue)
					break
				case "alwaysAllowWrite":
					setAlwaysAllowWrite(newValue)
					break
				case "alwaysAllowExecute":
					setAlwaysAllowExecute(newValue)
					break
				case "alwaysAllowBrowser":
					setAlwaysAllowBrowser(newValue)
					break
				case "alwaysAllowMcp":
					setAlwaysAllowMcp(newValue)
					break
				case "alwaysAllowModeSwitch":
					setAlwaysAllowModeSwitch(newValue)
					break
				case "alwaysAllowSubtasks":
					setAlwaysAllowSubtasks(newValue)
					break
				case "alwaysApproveResubmit":
					setAlwaysApproveResubmit(newValue)
					break
				case "alwaysAllowFollowupQuestions":
					setAlwaysAllowFollowupQuestions(newValue)
					break
				case "alwaysAllowUpdateTodoList":
					setAlwaysAllowUpdateTodoList(newValue)
					break
			}
		},
		[
			toggles,
			setAlwaysAllowReadOnly,
			setAlwaysAllowWrite,
			setAlwaysAllowExecute,
			setAlwaysAllowBrowser,
			setAlwaysAllowMcp,
			setAlwaysAllowModeSwitch,
			setAlwaysAllowSubtasks,
			setAlwaysApproveResubmit,
			setAlwaysAllowFollowupQuestions,
			setAlwaysAllowUpdateTodoList,
		],
	)

	// Store the handleToggle function in a ref to avoid re-registrations
	const handleToggleRef = useRef(handleToggle)
	useEffect(() => {
		handleToggleRef.current = handleToggle
	}, [handleToggle])

	// Stable event handler that uses the ref
	const handleKeyDown = useCallback((event: KeyboardEvent) => {
		// Check if keyboard shortcuts are enabled
		if (!DEFAULT_KEYBOARD_CONFIG.enabled) {
			return
		}

		// Support both Alt key and Ctrl+Shift key combinations based on configuration
		const isValidModifier = DEFAULT_KEYBOARD_CONFIG.useCtrlShiftKey
			? event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey
			: event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey

		if (isValidModifier) {
			const shortcut = KEYBOARD_SHORTCUTS[event.key]
			if (shortcut) {
				event.preventDefault()
				handleToggleRef.current(shortcut)
			}
		}
	}, [])

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
		}
	}, [handleKeyDown])

	return null // This component doesn't render anything
}
