import crypto from "crypto"
import fs from "fs"
import path from "path"

export type MutationClass = "AST_REFACTOR" | "INTENT_EVOLUTION"

export interface TraceEntry {
	intent_id: string | null
	mutation_class: MutationClass
	path: string
	content_hash: string
	timestamp: string
	req_id?: string
}

/**
 * Utility for spatial hashing and trace serialization
 */
export class TraceLogger {
	private tracePath = ".orchestration/agent_trace.jsonl"
	private orchestrationDir = ".orchestration"

	/**
	 * Generate SHA-256 hash of content
	 */
	static hashContent(content: string): string {
		return crypto.createHash("sha256").update(content, "utf8").digest("hex")
	}

	/**
	 * Classify mutation based on change analysis
	 * - AST_REFACTOR: syntax-only changes within the same intent
	 * - INTENT_EVOLUTION: new features or expanded scope
	 */
	static classifyMutation(content: string, originalContent?: string, isNewFile?: boolean): MutationClass {
		// If it's a new file, classify as INTENT_EVOLUTION
		if (isNewFile) {
			return "INTENT_EVOLUTION"
		}

		// If no original content, default to INTENT_EVOLUTION
		if (!originalContent) {
			return "INTENT_EVOLUTION"
		}

		// Simple heuristic: if content length change > 20%, likely INTENT_EVOLUTION
		const originalLen = originalContent.length
		const newLen = content.length
		const percentChange = Math.abs((newLen - originalLen) / originalLen)

		if (percentChange > 0.2) {
			return "INTENT_EVOLUTION"
		}

		// Otherwise, classify as AST_REFACTOR (syntax/style changes)
		return "AST_REFACTOR"
	}

	/**
	 * Log a trace entry to agent_trace.jsonl
	 */
	logTrace(
		intentId: string | null,
		filePath: string,
		content: string,
		mutationClass: MutationClass,
		reqId?: string,
	): void {
		try {
			// Ensure orchestration directory exists
			if (!fs.existsSync(this.orchestrationDir)) {
				fs.mkdirSync(this.orchestrationDir, { recursive: true })
			}

			// Create trace entry
			const entry: TraceEntry = {
				intent_id: intentId,
				mutation_class: mutationClass,
				path: filePath,
				content_hash: TraceLogger.hashContent(content),
				timestamp: new Date().toISOString(),
				...(reqId && { req_id: reqId }),
			}

			// Append to JSONL file
			fs.appendFileSync(this.tracePath, JSON.stringify(entry) + "\n", "utf8")
		} catch (err) {
			console.warn("TraceLogger: failed to log trace", err)
		}
	}

	/**
	 * Read all trace entries from agent_trace.jsonl
	 */
	readTraces(): TraceEntry[] {
		if (!fs.existsSync(this.tracePath)) {
			return []
		}

		try {
			const content = fs.readFileSync(this.tracePath, "utf8")
			const lines = content.trim().split("\n").filter(Boolean)
			return lines.map((line) => JSON.parse(line) as TraceEntry)
		} catch (err) {
			console.warn("TraceLogger: failed to read traces", err)
			return []
		}
	}

	/**
	 * Query traces by intent_id
	 */
	getTracesByIntent(intentId: string): TraceEntry[] {
		return this.readTraces().filter((e) => e.intent_id === intentId)
	}
}
