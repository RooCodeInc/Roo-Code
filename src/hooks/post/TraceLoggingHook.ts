import path from "path"
import fs from "fs/promises"
import crypto from "crypto"
import { v4 as uuidv4 } from "uuid"
import { execa } from "execa"
import { IToolHook, HookType, HookContext } from "../types"

import { getModelId } from "@roo-code/types"

/**
 * Automates project governance by logging all intent-driven changes with high fidelity.
 */
export class TraceLoggingHook implements IToolHook {
	name = "TraceLoggingHook"
	type = HookType.POST

	async execute(context: HookContext): Promise<void> {
		const { task, toolName, intentId, arguments: toolArgs, timestamp, result, error } = context

		// Only log mutating actions for the advanced ledger
		const isMutating = toolName === "write_to_file" || toolName === "apply_diff" || toolName === "execute_command"
		if (!isMutating) {
			return
		}

		try {
			const logPath = path.join(task.cwd, ".orchestration", "agent_trace.jsonl")

			// Get current Git revision
			let revisionId = "UNKNOWN"
			try {
				const { stdout } = await execa("git", ["rev-parse", "HEAD"], { cwd: task.cwd })
				revisionId = stdout.trim()
			} catch (gitErr) {
				// Fallback if not a git repo
			}

			// Generate content hash and ranges for file writes
			const files: any[] = []
			if (toolName === "write_to_file" || toolName === "apply_diff") {
				const filePath = (toolArgs.path || toolArgs.file_path) as string
				const absolutePath = path.resolve(task.cwd, filePath)

				try {
					const content = await fs.readFile(absolutePath, "utf8")
					const hash = crypto.createHash("sha256").update(content).digest("hex")
					const lineCount = content.split("\n").length

					// Heuristic for range: for write_to_file it's the whole file
					// For apply_diff, we could parse the diff, but for now we'll use the whole file
					// or specific lines if we can extract them. Let's use 1 to lineCount as a safe default.
					let startLine = 1
					let endLine = lineCount

					// Try to extract range from diff if it's apply_diff
					if (toolName === "apply_diff" && toolArgs.diff) {
						const match = toolArgs.diff.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
						if (match) {
							startLine = parseInt(match[2], 10)
							// Fallback endLine to lineCount or estimate from diff
						}
					}

					files.push({
						relative_path: filePath,
						conversations: [
							{
								url: task.taskId,
								contributor: {
									entity_type: "AI",
									model_identifier: getModelId(task.apiConfiguration) || "claude-3-5-sonnet",
								},
								ranges: [
									{
										start_line: startLine,
										end_line: endLine,
										content_hash: `sha256:${hash}`,
									},
								],
								related: intentId ? [{ type: "specification", value: intentId }] : [],
							},
						],
					})
				} catch (fileErr) {
					console.error(`Error reading file for trace logging: ${filePath}`, fileErr)
				}
			}

			const entry = {
				id: uuidv4(),
				timestamp,
				classification: toolName === "apply_diff" ? "AST_REFACTOR" : "FILE_WRITE",
				vcs: { revision_id: revisionId },
				files: files.length > 0 ? files : undefined,
			}

			const logLine = JSON.stringify(entry) + "\n"
			await fs.appendFile(logPath, logLine, "utf8")
		} catch (err) {
			console.error("Error writing to agent_trace.jsonl:", err)
		}
	}
}
