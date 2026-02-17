import fs from "fs/promises"
import path from "path"

import type { GovernanceStatus } from "@roo-code/types"

import { loadIntentCatalog } from "./intentLoader"

function orchestrationPath(cwd: string, filename: string): string {
	return path.join(cwd, ".orchestration", filename)
}

async function readActiveIntentId(cwd: string): Promise<string | undefined> {
	try {
		const raw = await fs.readFile(orchestrationPath(cwd, "active_intent.json"), "utf-8")
		const parsed = JSON.parse(raw) as { intent_id?: string }
		return typeof parsed.intent_id === "string" && parsed.intent_id.length > 0 ? parsed.intent_id : undefined
	} catch {
		return undefined
	}
}

async function readLastTraceRecord(
	cwd: string,
): Promise<{ timestamp?: string; status?: "success" | "failure" | "blocked"; tool_name?: string } | undefined> {
	const traceFile = orchestrationPath(cwd, "agent_trace.jsonl")
	try {
		const file = await fs.open(traceFile, "r")
		try {
			const stat = await file.stat()
			if (stat.size <= 0) {
				return undefined
			}
			const chunkSize = Math.min(stat.size, 64 * 1024)
			const buffer = Buffer.alloc(chunkSize)
			await file.read(buffer, 0, chunkSize, stat.size - chunkSize)
			const lines = buffer
				.toString("utf-8")
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean)
			const last = lines.length > 0 ? lines[lines.length - 1] : undefined
			if (!last) {
				return undefined
			}
			const parsed = JSON.parse(last) as {
				timestamp?: string
				status?: "success" | "failure" | "blocked"
				tool_name?: string
			}
			return parsed
		} finally {
			await file.close()
		}
	} catch {
		return undefined
	}
}

export async function getGovernanceStatusSnapshot(cwd: string): Promise<GovernanceStatus | undefined> {
	const [activeIntentId, lastTrace] = await Promise.all([readActiveIntentId(cwd), readLastTraceRecord(cwd)])

	let activeIntentTitle: string | undefined
	let activeIntentStatus: GovernanceStatus["activeIntentStatus"]
	if (activeIntentId) {
		try {
			const catalog = await loadIntentCatalog(cwd)
			const intent = catalog.intents.find((item) => item.id === activeIntentId)
			activeIntentTitle = intent?.title
			activeIntentStatus = intent?.status
		} catch {
			// Fail-safe: keep snapshot available even when intent catalog is invalid.
		}
	}

	if (!activeIntentId && !lastTrace) {
		return undefined
	}

	return {
		activeIntentId,
		activeIntentTitle,
		activeIntentStatus,
		lastTraceAt: lastTrace?.timestamp,
		lastTraceStatus: lastTrace?.status,
		lastToolName: lastTrace?.tool_name,
	}
}
