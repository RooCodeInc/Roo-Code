import * as fs from "fs"
import * as path from "path"
import { createHash } from "crypto"
import { ToolHookContext, ToolCall } from "../types"

export class TraceSerializer {
	private static traceFilePath = ".orchestration/agent_trace.jsonl"

	static computeContentHash(content: string): string {
		return createHash("sha256").update(content, "utf8").digest("hex")
	}

	static async appendTrace(toolCall: ToolCall, result: unknown, context: ToolHookContext): Promise<void> {
		const content = (toolCall.parameters.content || toolCall.parameters.text || "") as string
		const filePath = (toolCall.parameters.file_path || toolCall.parameters.path || toolCall.parameters.file) as
			| string
			| undefined

		if (!filePath) {
			return
		}

		const traceEntry = {
			id: this.generateUUID(),
			timestamp: new Date().toISOString(),
			vcs: {
				revision_id: await this.getCurrentGitSha(context.workspacePath),
			},
			files: [
				{
					relative_path: filePath,
					conversations: [
						{
							url: context.sessionId,
							contributor: {
								entity_type: "AI",
								model_identifier: context.modelName,
							},
							ranges: [
								{
									start_line: (toolCall.parameters.start_line as number) || 1,
									end_line: (toolCall.parameters.end_line as number) || -1,
									content_hash: this.computeContentHash(content),
								},
							],
							related: [
								{
									type: "specification",
									value: context.activeIntentId || "UNKNOWN",
								},
							],
						},
					],
				},
			],
		}

		const tracePath = path.join(context.workspacePath, this.traceFilePath)
		const line = JSON.stringify(traceEntry) + "\n"

		fs.appendFileSync(tracePath, line, "utf8")
	}

	private static generateUUID(): string {
		if (typeof crypto !== "undefined" && crypto.randomUUID) {
			return crypto.randomUUID()
		}
		return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
	}

	private static async getCurrentGitSha(workspacePath: string): Promise<string> {
		try {
			const { execSync } = require("child_process")
			return execSync("git rev-parse HEAD", { cwd: workspacePath, encoding: "utf8" }).trim()
		} catch {
			return "pending_git_integration"
		}
	}
}
