import * as fs from "fs"
import * as path from "path"

export interface TraceFile {
	relative_path: string
	content_hash: string
	contributor: {
		entity_type: "AI" | "HUMAN"
		model_identifier?: string
	}
	start_line?: number
	end_line?: number
}

export interface TraceEntry {
	id: string
	timestamp: string
	intent_id: string
	tool: string
	mutation_class: "AST_REFACTOR" | "INTENT_EVOLUTION" | "SAFE_READ" | "CONFIG_CHANGE"
	files: TraceFile[]
	git_sha?: string
}

/**
 * TraceLogger appends structured entries to agent_trace.jsonl.
 * This is the immutable audit ledger linking Intent IDs to code mutations.
 * Each line is a valid JSON object (JSONL format).
 */
export class TraceLogger {
	private readonly filePath: string

	constructor(orchestrationDir: string) {
		this.filePath = path.join(orchestrationDir, "agent_trace.jsonl")
	}

	async appendTrace(entry: TraceEntry): Promise<void> {
		const line = JSON.stringify(entry) + "\n"
		fs.appendFileSync(this.filePath, line, "utf-8")
	}

	async readAll(): Promise<TraceEntry[]> {
		try {
			const raw = fs.readFileSync(this.filePath, "utf-8")
			return raw
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line) as TraceEntry)
		} catch {
			return []
		}
	}

	async getEntriesForIntent(intentId: string): Promise<TraceEntry[]> {
		const all = await this.readAll()
		return all.filter((e) => e.intent_id === intentId)
	}
}
