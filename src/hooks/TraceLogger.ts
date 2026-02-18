import fs from "fs/promises"
import path from "path"

interface TraceEvent {
	ts: string
	task_id: string
	intent_id?: string
	tool_use_id?: string
	tool_name: string
	params: Partial<Record<string, string | undefined>>
	status: "success" | "denied" | "error"
	reason?: string
}

export class TraceLogger {
	private readonly traceDir = ".roo"
	private readonly traceFileName = "agent_trace.jsonl"

	async append(cwd: string, event: TraceEvent): Promise<void> {
		const directoryPath = path.join(cwd, this.traceDir)
		const filePath = path.join(directoryPath, this.traceFileName)
		await fs.mkdir(directoryPath, { recursive: true })
		await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8")
	}
}
