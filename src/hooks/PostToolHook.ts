import * as path from "path"
import * as fs from "fs/promises"

import { TraceManager } from "./TraceManager"
import { IntentManager } from "./IntentManager"
import type { ToolExecutionContext, PostHookResult, MutationClass } from "./types"

const MUTATION_TOOLS = new Set(["write_to_file", "edit_file"])

/**
 * PostToolHook logs file write operations to agent_trace.jsonl after successful execution.
 * Supports write_to_file and edit_file. Updates file state lock store after write for optimistic locking.
 */
export class PostToolHook {
	private traceManager: TraceManager
	private intentManager: IntentManager

	constructor(traceManager: TraceManager, intentManager: IntentManager) {
		this.traceManager = traceManager
		this.intentManager = intentManager
	}

	private getIntentManager(): IntentManager {
		const globalIntentManager = (global as any).__intentManager as IntentManager | undefined
		return globalIntentManager || this.intentManager
	}

	private getMutationClassFromPreHook(taskId: string, filePath: string): MutationClass | undefined {
		const map = (global as any).__lastWriteMutationByPath as Record<string, MutationClass> | undefined
		return map?.[`${taskId}:${filePath}`]
	}

	async run(context: ToolExecutionContext, result: unknown): Promise<PostHookResult> {
		if (!MUTATION_TOOLS.has(context.toolName)) {
			return { success: true }
		}

		const intentManager = this.getIntentManager()
		let activeIntentId: string | undefined = context.activeIntentId
		if (!activeIntentId) {
			const activeIntent = await intentManager.getActiveIntent(context.taskId)
			activeIntentId = activeIntent?.id
		}
		if (!activeIntentId) {
			return { success: true }
		}

		const workspaceRoot = context.workspacePath
		if (!workspaceRoot) {
			return { success: true, error: "No workspace root found in context" }
		}

		const filePath = (context.toolParams.path as string) || (context.toolParams.file_path as string)
		if (!filePath) {
			return { success: true, error: "Missing file path in tool params" }
		}

		let content: string | undefined = context.toolParams.content as string | undefined
		if (context.toolName === "edit_file" && content === undefined) {
			try {
				const absolutePath = path.resolve(workspaceRoot, filePath)
				content = await fs.readFile(absolutePath, "utf-8")
			} catch (err) {
				return { success: true, error: "Could not read file for trace after edit_file" }
			}
		}
		if (content === undefined) {
			return { success: true, error: "Missing file path or content in tool params" }
		}

		try {
			const mutationClass = this.getMutationClassFromPreHook(context.taskId, filePath)
			const traceEntry = await this.traceManager.createTraceEntry({
				intentId: activeIntentId,
				filePath,
				content,
				workspaceRoot,
				toolName: context.toolName,
				mutationClass,
			})
			await this.traceManager.appendTraceEntry(traceEntry)

			// Update file state lock so next write is not incorrectly flagged as stale
			const store = (global as any).__fileStateLockStore as
				| { update(filePath: string, content: string): void }
				| undefined
			if (store) {
				store.update(filePath, content)
			}

			return { success: true, traceEntry }
		} catch (error) {
			console.error(`[PostToolHook] Failed to log trace entry:`, error)
			return {
				success: true,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}
}
