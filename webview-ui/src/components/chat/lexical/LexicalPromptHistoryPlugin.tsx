import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_HIGH,
	KEY_ARROW_DOWN_COMMAND,
	KEY_ARROW_UP_COMMAND,
	KEY_ENTER_COMMAND,
} from "lexical"
import { useCallback, useEffect, useRef, useState } from "react"
import { usePromptHistoryData } from "../hooks/usePromptHistoryData"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface LexicalPromptHistoryPluginProps {
	showContextMenu: boolean
	onSend: () => void
	sendingDisabled: boolean
}

export function LexicalPromptHistoryPlugin({
	showContextMenu,
	onSend,
	sendingDisabled,
}: LexicalPromptHistoryPluginProps): null {
	const [editor] = useLexicalComposerContext()
	const [historyIndex, setHistoryIndex] = useState(-1)
	const [tempInput, setTempInput] = useState("")
	const isNavigatingRef = useRef(false)

	const { clineMessages, taskHistory, cwd } = useExtensionState()
	const { promptHistory } = usePromptHistoryData({
		clineMessages,
		taskHistory,
		cwd,
	})

	const resetHistoryNavigation = useCallback(() => {
		setHistoryIndex(-1)
		setTempInput("")
	}, [])

	// Helper to update editor content and cursor position
	const updateEditorContent = useCallback(
		(text: string, cursorPos: "start" | "end") => {
			editor.update(() => {
				const root = $getRoot()
				root.clear()

				const paragraphNode = $createParagraphNode()
				const textNode = $createTextNode(text)
				paragraphNode.append(textNode)
				root.append(paragraphNode)

				// Set cursor position
				if (cursorPos === "start") {
					root.selectStart()
				} else {
					root.selectEnd()
				}
			})
		},
		[editor],
	)

	// Navigate to a specific history entry
	const navigateToHistory = useCallback(
		(newIndex: number, cursorPos: "start" | "end" = "start"): boolean => {
			if (newIndex < 0 || newIndex >= promptHistory.length) {
				return false
			}

			const historicalPrompt = promptHistory[newIndex]
			if (!historicalPrompt) {
				return false
			}

			isNavigatingRef.current = true
			setHistoryIndex(newIndex)
			updateEditorContent(historicalPrompt, cursorPos)

			requestAnimationFrame(() => {
				isNavigatingRef.current = false
			})

			return true
		},
		[promptHistory, updateEditorContent],
	)

	// Return to current input
	const returnToCurrentInput = useCallback(
		(cursorPos: "start" | "end" = "end") => {
			isNavigatingRef.current = true
			setHistoryIndex(-1)
			updateEditorContent(tempInput, cursorPos)
			// Reset flag after a short delay
			setTimeout(() => {
				isNavigatingRef.current = false
			}, 0)
		},
		[tempInput, updateEditorContent],
	)

	// Reset history navigation when prompt history changes (e.g., switching tasks)
	useEffect(() => {
		resetHistoryNavigation()
	}, [promptHistory, resetHistoryNavigation])

	// Reset history navigation when user types (but not when we're navigating or using arrow keys)
	useEffect(() => {
		const removeUpdateListener = editor.registerUpdateListener(({ mutatedNodes }) => {
			// Skip if we're currently navigating history
			if (isNavigatingRef.current) return

			// Reset history navigation when user types
			if (historyIndex !== -1 && mutatedNodes !== null) {
				resetHistoryNavigation()
			}
		})

		return removeUpdateListener
	}, [editor, historyIndex, tempInput, promptHistory, resetHistoryNavigation])

	useEffect(() => {
		// Register arrow up command for history navigation
		const removeArrowUpListener = editor.registerCommand(
			KEY_ARROW_UP_COMMAND,
			(event) => {
				if (showContextMenu || promptHistory.length === 0) {
					return false // Let context menu handle it or no history available
				}

				// Check if cursor is at the beginning of the first line
				const isAtBeginning = editor.getEditorState().read(() => {
					const selection = $getSelection()
					if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
						return false
					}

					// Check if cursor is at the very beginning (position 0)
					// This means we're on the first line, first character
					return selection.anchor.offset === 0
				})

				if (isAtBeginning) {
					event?.preventDefault()

					// Save current input if starting navigation
					if (historyIndex === -1) {
						const currentText = editor.getEditorState().read(() => {
							return $getRoot().getTextContent()
						})
						setTempInput(currentText)
					}

					return navigateToHistory(historyIndex + 1, "start")
				}

				return false
			},
			COMMAND_PRIORITY_HIGH,
		)

		// Register arrow down command for history navigation
		const removeArrowDownListener = editor.registerCommand(
			KEY_ARROW_DOWN_COMMAND,
			(event) => {
				if (showContextMenu) {
					return false
				}

				// Check if cursor is at the beginning of first line or end of last line
				const cursorPosition = editor.getEditorState().read(() => {
					const selection = $getSelection()
					if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
						return null
					}

					const anchor = selection.anchor
					const root = $getRoot()
					const text = root.getTextContent()

					const isAtBeginning = anchor.offset === 0
					const isAtEnd = anchor.offset === text.length

					return { isAtBeginning, isAtEnd }
				})

				// Handle history navigation if we're in that mode
				if (historyIndex >= 0) {
					if (cursorPosition?.isAtBeginning || cursorPosition?.isAtEnd) {
						event?.preventDefault()

						if (historyIndex > 0) {
							// Keep cursor position consistent with where we started
							return navigateToHistory(historyIndex - 1, cursorPosition.isAtBeginning ? "start" : "end")
						} else if (historyIndex === 0) {
							returnToCurrentInput(cursorPosition.isAtBeginning ? "start" : "end")
							return true
						}
					}
				}

				// If not in history navigation mode, let the default behavior handle it
				// This allows the down arrow to work normally when at the end of text
				return false
			},
			COMMAND_PRIORITY_HIGH,
		)

		// Register Enter key command for sending message
		const removeEnterListener = editor.registerCommand(
			KEY_ENTER_COMMAND,
			(event) => {
				if (showContextMenu || sendingDisabled) {
					return false
				}

				// Allow Shift+Enter to add a new line
				if (event?.shiftKey) {
					return false
				}

				event?.preventDefault()

				if (historyIndex !== -1) {
					resetHistoryNavigation()
				}

				onSend()

				return true
			},
			COMMAND_PRIORITY_HIGH,
		)

		return () => {
			removeArrowUpListener()
			removeArrowDownListener()
			removeEnterListener()
		}
	}, [
		editor,
		promptHistory,
		showContextMenu,
		historyIndex,
		navigateToHistory,
		returnToCurrentInput,
		resetHistoryNavigation,
		onSend,
		sendingDisabled,
	])

	return null
}
