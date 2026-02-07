/** Prompt input component — orchestrator wiring keybindings, autocomplete, and keyboard modules. */

import { createSignal, createEffect, createMemo, on, onCleanup } from "solid-js"
import { type TextareaRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"

import { useTheme } from "../../context/theme.js"
import { useExit } from "../../context/exit.js"
import { useToast } from "../../context/toast.js"
import { useExtension } from "../../context/extension.js"
import { AutocompleteOverlay, type AutocompleteItem } from "../autocomplete/index.js"
import { HelpOverlay } from "../help-overlay.js"
import { detectTrigger, type TriggerDetection } from "../autocomplete/triggers.js"
import { PROMPT_KEYBINDINGS } from "./keybindings.js"
import {
	buildSlashCommandItems,
	buildModeItems,
	buildHistoryItems,
	triggerFileSearch,
} from "./autocomplete-builders.js"
import { handleAutocompleteSelect, handleAutocompleteDismiss } from "./autocomplete-handlers.js"
import { getAutocompleteTitle, getAutocompleteEmpty, shouldShowAutocomplete } from "./autocomplete-memos.js"
import { createPromptKeyboardHandler } from "./keyboard-handler.js"

export interface PromptRef {
	getText: () => string
	clear: () => void
	focus: () => void
}

export interface PromptProps {
	placeholder?: string
	onSubmit: (text: string) => void
	isActive?: boolean
	prefix?: string
	ref?: (ref: PromptRef) => void
	enableTriggers?: boolean
}

export function Prompt(props: PromptProps) {
	const { theme } = useTheme()
	const exit = useExit()
	const toast = useToast()
	const ext = useExtension()
	let textareaRef: TextareaRenderable | undefined

	const [currentText, setCurrentText] = createSignal("")
	const [activeTrigger, setActiveTrigger] = createSignal<TriggerDetection | null>(null)
	const [showHelp, setShowHelp] = createSignal(false)
	const [autocompleteItems, setAutocompleteItems] = createSignal<AutocompleteItem[]>([])
	const [pendingExit, setPendingExit] = createSignal(false)
	const exitTimerRef: { current: ReturnType<typeof setTimeout> | undefined } = { current: undefined }
	let fileSearchTimer: ReturnType<typeof setTimeout> | undefined

	onCleanup(() => {
		if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
		if (fileSearchTimer) clearTimeout(fileSearchTimer)
	})

	// Trigger detection — runs whenever text changes
	createEffect(
		on(currentText, (text) => {
			if (!props.enableTriggers) return
			const trigger = detectTrigger(text)
			if (!trigger) {
				setActiveTrigger(null)
				setShowHelp(false)
				setAutocompleteItems([])
				return
			}
			setActiveTrigger(trigger)
			switch (trigger.type) {
				case "help":
					setShowHelp(true)
					setAutocompleteItems([])
					break
				case "slash":
					setShowHelp(false)
					setAutocompleteItems(buildSlashCommandItems(trigger.query, ext.state.allSlashCommands))
					break
				case "file":
					setShowHelp(false)
					fileSearchTimer = triggerFileSearch(trigger.query, ext.searchFiles.bind(ext), fileSearchTimer)
					break
				case "mode":
					setShowHelp(false)
					setAutocompleteItems(buildModeItems(trigger.query, ext.state.availableModes))
					break
				case "history":
					setShowHelp(false)
					setAutocompleteItems(buildHistoryItems(trigger.query, ext.state.taskHistory))
					break
			}
		}),
	)

	// Refresh file search results when they arrive from extension
	createEffect(
		on(
			() => ext.state.fileSearchResults,
			(results) => {
				const trigger = activeTrigger()
				if (trigger?.type === "file" && results.length > 0) {
					setAutocompleteItems(
						results.map((r) => ({ key: r.key || r.path, label: r.path || r.label, icon: "📄" })),
					)
				}
			},
		),
	)

	// Autocomplete handler contexts
	const selectCtx = {
		get textareaRef() {
			return textareaRef
		},
		currentText,
		activeTrigger,
		setActiveTrigger,
		setShowHelp,
		setAutocompleteItems,
		sendToExtension: ext.sendToExtension.bind(ext),
		toastInfo: toast.info,
	}
	const dismissCtx = {
		get textareaRef() {
			return textareaRef
		},
		setActiveTrigger,
		setShowHelp,
		setAutocompleteItems,
	}
	const onSelect = (item: AutocompleteItem, index: number) => handleAutocompleteSelect(item, index, selectCtx)
	const onDismiss = () => handleAutocompleteDismiss(dismissCtx)

	// Keyboard handler
	useKeyboard(
		createPromptKeyboardHandler({
			isActive: () => props.isActive ?? false,
			hasOverlay: () => activeTrigger() !== null || showHelp(),
			dismissOverlay: onDismiss,
			isLoading: () => ext.state.isLoading,
			availableModes: () => ext.state.availableModes || [],
			currentMode: () => ext.state.currentMode,
			sendToExtension: ext.sendToExtension.bind(ext),
			toastInfo: toast.info,
			toastWarning: toast.warning,
			exit,
			pendingExit,
			setPendingExit,
			exitTimer: exitTimerRef,
		}),
	)

	function handleSubmit() {
		if (!textareaRef) return
		const text = textareaRef.plainText.trim()
		if (!text) return
		if (activeTrigger() || showHelp()) return
		props.onSubmit(text)
		textareaRef.clear()
		setCurrentText("")
	}

	function handleContentChange() {
		if (!textareaRef) return
		setCurrentText(textareaRef.plainText)
	}

	const autocompleteTitle = createMemo(() => getAutocompleteTitle(activeTrigger()))
	const autocompleteEmpty = createMemo(() => getAutocompleteEmpty(activeTrigger()))
	const showAutocomplete = createMemo(() => shouldShowAutocomplete(activeTrigger()))

	return (
		<box flexDirection="column" flexShrink={0}>
			<HelpOverlay visible={showHelp()} />
			<AutocompleteOverlay
				visible={showAutocomplete()}
				items={autocompleteItems()}
				title={autocompleteTitle()}
				emptyMessage={autocompleteEmpty()}
				onSelect={onSelect}
				onDismiss={onDismiss}
			/>
			<box flexDirection="row" flexShrink={0}>
				<text fg={props.isActive ? theme.promptColorActive : theme.promptColor} flexShrink={0}>
					{props.prefix ?? "› "}
				</text>
				<textarea
					ref={(r: TextareaRenderable) => {
						textareaRef = r
						if (props.ref) {
							props.ref({
								getText: () => r.plainText,
								clear: () => r.clear(),
								focus: () => r.focus(),
							})
						}
					}}
					placeholder={props.placeholder ?? ""}
					textColor={theme.text}
					focusedTextColor={theme.text}
					placeholderColor={theme.placeholderColor}
					minHeight={1}
					maxHeight={4}
					flexGrow={1}
					keyBindings={PROMPT_KEYBINDINGS}
					onSubmit={handleSubmit}
					onContentChange={handleContentChange}
					focused={props.isActive ?? true}
				/>
			</box>
		</box>
	)
}
