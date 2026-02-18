import * as path from "path"
import * as fs from "fs/promises"
import { createHash } from "crypto"
import { randomUUID } from "crypto"
import type { HookContext, HookTraceEntry, AgentTraceEntryTRP1 } from "./types"

function canonicalize(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value)
	return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort())
}

export function computeContentHash(payload: unknown): string {
	return createHash("sha256").update(canonicalize(payload)).digest("hex")
}

/** Append one JSON line to a file (creates file and dir if needed). Deterministic: stable key order. */
async function appendJsonlLine(filePath: string, entry: HookTraceEntry | AgentTraceEntryTRP1): Promise<void> {
	const dir = path.dirname(filePath)
	await fs.mkdir(dir, { recursive: true })
	const line = `${JSON.stringify(entry)}\n`
	await fs.appendFile(filePath, line, { encoding: "utf8" })
}

export async function writeTrace(baseDir: string, entry: HookTraceEntry): Promise<void> {
	const tracePath = path.join(baseDir, "agent_trace.jsonl")
	// TRP1 schema when we have intent + content (spatial independence / golden thread to spec).
	if (entry.intent_id != null && (entry.content_hash != null || entry.mutation_summary != null)) {
		const trp1: AgentTraceEntryTRP1 = {
			id: randomUUID(),
			timestamp: entry.timestamp,
			vcs: {},
			files: [
				{
					relative_path: (entry.params?.path as string) ?? (entry.params?.file_path as string) ?? "",
					conversations: [
						{
							url: entry.task_id,
							contributor: {
								entity_type: "AI",
								model_identifier: entry.model_id ?? entry.provider ?? "",
							},
							ranges: entry.content_hash ? [{ content_hash: `sha256:${entry.content_hash}` }] : undefined,
							related: [{ type: "specification", value: entry.intent_id }],
						},
					],
				},
			],
		}
		await appendJsonlLine(tracePath, trp1)
	} else {
		await appendJsonlLine(tracePath, entry)
	}
}

/** TRP1 minimal active intent record for YAML. */
export interface ActiveIntentRecord {
	id: string
	name?: string
	status?: string
	owned_scope?: string[]
	constraints?: string[]
	acceptance_criteria?: string[]
}

export async function updateActiveIntent(baseDir: string, activeIntentId: string): Promise<void> {
	const filePath = path.join(baseDir, "active_intents.yaml")
	await fs.mkdir(path.dirname(filePath), { recursive: true })
	// TRP1-shaped minimal YAML (single intent; merge with existing if needed later).
	const content = `active_intents:
  - id: "${activeIntentId}"
    name: "${activeIntentId}"
    status: "IN_PROGRESS"
    owned_scope: []
    constraints: []
    acceptance_criteria: []
`
	await fs.writeFile(filePath, content, { encoding: "utf8" })
}

/** Read active intents from .orchestration/active_intents.yaml (best-effort parse). */
export async function loadActiveIntents(baseDir: string): Promise<ActiveIntentRecord[]> {
	const filePath = path.join(baseDir, "active_intents.yaml")
	try {
		const raw = await fs.readFile(filePath, "utf8")
		const intents: ActiveIntentRecord[] = []
		// Minimal parse: find "- id: \"...\"" and subsequent name/owned_scope/constraints lines.
		const blockRegex = /-\s*id:\s*["']([^"']+)["']\s*\n((?:\s+\w+:\s*.*\n?)*)/g
		let m: RegExpExecArray | null
		while ((m = blockRegex.exec(raw)) !== null) {
			const id = m[1]
			const rest = m[2] ?? ""
			const nameMatch = rest.match(/name:\s*["']?([^"'\n]+)["']?/)
			const scopeMatch = rest.match(/owned_scope:\s*\[([^\]]*)\]/)
			const constraintsMatch = rest.match(/constraints:\s*\[([^\]]*)\]/)
			intents.push({
				id,
				name: nameMatch?.[1]?.trim() ?? id,
				status: "IN_PROGRESS",
				owned_scope: scopeMatch?.[1]
					? scopeMatch[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))
					: [],
				constraints: constraintsMatch?.[1]
					? constraintsMatch[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))
					: [],
			})
		}
		if (intents.length === 0 && raw.includes("active_intent:")) {
			const simpleId = raw.match(/active_intent:\s*(\S+)/)?.[1]
			if (simpleId)
				intents.push({ id: simpleId, name: simpleId, status: "IN_PROGRESS", owned_scope: [], constraints: [] })
		}
		return intents
	} catch {
		return []
	}
}

export function buildTraceEntry(
	ctx: HookContext,
	result: { allow: boolean; message?: string; isError?: boolean },
): HookTraceEntry {
	return {
		timestamp: ctx.timestamp,
		intent_id: ctx.activeIntentId,
		task_id: ctx.taskId,
		tool_name: ctx.toolName,
		tool_use_id: ctx.toolCallId,
		mode: ctx.mode,
		model_id: ctx.modelId,
		provider: ctx.provider,
		category: ctx.category,
		params: ctx.params,
		mutation_summary: ctx.mutationSummary,
		content_hash: ctx.contentHash,
		result: result.allow ? result.message : undefined,
		error: result.allow ? undefined : result.message,
	}
}
