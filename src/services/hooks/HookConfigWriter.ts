import YAML from "yaml"
import { HookUpdateData, HookEventType, HookDefinition } from "./types"
import fs from "fs/promises"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { safeWriteText } from "../../utils/safeWriteText"

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

	let parsed: any
	try {
		if (isJson) {
			parsed = JSON.parse(content)
		} else {
			parsed = YAML.parse(content)
		}
	} catch (e) {
		throw new Error(`Failed to parse config file ${filePath}: ${e}`)
	}

	if (!parsed || typeof parsed !== "object") {
		throw new Error(`Invalid config file format: ${filePath}`)
	}

	if (!parsed.hooks) {
		parsed.hooks = {}
	}

	// Find the hook definition first to ensure it exists and get a template
	let templateHook: HookDefinition | undefined

	// Iterate all events to find the hook
	for (const eventKey of Object.keys(parsed.hooks)) {
		const hooks = parsed.hooks[eventKey]
		if (Array.isArray(hooks)) {
			const found = hooks.find((h: any) => h.id === hookId)
			if (found) {
				templateHook = { ...found }
				break
			}
		}
	}

	if (!templateHook) {
		throw new Error(`Hook with ID '${hookId}' not found in ${filePath}`)
	}

	// Apply simple property updates to the template first, so they carry over to new events
	if (updates.matcher !== undefined) {
		if (updates.matcher === "") {
			delete templateHook.matcher
		} else {
			templateHook.matcher = updates.matcher
		}
	}
	if (updates.timeout !== undefined) {
		templateHook.timeout = updates.timeout
	}

	// Handle Event Updates
	if (updates.events) {
		if (updates.events.length === 0) {
			throw new Error("Hook must have at least one event")
		}
		const newEventsSet = new Set(updates.events)

		// 1. Remove hook from events that are NOT in the new set
		for (const eventKey of Object.keys(parsed.hooks)) {
			const event = eventKey as HookEventType
			if (!newEventsSet.has(event)) {
				const hooks = parsed.hooks[event]
				if (Array.isArray(hooks)) {
					parsed.hooks[event] = hooks.filter((h: any) => h?.id !== hookId)
				}
			}
		}

		// 2. Add hook to events that are in the new set
		for (const event of updates.events) {
			if (!parsed.hooks[event]) {
				parsed.hooks[event] = []
			}
			const hooks = parsed.hooks[event]
			// Check if already exists
			const existing = hooks.find((h: any) => h.id === hookId)
			if (!existing) {
				// Add the template hook
				hooks.push({ ...templateHook })
			}
		}
	}

	// Apply property updates to ALL instances of the hook in the file
	for (const eventKey of Object.keys(parsed.hooks)) {
		const hooks = parsed.hooks[eventKey]
		if (Array.isArray(hooks)) {
			const hook = hooks.find((h: any) => h.id === hookId)
			if (hook) {
				if (updates.matcher !== undefined) {
					if (updates.matcher === "") {
						delete hook.matcher
					} else {
						hook.matcher = updates.matcher
					}
				}
				if (updates.timeout !== undefined) {
					hook.timeout = updates.timeout
				}
			}
		}
	}

	// Write back (atomic)
	if (isJson) {
		await safeWriteJson(filePath, parsed)
	} else {
		await safeWriteText(filePath, YAML.stringify(parsed))
	}
}
