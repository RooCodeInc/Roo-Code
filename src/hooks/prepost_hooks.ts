// Minimal Pre/Post-Hook scaffolding for Roo Code (TypeScript)

import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

type Intent = {
	id: string
	name: string
	status: string
	owned_scope?: string[]
	constraints?: string[]
}

export function loadActiveIntent(intentId: string, workspaceRoot: string): Intent | null {
	const file = path.join(workspaceRoot, ".orchestration", "active_intents.yaml")
	if (!fs.existsSync(file)) return null
	// Lightweight parsing for example purposes.
	const content = fs.readFileSync(file, "utf8")
	if (content.includes(`id: "${intentId}"`)) {
		return { id: intentId, name: "Example", status: "IN_PROGRESS" }
	}
	return null
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
	// Return a simple intent_context block
	return `<intent_context>\nname: ${intent.name}\nconstraints: ${JSON.stringify(intent.constraints || [])}\n</intent_context>`
}

export async function postHook_WriteFile(relativePath: string, newContent: string, workspaceRoot: string, meta: any) {
	const contentHash = computeSha256(newContent)
	const trace = {
		id: meta?.id || "generated-uuid",
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
