/**
 * Hook middleware for intercepting tool execution.
 *
 * This module provides the core interceptor functions that wrap tool execution:
 * - executePreToolUseHooks: Runs before a tool executes
 * - executePostToolUseHooks: Runs after a tool completes
 *
 * Hooks are composable and run in registration order. If any PreToolUse hook
 * returns `continue: false`, tool execution is aborted.
 */

import type { ToolName } from "@roo-code/types"
import type { ToolUse } from "../shared/tools"
import type { Task } from "../core/task/Task"
import type {
	HookResult,
	PreToolUseContext,
	PostToolUseContext,
	PreToolUseHook,
	PostToolUseHook,
	HookRegistry,
} from "./types"

/**
 * Global registry of hooks.
 * Hooks are registered via registerPreToolUseHook() and registerPostToolUseHook().
 */
const hookRegistry: HookRegistry = {
	preToolUseHooks: [],
	postToolUseHooks: [],
}

/**
 * Registers a PreToolUse hook to be executed before every tool call.
 *
 * @param hook - Function to execute before tool use
 * @returns Cleanup function to unregister the hook
 *
 * @example
 * const cleanup = registerPreToolUseHook(async (context) => {
 *   console.log(`Tool ${context.toolUse.name} about to execute`)
 *   return { continue: true }
 * })
 *
 * // Later, to unregister:
 * cleanup()
 */
export function registerPreToolUseHook(hook: PreToolUseHook): () => void {
	hookRegistry.preToolUseHooks.push(hook)

	// Return cleanup function
	return () => {
		const index = hookRegistry.preToolUseHooks.indexOf(hook)
		if (index > -1) {
			hookRegistry.preToolUseHooks.splice(index, 1)
		}
	}
}

/**
 * Registers a PostToolUse hook to be executed after every tool call.
 *
 * @param hook - Function to execute after tool use
 * @returns Cleanup function to unregister the hook
 *
 * @example
 * const cleanup = registerPostToolUseHook(async (context) => {
 *   console.log(`Tool ${context.toolUse.name} completed in ${context.duration}ms`)
 *   return { continue: true }
 * })
 */
export function registerPostToolUseHook(hook: PostToolUseHook): () => void {
	hookRegistry.postToolUseHooks.push(hook)

	// Return cleanup function
	return () => {
		const index = hookRegistry.postToolUseHooks.indexOf(hook)
		if (index > -1) {
			hookRegistry.postToolUseHooks.splice(index, 1)
		}
	}
}

/**
 * Executes all registered PreToolUse hooks before a tool runs.
 *
 * Hooks run in registration order. If any hook returns `continue: false`,
 * execution stops and the tool is not invoked.
 *
 * @param task - The Task instance executing the tool
 * @param toolUse - The tool_use block from the LLM
 * @param params - Parsed parameters for the tool
 * @returns Aggregated result from all hooks
 *
 * @example
 * const result = await executePreToolUseHooks(task, toolUse, params)
 * if (!result.continue) {
 *   // Abort tool execution
 *   return result.reason
 * }
 * // Use result.modifiedParams if provided
 * const finalParams = result.modifiedParams || params
 */
export async function executePreToolUseHooks<TName extends ToolName>(
	task: Task,
	toolUse: ToolUse<TName>,
	params: Record<string, unknown>,
): Promise<HookResult> {
	// TODO: Implementation for Phase 1
	// For now, return a pass-through result

	const context: PreToolUseContext<TName> = {
		task,
		toolUse,
		params,
		timestamp: Date.now(),
		cwd: task.cwd,
	}

	// Aggregated result
	let aggregatedResult: HookResult = {
		continue: true,
	}

	// Execute hooks in sequence
	for (const hook of hookRegistry.preToolUseHooks) {
		try {
			const result = await hook(context)

			// If any hook says "don't continue", stop
			if (!result.continue) {
				return result
			}

			// Merge modified params (last hook wins)
			if (result.modifiedParams) {
				aggregatedResult.modifiedParams = result.modifiedParams
			}

			// Accumulate context to inject
			if (result.contextToInject) {
				aggregatedResult.contextToInject =
					(aggregatedResult.contextToInject || "") + "\n" + result.contextToInject
			}
		} catch (error) {
			// Hook errors should not break tool execution
			console.error(`PreToolUse hook failed:`, error)
		}
	}

	return aggregatedResult
}

/**
 * Executes all registered PostToolUse hooks after a tool completes.
 *
 * Hooks run in registration order. Unlike PreToolUse hooks, these cannot
 * prevent the tool from executing (it already did), but can trigger side
 * effects like logging, analytics, or follow-up actions.
 *
 * @param task - The Task instance that executed the tool
 * @param toolUse - The tool_use block from the LLM
 * @param params - Parameters that were passed to the tool
 * @param result - Result returned by the tool
 * @param success - Whether the tool succeeded
 * @param error - Error object if the tool failed
 * @param startTime - When the tool started executing
 * @returns Aggregated result from all hooks
 *
 * @example
 * const startTime = Date.now()
 * try {
 *   const result = await executeTool(params)
 *   await executePostToolUseHooks(task, toolUse, params, result, true, undefined, startTime)
 * } catch (error) {
 *   await executePostToolUseHooks(task, toolUse, params, null, false, error, startTime)
 * }
 */
export async function executePostToolUseHooks<TName extends ToolName>(
	task: Task,
	toolUse: ToolUse<TName>,
	params: Record<string, unknown>,
	result: unknown,
	success: boolean,
	error?: Error,
	startTime?: number,
): Promise<HookResult> {
	// TODO: Implementation for Phase 1

	const endTime = Date.now()
	const context: PostToolUseContext<TName> = {
		task,
		toolUse,
		params,
		result,
		success,
		error,
		startTime: startTime || endTime,
		endTime,
		duration: endTime - (startTime || endTime),
	}

	// Aggregated result
	let aggregatedResult: HookResult = {
		continue: true,
	}

	// Execute hooks in sequence
	for (const hook of hookRegistry.postToolUseHooks) {
		try {
			const result = await hook(context)

			// Accumulate context to inject
			if (result.contextToInject) {
				aggregatedResult.contextToInject =
					(aggregatedResult.contextToInject || "") + "\n" + result.contextToInject
			}
		} catch (error) {
			// Hook errors should not break the tool flow
			console.error(`PostToolUse hook failed:`, error)
		}
	}

	return aggregatedResult
}

/**
 * Clears all registered hooks. Useful for testing or resetting state.
 */
export function clearAllHooks(): void {
	hookRegistry.preToolUseHooks = []
	hookRegistry.postToolUseHooks = []
}

/**
 * Gets the current hook registry (for testing/debugging).
 * @internal
 */
export function getHookRegistry(): Readonly<HookRegistry> {
	return hookRegistry
}
