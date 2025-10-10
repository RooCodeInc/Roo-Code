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
	$getRoot,
} from "lexical"
import { useCallback, useEffect, useState, useImperativeHandle, forwardRef } from "react"
import { getIconForFilePath, getIconUrlByName } from "vscode-material-icons"

import { $createMentionNode, $isMentionNode } from "./MentionNode"
import { shouldShowContextMenu, ContextMenuOptionType } from "@/utils/context-mentions"
import { getDisplayNameForPath } from "@/utils/path-mentions"

export interface MentionInfo {
	path: string
	displayName: string
	icon: string
	type: "file" | "folder" | "url" | "problems" | "terminal" | "git"
	nodeKey: string // Unique identifier for the mention node
}

export interface LexicalMentionPluginRef {
	insertMention: (mentionText: string, trigger: string, type?: ContextMenuOptionType) => void
	removeMention: (mentionInfo: MentionInfo) => void
}

interface LexicalMentionPluginProps {
	onMentionTrigger?: (query: string, position: { x: number; y: number }) => void
	onMentionHide?: () => void
	onMentionUpdate?: (mentions: MentionInfo[]) => void
	materialIconsBaseUri?: string
}

export const LexicalMentionPlugin = forwardRef<LexicalMentionPluginRef, LexicalMentionPluginProps>(
	({ onMentionTrigger, onMentionHide, onMentionUpdate, materialIconsBaseUri = "" }, ref) => {
		const [editor] = useLexicalComposerContext()
		const [isShowingMentions, setIsShowingMentions] = useState(false)

		// Helper function to get material icon for mention
		const getMaterialIconForMention = useCallback(
			(mention: string, type?: "file" | "folder") => {
				// Use the provided type if available, otherwise fall back to path-based detection
				if (type === "folder" || (!type && mention.endsWith("/"))) {
					return getIconUrlByName("folder", materialIconsBaseUri)
				}

				const name = mention.split("/").filter(Boolean).at(-1) ?? ""
				const iconName = getIconForFilePath(name)
				return getIconUrlByName(iconName, materialIconsBaseUri)
			},
			[materialIconsBaseUri],
		)

		// Helper function to determine if path is a folder
		const isFolder = useCallback((mention: string) => {
			return mention.endsWith("/")
		}, [])

		const extractMentionsFromEditor = useCallback(() => {
			const mentionNodes: Array<{ path: string; data?: Record<string, any>; nodeKey: string }> = []

			editor.getEditorState().read(() => {
				const root = $getRoot()

				const traverse = (node: any, visited = new Set()) => {
					// Prevent infinite recursion by tracking visited nodes
					if (!node || visited.has(node)) {
						return
					}
					visited.add(node)

					if ($isMentionNode(node) && node.getTrigger() === "@") {
						mentionNodes.push({
							path: node.getValue(),
							data: node.getData(),
							nodeKey: node.getKey(),
						})
					}

					// Safely get children with error handling
					try {
						const children = node.getChildren?.() || []
						for (const child of children) {
							if (child && typeof child === "object") {
								traverse(child, visited)
							}
						}
					} catch (error) {
						console.warn("Error traversing node children:", error)
					}
				}

				traverse(root)
			})

			// Extract just the paths for display name calculation
			const mentionPaths = mentionNodes.map((node) => node.path)

			// SVG data URL for link icon
			const linkIconSvg = `data:image/svg+xml,${encodeURIComponent(
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z"/></svg>',
			)}`

			// Convert to MentionInfo objects with all necessary display information
			const mentions: MentionInfo[] = mentionNodes.map((node) => {
				// Use stored type data if available, otherwise fall back to path-based detection
				const storedType = node.data?.type
				let type: "file" | "folder" | "url" | "problems" | "terminal" | "git"
				let displayName: string
				let icon: string

				// Determine type and display info based on stored data or path
				if (storedType === ContextMenuOptionType.URL) {
					type = "url"
					displayName = node.path
					icon = linkIconSvg
				} else if (storedType === ContextMenuOptionType.Problems) {
					type = "problems"
					displayName = "Problems"
					icon = linkIconSvg // You can change this to a different icon if needed
				} else if (storedType === ContextMenuOptionType.Terminal) {
					type = "terminal"
					displayName = "Terminal"
					icon = linkIconSvg // You can change this to a different icon if needed
				} else if (storedType === ContextMenuOptionType.Git) {
					type = "git"
					displayName = node.path
					icon = linkIconSvg // You can change this to a different icon if needed
				} else if (storedType === ContextMenuOptionType.File) {
					type = "file"
					displayName = getDisplayNameForPath(node.path, mentionPaths)
					icon = getMaterialIconForMention(node.path, "file")
				} else if (storedType === ContextMenuOptionType.Folder) {
					type = "folder"
					displayName = getDisplayNameForPath(node.path, mentionPaths)
					icon = getMaterialIconForMention(node.path, "folder")
				} else {
					// Fall back to path-based detection for backward compatibility
					type = isFolder(node.path) ? "folder" : "file"
					displayName = getDisplayNameForPath(node.path, mentionPaths)
					icon = getMaterialIconForMention(node.path, type)
				}

				return {
					path: node.path,
					displayName,
					icon,
					type,
					nodeKey: node.nodeKey,
				}
			})

			return mentions
		}, [editor, getMaterialIconForMention, isFolder])

		const updateMentions = useCallback(() => {
			const currentMentions = extractMentionsFromEditor()
			onMentionUpdate?.(currentMentions)
		}, [extractMentionsFromEditor, onMentionUpdate])

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

		useEffect(() => {
			return editor.registerUpdateListener(({ editorState }) => {
				editorState.read(() => {
					checkForMentionTrigger()
					updateMentions()
				})
			})
		}, [editor, checkForMentionTrigger, updateMentions])

		const insertMention = useCallback(
			(mentionText: string, trigger: string, type?: ContextMenuOptionType) => {
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

					// Create mention node with type information
					const data = type ? { type } : undefined
					const mentionNode = $createMentionNode(trigger, mentionText, null, undefined, data)

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

		const removeMention = useCallback(
			(mentionInfo: MentionInfo) => {
				editor.update(() => {
					const root = $getRoot()

					const traverse = (node: any, visited = new Set()) => {
						// Prevent infinite recursion by tracking visited nodes
						if (!node || visited.has(node)) {
							return false
						}
						visited.add(node)

						if ($isMentionNode(node) && node.getTrigger() === "@") {
							// Check if this is the mention we want to remove using the unique node key
							if (node.getKey() === mentionInfo.nodeKey) {
								// Remove the mention node and any trailing space
								const nextSibling = node.getNextSibling()
								if ($isTextNode(nextSibling) && nextSibling.getTextContent().startsWith(" ")) {
									// Remove the space after the mention
									const remainingText = nextSibling.getTextContent().slice(1)
									if (remainingText) {
										nextSibling.setTextContent(remainingText)
									} else {
										nextSibling.remove()
									}
								}
								node.remove()
								return true // Found and removed
							}
						}

						// Safely get children with error handling
						try {
							const children = node.getChildren?.() || []
							for (const child of children) {
								if (child && typeof child === "object") {
									if (traverse(child, visited)) {
										return true // Found and removed in child
									}
								}
							}
						} catch (error) {
							console.warn("Error traversing node children:", error)
						}

						return false
					}

					traverse(root)
				})
			},
			[editor],
		)

		useImperativeHandle(ref, () => ({ insertMention, removeMention }), [insertMention, removeMention])

		useEffect(() => {
			const removeKeyDownListener = editor.registerCommand(
				KEY_ARROW_DOWN_COMMAND,
				() => false,
				COMMAND_PRIORITY_LOW,
			)
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
	},
)

LexicalMentionPlugin.displayName = "LexicalMentionPlugin"
