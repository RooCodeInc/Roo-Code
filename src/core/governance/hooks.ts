import path from "path"

import { loadActiveIntent } from "./intentStore"
import { requestHitlApproval } from "./hitl"
import { appendTraceRecord, hashArgs, summarizeArgs } from "./traceLedger"
import type { PreToolUseResult } from "./types"

const MUTATING_TOOLS = new Set([
	"execute_command",
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"generate_image",
	"new_task",
])

const FILE_MUTATION_TOOLS = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
])

function escapeRegex(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
}

function globToRegex(pattern: string): RegExp {
	const normalized = pattern.replace(/\\/g, "/")
	let regexSource = "^"
	for (let i = 0; i < normalized.length; i++) {
		const char = normalized[i]
		const next = normalized[i + 1]
		if (char === "*" && next === "*") {
			regexSource += ".*"
			i++
			continue
		}
		if (char === "*") {
			regexSource += "[^/]*"
			continue
		}
		if (char === "?") {
			regexSource += "."
			continue
		}
		regexSource += escapeRegex(char)
	}
	regexSource += "$"
	return new RegExp(regexSource)
}

function resolveTargetPath(args: Record<string, any>): string | undefined {
	return args.path ?? args.file_path
}

function normalizeRelativePath(cwd: string, targetPath: string): string {
	const absolute = path.isAbsolute(targetPath) ? targetPath : path.resolve(cwd, targetPath)
	return path.relative(cwd, absolute).replace(/\\/g, "/")
}

function isPathAllowedByScope(relativePath: string, scopePatterns: string[]): boolean {
	return scopePatterns.some((pattern) => globToRegex(pattern).test(relativePath))
}

export async function preToolUse(input: {
	cwd: string
	toolName: string
	args: Record<string, any>
}): Promise<PreToolUseResult> {
	const startedAt = Date.now()
	const intent = await loadActiveIntent(input.cwd)

	if (!intent) {
		return {
			allowed: false,
			intentId: null,
			approved: null,
			decisionReason: "Blocked by governance: no active intent selected.",
			startedAt,
		}
	}

	if (FILE_MUTATION_TOOLS.has(input.toolName)) {
		const targetPath = resolveTargetPath(input.args)
		if (typeof targetPath === "string" && targetPath.length > 0) {
			const relativePath = normalizeRelativePath(input.cwd, targetPath)
			const allowed = isPathAllowedByScope(relativePath, intent.scope)
			if (!allowed) {
				return {
					allowed: false,
					intentId: intent.id,
					approved: null,
					decisionReason: `Blocked by governance: ${relativePath} is outside intent scope.`,
					startedAt,
				}
			}
		}
	}

	if (MUTATING_TOOLS.has(input.toolName)) {
		const decision = await requestHitlApproval(input.toolName, "This tool can modify files or system state.")
		if (decision === "deny") {
			return {
				allowed: false,
				intentId: intent.id,
				approved: false,
				decisionReason: "Blocked by governance: HITL denied action.",
				startedAt,
			}
		}
		return {
			allowed: true,
			intentId: intent.id,
			approved: true,
			decisionReason:
				decision === "approve_always_session"
					? "Approved by HITL (always this session)."
					: "Approved by HITL (once).",
			startedAt,
		}
	}

	return {
		allowed: true,
		intentId: intent.id,
		approved: null,
		decisionReason: "Allowed by governance.",
		startedAt,
	}
}

export async function postToolUse(input: {
	cwd: string
	toolName: string
	args: Record<string, any>
	pre: PreToolUseResult
	status: "success" | "failure" | "blocked"
	errorMessage?: string
}): Promise<void> {
	await appendTraceRecord(
		{
			timestamp: new Date().toISOString(),
			intentId: input.pre.intentId,
			toolName: input.toolName,
			argsSummary: summarizeArgs(input.args),
			argsHash: hashArgs(input.args),
			approved: input.pre.approved,
			decisionReason: input.pre.decisionReason,
			status: input.status,
			durationMs: Math.max(0, Date.now() - input.pre.startedAt),
			errorMessage: input.errorMessage,
		},
		input.cwd,
	)
}

