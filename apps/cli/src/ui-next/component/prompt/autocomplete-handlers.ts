/**
 * Autocomplete selection and dismissal handlers.
 *
 * Pure functions that execute the side-effects of selecting or dismissing
 * an autocomplete item: replacing text, switching modes, resuming tasks, etc.
 */

import { batch } from "solid-js"
import type { TextareaRenderable } from "@opentui/core"
import type { WebviewMessage } from "@roo-code/types"

import type { AutocompleteItem } from "../autocomplete/index.js"
import { getReplacementText, type TriggerDetection } from "../autocomplete/triggers.js"

/** Dependencies required by the autocomplete select handler. */
export interface AutocompleteSelectContext {
	textareaRef: TextareaRenderable | undefined
	currentText: () => string
	activeTrigger: () => TriggerDetection | null
	setActiveTrigger: (v: TriggerDetection | null) => void
	setShowHelp: (v: boolean) => void
	setAutocompleteItems: (v: AutocompleteItem[]) => void
	sendToExtension: (msg: WebviewMessage) => void
	toastInfo: (msg: string) => void
}

/** Handle the user selecting an item from the autocomplete overlay. */
export function handleAutocompleteSelect(item: AutocompleteItem, _index: number, ctx: AutocompleteSelectContext): void {
	const trigger = ctx.activeTrigger()
	if (!trigger || !ctx.textareaRef) return

	switch (trigger.type) {
		case "slash": {
			// Replace trigger text with selected command
			const cmdName = item.label.startsWith("/") ? item.label.substring(1) : item.label
			const replacement = getReplacementText("slash", cmdName, ctx.currentText(), trigger.triggerIndex)
			ctx.textareaRef.clear()
			if (replacement) ctx.textareaRef.insertText(replacement)
			break
		}
		case "file": {
			// Replace trigger text with file path
			const replacement = getReplacementText("file", item.label, ctx.currentText(), trigger.triggerIndex)
			ctx.textareaRef.clear()
			if (replacement) ctx.textareaRef.insertText(replacement)
			break
		}
		case "mode": {
			// Switch mode via extension
			const modeSlug = item.description || item.key
			ctx.sendToExtension({ type: "mode", text: modeSlug })
			ctx.toastInfo(`Switched to ${item.label}`)
			ctx.textareaRef.clear()
			break
		}
		case "history": {
			// Resume task from history
			const taskId = item.key
			ctx.sendToExtension({ type: "showTaskWithId", text: taskId })
			ctx.toastInfo("Resuming task...")
			ctx.textareaRef.clear()
			break
		}
		case "help": {
			// Help items insert their trigger char
			const shortcut = item.label.trim()
			ctx.textareaRef.clear()
			if (["Esc", "Tab", "Ctrl+M", "Ctrl+C", "Alt+Enter"].includes(shortcut)) {
				// Action shortcuts — just clear
			} else {
				// Trigger shortcuts — insert the trigger char
				ctx.textareaRef.insertText(shortcut)
			}
			break
		}
	}

	// Clear autocomplete state
	batch(() => {
		ctx.setActiveTrigger(null)
		ctx.setShowHelp(false)
		ctx.setAutocompleteItems([])
	})
}

/** Dependencies required by the autocomplete dismiss handler. */
export interface AutocompleteDismissContext {
	textareaRef: TextareaRenderable | undefined
	setActiveTrigger: (v: TriggerDetection | null) => void
	setShowHelp: (v: boolean) => void
	setAutocompleteItems: (v: AutocompleteItem[]) => void
}

/** Handle dismissing the autocomplete overlay. */
export function handleAutocompleteDismiss(ctx: AutocompleteDismissContext): void {
	batch(() => {
		ctx.setActiveTrigger(null)
		ctx.setShowHelp(false)
		ctx.setAutocompleteItems([])
	})
	// Clear trigger char from input
	if (ctx.textareaRef) {
		ctx.textareaRef.clear()
	}
}
