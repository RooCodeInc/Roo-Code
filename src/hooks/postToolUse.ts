import { markWriteSnapshot, hashFileContent, sha256 } from "./concurrencyGuard"
import { recordFailure, recordSuccess } from "./securityClassifier"
import { appendTraceRecord, buildTraceRecord, hashArgs, summarizeArgs } from "./traceLogger"

import type { PreToolResult } from "./preToolUse"

export interface PostToolContext {
	taskId: string
	cwd: string
	toolName: string
	args: Record<string, any>
	pre: PreToolResult
	status: "success" | "failure" | "blocked"
	errorMessage?: string
}

const fileWriteTools = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
])

export async function postToolUse(context: PostToolContext): Promise<void> {
	const related = Array.isArray(context.args.related)
		? context.args.related.map((value: unknown) => String(value))
		: []
	if (context.pre.intentId && !related.includes(context.pre.intentId)) {
		related.push(context.pre.intentId)
	}

	let contentHash: string | undefined
	const content = context.args.content
	if (typeof content === "string") {
		contentHash = sha256(content)
	}

	const absolutePath =
		typeof context.args.__absolute_path === "string" ? (context.args.__absolute_path as string) : undefined
	let writeHash: string | null | undefined
	if (absolutePath && fileWriteTools.has(context.toolName) && context.status === "success") {
		await markWriteSnapshot(context.taskId, absolutePath)
		writeHash = await hashFileContent(absolutePath)
	}

	const record = buildTraceRecord({
		intent_id: context.pre.intentId,
		tool_name: context.toolName,
		args_summary: summarizeArgs(context.args),
		args_hash: hashArgs(context.args),
		approved: context.pre.approved,
		decision_reason: context.pre.decisionReason,
		status: context.status,
		duration_ms: Math.max(0, Date.now() - context.pre.startedAt),
		error_message: context.errorMessage,
		security_class: context.pre.securityClass,
		mutation_class: context.args.mutation_class ? String(context.args.mutation_class) : undefined,
		file_path: typeof context.args.__relative_path === "string" ? String(context.args.__relative_path) : undefined,
		content_hash: contentHash,
		read_hash: context.pre.readHash ?? (typeof context.args.read_hash === "string" ? context.args.read_hash : null),
		write_hash: writeHash,
		related,
		agent: {
			task_id: context.taskId,
		},
		vcs: {},
	})

	await appendTraceRecord(context.cwd, record)

	if (context.status === "success") {
		recordSuccess(context.taskId)
	} else {
		recordFailure(context.taskId)
	}
}
