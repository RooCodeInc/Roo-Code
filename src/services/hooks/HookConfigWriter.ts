import YAML from "yaml"
import { HookUpdateData, HookEventType, HookDefinitionWithEvents } from "./types"
import fs from "fs/promises"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { safeWriteText } from "../../utils/safeWriteText"

function parseConfigContent(content: string, filePath: string): any {
	const isJson = filePath.toLowerCase().endsWith(".json")
	try {
		return isJson ? JSON.parse(content) : YAML.parse(content)
	} catch (e) {
		throw new Error(`Failed to parse config file ${filePath}: ${e}`)
	}
}

function ensureNewFormatHooksArray(parsed: any): HookDefinitionWithEvents[] {
	if (!parsed || typeof parsed !== "object") {
		throw new Error("Invalid config file format")
	}
	if (!parsed.hooks) {
		parsed.hooks = []
	}
	if (!Array.isArray(parsed.hooks)) {
		throw new Error(
			"This operation requires a hook-centric config file (hooks: [ ... ]). " +
				"Legacy event-keyed hook configs are supported for loading but are not writable by the UI.",
		)
	}
	return parsed.hooks as HookDefinitionWithEvents[]
}

function generateCopyHookId(existingIds: Set<string>, originalId: string): string {
	const base = `${originalId}-copy`
	if (!existingIds.has(base)) {
		return base
	}

	for (let i = 2; i < 10_000; i++) {
		const candidate = `${base}-${i}`
		if (!existingIds.has(candidate)) {
			return candidate
		}
	}

	throw new Error(`Unable to generate unique copied hook ID for '${originalId}'`)
}

/**
 * Update a hook configuration in a YAML/JSON file.
 *
 * @param filePath - Path to the config file
 * @param hookId - ID of the hook to update
 * @param updates - Updates to apply
 */
export async function updateHookConfig(filePath: string, hookId: string, updates: HookUpdateData): Promise<void> {
	const isJson = filePath.toLowerCase().endsWith(".json")
	const content = await fs.readFile(filePath, "utf-8")

	const parsed = parseConfigContent(content, filePath)
	const hooks = ensureNewFormatHooksArray(parsed)

	const hookIndex = hooks.findIndex((h) => h?.id === hookId)
	if (hookIndex === -1) {
		throw new Error(`Hook with ID '${hookId}' not found in ${filePath}`)
	}

	const hook = hooks[hookIndex]

	if (updates.id !== undefined) {
		const trimmed = updates.id.trim()
		if (trimmed.length === 0) {
			throw new Error("Hook ID cannot be empty")
		}
		if (trimmed.length > 100) {
			throw new Error("Hook ID must be 100 characters or less")
		}
		if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
			throw new Error("Hook ID must contain only letters, numbers, hyphens, and underscores")
		}
		const duplicate = hooks.some((h, idx) => idx !== hookIndex && h?.id === trimmed)
		if (duplicate) {
			throw new Error("Hook ID must be unique within this file")
		}
		hook.id = trimmed
	}

	if (updates.events) {
		if (updates.events.length === 0) {
			throw new Error("Hook must have at least one event")
		}
		hook.events = [...updates.events]
	}

	if (updates.matcher !== undefined) {
		if (updates.matcher === "") {
			delete (hook as any).matcher
		} else {
			hook.matcher = updates.matcher
		}
	}

	if (updates.command !== undefined) {
		const trimmed = updates.command.trim()
		if (trimmed.length === 0) {
			throw new Error("Command cannot be empty")
		}
		hook.command = updates.command
	}

	if (updates.timeout !== undefined) {
		hook.timeout = updates.timeout
	}

	if (updates.enabled !== undefined) {
		hook.enabled = updates.enabled
	}

	if (updates.description !== undefined) {
		if (updates.description === "") {
			delete (hook as any).description
		} else {
			hook.description = updates.description
		}
	}

	if (updates.shell !== undefined) {
		if (updates.shell === "") {
			delete (hook as any).shell
		} else {
			hook.shell = updates.shell
		}
	}

	if (updates.includeConversationHistory !== undefined) {
		hook.includeConversationHistory = updates.includeConversationHistory
	}

	// Write back (atomic)
	if (isJson) {
		await safeWriteJson(filePath, parsed)
	} else {
		await safeWriteText(filePath, YAML.stringify(parsed))
	}
}

/**
 * Duplicate a hook within the same config file.
 *
 * The copied hook will be inserted after the source hook in the array.
 * The new hook will receive a unique ID within the file:
 *  - `${id}-copy`
 *  - `${id}-copy-2`, `${id}-copy-3`, ...
 */
export async function copyHookConfig(filePath: string, hookId: string): Promise<string> {
	const isJson = filePath.toLowerCase().endsWith(".json")
	const content = await fs.readFile(filePath, "utf-8")

	const parsed = parseConfigContent(content, filePath)
	const hooks = ensureNewFormatHooksArray(parsed)

	const hookIndex = hooks.findIndex((h) => h?.id === hookId)
	if (hookIndex === -1) {
		throw new Error(`Hook with ID '${hookId}' not found in ${filePath}`)
	}

	const sourceHook = hooks[hookIndex]
	const existingIds = new Set(hooks.map((h) => h?.id).filter((id): id is string => typeof id === "string"))
	const newId = generateCopyHookId(existingIds, sourceHook.id)

	const copied: HookDefinitionWithEvents = {
		...sourceHook,
		id: newId,
		events: Array.isArray(sourceHook.events) ? [...sourceHook.events] : [],
	}

	// Insert right after the original hook for better UX.
	hooks.splice(hookIndex + 1, 0, copied)

	// Write back (atomic)
	if (isJson) {
		await safeWriteJson(filePath, parsed)
	} else {
		await safeWriteText(filePath, YAML.stringify(parsed))
	}

	return newId
}
