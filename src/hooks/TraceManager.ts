import * as path from "path"
import * as fs from "fs/promises"
import * as crypto from "crypto"
import { OrchestrationStorage } from "./OrchestrationStorage"
import type { TraceLogEntry, MutationClass, SpecTraceLogEntry, TraceClassification } from "./types"

/**
 * TraceManager handles logging of file write operations to agent_trace.jsonl.
 * It creates trace entries with complete metadata including intent ID, content hash,
 * file path, mutation class, and timestamp.
 */
export class TraceManager {
	constructor(private storage: OrchestrationStorage) {}

	/**
	 * Determines the mutation class (CREATE or MODIFY) by checking if the file exists.
	 * @param filePath Relative path from workspace root
	 * @param workspaceRoot Absolute path to workspace root
	 * @returns "CREATE" if file doesn't exist, "MODIFY" if it exists
	 */
	async determineMutationClass(filePath: string, workspaceRoot: string): Promise<MutationClass> {
		const absolutePath = path.resolve(workspaceRoot, filePath)

		try {
			await fs.access(absolutePath)
			return "MODIFY"
		} catch {
			return "CREATE"
		}
	}

	/**
	 * Computes SHA256 content hash from raw file bytes without normalization.
	 * @param content File content as string (will be converted to bytes)
	 * @returns SHA256 hash as hex string (64 characters)
	 */
	computeContentHash(content: string): string {
		const hash = crypto.createHash("sha256")
		hash.update(Buffer.from(content, "utf-8"))
		return hash.digest("hex")
	}

	/**
	 * Creates a trace log entry for a file write operation.
	 * @param params Parameters for creating the trace entry
	 * @returns The created trace log entry
	 */
	async createTraceEntry(params: {
		intentId: string
		filePath: string
		content: string
		workspaceRoot: string
		toolName: string
		mutationClass?: MutationClass
		lineRanges?: Array<{ start: number; end: number }>
		gitSha?: string
	}): Promise<TraceLogEntry> {
		const mutationClass =
			params.mutationClass ?? (await this.determineMutationClass(params.filePath, params.workspaceRoot))
		const contentHash = this.computeContentHash(params.content)
		const timestamp = new Date().toISOString()

		return {
			intentId: params.intentId,
			contentHash,
			filePath: params.filePath,
			mutationClass,
			lineRanges: params.lineRanges,
			timestamp,
			toolName: params.toolName,
			gitSha: params.gitSha,
		}
	}

	/**
	 * Converts internal trace entry to spec-aligned format for agent_trace.jsonl.
	 */
	private toSpecEntry(entry: TraceLogEntry): SpecTraceLogEntry {
		const classification: TraceClassification =
			entry.mutationClass === "CREATE" ? "INTENT_EVOLUTION" : "AST_REFACTOR"
		return {
			timestamp: entry.timestamp,
			intent_id: entry.intentId,
			operation: "WRITE",
			file_path: entry.filePath,
			content_hash: `sha256:${entry.contentHash}`,
			classification,
		}
	}

	/**
	 * Appends a trace log entry to agent_trace.jsonl in spec-aligned format.
	 * Uses workspaceRoot when provided so the trace is written to the task's workspace .orchestration folder.
	 * @param entry The trace log entry to append
	 * @param workspaceRoot Optional workspace root; when provided, write to workspaceRoot/.orchestration/agent_trace.jsonl
	 */
	async appendTraceEntry(entry: TraceLogEntry, workspaceRoot?: string): Promise<void> {
		try {
			const traceFilePath = "agent_trace.jsonl"
			const specEntry = this.toSpecEntry(entry)
			const jsonLine = JSON.stringify(specEntry) + "\n"
			await this.storage.appendFile(traceFilePath, jsonLine, workspaceRoot)
		} catch (error) {
			console.error(`[TraceManager] Failed to append trace entry for ${entry.filePath}:`, error)
		}
	}
}
