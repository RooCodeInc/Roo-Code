import path from "path"
import fs from "fs/promises"
import { IToolHook, HookType, HookContext } from "../types"
import { fileExistsAtPath } from "../../utils/fs"

/**
 * Automates project governance by logging all intent-driven changes.
 */
export class TraceLoggingHook implements IToolHook {
	name = "TraceLoggingHook"
	type = HookType.POST

	async execute(context: HookContext): Promise<void> {
		const { task, toolName, intentId, arguments: toolArgs, timestamp, result, error } = context

		try {
			const logPath = path.join(task.cwd, ".orchestration", "agent_trace.jsonl")
			const entry = {
				timestamp,
				intentId: intentId || "NONE",
				tool: toolName,
				path: toolArgs.path || toolArgs.file_path || null,
				success: !error && !result?.includes("Access Denied"), // Hack for blocked hooks returning text errors
				error: error ? error.message : result?.includes("Access Denied") ? result : null,
			}

			const logLine = JSON.stringify(entry) + "\n"
			await fs.appendFile(logPath, logLine, "utf8")
		} catch (err) {
			console.error("Error writing to agent_trace.jsonl:", err)
		}
	}
}
