import * as vscode from "vscode"

import { captureReadSnapshot, readFileContentSafe, validateWriteFreshness } from "./concurrencyGuard"
import { canProceed, classifyTool, getFailureCount, assertCommandSafe, type SecurityClass } from "./securityClassifier"
import {
	getSelectedIntent,
	loadIntentCatalog,
	selectActiveIntent,
	type IntentDefinition,
	type IntentLoadError,
} from "./intentLoader"
import { sanitizeAndNormalizePath, validatePathAgainstScope } from "./scopeValidator"
import { inferSemanticMutationClass, isMutationClassCompatible, type SemanticMutationClass } from "./mutationClassifier"
import { preCompact } from "./preCompact"

const fileReadTools = new Set(["read_file"])
const fileWriteTools = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
])

interface HookErrorPayload {
	error: {
		code: string
		message: string
		details?: Record<string, unknown>
	}
}
const sessionApprovalByTask = new Set<string>()

export interface PreToolContext {
	taskId: string
	cwd: string
	toolName: string
	args: Record<string, any>
}

export interface PreToolResult {
	ok: boolean
	intentId: string | null
	intent?: IntentDefinition
	approved: boolean | null
	decisionReason: string
	securityClass: SecurityClass
	startedAt: number
	normalizedArgs: Record<string, any>
	errorPayload?: HookErrorPayload
	readHash?: string | null
	semanticMutationClass?: SemanticMutationClass
}

function hookError(code: string, message: string, details?: Record<string, unknown>): HookErrorPayload {
	return { error: { code, message, details } }
}

function getPathArg(args: Record<string, any>): string | undefined {
	return args.path ?? args.file_path
}

async function askSensitiveApproval(taskId: string, toolName: string): Promise<{ approved: boolean; always: boolean }> {
	if (sessionApprovalByTask.has(taskId)) {
		return { approved: true, always: true }
	}
	const approveOnce = "Approve once"
	const approveAlways = "Approve always (session)"
	const deny = "Deny"
	const result = await vscode.window.showWarningMessage(
		`Sensitive tool call detected: ${toolName}. Do you want to continue?`,
		{ modal: true },
		approveOnce,
		approveAlways,
		deny,
	)
	if (result === approveAlways) {
		sessionApprovalByTask.add(taskId)
		return { approved: true, always: true }
	}
	return { approved: result === approveOnce, always: false }
}

export async function preToolUse(context: PreToolContext): Promise<PreToolResult> {
	const startedAt = Date.now()
	const normalizedArgs = { ...(context.args ?? {}) }
	const securityClass = classifyTool(context.toolName, normalizedArgs)

	await preCompact(context.taskId, context.cwd).catch(() => undefined)

	if (!canProceed(context.taskId)) {
		return {
			ok: false,
			intentId: null,
			approved: null,
			decisionReason: "Circuit breaker triggered after repeated failures.",
			securityClass,
			startedAt,
			normalizedArgs,
			errorPayload: hookError("CIRCUIT_BREAKER_OPEN", "Tool execution blocked by circuit breaker.", {
				failures: getFailureCount(context.taskId),
			}),
		}
	}

	if (context.toolName === "select_active_intent") {
		try {
			const intentId = String(normalizedArgs.intent_id ?? "")
			if (!intentId) {
				return {
					ok: false,
					intentId: null,
					approved: null,
					decisionReason: "Missing intent_id",
					securityClass,
					startedAt,
					normalizedArgs,
					errorPayload: hookError("MALFORMED_INTENT_SELECTION", "select_active_intent requires intent_id."),
				}
			}
			const intent = await selectActiveIntent(context.taskId, context.cwd, intentId)
			return {
				ok: true,
				intentId: intent.id,
				intent,
				approved: true,
				decisionReason: "Active intent selected.",
				securityClass,
				startedAt,
				normalizedArgs,
			}
		} catch (error) {
			const e = error as IntentLoadError
			return {
				ok: false,
				intentId: null,
				approved: null,
				decisionReason: e.message,
				securityClass,
				startedAt,
				normalizedArgs,
				errorPayload: hookError(e.code ?? "INTENT_SELECTION_FAILED", e.message, e.details),
			}
		}
	}

	try {
		await loadIntentCatalog(context.cwd)
	} catch (error) {
		const e = error as IntentLoadError
		return {
			ok: false,
			intentId: null,
			approved: null,
			decisionReason: e.message,
			securityClass,
			startedAt,
			normalizedArgs,
			errorPayload: hookError(e.code ?? "INTENT_CATALOG_ERROR", e.message, e.details),
		}
	}

	const selectedIntent = await getSelectedIntent(context.taskId, context.cwd)
	if (!selectedIntent) {
		return {
			ok: false,
			intentId: null,
			approved: null,
			decisionReason: "No active intent selected. Call select_active_intent(intent_id) first.",
			securityClass,
			startedAt,
			normalizedArgs,
			errorPayload: hookError(
				"HANDSHAKE_REQUIRED",
				"All tools except select_active_intent require an active intent selection.",
			),
		}
	}

	if (securityClass === "DESTRUCTIVE" || securityClass === "WRITE") {
		const approval = await askSensitiveApproval(context.taskId, context.toolName)
		if (!approval.approved) {
			return {
				ok: false,
				intentId: selectedIntent?.id ?? null,
				intent: selectedIntent ?? undefined,
				approved: false,
				decisionReason: "Sensitive tool denied by human approval.",
				securityClass,
				startedAt,
				normalizedArgs,
				errorPayload: hookError("HITL_DENIED", "Sensitive tool denied."),
			}
		}
	}

	if (context.toolName === "execute_command") {
		try {
			assertCommandSafe(String(normalizedArgs.command ?? ""))
		} catch (error) {
			return {
				ok: false,
				intentId: selectedIntent?.id ?? null,
				intent: selectedIntent ?? undefined,
				approved: null,
				decisionReason: error instanceof Error ? error.message : String(error),
				securityClass,
				startedAt,
				normalizedArgs,
				errorPayload: hookError("UNSAFE_COMMAND_INPUT", "Command failed safety validation."),
			}
		}
	}

	const targetPath = getPathArg(normalizedArgs)
	let readHash: string | null | undefined
	if (targetPath) {
		try {
			const normalizedPath = sanitizeAndNormalizePath(context.cwd, targetPath)
			normalizedArgs.__absolute_path = normalizedPath.absolutePath
			normalizedArgs.__relative_path = normalizedPath.relativePath
			if (selectedIntent && fileWriteTools.has(context.toolName)) {
				validatePathAgainstScope(normalizedPath.relativePath, selectedIntent.scope)
			}
			if (fileReadTools.has(context.toolName)) {
				readHash = await captureReadSnapshot(context.taskId, normalizedPath.absolutePath)
			}
			if (fileWriteTools.has(context.toolName)) {
				const oldContent = await readFileContentSafe(normalizedPath.absolutePath)
				normalizedArgs.__old_content = oldContent
				normalizedArgs.__file_existed = oldContent !== null
				const freshness = await validateWriteFreshness(
					context.taskId,
					normalizedPath.absolutePath,
					typeof normalizedArgs.read_hash === "string" ? normalizedArgs.read_hash : undefined,
				)
				if (!freshness.ok) {
					return {
						ok: false,
						intentId: selectedIntent?.id ?? null,
						intent: selectedIntent ?? undefined,
						approved: null,
						decisionReason: "Stale write detected. File changed since read.",
						securityClass,
						startedAt,
						normalizedArgs,
						errorPayload: hookError("STALE_WRITE", "Optimistic lock failed due to hash mismatch.", {
							expected_hash: freshness.expectedHash,
							actual_hash: freshness.actualHash,
							collision_event: true,
						}),
					}
				}

				if (context.toolName === "write_to_file") {
					const mutationClass = String(normalizedArgs.mutation_class ?? "")
					if (
						!["create", "modify", "replace", "delete", "AST_REFACTOR", "INTENT_EVOLUTION"].includes(
							mutationClass,
						)
					) {
						return {
							ok: false,
							intentId: selectedIntent?.id ?? null,
							intent: selectedIntent ?? undefined,
							approved: null,
							decisionReason: "write_to_file is missing valid mutation_class.",
							securityClass,
							startedAt,
							normalizedArgs,
							errorPayload: hookError(
								"MALFORMED_WRITE_REQUEST",
								"write_to_file requires mutation_class in [create, modify, replace, delete, AST_REFACTOR, INTENT_EVOLUTION].",
							),
						}
					}
					const intentIdArg = String(normalizedArgs.intent_id ?? "")
					if (!intentIdArg || intentIdArg !== selectedIntent?.id) {
						return {
							ok: false,
							intentId: selectedIntent?.id ?? null,
							intent: selectedIntent ?? undefined,
							approved: null,
							decisionReason: "write_to_file intent_id does not match selected active intent.",
							securityClass,
							startedAt,
							normalizedArgs,
							errorPayload: hookError(
								"INTENT_MISMATCH",
								"write_to_file intent_id must match selected active intent.",
							),
						}
					}
					const newContent = String(normalizedArgs.content ?? "")
					const inferredClass = inferSemanticMutationClass({
						filePath: normalizedPath.relativePath,
						oldContent: oldContent,
						newContent,
					})
					normalizedArgs.__semantic_mutation_class = inferredClass
					if (!isMutationClassCompatible(mutationClass, inferredClass)) {
						return {
							ok: false,
							intentId: selectedIntent?.id ?? null,
							intent: selectedIntent ?? undefined,
							approved: null,
							decisionReason: `Mutation class mismatch. provided='${mutationClass}', inferred='${inferredClass}'.`,
							securityClass,
							startedAt,
							normalizedArgs,
							semanticMutationClass: inferredClass,
							errorPayload: hookError(
								"MUTATION_CLASS_MISMATCH",
								"Provided mutation_class does not match semantic classification.",
								{ provided: mutationClass, inferred: inferredClass },
							),
						}
					}
				}
			}
		} catch (error: any) {
			return {
				ok: false,
				intentId: selectedIntent?.id ?? null,
				intent: selectedIntent ?? undefined,
				approved: null,
				decisionReason: error.message ?? "Path/security validation failed.",
				securityClass,
				startedAt,
				normalizedArgs,
				errorPayload: hookError(
					error.code ?? "SCOPE_OR_PATH_ERROR",
					error.message ?? "Path validation failed.",
				),
			}
		}
	}

	return {
		ok: true,
		intentId: selectedIntent?.id ?? null,
		intent: selectedIntent ?? undefined,
		approved: securityClass === "DESTRUCTIVE" || securityClass === "WRITE" ? true : null,
		decisionReason: "Allowed by preToolUse.",
		securityClass,
		startedAt,
		normalizedArgs,
		readHash,
		semanticMutationClass: normalizedArgs.__semantic_mutation_class as SemanticMutationClass | undefined,
	}
}
