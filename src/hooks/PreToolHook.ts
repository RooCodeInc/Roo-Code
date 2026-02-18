import type { PreHookContext, PreHookResult } from "./types"
import { IntentManager } from "./IntentManager"
import { ContentHasher } from "./ContentHasher"
import * as fs from "fs"
import * as path from "path"

export class PreToolHook {
	async execute(context: PreHookContext): Promise<PreHookResult> {
		try {
			if (!context.toolName) {
				return { blocked: false }
			}
			console.log(`[PreToolHook] Tool: ${context.toolName}`)

			const writeTools = ["write_to_file", "apply_diff", "edit", "search_and_replace"]
			if (!writeTools.includes(context.toolName)) {
				return { blocked: false }
			}

			// Gatekeeper: Check if intent was selected
			const selectedIntentId = (context.task as any).selectedIntentId
			if (!selectedIntentId) {
				console.log("[PreToolHook] No intent selected - blocking write operation")
				return { blocked: true }
			}

			const workspacePath = context.task.cwd
			const intentManager = new IntentManager(workspacePath)
			const activeIntent = await intentManager.getActiveIntent()

			if (!activeIntent) {
				console.log("[PreToolHook] No active intent - allowing")
				return { blocked: false }
			}

			const filePath = context.params?.path || context.params?.file_path
			if (filePath && !intentManager.isFileInScope(filePath, activeIntent)) {
				console.log(`[PreToolHook] File ${filePath} out of scope - blocking`)
				return { blocked: true }
			}

			// Calculate content hash of current file for optimistic locking
			if (filePath) {
				const fullPath = path.join(context.task.cwd, filePath)
				if (fs.existsSync(fullPath)) {
					const currentContent = fs.readFileSync(fullPath, "utf-8")
					const currentHash = ContentHasher.hash(currentContent)
					// Store hash in task for PostToolHook to verify
					;(context.task as any).preWriteHash = currentHash
					console.log(`[PreToolHook] Pre-write hash: ${currentHash.substring(0, 12)}...`)
				}
			}

			return { blocked: false }
		} catch (error) {
			console.error("[PreToolHook] Error:", error)
			return { blocked: false }
		}
	}
}
