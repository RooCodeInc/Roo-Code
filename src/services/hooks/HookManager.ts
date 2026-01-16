/**
 * Hook Manager
 *
 * Central service for orchestrating hooks in Roo Code.
 * Implements the IHookManager interface from the PRD.
 *
 * Key responsibilities:
 * - Load and maintain a snapshot of hook configuration
 * - Execute matching hooks sequentially for events
 * - Manage execution history for debugging
 * - Provide enable/disable API for individual hooks
 */

import {
	IHookManager,
	HookEventType,
	HooksConfigSnapshot,
	ResolvedHook,
	HookExecution,
	HooksExecutionResult,
	HookExecutionResult,
	ExecuteHooksOptions,
	HookContext,
	ConversationHistoryEntry,
} from "./types"
import { loadHooksConfig, getHooksForEvent, LoadHooksConfigOptions } from "./HookConfigLoader"
import { filterMatchingHooks } from "./HookMatcher"
import { executeHook, interpretResult, describeResult } from "./HookExecutor"

/**
 * Default options for the HookManager.
 */
export interface HookManagerOptions {
	/** Project directory (cwd) */
	cwd: string

	/** Current mode slug */
	mode?: string

	/** Maximum execution history entries to keep (default: 100) */
	maxHistoryEntries?: number

	/** Optional logger for hook activity */
	logger?: {
		debug: (message: string) => void
		info: (message: string) => void
		warn: (message: string) => void
		error: (message: string) => void
	}
}

/**
 * Default maximum history entries.
 */
const DEFAULT_MAX_HISTORY = 100

/**
 * HookManager implementation.
 *
 * This class maintains an immutable snapshot of hook configuration that is
 * loaded once and only changes on explicit reload (for security).
 */
export class HookManager implements IHookManager {
	private options: HookManagerOptions
	private snapshot: HooksConfigSnapshot | null = null
	private executionHistory: HookExecution[] = []
	private maxHistoryEntries: number

	constructor(options: HookManagerOptions) {
		this.options = options
		this.maxHistoryEntries = options.maxHistoryEntries ?? DEFAULT_MAX_HISTORY
	}

	/**
	 * Load hooks configuration from all sources.
	 * Creates an immutable snapshot that won't change until explicit reload.
	 */
	async loadHooksConfig(): Promise<HooksConfigSnapshot> {
		const loadOptions: LoadHooksConfigOptions = {
			cwd: this.options.cwd,
			mode: this.options.mode,
		}

		const { snapshot, errors, warnings } = await loadHooksConfig(loadOptions)

		// Log errors and warnings
		if (this.options.logger) {
			for (const error of errors) {
				this.options.logger.error(`Hook config error: ${error}`)
			}
			for (const warning of warnings) {
				this.options.logger.warn(warning)
			}
		}

		// Store the snapshot
		this.snapshot = snapshot

		// Log summary
		const hookCount = Array.from(snapshot.hooksByEvent.values()).reduce((sum, hooks) => sum + hooks.length, 0)
		this.log("info", `Loaded ${hookCount} hooks from configuration`)

		return snapshot
	}

	/**
	 * Explicitly reload hooks configuration.
	 * Required for security - config changes don't auto-apply.
	 */
	async reloadHooksConfig(): Promise<void> {
		this.log("info", "Reloading hooks configuration...")

		// Preserve disabled hook IDs across reload
		const previousDisabled = this.snapshot?.disabledHookIds ?? new Set<string>()

		await this.loadHooksConfig()

		// Restore disabled state for hooks that still exist
		if (this.snapshot) {
			for (const hookId of previousDisabled) {
				if (this.snapshot.hooksById.has(hookId)) {
					this.snapshot.disabledHookIds.add(hookId)
				}
			}
		}

		this.log("info", "Hooks configuration reloaded")
	}

	/**
	 * Execute all matching hooks for an event.
	 * Hooks are executed sequentially in their defined order.
	 * If a blocking event returns exit code 2, subsequent hooks are skipped.
	 */
	async executeHooks(event: HookEventType, options: ExecuteHooksOptions): Promise<HooksExecutionResult> {
		const startTime = Date.now()
		const results: HookExecutionResult[] = []

		// Ensure config is loaded
		if (!this.snapshot) {
			await this.loadHooksConfig()
		}

		// Get enabled hooks for this event
		const eventHooks = getHooksForEvent(this.snapshot!, event)

		// Filter by tool name if this is a tool-related event
		let matchingHooks: ResolvedHook[]
		if (options.context.tool?.name) {
			matchingHooks = filterMatchingHooks(eventHooks, options.context.tool.name)
		} else {
			matchingHooks = eventHooks
		}

		this.log("debug", `Executing ${matchingHooks.length} hooks for ${event}`)

		let blocked = false
		let blockMessage: string | undefined
		let blockingHook: ResolvedHook | undefined
		let modification: HooksExecutionResult["modification"]

		// Execute hooks sequentially
		for (const hook of matchingHooks) {
			this.log("debug", `Executing hook "${hook.id}" for ${event}`)

			// Execute the hook
			const result = await executeHook(hook, options.context, options.conversationHistory)
			results.push(result)

			// Record in history
			this.recordExecution(hook, event, result)

			// Log the result
			this.log("info", describeResult(result))

			// Interpret the result
			const interpretation = interpretResult(result)

			// Check for blocking
			if (interpretation.blocked) {
				blocked = true
				blockMessage = interpretation.blockMessage
				blockingHook = hook
				this.log("warn", `Hook "${hook.id}" blocked ${event}: ${blockMessage}`)
				break // Stop executing subsequent hooks
			}

			// Check for modification (only first modification wins)
			if (!modification && result.modification) {
				modification = result.modification
				this.log("info", `Hook "${hook.id}" modified tool input`)
			}

			// If hook returned an error but we should continue, log it
			if (!interpretation.success && interpretation.shouldContinue) {
				this.log("warn", `Hook "${hook.id}" failed but continuing: ${result.error?.message || result.stderr}`)
			}
		}

		const totalDuration = Date.now() - startTime
		this.log("debug", `Executed ${results.length} hooks in ${totalDuration}ms`)

		return {
			results,
			blocked,
			blockMessage,
			blockingHook,
			modification,
			totalDuration,
		}
	}

	/**
	 * Get all currently enabled hooks.
	 */
	getEnabledHooks(): ResolvedHook[] {
		if (!this.snapshot) {
			return []
		}

		const allHooks: ResolvedHook[] = []
		for (const hooks of this.snapshot.hooksByEvent.values()) {
			for (const hook of hooks) {
				// Check if enabled in config AND not disabled at runtime
				if (hook.enabled !== false && !this.snapshot.disabledHookIds.has(hook.id)) {
					allHooks.push(hook)
				}
			}
		}

		return allHooks
	}

	/**
	 * Enable or disable a specific hook by ID.
	 * This persists until config reload.
	 */
	async setHookEnabled(hookId: string, enabled: boolean): Promise<void> {
		if (!this.snapshot) {
			await this.loadHooksConfig()
		}

		const hook = this.snapshot!.hooksById.get(hookId)
		if (!hook) {
			throw new Error(`Hook not found: ${hookId}`)
		}

		if (enabled) {
			this.snapshot!.disabledHookIds.delete(hookId)
			this.log("info", `Enabled hook "${hookId}"`)
		} else {
			this.snapshot!.disabledHookIds.add(hookId)
			this.log("info", `Disabled hook "${hookId}"`)
		}
	}

	/**
	 * Get execution history for debugging.
	 */
	getHookExecutionHistory(): HookExecution[] {
		return [...this.executionHistory]
	}

	/**
	 * Get the current config snapshot (or null if not loaded).
	 */
	getConfigSnapshot(): HooksConfigSnapshot | null {
		return this.snapshot
	}

	/**
	 * Update the current mode (useful when mode changes during session).
	 * Requires reload to take effect.
	 */
	setMode(mode: string): void {
		this.options.mode = mode
	}

	/**
	 * Clear execution history.
	 */
	clearHistory(): void {
		this.executionHistory = []
	}

	/**
	 * Record a hook execution in history.
	 */
	private recordExecution(hook: ResolvedHook, event: HookEventType, result: HookExecutionResult): void {
		const entry: HookExecution = {
			timestamp: new Date(),
			hook,
			event,
			result,
		}

		this.executionHistory.push(entry)

		// Trim history if needed
		if (this.executionHistory.length > this.maxHistoryEntries) {
			this.executionHistory = this.executionHistory.slice(-this.maxHistoryEntries)
		}
	}

	/**
	 * Log a message using the configured logger.
	 */
	private log(level: "debug" | "info" | "warn" | "error", message: string): void {
		if (this.options.logger) {
			this.options.logger[level](`[Hooks] ${message}`)
		}
	}
}

/**
 * Create a new HookManager instance.
 */
export function createHookManager(options: HookManagerOptions): IHookManager {
	return new HookManager(options)
}
