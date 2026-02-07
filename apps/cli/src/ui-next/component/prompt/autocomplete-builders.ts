/**
 * Autocomplete item builder functions.
 *
 * Each function takes a search query and dependencies, then returns
 * a list of autocomplete items. They do not own any state — the caller
 * is responsible for setting the resulting items into signals.
 */

import fuzzysort from "fuzzysort"

import type { AutocompleteItem } from "../autocomplete/index.js"
import { formatRelativeTime, truncateText } from "../autocomplete/triggers.js"
import { getGlobalCommandsForAutocomplete } from "../../../lib/utils/commands.js"

import type { SlashCommandResult, ModeResult, TaskHistoryItem } from "../../types.js"

// ----------------------------------------------------------------
// Slash commands
// ----------------------------------------------------------------

/** Build autocomplete items for slash commands (global CLI + extension). */
export function buildSlashCommandItems(query: string, allSlashCommands: SlashCommandResult[]): AutocompleteItem[] {
	const globalCmds = getGlobalCommandsForAutocomplete().map((c) => ({
		key: c.name,
		label: `/${c.name}`,
		description: c.description,
		icon: c.action ? "⚙️" : "🌐",
	}))

	const extCmds = (allSlashCommands || []).map((c) => ({
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

	return all
}

// ----------------------------------------------------------------
// Modes
// ----------------------------------------------------------------

/** Build autocomplete items for mode switching. */
export function buildModeItems(query: string, availableModes: ModeResult[]): AutocompleteItem[] {
	let modes = (availableModes || []).map((m) => ({
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

	return modes
}

// ----------------------------------------------------------------
// History
// ----------------------------------------------------------------

/** Build autocomplete items for task history. */
export function buildHistoryItems(query: string, taskHistory: TaskHistoryItem[]): AutocompleteItem[] {
	let history = (taskHistory || [])
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

	return history
}

// ----------------------------------------------------------------
// File search
// ----------------------------------------------------------------

/**
 * Triggers a debounced file search.
 *
 * Returns a new timer handle. The caller must store and clear it on cleanup.
 */
export function triggerFileSearch(
	query: string,
	searchFiles: (q: string) => void,
	existingTimer: ReturnType<typeof setTimeout> | undefined,
): ReturnType<typeof setTimeout> {
	if (existingTimer) clearTimeout(existingTimer)
	return setTimeout(() => {
		searchFiles(query)
	}, 150)
}
