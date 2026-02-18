import fs from "fs/promises"
import path from "path"
import { ContentHasher } from "./ContentHasher"

interface TraceEntry {
	timestamp: string
	toolName: string
	filePath?: string
	contentHash?: string
	mutationClass?: string
	intentId?: string
	result: string
}

export class TraceLogger {
	private traceFilePath: string

	constructor(workspacePath: string) {
		this.traceFilePath = path.join(workspacePath, ".orchestration", "agent_trace.jsonl")
	}

	async log(entry: Omit<TraceEntry, "timestamp">): Promise<void> {
		try {
			const fullEntry: TraceEntry = {
				timestamp: new Date().toISOString(),
				...entry,
			}

			const line = JSON.stringify(fullEntry) + "\n"
			await fs.mkdir(path.dirname(this.traceFilePath), { recursive: true })
			await fs.appendFile(this.traceFilePath, line, "utf-8")
		} catch (error) {
			console.error("[TraceLogger] Failed to log:", error)
		}
	}
}
