import { markWriteSnapshot, hashFileContent, sha256 } from "./concurrencyGuard"
import { recordFailure, recordSuccess } from "./securityClassifier"
import { appendTraceRecord, buildTraceRecord, hashArgs, summarizeArgs, resolveVcsMetadata } from "./traceLogger"
import { updateIntentStatus } from "./intentLoader"
import { updateIntentMap } from "./intentMapUpdater"
import { recordCompactEntry } from "./preCompact"
import type { SemanticMutationClass } from "./mutationClassifier"

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

const lintRegex = /\b(lint|eslint|tslint|ruff|pylint|stylelint)\b/i
const testRegex = /\b(test|jest|vitest|mocha|pytest|go\s+test|cargo\s+test)\b/i
const passedCriteriaByIntent = new Map<string, Set<string>>()

function normalizeCriteria(value: string): string {
	return value.trim().toLowerCase()
}

function trackAcceptanceCriteria(context: PostToolContext): void {
	if (context.status !== "success" || context.toolName !== "execute_command" || !context.pre.intent) {
		return
	}
	const command = String(context.args.command ?? "")
	if (!command) {
		return
	}
	const passed = passedCriteriaByIntent.get(context.pre.intent.id) ?? new Set<string>()
	for (const criterion of context.pre.intent.acceptanceCriteria) {
		const normalized = normalizeCriteria(criterion)
		if (normalized.includes("lint") && lintRegex.test(command)) {
			passed.add(normalized)
		}
		if (normalized.includes("test") && testRegex.test(command)) {
			passed.add(normalized)
		}
	}
	passedCriteriaByIntent.set(context.pre.intent.id, passed)
}

function isIntentCompleted(context: PostToolContext): boolean {
	const intent = context.pre.intent
	if (!intent) {
		return false
	}
	const passed = passedCriteriaByIntent.get(intent.id) ?? new Set<string>()
	for (const criterion of intent.acceptanceCriteria) {
		const normalized = normalizeCriteria(criterion)
		if (normalized.includes("lint") || normalized.includes("test")) {
			if (!passed.has(normalized)) {
				return false
			}
		}
	}
	return true
}

function shouldUpdateIntentMap(context: PostToolContext, semanticMutationClass?: SemanticMutationClass): boolean {
	if (context.status !== "success" || !fileWriteTools.has(context.toolName)) {
		return false
	}
	if (semanticMutationClass === "INTENT_EVOLUTION") {
		return true
	}
	return context.args.__file_existed === false
}

export async function postToolUse(context: PostToolContext): Promise<void> {
	try {
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
		const semanticMutationClass =
			typeof context.args.__semantic_mutation_class === "string"
				? (context.args.__semantic_mutation_class as SemanticMutationClass)
				: undefined

		const absolutePath =
			typeof context.args.__absolute_path === "string" ? (context.args.__absolute_path as string) : undefined
		let writeHash: string | null | undefined
		if (absolutePath && fileWriteTools.has(context.toolName) && context.status === "success") {
			await markWriteSnapshot(context.taskId, absolutePath)
			writeHash = await hashFileContent(absolutePath)
		}
		const vcs = await resolveVcsMetadata(context.cwd)

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
			mutation_class: context.args.mutation_class
				? String(context.args.mutation_class)
				: semanticMutationClass
					? semanticMutationClass
					: undefined,
			file_path:
				typeof context.args.__relative_path === "string" ? String(context.args.__relative_path) : undefined,
			content_hash: contentHash,
			read_hash:
				context.pre.readHash ?? (typeof context.args.read_hash === "string" ? context.args.read_hash : null),
			write_hash: writeHash,
			related,
			agent: {
				task_id: context.taskId,
			},
			vcs,
		})

		await appendTraceRecord(context.cwd, record)
		recordCompactEntry(context.taskId, {
			tool: context.toolName,
			status: context.status,
			summary: summarizeArgs(context.args),
			timestamp: new Date().toISOString(),
		})

		if (shouldUpdateIntentMap(context, semanticMutationClass)) {
			await updateIntentMap(
				context.cwd,
				context.pre.intentId,
				typeof context.args.__relative_path === "string" ? String(context.args.__relative_path) : undefined,
			)
		}

		trackAcceptanceCriteria(context)
		if (
			context.pre.intentId &&
			context.pre.intent &&
			context.pre.intent.status !== "COMPLETED" &&
			isIntentCompleted(context)
		) {
			try {
				await updateIntentStatus(context.cwd, context.pre.intentId, "COMPLETED")
			} catch {
				// Intent transition errors should not fail tool execution completion path.
			}
		}

		if (context.status === "success") {
			recordSuccess(context.taskId)
		} else {
			recordFailure(context.taskId)
		}
	} catch {
		recordFailure(context.taskId)
	}
}
