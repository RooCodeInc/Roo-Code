/**
 * Hook middleware for intercepting tool execution.
 *
 * This module provides the core interceptor functions that wrap tool execution:
 * - executePreToolUseHooks: Runs before a tool executes
 * - executePostToolUseHooks: Runs after a tool completes
 *
 * Hooks are composable and run in registration order. If any PreToolUse hook
 * returns `continue: false`, tool execution is aborted.
 */

import * as vscode from "vscode"
import type { ToolName } from "@roo-code/types"
import type { ToolUse } from "../shared/tools"
import type { Task } from "../core/task/Task"
import type {
	HookResult,
	PreToolUseContext,
	PostToolUseContext,
	PreToolUseHook,
	PostToolUseHook,
	HookRegistry,
} from "./types"
import * as path from "path"
import { classifyToolSafety } from "./security"
import { computeContentHash, computeGitSha, buildTraceRecord, appendTraceRecord } from "./trace-logger"

/**
 * Global registry of hooks.
 * Hooks are registered via registerPreToolUseHook() and registerPostToolUseHook().
 */
const hookRegistry: HookRegistry = {
	preToolUseHooks: [],
	postToolUseHooks: [],
}

/**
 * Registers a PreToolUse hook to be executed before every tool call.
 *
 * @param hook - Function to execute before tool use
 * @returns Cleanup function to unregister the hook
 *
 * @example
 * const cleanup = registerPreToolUseHook(async (context) => {
 *   console.log(`Tool ${context.toolUse.name} about to execute`)
 *   return { continue: true }
 * })
 *
 * // Later, to unregister:
 * cleanup()
 */
export function registerPreToolUseHook(hook: PreToolUseHook): () => void {
	hookRegistry.preToolUseHooks.push(hook)

	// Return cleanup function
	return () => {
		const index = hookRegistry.preToolUseHooks.indexOf(hook)
		if (index > -1) {
			hookRegistry.preToolUseHooks.splice(index, 1)
		}
	}
}

/**
 * Registers a PostToolUse hook to be executed after every tool call.
 *
 * @param hook - Function to execute after tool use
 * @returns Cleanup function to unregister the hook
 *
 * @example
 * const cleanup = registerPostToolUseHook(async (context) => {
 *   console.log(`Tool ${context.toolUse.name} completed in ${context.duration}ms`)
 *   return { continue: true }
 * })
 */
export function registerPostToolUseHook(hook: PostToolUseHook): () => void {
	hookRegistry.postToolUseHooks.push(hook)

	// Return cleanup function
	return () => {
		const index = hookRegistry.postToolUseHooks.indexOf(hook)
		if (index > -1) {
			hookRegistry.postToolUseHooks.splice(index, 1)
		}
	}
}

/**
 * Executes all registered PreToolUse hooks before a tool runs.
 *
 * Hooks run in registration order. If any hook returns `continue: false`,
 * execution stops and the tool is not invoked.
 *
 * @param task - The Task instance executing the tool
 * @param toolUse - The tool_use block from the LLM
 * @param params - Parsed parameters for the tool
 * @returns Aggregated result from all hooks
 *
 * @example
 * const result = await executePreToolUseHooks(task, toolUse, params)
 * if (!result.continue) {
 *   // Abort tool execution
 *   return result.reason
 * }
 * // Use result.modifiedParams if provided
 * const finalParams = result.modifiedParams || params
 */
export async function executePreToolUseHooks<TName extends ToolName>(
	task: Task,
	toolUse: ToolUse<TName>,
	params: Record<string, unknown>,
): Promise<HookResult> {
	// TODO: Implementation for Phase 1
	// For now, return a pass-through result

	const context: PreToolUseContext<TName> = {
		task,
		toolUse,
		params,
		timestamp: Date.now(),
		cwd: task.cwd,
	}

	// Aggregated result
	let aggregatedResult: HookResult = {
		continue: true,
	}

	// --- Governance: classification, HITL, optimistic locking ---
	try {
		const safety = classifyToolSafety(toolUse.name as string, params)
		if (safety === "DESTRUCTIVE") {
			const approved = await requestHITLAuthorization(toolUse.name as string, params)
			if (!approved) {
				return {
					continue: false,
					reason: formatRejectionError("User rejected HITL", "Operation cancelled by user", "HITL_REJECTED"),
				}
			}
		}

		// Optimistic locking for write_to_file
		if (toolUse.name === "write_to_file") {
			const filePath = String(params["path"] || params["file"] || "")
			const expected = String(params["expected_content_hash"] || "")
			if (filePath && expected) {
				try {
					const target = path.join(task.cwd, filePath)
					const uri = vscode.Uri.file(target)
					const disk = await vscode.workspace.fs.readFile(uri)
					const diskText = Buffer.from(disk).toString("utf-8")
					const diskHash = computeContentHash(diskText)
					if (expected && expected !== diskHash) {
						return {
							continue: false,
							reason: formatRejectionError(
								"Optimistic Lock Failed",
								"File changed on disk; reconcile and retry",
								"OPTIMISTIC_LOCK_FAIL",
							),
						}
					}
				} catch (e) {
					// File may not exist or read failed - allow hook chain to continue
				}
			}
		}
	} catch (err) {
		console.error("[HookEngine] Governance pre-check failed:", err)
	}

	// Execute hooks in sequence
	for (const hook of hookRegistry.preToolUseHooks) {
		try {
			const result = await hook(context)

			// If any hook says "don't continue", stop
			if (!result.continue) {
				return result
			}

			// Merge modified params (last hook wins)
			if (result.modifiedParams) {
				aggregatedResult.modifiedParams = result.modifiedParams
			}

			// Accumulate context to inject
			if (result.contextToInject) {
				aggregatedResult.contextToInject =
					(aggregatedResult.contextToInject || "") + "\n" + result.contextToInject
			}
		} catch (error) {
			// Hook errors should not break tool execution
			console.error(`PreToolUse hook failed:`, error)
		}
	}

	return aggregatedResult
}

/**
 * Executes all registered PostToolUse hooks after a tool completes.
 *
 * Hooks run in registration order. Unlike PreToolUse hooks, these cannot
 * prevent the tool from executing (it already did), but can trigger side
 * effects like logging, analytics, or follow-up actions.
 *
 * @param task - The Task instance that executed the tool
 * @param toolUse - The tool_use block from the LLM
 * @param params - Parameters that were passed to the tool
 * @param result - Result returned by the tool
 * @param success - Whether the tool succeeded
 * @param error - Error object if the tool failed
 * @param startTime - When the tool started executing
 * @returns Aggregated result from all hooks
 *
 * @example
 * const startTime = Date.now()
 * try {
 *   const result = await executeTool(params)
 *   await executePostToolUseHooks(task, toolUse, params, result, true, undefined, startTime)
 * } catch (error) {
 *   await executePostToolUseHooks(task, toolUse, params, null, false, error, startTime)
 * }
 */
export async function executePostToolUseHooks<TName extends ToolName>(
	task: Task,
	toolUse: ToolUse<TName>,
	params: Record<string, unknown>,
	result: unknown,
	success: boolean,
	error?: Error,
	startTime?: number,
): Promise<HookResult> {
	// TODO: Implementation for Phase 1

	const endTime = Date.now()
	const context: PostToolUseContext<TName> = {
		task,
		toolUse,
		params,
		result,
		success,
		error,
		startTime: startTime || endTime,
		endTime,
		duration: endTime - (startTime || endTime),
	}

	// Aggregated result
	let aggregatedResult: HookResult = {
		continue: true,
	}

	// Execute hooks in sequence
	for (const hook of hookRegistry.postToolUseHooks) {
		try {
			const result = await hook(context)

			// Accumulate context to inject
			if (result.contextToInject) {
				aggregatedResult.contextToInject =
					(aggregatedResult.contextToInject || "") + "\n" + result.contextToInject
			}
		} catch (error) {
			// Hook errors should not break the tool flow
			console.error(`PostToolUse hook failed:`, error)
		}
	}

	// Post-write: build and append trace record for write_to_file
	try {
		if (toolUse.name === "write_to_file" && success) {
			const filePath = String(params["path"] || params["file"] || "")
			let code = ""
			if (typeof params["content"] === "string" && params["content"].length > 0) {
				code = params["content"] as string
			} else if (filePath) {
				try {
					const uri = vscode.Uri.file(path.join(task.cwd, filePath))
					const disk = await vscode.workspace.fs.readFile(uri)
					code = Buffer.from(disk).toString("utf-8")
				} catch (e) {
					// ignore read errors
				}
			}

			const intentId = (task as any).getActiveIntentId
				? (task as any).getActiveIntentId()
				: (params["intent_id"] as string | undefined)
			const modelId =
				(task as any).cachedStreamingModel?.id ?? (task as any).apiConfiguration?.modelId ?? "unknown"
			const gitSha = await computeGitSha(task.cwd)
			const trace = buildTraceRecord(filePath, code, String(intentId || ""), String(modelId), task.taskId)
			// annotate with vcs revision if available
			;(trace as any).git_sha = gitSha
			await appendTraceRecord(trace, task.cwd)
		}
	} catch (err) {
		console.error("[HookEngine] Failed to append trace record:", err)
	}

	return aggregatedResult
}

/**
 * Clears all registered hooks. Useful for testing or resetting state.
 */
export function clearAllHooks(): void {
	hookRegistry.preToolUseHooks = []
	hookRegistry.postToolUseHooks = []
}

/**
 * Requests Human-in-the-Loop (HITL) authorization for DESTRUCTIVE operations.
 * Shows a modal dialog requiring user approval before proceeding.
 *
 * @param toolName - Name of the tool requiring authorization
 * @param args - Tool arguments for context
 * @returns true if approved, false if rejected
 *
 * @example
 * const approved = await requestHITLAuthorization("write_to_file", { path: "src/main.ts" })
 * if (!approved) {
 *   return { continue: false, reason: "User rejected operation" }
 * }
 */
export async function requestHITLAuthorization(toolName: string, args: any): Promise<boolean> {
	const options = ["Approve", "Reject"]

	// Format args for display
	const argsPreview = JSON.stringify(args, null, 2).substring(0, 200)
	const detail = `This is a DESTRUCTIVE operation.\n\nTool: ${toolName}\nArgs: ${argsPreview}${argsPreview.length >= 200 ? "..." : ""}\n\nDo you approve?`

	const selection = await vscode.window.showWarningMessage(
		`⚠️ Governance Alert: ${toolName}`,
		{ modal: true, detail },
		...options,
	)

	return selection === "Approve"
}

/**
 * Formats a rejection error as structured JSON for LLM self-correction.
 *
 * @param reason - Human-readable reason for rejection
 * @param suggestion - Suggested action for the agent to take
 * @param blockedReason - Machine-readable error code
 * @returns JSON-formatted error string
 *
 * @example
 * const error = formatRejectionError(
 *   "Scope Violation",
 *   "Request scope expansion via intent update",
 *   "SCOPE_VIOLATION"
 * )
 */
export function formatRejectionError(reason: string, suggestion: string, blockedReason?: string): string {
	return JSON.stringify(
		{
			error: "HOOK_BLOCKED",
			reason: reason,
			suggestion: suggestion,
			blocked_reason: blockedReason || "VALIDATION_FAILED",
			timestamp: new Date().toISOString(),
		},
		null,
		2,
	)
}
