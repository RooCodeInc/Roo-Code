import type { PreHookContext, PreHookResult } from "./types"
import { IntentManager } from "./IntentManager"

export class PreToolHook {
	async execute(context: PreHookContext): Promise<PreHookResult> {
		try {
			console.log(`[PreToolHook] Tool: ${context.toolName}`)

			const writeTools = ["write_to_file", "apply_diff", "edit", "search_and_replace"]
			if (!writeTools.includes(context.toolName)) {
				return { blocked: false }
			}

			const workspacePath = context.task.cwd
			const intentManager = new IntentManager(workspacePath)
			const activeIntent = await intentManager.getActiveIntent()

			if (!activeIntent) {
				console.log("[PreToolHook] No active intent - allowing")
				return { blocked: false }
			}

			const filePath = context.params.path || context.params.file_path
			if (filePath && !intentManager.isFileInScope(filePath, activeIntent)) {
				console.log(`[PreToolHook] File ${filePath} out of scope - blocking`)
				return { blocked: true }
			}

			return { blocked: false }
		} catch (error) {
			console.error("[PreToolHook] Error:", error)
			return { blocked: false }
		}
	}
}
