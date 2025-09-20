import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
	$getSelection,
	$isRangeSelection,
	$isTextNode,
	COMMAND_PRIORITY_LOW,
	KEY_ARROW_DOWN_COMMAND,
	KEY_ARROW_UP_COMMAND,
	KEY_ENTER_COMMAND,
	KEY_ESCAPE_COMMAND,
	KEY_TAB_COMMAND,
	TextNode,
} from "lexical"
import { useCallback, useEffect, useState } from "react"

import { $createMentionNode } from "./MentionNode"
import { shouldShowContextMenu } from "@/utils/context-mentions"

interface LexicalMentionPluginProps {
	onMentionTrigger?: (query: string, position: { x: number; y: number }) => void
	onMentionHide?: () => void
}

export function LexicalMentionPlugin({ onMentionTrigger, onMentionHide }: LexicalMentionPluginProps): null {
	const [editor] = useLexicalComposerContext()
	const [isShowingMentions, setIsShowingMentions] = useState(false)

	const checkForMentionTrigger = useCallback(() => {
		editor.getEditorState().read(() => {
			const selection = $getSelection()
			if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
				if (isShowingMentions) {
					setIsShowingMentions(false)
					onMentionHide?.()
				}
				return
			}

			const anchor = selection.anchor
			const anchorNode = anchor.getNode()

			if (!$isTextNode(anchorNode)) {
				if (isShowingMentions) {
					setIsShowingMentions(false)
					onMentionHide?.()
				}
				return
			}

			const anchorOffset = anchor.offset
			const textContent = anchorNode.getTextContent()
			const textUpToAnchor = textContent.slice(0, anchorOffset)

			// Check if we should show context menu using existing logic
			if (shouldShowContextMenu(textUpToAnchor, anchorOffset)) {
				// Get cursor position for context menu
				const domSelection = window.getSelection()
				if (domSelection && domSelection.rangeCount > 0) {
					const range = domSelection.getRangeAt(0)
					const rect = range.getBoundingClientRect()

					// Always trigger the mention callback to update search query
					onMentionTrigger?.(textUpToAnchor, { x: rect.left, y: rect.top })

					if (!isShowingMentions) {
						setIsShowingMentions(true)
					}
				}
			} else if (isShowingMentions) {
				setIsShowingMentions(false)
				onMentionHide?.()
			}
		})
	}, [editor, isShowingMentions, onMentionTrigger, onMentionHide])

	// Register update listener to check for mention triggers
	useEffect(() => {
		return editor.registerUpdateListener(({ editorState }) => {
			editorState.read(() => {
				checkForMentionTrigger()
			})
		})
	}, [editor, checkForMentionTrigger])

	// Handle mention insertion
	const insertMention = useCallback(
		(mentionText: string, trigger: string) => {
			editor.update(() => {
				const selection = $getSelection()
				if (!$isRangeSelection(selection)) return

				const anchor = selection.anchor
				const anchorNode = anchor.getNode()

				if (!$isTextNode(anchorNode)) return

				const anchorOffset = anchor.offset
				const textContent = anchorNode.getTextContent()

				// Find the trigger position
				let triggerOffset = -1
				if (trigger === "@") {
					triggerOffset = textContent.lastIndexOf("@", anchorOffset - 1)
				} else if (trigger === "/") {
					triggerOffset = textContent.lastIndexOf("/", anchorOffset - 1)
				}

				if (triggerOffset === -1) return

				// Split the text node and insert mention
				const beforeText = textContent.slice(0, triggerOffset)
				const afterText = textContent.slice(anchorOffset)

				// Create mention node
				const mentionNode = $createMentionNode(mentionText, trigger)

				if (beforeText) {
					anchorNode.setTextContent(beforeText)
					anchorNode.insertAfter(mentionNode)
				} else {
					anchorNode.replace(mentionNode)
				}

				if (afterText) {
					const afterTextNode = new TextNode(afterText)
					mentionNode.insertAfter(afterTextNode)
				}

				// Add space after mention and position cursor
				const spaceNode = new TextNode(" ")
				mentionNode.insertAfter(spaceNode)
				spaceNode.select()
			})

			setIsShowingMentions(false)
			onMentionHide?.()
		},
		[editor, onMentionHide],
	)

	// Expose the insertMention function
	useEffect(() => {
		// Store the function reference so it can be called from outside
		;(window as any).__lexicalInsertMention = insertMention

		return () => {
			delete (window as any).__lexicalInsertMention
		}
	}, [insertMention])

	useEffect(() => {
		const removeKeyDownListener = editor.registerCommand(KEY_ARROW_DOWN_COMMAND, () => false, COMMAND_PRIORITY_LOW)
		const removeKeyUpListener = editor.registerCommand(KEY_ARROW_UP_COMMAND, () => false, COMMAND_PRIORITY_LOW)

		const removeEnterListener = editor.registerCommand(
			KEY_ENTER_COMMAND,
			(event) => {
				if (isShowingMentions) {
					event?.preventDefault()
					return true
				}
				return false
			},
			COMMAND_PRIORITY_LOW,
		)

		const removeTabListener = editor.registerCommand(
			KEY_TAB_COMMAND,
			(event) => {
				if (isShowingMentions) {
					event?.preventDefault()
					return true
				}
				return false
			},
			COMMAND_PRIORITY_LOW,
		)

		const removeEscapeListener = editor.registerCommand(
			KEY_ESCAPE_COMMAND,
			() => {
				if (isShowingMentions) {
					setIsShowingMentions(false)
					onMentionHide?.()
					return true
				}
				return false
			},
			COMMAND_PRIORITY_LOW,
		)

		return () => {
			removeKeyDownListener()
			removeKeyUpListener()
			removeEnterListener()
			removeTabListener()
			removeEscapeListener()
		}
	}, [editor, isShowingMentions, onMentionHide])

	return null
}
