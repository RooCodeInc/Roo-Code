/**
 * Pure functions for computing autocomplete display state.
 *
 * Maps trigger types to UI strings (title, empty message)
 * and determines autocomplete overlay visibility.
 */

import type { TriggerDetection } from "../autocomplete/triggers.js"

/** Maps a trigger type to the autocomplete overlay title. */
export function getAutocompleteTitle(trigger: TriggerDetection | null): string {
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
}

/** Maps a trigger type to the empty-state text shown when no items match. */
export function getAutocompleteEmpty(trigger: TriggerDetection | null): string {
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
}

/** Determines whether the autocomplete overlay should be visible (excludes help trigger). */
export function shouldShowAutocomplete(trigger: TriggerDetection | null): boolean {
	return trigger !== null && trigger.type !== "help"
}
