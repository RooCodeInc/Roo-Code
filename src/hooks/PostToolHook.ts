import { TraceManager } from "./TraceManager"
import { IntentManager } from "./IntentManager"
import type { ToolExecutionContext, PostHookResult } from "./types"

/**
 * PostToolHook logs file write operations to agent_trace.jsonl after successful execution.
 * This provides traceability by linking code changes to their corresponding intents.
 */
export class PostToolHook {
	private traceManager: TraceManager
	private intentManager: IntentManager

	constructor(traceManager: TraceManager, intentManager: IntentManager) {
		this.traceManager = traceManager
		this.intentManager = intentManager
	}

	/**
	 * Gets the IntentManager instance, preferring the global one if available.
	 */
	private getIntentManager(): IntentManager {
		const globalIntentManager = (global as any).__intentManager as IntentManager | undefined
		return globalIntentManager || this.intentManager
	}

	/**
	 * Runs post-execution logging for file write operations.
	 * Only logs operations that were successful and have an active intent.
	 * @param context The tool execution context
	 * @param result The result from tool execution
	 * @returns Post-hook result
	 */
	async run(context: ToolExecutionContext, result: unknown): Promise<PostHookResult> {
		// Only log write operations
		if (context.toolName !== "write_to_file") {
			return { success: true }
		}

		// Get active intent ID
		const intentManager = this.getIntentManager()
		let activeIntentId: string | undefined = context.activeIntentId

		if (!activeIntentId) {
			// Fallback: try to get active intent from task
			const activeIntent = await intentManager.getActiveIntent(context.taskId)
			activeIntentId = activeIntent?.id
		}

		// Skip logging if no active intent
		if (!activeIntentId) {
			return { success: true }
		}

		// Get workspace root from context
		const workspaceRoot = context.workspacePath
		if (!workspaceRoot) {
			return { success: true, error: "No workspace root found in context" }
		}

		// Extract file path and content from tool params
		const filePath = context.toolParams.path as string | undefined
		const content = context.toolParams.content as string | undefined

		if (!filePath || content === undefined) {
			return { success: true, error: "Missing file path or content in tool params" }
		}

		try {
			// Create trace entry
			const traceEntry = await this.traceManager.createTraceEntry({
				intentId: activeIntentId,
				filePath,
				content,
				workspaceRoot,
				toolName: context.toolName,
			})

			// Append to trace log (non-blocking)
			await this.traceManager.appendTraceEntry(traceEntry)

			return {
				success: true,
				traceEntry,
			}
		} catch (error) {
			// Log error but don't block (non-blocking audit)
			console.error(`[PostToolHook] Failed to log trace entry:`, error)
			return {
				success: true, // Post-hooks never block
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}
}
