/**
 * HookEngine - Core middleware/interceptor for intent orchestration
 * Implements the Pre-Hook/Post-Hook pattern for tool interception
 */

import type { ToolAction, ToolInterceptor } from "./types/ToolAction"
import type { HookContext, HookResult, PreHookResult, PostHookResult } from "./types/HookResult"
import { ValidationError } from "./errors/ValidationError"

export interface PreHook {
	name: string
	execute(context: HookContext): Promise<PreHookResult>
}

export interface PostHook {
	name: string
	execute(context: HookContext, result: unknown): Promise<PostHookResult>
}

export class HookEngine {
	private preHooks: Map<string, PreHook> = new Map()
	private postHooks: Map<string, PostHook> = new Map()
	private interceptors: Map<string, ToolInterceptor> = new Map()
	private activeIntentId: string | null = null

	/**
	 * Register a pre-tool-use hook
	 */
	registerPreHook(hook: PreHook): void {
		this.preHooks.set(hook.name, hook)
	}

	/**
	 * Register a post-tool-use hook
	 */
	registerPostHook(hook: PostHook): void {
		this.postHooks.set(hook.name, hook)
	}

	/**
	 * Register a tool interceptor for specific tool names
	 */
	registerInterceptor(toolName: string, interceptor: ToolInterceptor): void {
		this.interceptors.set(toolName, interceptor)
	}

	/**
	 * Set the currently active intent
	 */
	setActiveIntent(intentId: string): void {
		this.activeIntentId = intentId
	}

	/**
	 * Get the currently active intent
	 */
	getActiveIntent(): string | null {
		return this.activeIntentId
	}

	/**
	 * Execute pre-tool-use hooks and interceptors
	 * This is the main entry point for tool interception
	 */
	async executePreHooks(tool: ToolAction): Promise<PreHookResult> {
		const context: HookContext = {
			tool_name: tool.name,
			tool_args: tool.args,
			intent_id: this.activeIntentId || undefined,
			timestamp: new Date().toISOString(),
		}

		// Special handling for select_active_intent tool
		if (tool.name === "select_active_intent") {
			const intentId = tool.args.intent_id as string
			if (!intentId) {
				return {
					action: "block",
					shouldProceed: false,
					error: "intent_id is required for select_active_intent",
				}
			}
			// Set active intent and inject context
			this.setActiveIntent(intentId)
			return {
				action: "inject",
				shouldProceed: true,
				contextToInject: this.buildIntentContextBlock(intentId),
			}
		}

		// Check if intent is required for other tools
		if (!this.activeIntentId && this.requiresIntent(tool.name)) {
			return {
				action: "block",
				shouldProceed: false,
				error: "No active intent. Call select_active_intent first.",
			}
		}

		// Execute registered interceptors
		const interceptor = this.interceptors.get(tool.name)
		if (interceptor) {
			const result = await interceptor(tool, context)
			if (!result.shouldProceed) {
				return result as PreHookResult
			}
		}

		// Execute all registered pre-hooks
		for (const [, hook] of this.preHooks) {
			const result = await hook.execute(context)
			if (!result.shouldProceed) {
				return result
			}
		}

		return {
			action: "allow",
			shouldProceed: true,
		}
	}

	/**
	 * Execute post-tool-use hooks
	 */
	async executePostHooks(tool: ToolAction, result: unknown): Promise<PostHookResult> {
		const context: HookContext = {
			tool_name: tool.name,
			tool_args: tool.args,
			intent_id: this.activeIntentId || undefined,
			timestamp: new Date().toISOString(),
		}

		for (const [, hook] of this.postHooks) {
			const hookResult = await hook.execute(context, result)
			if (!hookResult.shouldProceed) {
				return hookResult
			}
		}

		return {
			action: "allow",
			shouldProceed: true,
		}
	}

	/**
	 * Build the intent context XML block for injection
	 */
	private buildIntentContextBlock(intentId: string): string {
		// This will be implemented to read from IntentStore
		return `<intent_context>
  <intent_id>${intentId}</intent_id>
  <status>active</status>
</intent_context>`
	}

	/**
	 * Determine if a tool requires an active intent
	 */
	private requiresIntent(toolName: string): boolean {
		const toolsRequiringIntent = ["write_file", "edit_file", "apply_diff", "execute_command"]
		return toolsRequiringIntent.includes(toolName)
	}
}

// Singleton instance
export const hookEngine = new HookEngine()
