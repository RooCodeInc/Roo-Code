// Minimal Pre/Post-Hook scaffolding for Roo Code (TypeScript)

import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

// Prefer a proper YAML parser if available.
let yamlParse: (input: string) => any
try {
	const yaml = require("yaml")
	yamlParse = (s: string) => yaml.parse(s)
} catch (e) {
	// Fallback: very small YAML subset parser for our simple `active_intents.yaml` structure.
	yamlParse = (s: string) => {
		const lines = s.split(/\r?\n/).map((l) => l.replace(/^\s+|\s+$/g, ""))
		const out: any = { active_intents: [] }
		let current: any = null
		for (const line of lines) {
			if (!line || line.startsWith("#")) continue
			if (line.startsWith("- id:")) {
				current = {
					id: line
						.split(":")[1]
						.trim()
						.replace(/^\"|\"$/g, ""),
				}
				out.active_intents.push(current)
				continue
			}
			if (!current) continue
			if (line.startsWith("name:"))
				current.name = line
					.split(":")
					.slice(1)
					.join(":")
					.trim()
					.replace(/^\"|\"$/g, "")
			if (line.startsWith("status:")) current.status = line.split(":")[1].trim()
			if (line.startsWith("owned_scope:")) current.owned_scope = []
			if (line.startsWith('- "') && current && Array.isArray(current.owned_scope)) {
				current.owned_scope.push(line.replace(/^-\s*/, "").replace(/^\"|\"$/g, ""))
			}
			if (line.startsWith("constraints:")) current.constraints = []
			if (line.startsWith('- "') && current && Array.isArray(current.constraints)) {
				current.constraints.push(line.replace(/^-\s*/, "").replace(/^\"|\"$/g, ""))
			}
			if (line.startsWith("acceptance_criteria:")) current.acceptance_criteria = []
			if (line.startsWith('- "') && current && Array.isArray(current.acceptance_criteria)) {
				current.acceptance_criteria.push(line.replace(/^-\s*/, "").replace(/^\"|\"$/g, ""))
			}
		}
		return out
	}
}

export interface Intent {
	id: string
	name: string
	status: string
	owned_scope?: string[]
	constraints?: string[]
	acceptance_criteria?: string[]
}

// Hook interfaces and engine
export type PreHook<Input, Output> = (input: Input, workspaceRoot: string) => Promise<Output> | Output
export type PostHook<Input, Output> = (input: Input, result: Output, workspaceRoot: string) => Promise<void> | void

export class HookEngine {
	private preHooks: Map<string, Array<PreHook<any, any>>> = new Map()
	private postHooks: Map<string, Array<PostHook<any, any>>> = new Map()

	registerPreHook<TIn, TOut>(toolName: string, fn: PreHook<TIn, TOut>) {
		this.preHooks.set(toolName, (this.preHooks.get(toolName) || []).concat(fn))
	}

	registerPostHook<TIn, TOut>(toolName: string, fn: PostHook<TIn, TOut>) {
		this.postHooks.set(toolName, (this.postHooks.get(toolName) || []).concat(fn))
	}

	async runPreHooks<TIn, TOut>(toolName: string, input: TIn, workspaceRoot: string): Promise<TOut | null> {
		const hooks = this.preHooks.get(toolName) || []
		let last: any = null
		for (const h of hooks) last = await h(input, workspaceRoot)
		return last as TOut | null
	}

	async runPostHooks<TIn, TOut>(toolName: string, input: TIn, result: TOut, workspaceRoot: string) {
		const hooks = this.postHooks.get(toolName) || []
		for (const h of hooks) await h(input, result, workspaceRoot)
	}
}

export function loadActiveIntent(intentId: string, workspaceRoot: string): Intent | null {
	const file = path.join(workspaceRoot, ".orchestration", "active_intents.yaml")
	if (!fs.existsSync(file)) return null
	const content = fs.readFileSync(file, "utf8")
	try {
		const parsed = yamlParse(content)
		if (!parsed || !Array.isArray(parsed.active_intents)) return null
		const found = parsed.active_intents.find((a: any) => String(a.id) === String(intentId))
		if (!found) return null
		return {
			id: String(found.id),
			name: found.name || "unknown",
			status: found.status || "UNKNOWN",
			owned_scope: found.owned_scope || [],
			constraints: found.constraints || [],
			acceptance_criteria: found.acceptance_criteria || [],
		} as Intent
	} catch (err) {
		return null
	}
}

export function computeSha256(content: string): string {
	return crypto.createHash("sha256").update(content, "utf8").digest("hex")
}

export function appendAgentTrace(workspaceRoot: string, traceObj: object) {
	const file = path.join(workspaceRoot, ".orchestration", "agent_trace.jsonl")
	const line = JSON.stringify(traceObj) + "\n"
	fs.appendFileSync(file, line, "utf8")
}

// Exported hooks (to be wired into the extension host)
export async function preHook_SelectActiveIntent(intentId: string, workspaceRoot: string) {
	const intent = loadActiveIntent(intentId, workspaceRoot)
	if (!intent) throw new Error("You must cite a valid active Intent ID.")
	// Return a structured intent_context block (machine-readable as YAML)
	return {
		intent_context: {
			id: intent.id,
			name: intent.name,
			constraints: intent.constraints || [],
			owned_scope: intent.owned_scope || [],
		},
	}
}

export async function postHook_WriteFile(relativePath: string, newContent: string, workspaceRoot: string, meta: any) {
	const contentHash = computeSha256(newContent)
	const trace = {
		id: meta?.id || `trace-${Date.now()}`,
		timestamp: new Date().toISOString(),
		vcs: { revision_id: meta?.vcs || null },
		files: [
			{
				relative_path: relativePath,
				conversations: [
					{
						contributor: meta?.contributor || { entity_type: "AI", model_identifier: "example-model" },
						ranges: [
							{
								start_line: meta?.start_line || 1,
								end_line: meta?.end_line || 1,
								content_hash: `sha256:${contentHash}`,
							},
						],
						related: meta?.related || [],
					},
				],
			},
		],
	}
	appendAgentTrace(workspaceRoot, trace)
	return trace
}
