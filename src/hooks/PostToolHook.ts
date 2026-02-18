import type { PostHookContext } from "./types"
import { TraceLogger } from "./TraceLogger"
import { ContentHasher } from "./ContentHasher"
import * as fs from "fs"
import * as path from "path"

export class PostToolHook {
	async execute(context: PostHookContext): Promise<void> {
		try {
			if (!context.toolName) {
				return
			}
			console.log(`[PostToolHook] Tool: ${context.toolName} completed`)

			const workspacePath = context.task.cwd
			const logger = new TraceLogger(workspacePath)

			const filePath = context.params?.path || context.params?.file_path

			// Enhanced trace with content hash and mutation classification
			let contentHash = "unknown"
			let mutationClass = "UNKNOWN"

			if (filePath) {
				const fullPath = path.join(workspacePath, filePath)
				if (fs.existsSync(fullPath)) {
					const newContent = fs.readFileSync(fullPath, "utf-8")
					contentHash = ContentHasher.hash(newContent)

					const preHash = (context.task as any).preWriteHash
					if (preHash && preHash !== contentHash) {
						const selectedIntentId = (context.task as any).selectedIntentId
						mutationClass = selectedIntentId ? "AST_REFACTOR" : "INTENT_EVOLUTION"
					} else if (!preHash) {
						mutationClass = "FILE_CREATION"
					}
				}
			}

			const selectedIntentId = (context.task as any).selectedIntentId
			await logger.log({
				toolName: context.toolName,
				filePath,
				contentHash,
				mutationClass,
				intentId: selectedIntentId || "none",
				result: context.result,
			})
		} catch (error) {
			console.error("[PostToolHook] Error:", error)
		}
	}
}
