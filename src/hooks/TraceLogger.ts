import * as fs from "fs/promises"
import * as path from "path"
import { contentHash } from "./utils"

export class TraceLogger {
	private workspaceRoot: string
	private tracePath: string

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot
		this.tracePath = path.join(workspaceRoot, ".orchestration", "agent_trace.jsonl")
	}

	async logWrite(intentId: string, filePath: string, startLine: number, endLine: number) {
		const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.workspaceRoot, filePath)
		const content = await fs.readFile(fullPath, "utf8")
		const lines = content.split("\n")
		const block = lines.slice(startLine - 1, endLine).join("\n")
		const hash = contentHash(block)

		const entry = {
			id: crypto.randomUUID(),
			timestamp: new Date().toISOString(),
			vcs: { revision_id: "pending-git-sha" },
			files: [
				{
					relative_path: filePath,
					conversations: [
						{
							url: "roo-session",
							contributor: { entity_type: "AI", model_identifier: "claude-3-5-sonnet" },
							ranges: [{ start_line: startLine, end_line: endLine, content_hash: hash }],
							related: [{ type: "specification", value: intentId }],
						},
					],
				},
			],
		}

		await fs.appendFile(this.tracePath, JSON.stringify(entry) + "\n")
	}
}
