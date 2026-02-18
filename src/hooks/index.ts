/**
 * Hook System Integration
 *
 * This module provides functions to integrate the hook system
 * with the tool execution pipeline.
 */

import { getHookEngine } from "./HookEngine"
import { logTrace, classifyMutation } from "./TraceLogger"
import type { HookContext, MutationClass } from "./types"

/**
 * Execute a tool with Pre-Hook and Post-Hook
 *
 * @param context - The hook context
 * @param executeTool - The actual tool execution function
 * @param toolResult - The result of the tool execution (for Post-Hook)
 * @param mutationClass - Classification of the mutation
 * @returns The result of the tool execution, or an error if blocked
 */
export async function executeWithHooks(
	context: HookContext,
	executeTool: () => Promise<void>,
	toolResult: string,
	mutationClass: MutationClass = "UNKNOWN",
): Promise<{ success: boolean; error?: string }> {
	const hookEngine = getHookEngine()

	// Pre-Hook: Validate and potentially modify the execution
	const preResult = await hookEngine.preHook(context)

	if (!preResult.allowed) {
		return {
			success: false,
			error: preResult.errorMessage || "Execution blocked by Pre-Hook",
		}
	}

	// Execute the tool
	try {
		await executeTool()
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}

	// Post-Hook: Log the trace
	const postResult = await hookEngine.postHook(context, toolResult, mutationClass)

	if (!postResult.success) {
		console.warn("[HookSystem] Post-Hook warning:", postResult.errorMessage)
	}

	return { success: true }
}

/**
 * Initialize the hook engine for a new task
 */
export function initializeHookEngine(workspacePath: string, taskId: string, instanceId: string): void {
	const hookEngine = getHookEngine()
	hookEngine.initialize(workspacePath, taskId, instanceId)
}

/**
 * Reset the hook engine
 */
export function resetHookEngine(): void {
	const hookEngine = getHookEngine()
	hookEngine.reset()
}
