import { Task } from "../task/Task"
import type { ToolUse } from "../../shared/tools"
import type { ToolName } from "@roo-code/types"
import { OrchestrationDataModel, type ActiveIntent } from "../orchestration/OrchestrationDataModel"
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { execSync } from "child_process"

/**
 * Hook execution result
 */
export interface HookResult {
	shouldProceed: boolean
	errorMessage?: string
	injectedContext?: string
}

/**
 * Hook Engine - Middleware boundary for tool execution
 * Implements Pre-Hook and Post-Hook interception
 */
export class HookEngine {
	private dataModel: OrchestrationDataModel

	constructor(workspaceRoot: string) {
		this.dataModel = new OrchestrationDataModel(workspaceRoot)
	}

	/**
	 * UI-blocking authorization (HITL): pause execution until the user approves/rejects.
	 *
	 * We intentionally make this a modal dialog to "pause the Promise chain" as required by `document.md`.
	 * To avoid excessive prompts, we authorize once per intent per task session.
	 */
	private async ensureIntentAuthorized(
		task: Task,
		intent: ActiveIntent,
		toolName: ToolName,
		details?: { filePath?: string; command?: string },
	): Promise<{ approved: boolean; message?: string }> {
		const approvedSetKey = "__approvedIntentIds" as const
		const approved = ((task as any)[approvedSetKey] ?? []) as string[]

		// Authorize once per intent per task session.
		if (approved.includes(intent.id)) {
			return { approved: true }
		}

		const detailLines: string[] = []
		if (details?.filePath) detailLines.push(`File: ${details.filePath}`)
		if (details?.command) detailLines.push(`Command: ${details.command}`)
		if (detailLines.length === 0) detailLines.push(`Tool: ${toolName}`)

		const message =
			`Approve intent evolution for this task?\n\n` +
			`Intent: ${intent.id} — ${intent.name}\n` +
			detailLines.join("\n") +
			`\n\nThis will allow destructive actions under this intent for the current task session.`

		const answer = await vscode.window.showWarningMessage(message, { modal: true }, "Approve", "Reject")

		if (answer !== "Approve") {
			return { approved: false, message: "User rejected the intent evolution request." }
		}

		;(task as any)[approvedSetKey] = [...approved, intent.id]
		return { approved: true }
	}

	/**
	 * Initialize orchestration directory
	 */
	async initialize(): Promise<void> {
		await this.dataModel.initialize()
	}

	/**
	 * Pre-Hook: Intercept tool execution before it happens
	 * Enforces intent context injection and scope validation
	 */
	async preHook(toolName: ToolName, toolUse: ToolUse, task: Task): Promise<HookResult> {
		// Check if this is select_active_intent - allow it through
		if (toolName === "select_active_intent") {
			return { shouldProceed: true }
		}

		// For all other tools, check if active intent is set
		const activeIntentId = (task as any).activeIntentId as string | undefined
		let activeIntent = (task as any).activeIntent as ActiveIntent | undefined

		// Destructive tools require intent selection
		const destructiveTools: ToolName[] = [
			"write_to_file",
			"edit_file",
			"apply_diff",
			"apply_patch",
			"edit",
			"search_replace",
			"search_and_replace",
			"execute_command",
		]

		if (destructiveTools.includes(toolName)) {
			if (!activeIntentId) {
				return {
					shouldProceed: false,
					errorMessage:
						"You must cite a valid active Intent ID. Call select_active_intent(intent_id) before making code changes.",
				}
			}

			// Load intent details (for authorization prompt + scope checks)
			if (!activeIntent) {
				const loadedIntent = await this.dataModel.getIntent(activeIntentId)
				if (loadedIntent) {
					activeIntent = loadedIntent
					;(task as any).activeIntent = activeIntent
				}
			}

			if (!activeIntent) {
				return {
					shouldProceed: false,
					errorMessage: `Intent "${activeIntentId}" not found in active_intents.yaml. Please select a valid intent ID.`,
				}
			}

			// Validate scope for write operations
			if (toolName === "write_to_file" || toolName === "edit_file") {
				const filePath = (toolUse.params as any).path as string | undefined
				if (filePath) {
					const scopeValid = await this.validateScope(activeIntentId, filePath, task.cwd)
					if (!scopeValid.valid) {
						return {
							shouldProceed: false,
							errorMessage: `Scope Violation: ${activeIntentId} is not authorized to edit ${filePath}. ${scopeValid.message}`,
						}
					}

					// UI-blocking authorization (HITL)
					const auth = await this.ensureIntentAuthorized(task, activeIntent, toolName, { filePath })
					if (!auth.approved) {
						return {
							shouldProceed: false,
							errorMessage: auth.message || "Operation rejected by user.",
						}
					}
				}
			} else if (toolName === "execute_command") {
				const command = (toolUse.params as any).command as string | undefined
				const auth = await this.ensureIntentAuthorized(task, activeIntent, toolName, { command })
				if (!auth.approved) {
					return {
						shouldProceed: false,
						errorMessage: auth.message || "Operation rejected by user.",
					}
				}
			} else {
				// Other destructive tools: still require UI-blocking authorization.
				const auth = await this.ensureIntentAuthorized(task, activeIntent, toolName)
				if (!auth.approved) {
					return {
						shouldProceed: false,
						errorMessage: auth.message || "Operation rejected by user.",
					}
				}
			}
		}

		return { shouldProceed: true }
	}

	/**
	 * Post-Hook: Execute after tool completes
	 * Updates trace logs and intent state
	 */
	async postHook(toolName: ToolName, toolUse: ToolUse, task: Task, success: boolean, result?: string): Promise<void> {
		const activeIntentId = (task as any).activeIntentId as string | undefined

		// Only log destructive operations
		const destructiveTools: ToolName[] = [
			"write_to_file",
			"edit_file",
			"apply_diff",
			"apply_patch",
			"edit",
			"search_replace",
			"search_and_replace",
		]

		if (destructiveTools.includes(toolName) && activeIntentId && success) {
			await this.logTraceEntry(toolName, toolUse, task, activeIntentId, result)
		}
	}

	/**
	 * Validate that a file path is within the intent's owned scope
	 */
	private async validateScope(
		intentId: string,
		filePath: string,
		workspaceRoot: string,
	): Promise<{ valid: boolean; message?: string }> {
		try {
			const intent = await this.dataModel.getIntent(intentId)
			if (!intent) {
				return { valid: false, message: "Intent not found" }
			}

			const normalizedPath = path.normalize(filePath)
			const absolutePath = path.resolve(workspaceRoot, normalizedPath)

			// Check if file matches any scope pattern
			for (const scopePattern of intent.owned_scope) {
				// Simple glob matching (can be enhanced with minimatch later)
				if (this.matchesPattern(normalizedPath, scopePattern)) {
					return { valid: true }
				}
			}

			return {
				valid: false,
				message: `File is outside intent scope. Request scope expansion or use a different intent.`,
			}
		} catch (error) {
			console.error("Scope validation error:", error)
			return { valid: true } // Fail open on error
		}
	}

	/**
	 * Simple pattern matching (supports ** and *)
	 */
	private matchesPattern(filePath: string, pattern: string): boolean {
		// Convert glob pattern to regex
		const regexPattern = pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\//g, "\\/")
		const regex = new RegExp(`^${regexPattern}$`)
		return regex.test(filePath)
	}

	/**
	 * Log trace entry to agent_trace.jsonl
	 */
	private async logTraceEntry(
		toolName: ToolName,
		toolUse: ToolUse,
		task: Task,
		intentId: string,
		result?: string,
	): Promise<void> {
		try {
			// Get current git revision
			let gitRevision = "unknown"
			try {
				gitRevision = execSync("git rev-parse HEAD", { cwd: task.cwd, encoding: "utf-8" }).trim()
			} catch {
				// Git not available or not a git repo
			}

			// Extract file path and content from tool params
			const params = toolUse.params as any
			const filePath = params.path as string | undefined

			if (!filePath) {
				return // Can't log without file path
			}

			// Read file content to compute hash
			const absolutePath = path.resolve(task.cwd, filePath)
			let fileContent = ""
			let startLine = 1
			let endLine = 1

			try {
				fileContent = await fs.readFile(absolutePath, "utf-8")
				const lines = fileContent.split("\n")
				endLine = lines.length

				// If we have line numbers in params, use them
				if (params.start_line !== undefined && params.end_line !== undefined) {
					startLine = params.start_line
					endLine = params.end_line
				}
			} catch {
				// File doesn't exist or can't be read
				return
			}

			// Extract relevant code block
			const lines = fileContent.split("\n")
			const relevantLines = lines.slice(Math.max(0, startLine - 1), endLine)
			const codeBlock = relevantLines.join("\n")
			const contentHash = this.dataModel.computeContentHash(codeBlock)

			// Get model identifier from task
			const modelId = task.api.getModel().id

			// Build trace entry
			const traceEntry = {
				id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				timestamp: new Date().toISOString(),
				vcs: {
					revision_id: gitRevision,
				},
				files: [
					{
						relative_path: filePath,
						conversations: [
							{
								url: `task-${task.taskId}`,
								contributor: {
									entity_type: "AI" as const,
									model_identifier: modelId,
								},
								ranges: [
									{
										start_line: startLine,
										end_line: endLine,
										content_hash: `sha256:${contentHash}`,
									},
								],
								related: [
									{
										type: "intent" as const,
										value: intentId,
									},
								],
							},
						],
					},
				],
			}

			await this.dataModel.appendTraceEntry(traceEntry)
		} catch (error) {
			console.error("Failed to log trace entry:", error)
			// Don't throw - logging failures shouldn't break tool execution
		}
	}
}
