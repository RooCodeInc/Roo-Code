import type { PostHookContext } from "./types"
import { TraceLogger } from "./TraceLogger"

export class PostToolHook {
	async execute(context: PostHookContext): Promise<void> {
		try {
			console.log(`[PostToolHook] Tool: ${context.toolName} completed`)

			const workspacePath = context.task.cwd
			const logger = new TraceLogger(workspacePath)

			const filePath = context.params.path || context.params.file_path
			await logger.log({
				toolName: context.toolName,
				filePath,
				result: context.result,
			})
		} catch (error) {
			console.error("[PostToolHook] Error:", error)
		}
	}
}
