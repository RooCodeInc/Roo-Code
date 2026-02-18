import type { ToolExecutionContext, PreHookResult, PostHookResult } from "./types"

export type PreHookFunction = (context: ToolExecutionContext) => Promise<PreHookResult>
export type PostHookFunction = (context: ToolExecutionContext, result: unknown) => Promise<PostHookResult>

/**
 * HookEngine is the main middleware coordinator for tool execution.
 * It manages pre-execution and post-execution hooks that intercept tool calls
 * to enforce governance, validation, and traceability.
 */
export class HookEngine {
	private preHooks: PreHookFunction[] = []
	private postHooks: PostHookFunction[] = []

	/**
	 * Registers a pre-execution hook.
	 * Pre-hooks are executed before tool execution and can block the operation.
	 * @param hook The pre-hook function to register
	 */
	registerPreHook(hook: PreHookFunction): void {
		this.preHooks.push(hook)
	}

	/**
	 * Registers a post-execution hook.
	 * Post-hooks are executed after tool execution and cannot block the operation.
	 * @param hook The post-hook function to register
	 */
	registerPostHook(hook: PostHookFunction): void {
		this.postHooks.push(hook)
	}

	/**
	 * Executes all registered pre-hooks in order.
	 * If any pre-hook returns allowed=false, execution stops and the error is returned.
	 * @param context The tool execution context
	 * @returns Pre-hook validation result
	 */
	async executePreHooks(context: ToolExecutionContext): Promise<PreHookResult> {
		for (const hook of this.preHooks) {
			try {
				const result = await hook(context)
				if (!result.allowed) {
					// First hook that blocks stops execution
					return {
						allowed: false,
						error: result.error || "Operation blocked by pre-hook",
						modifiedParams: result.modifiedParams,
					}
				}
				// If hook modified params, update context for next hook
				if (result.modifiedParams) {
					context.toolParams = { ...context.toolParams, ...result.modifiedParams }
				}
			} catch (error) {
				// Pre-hook errors block execution
				return {
					allowed: false,
					error: `Pre-hook error: ${error instanceof Error ? error.message : String(error)}`,
				}
			}
		}

		// All pre-hooks passed
		return { allowed: true }
	}

	/**
	 * Executes all registered post-hooks in order.
	 * Post-hooks are executed even if previous ones fail (non-blocking).
	 * @param context The tool execution context
	 * @param result The result from tool execution
	 * @returns Post-hook execution result
	 */
	async executePostHooks(context: ToolExecutionContext, result: unknown): Promise<PostHookResult> {
		let lastError: string | undefined
		let traceEntry: PostHookResult["traceEntry"]

		for (const hook of this.postHooks) {
			try {
				const hookResult = await hook(context, result)
				if (hookResult.traceEntry) {
					traceEntry = hookResult.traceEntry
				}
				if (hookResult.error) {
					lastError = hookResult.error
				}
			} catch (error) {
				// Post-hook errors are logged but don't block
				lastError = `Post-hook error: ${error instanceof Error ? error.message : String(error)}`
				console.error(`[HookEngine] Post-hook error:`, error)
			}
		}

		return {
			success: true, // Post-hooks never block execution
			error: lastError,
			traceEntry,
		}
	}

	/**
	 * Clears all registered hooks.
	 * Useful for testing or resetting the hook engine.
	 */
	clearHooks(): void {
		this.preHooks = []
		this.postHooks = []
	}
}
