import path from "path"
import fs from "fs/promises"
import crypto from "crypto"
import { IToolHook, HookType, HookContext, HookResponse } from "../types"

/**
 * Enforces optimistic locking by blocking writes if the file has changed on disk
 * since it was last read by this agent session.
 */
export class ConcurrencyPreHook implements IToolHook {
	name = "ConcurrencyPreHook"
	type = HookType.PRE

	async execute(context: HookContext): Promise<HookResponse | void> {
		const { task, toolName, arguments: toolArgs } = context

		if (toolName === "write_to_file" || toolName === "apply_diff") {
			const filePath = (toolArgs.path || toolArgs.file_path) as string
			if (!filePath) return

			const absolutePath = path.resolve(task.cwd, filePath)
			const storedHash = task.intentController.getReadHash(absolutePath)

			// If we haven't read this file yet in this session, we don't have a "read hash"
			// This might happen if the agent assumes the file content or it's a new file.
			if (!storedHash) {
				return
			}

			try {
				const currentContent = await fs.readFile(absolutePath, "utf8")
				const currentHash = crypto.createHash("sha256").update(currentContent).digest("hex")

				if (currentHash !== storedHash) {
					return {
						allow: false,
						reason: `Stale File Error: File '${filePath}' has been modified by another agent or user since you last read it. You MUST re-read the file using 'read_file' to synchronize your state before attempting to write.`,
					}
				}
			} catch (error) {
				// If file doesn't exist, it's not a collision (it might be a new file being created)
				// or some other error happened - let the original tool handle it.
			}
		}
	}
}
