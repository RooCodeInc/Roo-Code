import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"

import { sha256 } from "./concurrencyGuard"

export interface AgentTraceRecord {
	trace_id: string
	timestamp: string
	intent_id: string | null
	tool_name: string
	args_summary: string
	args_hash: string
	approved: boolean | null
	decision_reason: string
	status: "success" | "failure" | "blocked"
	duration_ms: number
	error_message?: string
	security_class: "SAFE" | "WRITE" | "DESTRUCTIVE"
	mutation_class?: string
	file_path?: string
	content_hash?: string
	read_hash?: string | null
	write_hash?: string | null
	related: string[]
	agent: {
		task_id: string
	}
	vcs: {
		branch?: string
		commit?: string
	}
}

function tracePath(cwd: string): string {
	return path.join(cwd, ".orchestration", "agent_trace.jsonl")
}

export function summarizeArgs(args: Record<string, unknown>): string {
	const raw = JSON.stringify(args ?? {})
	if (!raw) {
		return ""
	}
	return raw.length <= 500 ? raw : `${raw.slice(0, 497)}...`
}

export function hashArgs(args: Record<string, unknown>): string {
	return sha256(JSON.stringify(args ?? {}))
}

export function buildTraceRecord(input: Omit<AgentTraceRecord, "trace_id" | "timestamp">): AgentTraceRecord {
	return {
		trace_id: randomUUID(),
		timestamp: new Date().toISOString(),
		...input,
	}
}

export async function appendTraceRecord(cwd: string, record: AgentTraceRecord): Promise<void> {
	const target = tracePath(cwd)
	await fs.mkdir(path.dirname(target), { recursive: true })
	await fs.appendFile(target, `${JSON.stringify(record)}\n`, "utf-8")
}
