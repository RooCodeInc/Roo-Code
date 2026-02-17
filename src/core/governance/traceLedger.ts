import crypto from "crypto"
import fs from "fs/promises"
import path from "path"

import { getWorkspacePath } from "../../utils/path"

import type { GovernanceTraceRecord } from "./types"

const ORCHESTRATION_DIR = ".orchestration"
const TRACE_FILE = "agent_trace.jsonl"

function getWorkspaceRoot(fallbackCwd?: string): string {
	return getWorkspacePath(fallbackCwd ?? process.cwd())
}

function getTraceFilePath(workspaceRoot: string): string {
	return path.join(workspaceRoot, ORCHESTRATION_DIR, TRACE_FILE)
}

export function computeSha256(value: string): string {
	return crypto.createHash("sha256").update(value, "utf-8").digest("hex")
}

export function summarizeArgs(args: unknown): string {
	const raw = JSON.stringify(args ?? {})
	if (!raw) {
		return ""
	}
	if (raw.length <= 400) {
		return raw
	}
	return `${raw.slice(0, 397)}...`
}

export function hashArgs(args: unknown): string {
	return computeSha256(JSON.stringify(args ?? {}))
}

export async function appendTraceRecord(record: GovernanceTraceRecord, fallbackCwd?: string): Promise<void> {
	const workspaceRoot = getWorkspaceRoot(fallbackCwd)
	const tracePath = getTraceFilePath(workspaceRoot)
	await fs.mkdir(path.dirname(tracePath), { recursive: true })
	await fs.appendFile(tracePath, `${JSON.stringify(record)}\n`, "utf-8")
}

