import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
	$getSelection,
	$isRangeSelection,
	$createTextNode,
	COMMAND_PRIORITY_HIGH,
	PASTE_COMMAND,
	TextNode,
} from "lexical"
import { useEffect } from "react"
import { $createMentionNode } from "./MentionNode"
import { mentionRegexGlobal, commandRegexGlobal } from "@roo/context-mentions"
import { ContextMenuOptionType } from "@/utils/context-mentions"
import { MAX_IMAGES_PER_MESSAGE } from "../ChatView"

interface LexicalPastePluginProps {
	materialIconsBaseUri?: string
	shouldDisableImages: boolean
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
}

export const LexicalPastePlugin = ({
	materialIconsBaseUri = "",
	shouldDisableImages,
	setSelectedImages,
}: LexicalPastePluginProps) => {
	const [editor] = useLexicalComposerContext()

	useEffect(() => {
		return editor.registerCommand(
			PASTE_COMMAND,
			(event: ClipboardEvent) => {
				const selection = $getSelection()

				if (!$isRangeSelection(selection)) {
					return false
				}

				const clipboardData = event.clipboardData
				if (!clipboardData) {
					return false
				}

				const text = clipboardData.getData("text/plain")
				const items = clipboardData.items

				// Handle image pasting
				const acceptedTypes = ["png", "jpeg", "webp"]
				const imageItems = Array.from(items).filter((item) => {
					const [type, subtype] = item.type.split("/")
					return type === "image" && acceptedTypes.includes(subtype)
				})

				if (!shouldDisableImages && imageItems.length > 0) {
					event.preventDefault()

					// Handle image paste asynchronously
					handleImagePaste(imageItems, setSelectedImages)
					return true
				}

				// Handle URL pasting - let Lexical handle it normally
				const urlRegex = /^\S+:\/\/\S+$/
				if (text && urlRegex.test(text.trim())) {
					// Let Lexical's default paste handle URLs
					return false
				}

				if (!text) {
					return false
				}

				// Check if the text contains any mentions or commands
				const hasMentions = mentionRegexGlobal.test(text)
				const hasCommands = commandRegexGlobal.test(text)

				// Reset regex lastIndex
				mentionRegexGlobal.lastIndex = 0
				commandRegexGlobal.lastIndex = 0

				if (!hasMentions && !hasCommands) {
					// Let Lexical handle normal paste
					return false
				}

				// Prevent default paste behavior
				event.preventDefault()

				// Parse the text and create nodes
				editor.update(() => {
					const nodes = parseTextIntoNodes(text)

					// Get selection again in update
					const currentSelection = $getSelection()
					if (!$isRangeSelection(currentSelection)) {
						return
					}

					// Insert the parsed nodes
					for (const node of nodes) {
						currentSelection.insertNodes([node])
					}
				})

				return true
			},
			COMMAND_PRIORITY_HIGH,
		)
	}, [editor, materialIconsBaseUri, shouldDisableImages, setSelectedImages])

	return null
}

/**
 * Parse text and convert mentions/commands into appropriate nodes
 */
function parseTextIntoNodes(text: string): Array<TextNode> {
	const nodes: Array<TextNode> = []
	let lastIndex = 0

	// Collect all mentions and commands with their positions
	const items: Array<{ index: number; match: string; type: "mention" | "command"; mentionText: string }> = []

	// Find all mentions
	let mentionMatch: RegExpExecArray | null
	while ((mentionMatch = mentionRegexGlobal.exec(text)) !== null) {
		items.push({
			index: mentionMatch.index,
			match: mentionMatch[0],
			type: "mention",
			mentionText: mentionMatch[1], // The captured group without @
		})
	}

	// Find all commands
	let commandMatch: RegExpExecArray | null
	while ((commandMatch = commandRegexGlobal.exec(text)) !== null) {
		items.push({
			index: commandMatch.index,
			match: commandMatch[0].trim(), // Remove leading space
			type: "command",
			mentionText: commandMatch[1], // The captured group without /
		})
	}

	// Sort by index
	items.sort((a, b) => a.index - b.index)

	// Create nodes
	for (const item of items) {
		// Add text before this mention/command
		if (item.index > lastIndex) {
			const textBefore = text.slice(lastIndex, item.index)
			if (textBefore) {
				// For commands with leading space, include that space
				if (item.type === "command" && textBefore.endsWith(" ")) {
					nodes.push($createTextNode(textBefore))
				} else {
					nodes.push($createTextNode(textBefore))
				}
			}
		}

		// Determine the type for the mention node
		let contextType: ContextMenuOptionType | undefined

		if (item.type === "mention") {
			const mentionText = item.mentionText
			if (mentionText === "problems") {
				contextType = ContextMenuOptionType.Problems
			} else if (mentionText === "terminal") {
				contextType = ContextMenuOptionType.Terminal
			} else if (mentionText === "git-changes") {
				contextType = ContextMenuOptionType.Git
			} else if (mentionText.startsWith("http://") || mentionText.startsWith("https://")) {
				contextType = ContextMenuOptionType.URL
			} else if (mentionText.startsWith("/")) {
				// File or folder path
				contextType = mentionText.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File
			} else if (/^[a-f0-9]{7,40}$/i.test(mentionText)) {
				// Git commit hash
				contextType = ContextMenuOptionType.Git
			}

			const data = contextType ? { type: contextType } : undefined
			nodes.push($createMentionNode(item.mentionText, "@", undefined, data))
		} else if (item.type === "command") {
			nodes.push($createMentionNode(item.mentionText, "/", undefined, { type: ContextMenuOptionType.Command }))
		}

		lastIndex = item.index + item.match.length
	}

	// Add remaining text
	if (lastIndex < text.length) {
		const remainingText = text.slice(lastIndex)
		if (remainingText) {
			nodes.push($createTextNode(remainingText))
		}
	}

	return nodes
}

/**
 * Handle pasting images from clipboard
 */
async function handleImagePaste(
	imageItems: DataTransferItem[],
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>,
) {
	const imagePromises = imageItems.map((item) => {
		return new Promise<string | null>((resolve) => {
			const blob = item.getAsFile()

			if (!blob) {
				resolve(null)
				return
			}

			const reader = new FileReader()

			reader.onloadend = () => {
				if (reader.error) {
					console.error("Error reading file:", reader.error)
					resolve(null)
				} else {
					const result = reader.result
					resolve(typeof result === "string" ? result : null)
				}
			}

			reader.readAsDataURL(blob)
		})
	})

	const imageDataArray = await Promise.all(imagePromises)
	const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)

	if (dataUrls.length > 0) {
		setSelectedImages((prevImages) => [...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
	} else {
		console.warn("No valid images found in clipboard")
	}
}
