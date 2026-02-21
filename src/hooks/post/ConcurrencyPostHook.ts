import crypto from "crypto"
import { IToolHook, HookType, HookContext } from "../types"

/**
 * Records the hash of files when they are read by the agent to enable optimistic locking.
 */
export class ConcurrencyPostHook implements IToolHook {
	name = "ConcurrencyPostHook"
	type = HookType.POST

	async execute(context: HookContext): Promise<void> {
		const { task, toolName, arguments: toolArgs, result, error } = context

		// If the tool failed, don't record anything
		if (error) return

		if (toolName === "read_file") {
			const filePath = toolArgs.path as string
			const content = result as string
			if (!filePath || typeof content !== "string") return

			const hash = crypto.createHash("sha256").update(content).digest("hex")
			task.intentController.recordReadHash(filePath, hash)
		}
	}
}
