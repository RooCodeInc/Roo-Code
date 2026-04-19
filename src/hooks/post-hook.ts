import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"

import type { AgentTraceEntry, AgentTraceFileEntry, AgentTraceConversation, MutationClass } from "./types"
import { contentHash, contentHashForRange } from "./content-hash"

const ORCHESTRATION_DIR = ".orchestration"
const AGENT_TRACE_FILE = "agent_trace.jsonl"

export interface PostHookWriteParams {
	relativePath: string
	content: string
	intentId: string | null
	mutationClass?: MutationClass
	/** REQ-ID from Phase 1 - injected into related array for traceability */
	reqId?: string
	sessionLogId?: string
	modelIdentifier?: string
	vcsRevisionId?: string
}

/**
 * Post-Hook: after a successful write_to_file, append an entry to agent_trace.jsonl
 * linking the file (and content hash) to the intent.
 */
export async function appendAgentTrace(cwd: string, params: PostHookWriteParams): Promise<void> {
	const {
		relativePath,
		content,
		intentId,
		mutationClass = "UNKNOWN",
		reqId,
		sessionLogId,
		modelIdentifier = "unknown",
		vcsRevisionId,
	} = params

	const dir = path.join(cwd, ORCHESTRATION_DIR)
	await fs.mkdir(dir, { recursive: true })
	const tracePath = path.join(dir, AGENT_TRACE_FILE)

	const lines = content.split("\n")
	const fullRangeHash = contentHash(content)
	const related: Array<{ type: string; value: string }> = []
	if (intentId) related.push({ type: "specification", value: intentId })
	if (reqId) related.push({ type: "request", value: reqId })

	const conversation: AgentTraceConversation = {
		url: sessionLogId,
		contributor: { entity_type: "AI", model_identifier: modelIdentifier },
		ranges: [{ start_line: 1, end_line: lines.length, content_hash: fullRangeHash }],
		related,
	}

	const fileEntry: AgentTraceFileEntry = {
		relative_path: relativePath,
		conversations: [conversation],
	}

	const entry: AgentTraceEntry = {
		id: randomUUID(),
		timestamp: new Date().toISOString(),
		vcs: vcsRevisionId ? { revision_id: vcsRevisionId } : undefined,
		files: [fileEntry],
	}

	const line = JSON.stringify(entry) + "\n"
	await fs.appendFile(tracePath, line)
}

/**
 * Compute content hash for a modified block (e.g. after apply_diff).
 * Use when you have start_line/end_line and full file content.
 */
export function computeRangeHash(content: string, startLine: number, endLine: number): string {
	return contentHashForRange(content, startLine, endLine)
}
