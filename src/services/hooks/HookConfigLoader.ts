/**
 * Hook Configuration Loader
 *
 * Loads and merges hook configurations from:
 * 1. Project directory: .roo/hooks/*.yaml or *.json (highest priority)
 * 2. Mode-specific: .roo/hooks-{mode}/*.yaml or *.json (middle priority)
 * 3. Global directory: ~/.roo/hooks/*.yaml or *.json (lowest priority)
 *
 * Files within each directory are processed in alphabetical order.
 * Same hook ID at higher precedence level overrides lower levels.
 */

import * as path from "path"
import * as fs from "fs/promises"
import YAML from "yaml"
import { z } from "zod"
import {
	HooksConfigFileSchema,
	LegacyHooksConfigFileSchema,
	HooksConfigSnapshot,
	HookDefinition,
	ResolvedHook,
	HookSource,
	HookEventType,
} from "./types"
import { getGlobalRooDirectory, getProjectRooDirectoryForCwd } from "../roo-config"

/**
 * Result of loading a single config file.
 */
interface LoadedConfigFile {
	filePath: string
	source: HookSource
	createdAt?: number
	hooks: Map<HookEventType, HookDefinition[]>
	errors: string[]
}

/**
 * Options for loading hooks configuration.
 */
export interface LoadHooksConfigOptions {
	/** Project directory (cwd) */
	cwd: string

	/** Current mode slug (for mode-specific hooks) */
	mode?: string
}

/**
 * Result of loading all hooks configuration.
 */
export interface LoadHooksConfigResult {
	snapshot: HooksConfigSnapshot
	errors: string[]
	warnings: string[]
}

/**
 * Check if a file has a supported extension (.yaml, .yml, .json).
 */
function isSupportedConfigFile(filename: string): boolean {
	const lower = filename.toLowerCase()
	return lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".json")
}

/**
 * Parse a config file content (YAML or JSON).
 */
function parseConfigContent(content: string, filePath: string): unknown {
	const lower = filePath.toLowerCase()

	if (lower.endsWith(".json")) {
		return JSON.parse(content)
	}

	// Parse as YAML (which also handles plain JSON)
	return YAML.parse(content)
}

/**
 * Validate parsed config against the schema.
 */
function validateConfig(
	parsed: unknown,
	filePath: string,
): { success: true; data: z.infer<typeof HooksConfigFileSchema> } | { success: false; errors: string[] } {
	const result = HooksConfigFileSchema.safeParse(parsed)

	if (result.success) {
		return { success: true, data: result.data }
	}

	// Format Zod errors nicely
	const errors = result.error.errors.map((err) => {
		const pathStr = err.path.length > 0 ? err.path.join(".") : "(root)"
		return `${filePath}: ${pathStr}: ${err.message}`
	})

	return { success: false, errors }
}

function toHooksByEventMap(data: z.infer<typeof HooksConfigFileSchema>): Map<HookEventType, HookDefinition[]> {
	const hooks = new Map<HookEventType, HookDefinition[]>()

	// New format: hooks: HookDefinitionWithEvents[]
	if (Array.isArray((data as any).hooks)) {
		for (const def of (data as any).hooks as Array<any>) {
			const events: HookEventType[] = Array.isArray(def?.events) ? def.events : []
			for (const event of events) {
				const hookDef: HookDefinition = {
					id: def.id,
					matcher: def.matcher,
					enabled: def.enabled,
					command: def.command,
					timeout: def.timeout,
					description: def.description,
					shell: def.shell,
					includeConversationHistory: def.includeConversationHistory,
				}
				if (!hooks.has(event)) {
					hooks.set(event, [])
				}
				hooks.get(event)!.push(hookDef)
			}
		}
		return hooks
	}

	// Legacy format: hooks: Record<Event, HookDefinition[]>
	const legacy = LegacyHooksConfigFileSchema.parse(data)
	const hooksRecord = legacy.hooks || {}
	for (const [eventStr, definitions] of Object.entries(hooksRecord)) {
		const event = eventStr as HookEventType
		if (definitions && definitions.length > 0) {
			hooks.set(event, definitions)
		}
	}

	return hooks
}

/**
 * Load a single config file.
 */
async function loadConfigFile(filePath: string, source: HookSource): Promise<LoadedConfigFile> {
	const result: LoadedConfigFile = {
		filePath,
		source,
		createdAt: undefined,
		hooks: new Map(),
		errors: [],
	}

	try {
		// Prefer file birthtime when available. Fall back to ctime/mtime.
		const stat = await fs.stat(filePath)
		result.createdAt =
			stat.birthtimeMs && stat.birthtimeMs > 0
				? stat.birthtimeMs
				: stat.ctimeMs && stat.ctimeMs > 0
					? stat.ctimeMs
					: stat.mtimeMs

		const content = await fs.readFile(filePath, "utf-8")
		const parsed = parseConfigContent(content, filePath)
		const validated = validateConfig(parsed, filePath)

		if (!validated.success) {
			result.errors = validated.errors
			return result
		}

		result.hooks = toHooksByEventMap(validated.data)
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			// File doesn't exist - not an error, just skip
			return result
		}

		const message = err instanceof Error ? err.message : String(err)
		result.errors.push(`${filePath}: Failed to load: ${message}`)
	}

	return result
}

/**
 * List config files in a directory (sorted alphabetically).
 */
async function listConfigFiles(dirPath: string): Promise<string[]> {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true })
		const files = entries
			.filter((entry) => entry.isFile() && isSupportedConfigFile(entry.name))
			.map((entry) => path.join(dirPath, entry.name))
			.sort() // Alphabetical order

		return files
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			// Directory doesn't exist - not an error
			return []
		}
		throw err
	}
}

/**
 * Load all config files from a directory.
 */
async function loadConfigDirectory(dirPath: string, source: HookSource): Promise<LoadedConfigFile[]> {
	const files = await listConfigFiles(dirPath)
	const results: LoadedConfigFile[] = []

	for (const filePath of files) {
		const loaded = await loadConfigFile(filePath, source)
		results.push(loaded)
	}

	return results
}

/**
 * Merge loaded configs into a snapshot, respecting precedence rules.
 *
 * Precedence (highest to lowest):
 * 1. Project hooks (.roo/hooks/)
 * 2. Mode-specific hooks (.roo/hooks-{mode}/)
 * 3. Global hooks (~/.roo/hooks/)
 *
 * Within same level: alphabetical file order.
 * Same hook ID: higher precedence wins (can also disable with enabled: false).
 */
function mergeConfigs(loadedConfigs: LoadedConfigFile[]): {
	hooksByEvent: Map<HookEventType, ResolvedHook[]>
	hooksById: Map<string, ResolvedHook>
	hasProjectHooks: boolean
} {
	function isSameHookDefinition(a: ResolvedHook, b: ResolvedHook): boolean {
		return (
			a.id === b.id &&
			a.command === b.command &&
			a.matcher === b.matcher &&
			a.enabled === b.enabled &&
			a.timeout === b.timeout &&
			a.description === b.description &&
			a.shell === b.shell &&
			a.includeConversationHistory === b.includeConversationHistory
		)
	}

	function removeHookIdFromAllEvents(hookId: string): void {
		for (const [evt, list] of hooksByEvent) {
			const next = list.filter((h) => h.id !== hookId)
			if (next.length === 0) {
				hooksByEvent.delete(evt)
			} else if (next.length !== list.length) {
				hooksByEvent.set(evt, next)
			}
		}
	}

	function upsertHookInEventList(event: HookEventType, hook: ResolvedHook): void {
		if (!hooksByEvent.has(event)) {
			hooksByEvent.set(event, [])
		}
		const list = hooksByEvent.get(event)!
		const idx = list.findIndex((h) => h.id === hook.id)
		if (idx === -1) {
			list.push(hook)
		} else {
			list[idx] = hook
		}
	}

	function syncHookInstances(hookId: string, canonical: ResolvedHook): void {
		// Keep any existing per-event instances aligned with the canonical definition.
		for (const [evt, list] of hooksByEvent) {
			for (let i = 0; i < list.length; i++) {
				const h = list[i]
				if (h.id !== hookId) continue
				list[i] = {
					...canonical,
					event: evt,
					// Ensure the event list is consistent across all instances
					events: canonical.events,
				}
			}
		}
	}

	// Track hooks by ID to detect overrides
	const hooksById = new Map<string, ResolvedHook>()

	// Track hooks by event for efficient lookup
	const hooksByEvent = new Map<HookEventType, ResolvedHook[]>()

	// Track if we have any project hooks (for security warnings)
	let hasProjectHooks = false

	// Process configs in reverse precedence order (global -> mode -> project)
	// so that later (higher precedence) configs override earlier ones
	const orderedConfigs = [...loadedConfigs].sort((a, b) => {
		const precedence: Record<HookSource, number> = {
			global: 0,
			mode: 1,
			project: 2,
		}
		return precedence[a.source] - precedence[b.source]
	})

	for (const config of orderedConfigs) {
		if (config.source === "project" && config.hooks.size > 0) {
			hasProjectHooks = true
		}

		for (const [event, definitions] of config.hooks) {
			for (const def of definitions) {
				const resolved: ResolvedHook = {
					...def,
					source: config.source,
					createdAt: config.createdAt,
					event,
					events: [event],
					filePath: config.filePath,
				}

				// Check for existing hook with same ID
				const existing = hooksById.get(def.id)
				if (existing) {
					// If this is effectively the same hook definition, merge events instead of overwriting.
					if (isSameHookDefinition(existing, resolved)) {
						const mergedEvents = new Set<HookEventType>([...(existing.events ?? [existing.event]), event])
						existing.events = Array.from(mergedEvents)

						// Prefer metadata from the later (higher precedence / later file) definition.
						existing.source = resolved.source
						existing.createdAt = resolved.createdAt
						existing.filePath = resolved.filePath

						// Ensure hooksByEvent has an entry for this event.
						upsertHookInEventList(event, {
							...existing,
							event,
							events: existing.events,
						})

						// Keep all existing per-event hook instances up to date.
						syncHookInstances(def.id, existing)
						continue
					}

					// Different hook definition: higher precedence replaces the entire hook (and its events).
					removeHookIdFromAllEvents(def.id)
				}

				// Add/replace in lookup maps
				hooksById.set(def.id, resolved)
				upsertHookInEventList(event, resolved)
			}
		}
	}

	return { hooksByEvent, hooksById, hasProjectHooks }
}

/**
 * Load hooks configuration from all sources.
 *
 * @param options - Loading options (cwd, mode)
 * @returns Loaded configuration snapshot and any errors/warnings
 */
export async function loadHooksConfig(options: LoadHooksConfigOptions): Promise<LoadHooksConfigResult> {
	const { cwd, mode } = options
	const errors: string[] = []
	const warnings: string[] = []
	const loadedConfigs: LoadedConfigFile[] = []

	// 1. Load global hooks (~/.roo/hooks/)
	const globalDir = path.join(getGlobalRooDirectory(), "hooks")
	try {
		const globalConfigs = await loadConfigDirectory(globalDir, "global")
		loadedConfigs.push(...globalConfigs)
		for (const config of globalConfigs) {
			errors.push(...config.errors)
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		warnings.push(`Failed to load global hooks from ${globalDir}: ${message}`)
	}

	// 2. Load mode-specific hooks (.roo/hooks-{mode}/)
	if (mode) {
		const modeDir = path.join(getProjectRooDirectoryForCwd(cwd), `hooks-${mode}`)
		try {
			const modeConfigs = await loadConfigDirectory(modeDir, "mode")
			loadedConfigs.push(...modeConfigs)
			for (const config of modeConfigs) {
				errors.push(...config.errors)
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			warnings.push(`Failed to load mode-specific hooks from ${modeDir}: ${message}`)
		}
	}

	// 3. Load project hooks (.roo/hooks/)
	const projectDir = path.join(getProjectRooDirectoryForCwd(cwd), "hooks")
	try {
		const projectConfigs = await loadConfigDirectory(projectDir, "project")
		loadedConfigs.push(...projectConfigs)
		for (const config of projectConfigs) {
			errors.push(...config.errors)
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		warnings.push(`Failed to load project hooks from ${projectDir}: ${message}`)
	}

	// Merge configs with precedence rules
	const { hooksByEvent, hooksById, hasProjectHooks } = mergeConfigs(loadedConfigs)

	// Create snapshot
	const snapshot: HooksConfigSnapshot = {
		hooksByEvent,
		hooksById,
		loadedAt: new Date(),
		disabledHookIds: new Set(),
		hasProjectHooks,
	}

	// Security warning for project hooks
	if (hasProjectHooks) {
		warnings.push(
			"⚠️ Project hooks are active: This workspace has hooks defined in .roo/hooks/. " +
				"These hooks run shell commands when Roo Code performs actions. " +
				"Only enable project hooks for repositories you trust.",
		)
	}

	return { snapshot, errors, warnings }
}

/**
 * Get hooks for a specific event from a snapshot.
 *
 * @param snapshot - The config snapshot
 * @param event - The event type
 * @returns Array of hooks for the event (excluding disabled ones)
 */
export function getHooksForEvent(snapshot: HooksConfigSnapshot, event: HookEventType): ResolvedHook[] {
	const hooks = snapshot.hooksByEvent.get(event) || []
	return hooks.filter((hook) => {
		// Check if explicitly disabled via setHookEnabled
		if (snapshot.disabledHookIds.has(hook.id)) {
			return false
		}
		// Check if disabled in config
		return hook.enabled !== false
	})
}

/**
 * Get a specific hook by ID from a snapshot.
 *
 * @param snapshot - The config snapshot
 * @param hookId - The hook ID
 * @returns The hook, or undefined if not found
 */
export function getHookById(snapshot: HooksConfigSnapshot, hookId: string): ResolvedHook | undefined {
	return snapshot.hooksById.get(hookId)
}
