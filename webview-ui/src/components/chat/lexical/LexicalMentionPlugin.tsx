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
import { removeLeadingNonAlphanumeric } from "@/utils/removeLeadingNonAlphanumeric"

export interface MentionInfo {
	path: string
	displayName: string
	icon: string
	type: "file" | "folder"
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

		// Helper function to get display name with conflict resolution
		const getDisplayName = useCallback((mention: string, allMentions: string[]) => {
			// Remove leading non-alphanumeric and trailing slash
			const path = removeLeadingNonAlphanumeric(mention).replace(/\/$/, "")
			const pathList = path.split("/")
			const filename = pathList.at(-1) || mention

			// Check if there are other mentions with the same filename
			const sameFilenames = allMentions.filter((m) => {
				const otherPath = removeLeadingNonAlphanumeric(m).replace(/\/$/, "")
				const otherFilename = otherPath.split("/").at(-1) || m
				return otherFilename === filename && m !== mention
			})

			if (sameFilenames.length === 0) {
				return filename // No conflicts, just show filename
			}

			// There are conflicts, need to show directory to disambiguate
			if (pathList.length > 1) {
				// Show filename with first directory
				return `${pathList[pathList.length - 2]}/${filename}`
			}

			return filename
		}, [])

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
			const mentionNodes: Array<{ path: string; data?: Record<string, any> }> = []

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
							path: node.getMentionName(),
							data: node.getData(),
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

			// Convert to MentionInfo objects with all necessary display information
			const mentions: MentionInfo[] = mentionNodes.map((node) => {
				// Use stored type data if available, otherwise fall back to path-based detection
				const storedType = node.data?.type
				let type: "file" | "folder"

				if (storedType === "file" || storedType === "folder") {
					type = storedType
				} else {
					// Fall back to path-based detection for backward compatibility
					type = isFolder(node.path) ? "folder" : "file"
				}

				return {
					path: node.path,
					displayName: getDisplayName(node.path, mentionPaths),
					icon: getMaterialIconForMention(node.path, type),
					type,
				}
			})

			return mentions
		}, [editor, getDisplayName, getMaterialIconForMention, isFolder])

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
					const mentionNode = $createMentionNode(mentionText, trigger, undefined, data)

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
							// Check if this is the mention we want to remove
							if (node.getMentionName() === mentionInfo.path) {
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
