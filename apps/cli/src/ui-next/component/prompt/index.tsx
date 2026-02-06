/**
 * Main prompt input component for the SolidJS TUI.
 *
 * Uses opentui's native <textarea> renderable for text input.
 * Handles trigger detection for autocomplete overlays (/, @, !, ?, #),
 * global keyboard shortcuts (Esc to cancel, Ctrl+C to exit),
 * and coordinates with the autocomplete overlay and help overlay.
 */

import { createSignal, createEffect, createMemo, on, onCleanup, Show, batch } from "solid-js"
import { type TextareaRenderable, type KeyBinding, type KeyEvent } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import fuzzysort from "fuzzysort"

import { useTheme } from "../../context/theme.js"
import { useExit } from "../../context/exit.js"
import { useToast } from "../../context/toast.js"
import { useExtension } from "../../context/extension.js"
import { AutocompleteOverlay, type AutocompleteItem } from "../autocomplete/index.js"
import { HelpOverlay } from "../help-overlay.js"
import {
	detectTrigger,
	formatRelativeTime,
	truncateText,
	getReplacementText,
	type TriggerType,
	type TriggerDetection,
} from "../autocomplete/triggers.js"
import { getGlobalCommandsForAutocomplete } from "../../../lib/utils/commands.js"

/** Default key bindings: Enter submits, Option+Enter for newline */
const PROMPT_KEYBINDINGS: KeyBinding[] = [
	{ name: "return", action: "submit" },
	{ name: "return", meta: true, action: "newline" },
]

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
	/** Enable trigger detection for autocomplete overlays */
	enableTriggers?: boolean
}

export function Prompt(props: PromptProps) {
	const { theme } = useTheme()
	const exit = useExit()
	const toast = useToast()
	const ext = useExtension()

	let textareaRef: TextareaRenderable | undefined

	// ================================================================
	// Autocomplete state
	// ================================================================
	const [currentText, setCurrentText] = createSignal("")
	const [activeTrigger, setActiveTrigger] = createSignal<TriggerDetection | null>(null)
	const [showHelp, setShowHelp] = createSignal(false)
	const [autocompleteItems, setAutocompleteItems] = createSignal<AutocompleteItem[]>([])

	// Ctrl+C double-press state
	const [pendingExit, setPendingExit] = createSignal(false)
	let exitTimer: ReturnType<typeof setTimeout> | undefined

	// File search debounce
	let fileSearchTimer: ReturnType<typeof setTimeout> | undefined

	onCleanup(() => {
		if (exitTimer) clearTimeout(exitTimer)
		if (fileSearchTimer) clearTimeout(fileSearchTimer)
	})

	// ================================================================
	// Trigger detection — runs whenever text changes
	// ================================================================
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
					updateSlashCommandItems(trigger.query)
					break
				case "file":
					setShowHelp(false)
					triggerFileSearch(trigger.query)
					break
				case "mode":
					setShowHelp(false)
					updateModeItems(trigger.query)
					break
				case "history":
					setShowHelp(false)
					updateHistoryItems(trigger.query)
					break
			}
		}),
	)

	// ================================================================
	// Update autocomplete items when extension state changes
	// ================================================================

	// Refresh file search results when they arrive from extension
	createEffect(
		on(
			() => ext.state.fileSearchResults,
			(results) => {
				const trigger = activeTrigger()
				if (trigger?.type === "file" && results.length > 0) {
					const items: AutocompleteItem[] = results.map((r) => ({
						key: r.key || r.path,
						label: r.path || r.label,
						icon: "📄",
					}))
					setAutocompleteItems(items)
				}
			},
		),
	)

	// ================================================================
	// Autocomplete item builders
	// ================================================================

	function updateSlashCommandItems(query: string) {
		// Merge global CLI commands with extension slash commands
		const globalCmds = getGlobalCommandsForAutocomplete().map((c) => ({
			key: c.name,
			label: `/${c.name}`,
			description: c.description,
			icon: c.action ? "⚙️" : "🌐",
		}))

		const extCmds = (ext.state.allSlashCommands || []).map((c) => ({
			key: c.key || c.label,
			label: `/${c.label}`,
			description: c.description,
			icon: "⚡",
		}))

		let all = [...globalCmds, ...extCmds]

		if (query.length > 0) {
			const results = fuzzysort.go(query, all, {
				key: "label",
				limit: 20,
				threshold: -10000,
			})
			all = results.map((r) => r.obj)
		} else {
			all = all.slice(0, 20)
		}

		setAutocompleteItems(all)
	}

	function updateModeItems(query: string) {
		let modes = (ext.state.availableModes || []).map((m) => ({
			key: m.key || m.slug,
			label: m.label,
			description: m.slug,
			icon: "🔧",
		}))

		if (query.length > 0) {
			const results = fuzzysort.go(query, modes, {
				key: "label",
				limit: 20,
				threshold: -10000,
			})
			modes = results.map((r) => r.obj)
		}

		setAutocompleteItems(modes)
	}

	function updateHistoryItems(query: string) {
		let history = (ext.state.taskHistory || [])
			.sort((a, b) => b.ts - a.ts)
			.map((h) => ({
				key: h.id,
				label: truncateText(h.task.replace(/\n/g, " "), 55),
				meta: formatRelativeTime(h.ts),
				icon: h.status === "completed" ? "✓" : h.status === "active" ? "●" : "○",
			}))

		if (query.length > 0) {
			const results = fuzzysort.go(query, history, {
				key: "label",
				limit: 15,
				threshold: -10000,
			})
			history = results.map((r) => r.obj)
		} else {
			history = history.slice(0, 15)
		}

		setAutocompleteItems(history)
	}

	function triggerFileSearch(query: string) {
		// Debounce file search API calls
		if (fileSearchTimer) clearTimeout(fileSearchTimer)
		fileSearchTimer = setTimeout(() => {
			ext.searchFiles(query)
		}, 150)
	}

	// ================================================================
	// Autocomplete selection handler
	// ================================================================

	function handleAutocompleteSelect(item: AutocompleteItem, _index: number) {
		const trigger = activeTrigger()
		if (!trigger || !textareaRef) return

		switch (trigger.type) {
			case "slash": {
				// Replace trigger text with selected command
				const cmdName = item.label.startsWith("/") ? item.label.substring(1) : item.label
				const replacement = getReplacementText("slash", cmdName, currentText(), trigger.triggerIndex)
				textareaRef.clear()
				if (replacement) textareaRef.insertText(replacement)
				break
			}
			case "file": {
				// Replace trigger text with file path
				const replacement = getReplacementText("file", item.label, currentText(), trigger.triggerIndex)
				textareaRef.clear()
				if (replacement) textareaRef.insertText(replacement)
				break
			}
			case "mode": {
				// Switch mode via extension
				const modeSlug = item.description || item.key
				ext.sendToExtension({ type: "mode", text: modeSlug })
				toast.info(`Switched to ${item.label}`)
				textareaRef.clear()
				break
			}
			case "history": {
				// Resume task from history
				const taskId = item.key
				ext.sendToExtension({ type: "showTaskWithId", text: taskId })
				toast.info("Resuming task...")
				textareaRef.clear()
				break
			}
			case "help": {
				// Help items insert their trigger char
				const shortcut = item.label.trim()
				textareaRef.clear()
				if (["Esc", "Tab", "Ctrl+M", "Ctrl+C", "Alt+Enter"].includes(shortcut)) {
					// Action shortcuts — just clear
				} else {
					// Trigger shortcuts — insert the trigger char
					textareaRef.insertText(shortcut)
				}
				break
			}
		}

		// Clear autocomplete state
		batch(() => {
			setActiveTrigger(null)
			setShowHelp(false)
			setAutocompleteItems([])
		})
	}

	function handleAutocompleteDismiss() {
		batch(() => {
			setActiveTrigger(null)
			setShowHelp(false)
			setAutocompleteItems([])
		})
		// Clear trigger char from input
		if (textareaRef) {
			textareaRef.clear()
		}
	}

	// ================================================================
	// Global keyboard handler
	// ================================================================

	useKeyboard((event: KeyEvent) => {
		if (!props.isActive) return

		// Only intercept when we're not in an autocomplete overlay
		const hasOverlay = activeTrigger() !== null || showHelp()

		// Esc — cancel task or dismiss overlay
		if (event.name === "escape") {
			if (hasOverlay) {
				handleAutocompleteDismiss()
				return
			}
			// Cancel current task when loading
			if (ext.state.isLoading) {
				ext.sendToExtension({ type: "cancelTask" })
				toast.info("Cancelling task...")
				return
			}
		}

		// Ctrl+C — double-press to exit
		if (event.name === "c" && event.ctrl) {
			if (hasOverlay) {
				handleAutocompleteDismiss()
				return
			}

			if (pendingExit()) {
				// Second press — exit
				if (exitTimer) clearTimeout(exitTimer)
				exit()
				return
			}

			// First press — show hint
			setPendingExit(true)
			toast.warning("Press Ctrl+C again to exit")
			exitTimer = setTimeout(() => {
				setPendingExit(false)
			}, 2000)
			return
		}

		// Ctrl+M — cycle through modes
		if (event.name === "m" && event.ctrl) {
			if (ext.state.isLoading) {
				toast.warning("Cannot switch modes while task is in progress")
				return
			}

			const modes = ext.state.availableModes || []
			if (modes.length < 2) return

			const currentSlug = ext.state.currentMode
			const currentIndex = modes.findIndex((m) => m.slug === currentSlug)
			const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % modes.length
			const nextMode = modes[nextIndex]

			if (nextMode) {
				ext.sendToExtension({ type: "mode", text: nextMode.slug })
				toast.info(`Switched to ${nextMode.label}`)
			}
			return
		}
	})

	// ================================================================
	// Submit handler
	// ================================================================

	function handleSubmit() {
		if (!textareaRef) return
		const text = textareaRef.plainText.trim()
		if (!text) return

		// If there's an active overlay, don't submit — let autocomplete handle Enter
		if (activeTrigger() || showHelp()) return

		props.onSubmit(text)
		textareaRef.clear()
		setCurrentText("")
	}

	// ================================================================
	// Content change handler — drives trigger detection
	// ================================================================

	function handleContentChange() {
		if (!textareaRef) return
		setCurrentText(textareaRef.plainText)
	}

	// ================================================================
	// Autocomplete title
	// ================================================================

	const autocompleteTitle = createMemo(() => {
		const trigger = activeTrigger()
		if (!trigger) return ""
		switch (trigger.type) {
			case "slash":
				return "Commands"
			case "file":
				return "Files"
			case "mode":
				return "Modes"
			case "history":
				return "Task History"
			case "help":
				return "Help"
			default:
				return ""
		}
	})

	const autocompleteEmpty = createMemo(() => {
		const trigger = activeTrigger()
		if (!trigger) return "No results"
		switch (trigger.type) {
			case "slash":
				return "No matching commands"
			case "file":
				return "No matching files"
			case "mode":
				return "No matching modes"
			case "history":
				return "No task history"
			case "help":
				return "No shortcuts"
			default:
				return "No results"
		}
	})

	const showAutocomplete = createMemo(() => {
		const trigger = activeTrigger()
		return trigger !== null && trigger.type !== "help"
	})

	// ================================================================
	// Render
	// ================================================================

	return (
		<box flexDirection="column" flexShrink={0}>
			{/* Help overlay */}
			<HelpOverlay visible={showHelp()} />

			{/* Autocomplete overlay */}
			<AutocompleteOverlay
				visible={showAutocomplete()}
				items={autocompleteItems()}
				title={autocompleteTitle()}
				emptyMessage={autocompleteEmpty()}
				onSelect={handleAutocompleteSelect}
				onDismiss={handleAutocompleteDismiss}
			/>

			{/* Prompt input row */}
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
