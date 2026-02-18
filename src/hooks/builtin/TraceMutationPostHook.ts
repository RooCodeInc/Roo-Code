import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"
import * as childProcess from "child_process"

import { PostToolHook, PostToolHookContext } from "../types"

interface TraceRange {
	start_line: number
	end_line: number
	content_hash: string
}

interface TraceContributor {
	entity_type: "AI" | "HUMAN"
	model_identifier?: string
}

interface TraceConversation {
	url: string
	contributor: TraceContributor
	ranges: TraceRange[]
	related: Array<{ type: string; value: string }>
}

interface TraceFile {
	relative_path: string
	conversations: TraceConversation[]
}

interface AgentTraceRecord {
	id: string
	timestamp: string
	intent_id: string
	mutation_class: "AST_REFACTOR" | "INTENT_EVOLUTION" | "UNKNOWN"
	vcs: { revision_id: string }
	files: TraceFile[]
}

function sha256(content: string): string {
	return "sha256:" + crypto.createHash("sha256").update(content, "utf8").digest("hex")
}

function getGitHead(cwd: string): string {
	try {
		return childProcess.execSync("git rev-parse HEAD", { cwd, encoding: "utf8" }).trim()
	} catch {
		return "unknown"
	}
}

function uuidv4(): string {
	return crypto.randomUUID()
}

function computeMutationClass(
	toolName: string,
	toolArgs: Record<string, unknown>,
): "AST_REFACTOR" | "INTENT_EVOLUTION" | "UNKNOWN" {
	// Heuristic: if the content being written is not a new file creation it is
	// more likely an AST_REFACTOR. INTENT_EVOLUTION is signalled by the agent
	// passing mutation_class explicitly in the tool args.
	const explicit = toolArgs["mutation_class"]
	if (explicit === "INTENT_EVOLUTION") return "INTENT_EVOLUTION"
	if (explicit === "AST_REFACTOR") return "AST_REFACTOR"
	if (toolName === "write_to_file" || toolName === "apply_diff" || toolName === "edit_file") {
		return "AST_REFACTOR"
	}
	return "UNKNOWN"
}

export class TraceMutationPostHook implements PostToolHook {
	name = "trace-mutation-post-hook"

	async run(context: PostToolHookContext): Promise<void> {
		const MUTATING_TOOLS = new Set(["write_to_file", "apply_diff", "edit_file", "apply_patch", "search_replace"])
		if (!MUTATING_TOOLS.has(context.toolName)) {
			return
		}

		const cwd = context.cwd ?? process.cwd()
		const orchestrationDir = path.join(cwd, ".orchestration")
		const tracePath = path.join(orchestrationDir, "agent_trace.jsonl")

		// Ensure .orchestration/ exists.
		try {
			await fs.promises.mkdir(orchestrationDir, { recursive: true })
		} catch {
			// Already exists.
		}

		const intentId = (context.toolArgs["intent_id"] as string | undefined) ?? "UNTRACKED"
		const revisionId = getGitHead(cwd)
		const mutationClass = computeMutationClass(context.toolName, context.toolArgs)

		const files: TraceFile[] = await Promise.all(
			context.changedFiles.map(async (relPath) => {
				const absPath = path.resolve(cwd, relPath)
				let content = ""
				try {
					content = await fs.promises.readFile(absPath, "utf-8")
				} catch {
					content = ""
				}

				const lines = content.split("\n")
				const range: TraceRange = {
					start_line: 1,
					end_line: lines.length,
					content_hash: sha256(content),
				}

				const conversation: TraceConversation = {
					url: context.taskId,
					contributor: {
						entity_type: "AI",
						model_identifier: (context.toolArgs["model_identifier"] as string | undefined) ?? "unknown",
					},
					ranges: [range],
					related: [{ type: "specification", value: intentId }],
				}

				return {
					relative_path: relPath,
					conversations: [conversation],
				}
			}),
		)

		const record: AgentTraceRecord = {
			id: uuidv4(),
			timestamp: new Date().toISOString(),
			intent_id: intentId,
			mutation_class: mutationClass,
			vcs: { revision_id: revisionId },
			files,
		}

		// Append-only write — never overwrite existing records.
		await fs.promises.appendFile(tracePath, JSON.stringify(record) + "\n", "utf-8")
	}
}
