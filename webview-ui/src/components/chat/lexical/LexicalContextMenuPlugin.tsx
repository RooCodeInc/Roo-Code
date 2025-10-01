import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
	COMMAND_PRIORITY_HIGH,
	KEY_ARROW_DOWN_COMMAND,
	KEY_ARROW_UP_COMMAND,
	KEY_ENTER_COMMAND,
	KEY_ESCAPE_COMMAND,
	KEY_TAB_COMMAND,
} from "lexical"
import { useEffect } from "react"

import type { ModeConfig } from "@roo-code/types"
import type { Command } from "@roo/ExtensionMessage"

import { ContextMenuOptionType, getContextMenuOptions, type ContextMenuQueryItem } from "@/utils/context-mentions"

interface LexicalContextMenuPluginProps {
	showContextMenu: boolean
	searchQuery: string
	selectedMenuIndex: number
	setSelectedMenuIndex: React.Dispatch<React.SetStateAction<number>>
	selectedType: ContextMenuOptionType | null
	setSelectedType: (type: ContextMenuOptionType | null) => void
	queryItems: ContextMenuQueryItem[]
	fileSearchResults: any[]
	customModes?: ModeConfig[]
	commands?: Command[]
	onMentionSelect: (type: ContextMenuOptionType, value?: string) => void
}

export function LexicalContextMenuPlugin({
	showContextMenu,
	searchQuery,
	selectedMenuIndex,
	setSelectedMenuIndex,
	selectedType,
	setSelectedType,
	queryItems,
	fileSearchResults,
	customModes,
	commands,
	onMentionSelect,
}: LexicalContextMenuPluginProps): null {
	const [editor] = useLexicalComposerContext()

	useEffect(() => {
		if (!showContextMenu) {
			return
		}

		// Register Escape key command
		const removeEscapeListener = editor.registerCommand(
			KEY_ESCAPE_COMMAND,
			(event) => {
				event?.preventDefault()
				setSelectedType(null)
				setSelectedMenuIndex(3) // File by default
				return true
			},
			COMMAND_PRIORITY_HIGH,
		)

		// Register Arrow Up command
		const removeArrowUpListener = editor.registerCommand(
			KEY_ARROW_UP_COMMAND,
			(event) => {
				event?.preventDefault()
				setSelectedMenuIndex((prevIndex) => {
					const direction = -1
					const options = getContextMenuOptions(
						searchQuery,
						selectedType,
						queryItems,
						fileSearchResults,
						customModes,
						commands,
					)
					const optionsLength = options.length

					if (optionsLength === 0) return prevIndex

					// Find selectable options (non-URL types)
					const selectableOptions = options.filter(
						(option) =>
							option.type !== ContextMenuOptionType.URL &&
							option.type !== ContextMenuOptionType.NoResults &&
							option.type !== ContextMenuOptionType.SectionHeader,
					)

					if (selectableOptions.length === 0) return -1 // No selectable options

					// Find the index of the next selectable option
					const currentSelectableIndex = selectableOptions.findIndex(
						(option) => option === options[prevIndex],
					)

					const newSelectableIndex =
						(currentSelectableIndex + direction + selectableOptions.length) % selectableOptions.length

					// Find the index of the selected option in the original options array
					return options.findIndex((option) => option === selectableOptions[newSelectableIndex])
				})
				return true
			},
			COMMAND_PRIORITY_HIGH,
		)

		// Register Arrow Down command
		const removeArrowDownListener = editor.registerCommand(
			KEY_ARROW_DOWN_COMMAND,
			(event) => {
				event?.preventDefault()
				setSelectedMenuIndex((prevIndex) => {
					const direction = 1
					const options = getContextMenuOptions(
						searchQuery,
						selectedType,
						queryItems,
						fileSearchResults,
						customModes,
						commands,
					)
					const optionsLength = options.length

					if (optionsLength === 0) return prevIndex

					// Find selectable options (non-URL types)
					const selectableOptions = options.filter(
						(option) =>
							option.type !== ContextMenuOptionType.URL &&
							option.type !== ContextMenuOptionType.NoResults &&
							option.type !== ContextMenuOptionType.SectionHeader,
					)

					if (selectableOptions.length === 0) return -1 // No selectable options

					// Find the index of the next selectable option
					const currentSelectableIndex = selectableOptions.findIndex(
						(option) => option === options[prevIndex],
					)

					const newSelectableIndex =
						(currentSelectableIndex + direction + selectableOptions.length) % selectableOptions.length

					// Find the index of the selected option in the original options array
					return options.findIndex((option) => option === selectableOptions[newSelectableIndex])
				})
				return true
			},
			COMMAND_PRIORITY_HIGH,
		)

		// Register Enter and Tab commands
		const removeEnterListener = editor.registerCommand(
			KEY_ENTER_COMMAND,
			(event) => {
				if (selectedMenuIndex !== -1) {
					event?.preventDefault()
					event?.stopPropagation()
					const selectedOption = getContextMenuOptions(
						searchQuery,
						selectedType,
						queryItems,
						fileSearchResults,
						customModes,
						commands,
					)[selectedMenuIndex]
					if (
						selectedOption &&
						selectedOption.type !== ContextMenuOptionType.URL &&
						selectedOption.type !== ContextMenuOptionType.NoResults &&
						selectedOption.type !== ContextMenuOptionType.SectionHeader
					) {
						onMentionSelect(selectedOption.type, selectedOption.value)
					}
					return true
				}
				return false
			},
			COMMAND_PRIORITY_HIGH,
		)

		const removeTabListener = editor.registerCommand(
			KEY_TAB_COMMAND,
			(event) => {
				if (selectedMenuIndex !== -1) {
					event?.preventDefault()
					event?.stopPropagation()
					const selectedOption = getContextMenuOptions(
						searchQuery,
						selectedType,
						queryItems,
						fileSearchResults,
						customModes,
						commands,
					)[selectedMenuIndex]
					if (
						selectedOption &&
						selectedOption.type !== ContextMenuOptionType.URL &&
						selectedOption.type !== ContextMenuOptionType.NoResults &&
						selectedOption.type !== ContextMenuOptionType.SectionHeader
					) {
						onMentionSelect(selectedOption.type, selectedOption.value)
					}
					return true
				}
				return false
			},
			COMMAND_PRIORITY_HIGH,
		)

		return () => {
			removeEscapeListener()
			removeArrowUpListener()
			removeArrowDownListener()
			removeEnterListener()
			removeTabListener()
		}
	}, [
		editor,
		showContextMenu,
		searchQuery,
		selectedMenuIndex,
		selectedType,
		queryItems,
		fileSearchResults,
		customModes,
		commands,
		onMentionSelect,
		setSelectedMenuIndex,
		setSelectedType,
	])

	return null
}
