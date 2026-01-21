/**
 * Lifecycle Hooks Service
 *
 * Provides integration between non-tool lifecycle events and the hooks system.
 * Mirrors ToolExecutionHooks but for session/task lifecycle events.
 */

import type { HookContext, HookProjectContext, HookSessionContext, HookToolContext, IHookManager } from "./types"
import type { HookEventType } from "./types"
import { isBlockingEvent } from "./types"

import type {
	ClineSay as SayType,
	HookExecutionOutputStatusPayload as HookExecutionOutputStatus,
} from "@roo-code/types"

/**
 * Result of a lifecycle hook execution.
 */
export interface LifecycleHookResult {
	blocked: boolean
	executionId?: string
	/**
	 * Human-readable reason for a block (typically hook stderr). Present only when `blocked: true`.
	 */
	blockMessage?: string
	error?: string
}

/**
 * Options for executing lifecycle hooks.
 */
export interface LifecycleHookOptions {
	/** Matcher value for events that support matchers */
	matcher?: string
	/** Additional context data specific to the event */
	eventData?: Record<string, unknown>
}

export interface LifecycleHooksCallbacks {
	sayCallback?: (type: SayType, message?: string) => Promise<string | void>
	updateSayCallback?: (type: SayType, id: string, message?: string) => Promise<string | void>
	outputStatusCallback?: (status: HookExecutionOutputStatus) => void
	onHookStatus?: LifecycleHookStatusCallback
}

export type LifecycleHookStatusCallback = (status: {
	event: string
	hookId: string
	state: "started" | "completed" | "failed" | "blocked"
}) => void

type UserPromptSubmitOptions = {
	images?: string[] | { count: number; paths?: string[] }
	source?: "chat_input" | "edit_message" | "queued_message"
}

type StopReason =
	| "user_request"
	| "error"
	| "timeout"
	| "force"
	// Backwards compatibility: legacy PRD/early-implementation reasons
	| "user_cancelled"
	| "provider_cleanup"
	| "rehydrate"
	| "other"

type StopOptions = {
	/** High-level reason why stop/abort was requested. */
	reason?: StopReason
	/** Whether the task is being abandoned/force-cleaned up. */
	isAbandoned?: boolean
	/**
	 * Force-abort mode: bypass Stop hooks entirely.
	 * This is a safety valve to ensure internal cleanup cannot be blocked.
	 */
	isForceAbort?: boolean
}

type SubagentStartOptions = {
	parentTaskId?: string
	childTaskId?: string
	mode?: string
}

type SubagentStopOptions = {
	parentTaskId?: string
	childTaskId?: string
	mode?: string
	result?: unknown
}

type SessionEndOptions = {
	endReason?: string
}

type NotificationOptions = {
	message?: string
	title?: string
	severity?: "info" | "warn" | "error"
	source?: string
}

function isLegacySubtaskStartInfo(arg: unknown): arg is { taskId: string; mode?: string } {
	return !!arg && typeof arg === "object" && "taskId" in arg
}

function isLegacySubtaskStopInfo(arg: unknown): arg is { taskId: string; result?: string } {
	return !!arg && typeof arg === "object" && "taskId" in arg
}

function isCallbacks(arg: unknown): arg is LifecycleHooksCallbacks {
	if (!arg || typeof arg !== "object") return false
	const obj = arg as Record<string, unknown>
	return "sayCallback" in obj || "updateSayCallback" in obj || "outputStatusCallback" in obj || "onHookStatus" in obj
}

/**
 * LifecycleHooks provides the integration layer for non-tool lifecycle events.
 */
export class LifecycleHooks {
	private hookManagerGetter: () => IHookManager | null
	private hooksEnabledGetter?: () => boolean
	private onHookStatus?: LifecycleHookStatusCallback

	private sayCallback?: (type: SayType, message?: string) => Promise<string | void>
	private updateSayCallback?: (type: SayType, id: string, message?: string) => Promise<string | void>
	private outputStatusCallback?: (status: HookExecutionOutputStatus) => void

	// Default getter to keep the adapter functional even before call sites are updated.
	// Call sites can provide a better implementation in follow-up tasks.
	private getSessionContext: () => { cwd: string; taskId: string; mode?: string } = () => ({
		cwd: process.cwd(),
		taskId: "unknown",
		mode: "unknown",
	})

	constructor(
		hookManagerGetter: () => IHookManager | null,
		isEnabled: () => boolean,
		callbacks?: LifecycleHooksCallbacks,
	)
	constructor(
		hookManager: IHookManager,
		getSessionContext: () => { cwd: string; taskId: string; mode?: string },
		onHookStatus?: (status: {
			event: string
			hookId: string
			state: "started" | "completed" | "failed" | "blocked"
		}) => void,
	)
	constructor(
		hookManagerGetterOrInstance: (() => IHookManager | null) | IHookManager,
		isEnabledOrGetSessionContext: (() => boolean) | (() => { cwd: string; taskId: string; mode?: string }),
		callbacksOrOnHookStatus?:
			| LifecycleHooksCallbacks
			| ((status: {
					event: string
					hookId: string
					state: "started" | "completed" | "failed" | "blocked"
			  }) => void),
	) {
		// Backwards-compatible constructor: (hookManager, getSessionContext, onHookStatus?)
		if (typeof hookManagerGetterOrInstance !== "function") {
			this.hookManagerGetter = () => hookManagerGetterOrInstance
			// Default to enabled for backwards compatibility.
			this.hooksEnabledGetter = undefined
			this.getSessionContext = isEnabledOrGetSessionContext as () => {
				cwd: string
				taskId: string
				mode?: string
			}
			this.onHookStatus = callbacksOrOnHookStatus as LifecycleHookStatusCallback | undefined
			return
		}

		// New constructor: (hookManagerGetter, isEnabled, callbacks?)
		this.hookManagerGetter = hookManagerGetterOrInstance
		this.hooksEnabledGetter = isEnabledOrGetSessionContext as () => boolean
		const callbacks = callbacksOrOnHookStatus as LifecycleHooksCallbacks | undefined
		this.sayCallback = callbacks?.sayCallback
		this.updateSayCallback = callbacks?.updateSayCallback
		this.outputStatusCallback = callbacks?.outputStatusCallback
		this.onHookStatus = callbacks?.onHookStatus
	}

	/**
	 * Optional: allow call sites to provide a session context getter without changing the constructor signature.
	 */
	setSessionContextGetter(getter: (() => { cwd: string; taskId: string; mode?: string }) | undefined): void {
		if (!getter) return
		this.getSessionContext = getter
	}

	/**
	 * Update the hook status callback.
	 */
	setOnHookStatus(callback: LifecycleHookStatusCallback | undefined): void {
		this.onHookStatus = callback
	}

	/**
	 * Update the output status callback used for streaming terminal output.
	 */
	setOutputStatusCallback(callback: ((status: HookExecutionOutputStatus) => void) | undefined): void {
		this.outputStatusCallback = callback
	}

	/**
	 * Update the hooks enabled getter.
	 */
	setHooksEnabledGetter(getter: (() => boolean) | undefined): void {
		this.hooksEnabledGetter = getter
	}

	/**
	 * Check if hooks are globally enabled.
	 * Returns true if no getter is set (backwards compatibility) or if the getter returns true.
	 */
	private isHooksEnabled(): boolean {
		if (!this.hooksEnabledGetter) {
			return true
		}
		return this.hooksEnabledGetter()
	}

	private getHookManager(): IHookManager | null {
		return this.hookManagerGetter()
	}

	/**
	 * Execute hooks for UserPromptSubmit event (BLOCKING)
	 * Called before a user prompt is processed.
	 */
	async executeUserPromptSubmit(prompt: string, callbacks?: LifecycleHooksCallbacks): Promise<LifecycleHookResult>
	async executeUserPromptSubmit(
		prompt: string,
		options?: UserPromptSubmitOptions,
		callbacks?: LifecycleHooksCallbacks,
	): Promise<LifecycleHookResult>
	async executeUserPromptSubmit(
		prompt: string,
		optionsOrCallbacks?: UserPromptSubmitOptions | LifecycleHooksCallbacks,
		callbacks?: LifecycleHooksCallbacks,
	): Promise<LifecycleHookResult> {
		const options = isCallbacks(optionsOrCallbacks) ? undefined : optionsOrCallbacks
		const cb = isCallbacks(optionsOrCallbacks) ? optionsOrCallbacks : callbacks

		const images = options?.images
		const imagePayload = Array.isArray(images) ? { count: images.length, paths: images } : images

		const promptPayload: Record<string, unknown> = { text: prompt }
		if (imagePayload) promptPayload.images = imagePayload
		if (options?.source) promptPayload.source = options.source

		return this.executeLifecycleHooks(
			"UserPromptSubmit",
			undefined,
			{
				prompt: promptPayload,
			},
			cb,
		)
	}

	/**
	 * Execute hooks for PreCompact event
	 * Called before context compaction.
	 */
	async executePreCompact(
		trigger: "manual" | "auto",
		callbacks?: LifecycleHooksCallbacks,
	): Promise<LifecycleHookResult> {
		return this.executeLifecycleHooks("PreCompact", trigger, undefined, callbacks)
	}

	/**
	 * Execute hooks for Stop event (BLOCKING)
	 * Called when task abort is requested.
	 */
	async executeStop(callbacks?: LifecycleHooksCallbacks): Promise<LifecycleHookResult>
	async executeStop(options?: StopOptions, callbacks?: LifecycleHooksCallbacks): Promise<LifecycleHookResult>
	async executeStop(
		optionsOrCallbacks?: StopOptions | LifecycleHooksCallbacks,
		callbacks?: LifecycleHooksCallbacks,
	): Promise<LifecycleHookResult> {
		const options = isCallbacks(optionsOrCallbacks) ? undefined : optionsOrCallbacks
		const cb = isCallbacks(optionsOrCallbacks) ? optionsOrCallbacks : callbacks

		// Force-abort bypass: never execute Stop hooks.
		// This ensures internal cleanup cannot be blocked by external hook scripts.
		if (options?.isForceAbort) {
			return { blocked: false }
		}

		const stopPayload: Record<string, unknown> | undefined = options
			? {
					...(options.reason ? { reason: options.reason } : {}),
					...(options.isAbandoned !== undefined ? { isAbandoned: options.isAbandoned } : {}),
				}
			: undefined

		return this.executeLifecycleHooks(
			"Stop",
			undefined,
			options
				? {
						...(stopPayload ? { stop: stopPayload } : {}),
						// legacy field (pre-PRD)
						...(options.reason ? { reason: options.reason } : {}),
					}
				: undefined,
			cb,
		)
	}

	/**
	 * Execute hooks for SubagentStart event
	 * Called when a subtask is spawned.
	 */
	async executeSubagentStart(
		subtaskInfo?: { taskId: string; mode?: string } | SubagentStartOptions,
		callbacks?: LifecycleHooksCallbacks,
	): Promise<LifecycleHookResult> {
		const legacy = isLegacySubtaskStartInfo(subtaskInfo) ? subtaskInfo : undefined
		const options: SubagentStartOptions | undefined = legacy ? undefined : (subtaskInfo as SubagentStartOptions)

		const childTaskId = legacy?.taskId ?? options?.childTaskId
		const mode = legacy?.mode ?? options?.mode
		const parentTaskId = options?.parentTaskId

		return this.executeLifecycleHooks(
			"SubagentStart",
			undefined,
			{
				// Legacy field used by existing tests/call sites.
				subtask: legacy,
				subagent: {
					parentTaskId,
					childTaskId,
					mode,
				},
			},
			callbacks,
		)
	}

	/**
	 * Execute hooks for SubagentStop event (BLOCKING)
	 * Called when returning from a subtask.
	 */
	async executeSubagentStop(
		subtaskInfo?: { taskId: string; result?: string } | SubagentStopOptions,
		callbacks?: LifecycleHooksCallbacks,
	): Promise<LifecycleHookResult> {
		const legacy = isLegacySubtaskStopInfo(subtaskInfo) ? subtaskInfo : undefined
		const options: SubagentStopOptions | undefined = legacy ? undefined : (subtaskInfo as SubagentStopOptions)

		const childTaskId = legacy?.taskId ?? options?.childTaskId
		const result = legacy?.result ?? options?.result
		const mode = options?.mode
		const parentTaskId = options?.parentTaskId

		return this.executeLifecycleHooks(
			"SubagentStop",
			undefined,
			{
				// Legacy field used by existing tests/call sites.
				subtask: legacy,
				subagent: {
					parentTaskId,
					childTaskId,
					mode,
					result,
				},
			},
			callbacks,
		)
	}

	/**
	 * Execute hooks for SessionStart event.
	 */
	async executeSessionStart(
		trigger: "startup" | "resume" | "clear" | "compact",
		callbacks?: LifecycleHooksCallbacks,
	): Promise<LifecycleHookResult> {
		return this.executeLifecycleHooks("SessionStart", trigger, undefined, callbacks, { source: trigger })
	}

	/**
	 * Execute hooks for SessionEnd event.
	 */
	async executeSessionEnd(callbacks?: LifecycleHooksCallbacks): Promise<LifecycleHookResult>
	async executeSessionEnd(
		options?: SessionEndOptions,
		callbacks?: LifecycleHooksCallbacks,
	): Promise<LifecycleHookResult>
	async executeSessionEnd(
		optionsOrCallbacks?: SessionEndOptions | LifecycleHooksCallbacks,
		callbacks?: LifecycleHooksCallbacks,
	): Promise<LifecycleHookResult> {
		const options = isCallbacks(optionsOrCallbacks) ? undefined : optionsOrCallbacks
		const cb = isCallbacks(optionsOrCallbacks) ? optionsOrCallbacks : callbacks
		return this.executeLifecycleHooks("SessionEnd", undefined, undefined, cb, { endReason: options?.endReason })
	}

	/**
	 * Execute hooks for Notification event.
	 */
	async executeNotification(
		type: "permission_prompt" | "idle_prompt" | "auth_success" | "elicitation_dialog",
		notificationData?: NotificationOptions,
		callbacks?: LifecycleHooksCallbacks,
	): Promise<LifecycleHookResult> {
		const message = notificationData?.message ?? notificationData?.title ?? ""
		const notificationPayload: Record<string, unknown> = {
			type,
			message,
		}
		if (notificationData?.severity) notificationPayload.severity = notificationData.severity
		if (notificationData?.source) notificationPayload.source = notificationData.source

		return this.executeLifecycleHooks(
			"Notification",
			type,
			{
				notification: notificationPayload,
			},
			callbacks,
		)
	}

	/**
	 * Internal method to execute lifecycle hooks.
	 */
	private async executeLifecycleHooks(
		event: HookEventType,
		matcher?: string,
		additionalContext?: Record<string, unknown>,
		callbacks?: LifecycleHooksCallbacks,
		sessionOverrides?: Partial<HookSessionContext>,
	): Promise<LifecycleHookResult> {
		const hookManager = this.getHookManager()
		if (!this.isHooksEnabled() || !hookManager) {
			return { blocked: false }
		}

		const sessionContext = this.getSessionContext()

		const session: HookSessionContext = {
			taskId: sessionContext.taskId,
			// Lifecycle hooks may be triggered outside a specific provider instance.
			// Use taskId as a stable fallback to satisfy HookContext requirements.
			sessionId: sessionContext.taskId,
			mode: sessionContext.mode ?? "unknown",
			...sessionOverrides,
		}

		const project: HookProjectContext = {
			directory: sessionContext.cwd,
			name: sessionContext.cwd.split(/[/\\]/).filter(Boolean).pop() ?? sessionContext.cwd,
		}

		const hookContext: HookContext = {
			event,
			timestamp: new Date().toISOString(),
			session,
			project,
			...additionalContext,
		}

		// Standard matcher field for lifecycle events with matchers.
		if (matcher) {
			hookContext.matcher = matcher
		}

		// For lifecycle events that support matchers, we reuse tool matcher filtering by
		// setting a synthetic tool context name.
		if (matcher) {
			const tool: HookToolContext = {
				name: matcher,
				input: {},
			}
			hookContext.tool = tool
		}

		const executionId = `lifecycle-${sessionContext.taskId}-${event}-${Date.now()}`

		try {
			const result = await hookManager.executeHooks(event, {
				context: hookContext,
				executionId,
				outputStatusCallback: callbacks?.outputStatusCallback ?? this.outputStatusCallback,
				hookExecutionCallback: this.buildHookExecutionCallback(callbacks),
			})

			// Enforce contract: only blocking events can report blocked.
			const blocked = isBlockingEvent(event) ? result.blocked || false : false
			const blockMessage = blocked ? result.blockMessage : undefined

			return {
				blocked,
				executionId,
				blockMessage,
			}
		} catch (error) {
			console.error(`[LifecycleHooks] Error executing ${event} hooks:`, error)
			return {
				blocked: false,
				executionId,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	// Persisted hook_execution rows need to be stable across all hook runs for a task.
	// Keep this mapping on the instance so multiple executeHooks() calls don't lose update ability.
	private hookExecutionRowIdByExecutionId = new Map<string, string>()
	private hookExecutionCallbackInstance?: NonNullable<import("./types").ExecuteHooksOptions["hookExecutionCallback"]>

	private buildHookExecutionCallback(
		callbacksOverride?: LifecycleHooksCallbacks,
	): NonNullable<import("./types").ExecuteHooksOptions["hookExecutionCallback"]> {
		// If call sites pass callbacks per execution, avoid caching so we don't accidentally
		// mix callbacks across tasks.
		if (!callbacksOverride && this.hookExecutionCallbackInstance) {
			return this.hookExecutionCallbackInstance
		}

		const sayCallback = callbacksOverride?.sayCallback ?? this.sayCallback
		const updateSayCallback = callbacksOverride?.updateSayCallback ?? this.updateSayCallback
		const onHookStatus = callbacksOverride?.onHookStatus ?? this.onHookStatus
		const hookExecutionRowIdByExecutionId = callbacksOverride
			? new Map<string, string>()
			: this.hookExecutionRowIdByExecutionId

		const callback: NonNullable<import("./types").ExecuteHooksOptions["hookExecutionCallback"]> = async (evt) => {
			onHookStatus?.({
				event: String(evt.event),
				hookId: evt.hookId,
				state: evt.phase,
			})

			if (!sayCallback) return

			if (evt.phase === "started") {
				const payload = {
					executionId: evt.executionId,
					hookId: evt.hookId,
					event: evt.event,
					toolName: evt.toolName,
					command: evt.command,
				}

				const rowId = await sayCallback("hook_execution", JSON.stringify(payload))
				hookExecutionRowIdByExecutionId.set(
					evt.executionId,
					typeof rowId === "string" ? rowId : evt.executionId,
				)
				return
			}

			// Terminal states: update persisted row with a compressed output summary.
			const rowId = hookExecutionRowIdByExecutionId.get(evt.executionId)
			if (!rowId || !updateSayCallback) {
				return
			}

			const payload = {
				executionId: evt.executionId,
				hookId: evt.hookId,
				event: evt.event,
				toolName: evt.toolName,
				command: evt.command,
				result: {
					phase: evt.phase,
					exitCode: evt.exitCode,
					durationMs: evt.durationMs,
					blockMessage: evt.blockMessage,
					error: evt.error,
					modified: evt.modified,
					outputSummary: evt.outputSummary,
				},
			}

			await updateSayCallback("hook_execution", rowId, JSON.stringify(payload))
		}

		if (!callbacksOverride) {
			this.hookExecutionCallbackInstance = callback
		}

		return callback
	}
}
