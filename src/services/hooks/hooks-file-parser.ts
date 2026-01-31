import * as YAML from "yaml"

import {
	type HooksFile,
	type HookConfig,
	type HookEventType,
	type HookWithMetadata,
	hooksFileSchema,
	hookEventTypes,
} from "@roo-code/types"

/**
 * File extension for hooks configuration files
 */
export const HOOKS_FILE_EXTENSION = ".hooks.yaml"

/**
 * Parse .hooks.yaml file content (YAML with Zod validation)
 *
 * @param content - The raw file content to parse
 * @returns Parsed HooksFile object
 * @throws Error if content is not valid YAML or fails Zod validation
 */
export function parseHooksFile(content: string): HooksFile {
	// Handle empty content
	if (!content || content.trim() === "") {
		return createEmptyHooksFile()
	}

	try {
		const parsed = YAML.parse(content)
		const result = hooksFileSchema.safeParse(parsed)

		if (!result.success) {
			const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
			throw new Error(`Invalid hooks file format: ${errors}`)
		}

		return result.data
	} catch (error) {
		if (error instanceof YAML.YAMLParseError) {
			throw new Error(`Invalid YAML in hooks file: ${error.message}`)
		}
		throw error
	}
}

/**
 * Serialize HooksFile to YAML string
 *
 * @param hooksFile - The HooksFile object to serialize
 * @returns Pretty-printed YAML string
 */
export function serializeHooksFile(hooksFile: HooksFile): string {
	// Ensure hooks object only contains valid event types and remove empty arrays
	const cleanedHooks: Partial<Record<HookEventType, HookConfig[]>> = {}

	for (const eventType of hookEventTypes) {
		const eventHooks = hooksFile.hooks[eventType]
		if (eventHooks && eventHooks.length > 0) {
			cleanedHooks[eventType] = eventHooks
		}
	}

	const cleanedFile: HooksFile = {
		$schema: hooksFile.$schema || "https://roo.dev/schemas/hooks.json",
		version: hooksFile.version,
		hooks: cleanedHooks as HooksFile["hooks"],
	}

	return YAML.stringify(cleanedFile, {
		indent: 2,
		lineWidth: 0, // Disable line wrapping for commands
		defaultStringType: "QUOTE_DOUBLE", // Use double quotes for strings with special characters
		defaultKeyType: "PLAIN", // Keep keys unquoted
	})
}

/**
 * Create an empty HooksFile structure
 *
 * @returns Empty HooksFile with default schema and version
 */
export function createEmptyHooksFile(): HooksFile {
	return {
		$schema: "https://roo.dev/schemas/hooks.json",
		version: "1.0",
		hooks: {},
	}
}

/**
 * Extract hooks from a HooksFile into HookWithMetadata array
 *
 * @param hooksFile - The parsed HooksFile
 * @param source - Whether this is from 'global' or 'project' location
 * @param filePath - The file path where this hooks file is located
 * @returns Array of HookWithMetadata objects
 */
export function extractHooksWithMetadata(
	hooksFile: HooksFile,
	source: "global" | "project",
	filePath: string,
): HookWithMetadata[] {
	const result: HookWithMetadata[] = []

	for (const eventType of hookEventTypes) {
		const eventHooks = hooksFile.hooks[eventType]
		if (eventHooks) {
			for (const hook of eventHooks) {
				result.push({
					...hook,
					eventType,
					source,
					filePath,
				})
			}
		}
	}

	return result
}

/**
 * Merge global and project hooks (project takes precedence)
 *
 * When a hook ID exists in both global and project, the project version wins.
 * This provides override capability for project-specific customizations.
 *
 * @param globalHooks - Hooks from the global .hooks.yaml file
 * @param projectHooks - Hooks from the project .hooks.yaml file
 * @returns Merged array with project hooks taking precedence
 */
export function mergeHooks(globalHooks: HookWithMetadata[], projectHooks: HookWithMetadata[]): HookWithMetadata[] {
	// Create a map of project hooks by ID for quick lookup
	const projectHookIds = new Set(projectHooks.map((h) => h.id))

	// Filter out global hooks that are overridden by project hooks
	const nonOverriddenGlobalHooks = globalHooks.filter((h) => !projectHookIds.has(h.id))

	// Combine non-overridden global hooks with all project hooks
	return [...nonOverriddenGlobalHooks, ...projectHooks]
}

/**
 * Convert a HookWithMetadata back to HookConfig (for saving)
 *
 * @param hook - The hook with metadata
 * @returns HookConfig without metadata fields
 */
export function stripHookMetadata(hook: HookWithMetadata): HookConfig {
	const { eventType, source, filePath, ...config } = hook
	return config as HookConfig
}

/**
 * Update a HooksFile with a hook configuration
 *
 * @param hooksFile - The existing hooks file
 * @param hook - The hook to add/update
 * @param eventType - The event type for the hook
 * @returns Updated HooksFile
 */
export function updateHookInFile(hooksFile: HooksFile, hook: HookConfig, eventType: HookEventType): HooksFile {
	const existingHooks = hooksFile.hooks[eventType] || []
	const hookIndex = existingHooks.findIndex((h) => h.id === hook.id)

	let updatedHooks: HookConfig[]
	if (hookIndex >= 0) {
		// Update existing hook
		updatedHooks = [...existingHooks]
		updatedHooks[hookIndex] = hook
	} else {
		// Add new hook
		updatedHooks = [...existingHooks, hook]
	}

	return {
		...hooksFile,
		hooks: {
			...hooksFile.hooks,
			[eventType]: updatedHooks,
		},
	}
}

/**
 * Remove a hook from a HooksFile
 *
 * @param hooksFile - The existing hooks file
 * @param hookId - The ID of the hook to remove
 * @param eventType - The event type of the hook
 * @returns Updated HooksFile
 */
export function removeHookFromFile(hooksFile: HooksFile, hookId: string, eventType: HookEventType): HooksFile {
	const existingHooks = hooksFile.hooks[eventType] || []
	const filteredHooks = existingHooks.filter((h) => h.id !== hookId)

	const updatedHooks = { ...hooksFile.hooks }
	if (filteredHooks.length === 0) {
		delete updatedHooks[eventType]
	} else {
		updatedHooks[eventType] = filteredHooks
	}

	return {
		...hooksFile,
		hooks: updatedHooks,
	}
}

/**
 * Reorder hooks within an event type in a HooksFile
 *
 * @param hooksFile - The existing hooks file
 * @param eventType - The event type to reorder hooks in
 * @param hookIds - Array of hook IDs in the new order
 * @returns Updated HooksFile
 */
export function reorderHooksInFile(hooksFile: HooksFile, eventType: HookEventType, hookIds: string[]): HooksFile {
	const existingHooks = hooksFile.hooks[eventType] || []

	// Create a map for quick lookup
	const hookMap = new Map(existingHooks.map((h) => [h.id, h]))

	// Reorder based on hookIds, preserving hooks that aren't in hookIds at the end
	const reorderedHooks: HookConfig[] = []
	const usedIds = new Set<string>()

	for (const id of hookIds) {
		const hook = hookMap.get(id)
		if (hook) {
			reorderedHooks.push(hook)
			usedIds.add(id)
		}
	}

	// Add any remaining hooks that weren't in hookIds
	for (const hook of existingHooks) {
		if (!usedIds.has(hook.id)) {
			reorderedHooks.push(hook)
		}
	}

	return {
		...hooksFile,
		hooks: {
			...hooksFile.hooks,
			[eventType]: reorderedHooks,
		},
	}
}

/**
 * Move a hook from one event type to another in a HooksFile (atomic operation)
 *
 * @param hooksFile - The existing hooks file
 * @param hook - The hook configuration to move
 * @param fromEventType - The source event type
 * @param toEventType - The target event type
 * @returns Updated HooksFile with hook moved
 */
export function moveHookInFile(
	hooksFile: HooksFile,
	hook: HookConfig,
	fromEventType: HookEventType,
	toEventType: HookEventType,
): HooksFile {
	// Start with a copy of all hooks
	const updatedHooks = { ...hooksFile.hooks }

	// Step 1: Remove from source event type
	const sourceHooks = updatedHooks[fromEventType] || []
	const filteredSourceHooks = sourceHooks.filter((h) => h.id !== hook.id)
	if (filteredSourceHooks.length === 0) {
		delete updatedHooks[fromEventType]
	} else {
		updatedHooks[fromEventType] = filteredSourceHooks
	}

	// Step 2: Add to target event type
	const targetHooks = updatedHooks[toEventType] || []
	// Check if hook already exists in target (shouldn't happen, but be safe)
	const existingIndex = targetHooks.findIndex((h) => h.id === hook.id)
	if (existingIndex >= 0) {
		// Update existing
		const newTargetHooks = [...targetHooks]
		newTargetHooks[existingIndex] = hook
		updatedHooks[toEventType] = newTargetHooks
	} else {
		// Add new
		updatedHooks[toEventType] = [...targetHooks, hook]
	}

	return {
		...hooksFile,
		hooks: updatedHooks,
	}
}
