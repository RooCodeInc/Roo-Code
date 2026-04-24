import { Task } from "../core/task/Task"
import type { ToolUse } from "../shared/tools"
import type { ToolName } from "@roo-code/types"
import { OrchestrationDataModel, type ActiveIntent } from "./OrchestrationDataModel"
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { execSync } from "child_process"

/**
 * Standardized error format for autonomous recovery (Phase 2 requirement)
 * LLM can parse this JSON and self-correct without crashing
 */
export interface HookError {
	error_type: string
	message: string
	details?: {
		[key: string]: any
	}
	recoverable: boolean
	suggested_action?: string
}

/**
 * Hook execution result
 */
export interface HookResult {
	shouldProceed: boolean
	errorMessage?: string
	structuredError?: HookError // Phase 2: Structured error for autonomous recovery
	injectedContext?: string
}

/**
 * Hook Engine - Middleware boundary for tool execution
 * Implements Pre-Hook and Post-Hook interception
 */
export class HookEngine {
	private dataModel: OrchestrationDataModel
	private initialized = false
	// Phase 4: Track file hashes for optimistic locking
	private fileHashCache: Map<string, { hash: string; timestamp: number }> = new Map()
	private readonly HASH_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

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
		if (this.initialized) return
		await this.dataModel.initialize()
		this.initialized = true
	}

	/**
	 * Extract the primary target file path for a tool call (best-effort).
	 * This enables consistent scope checks across all file-mutating tools.
	 */
	private extractTargetFilePath(toolName: ToolName, toolUse: ToolUse): string | undefined {
		const nativeArgs = (toolUse as any).nativeArgs
		const params = toolUse.params as any

		// Direct path/file_path parameters
		const direct = (nativeArgs?.path || nativeArgs?.file_path || params?.path || params?.file_path) as
			| string
			| undefined
		if (direct) return direct

		// apply_patch: infer from patch content
		const patchContent = nativeArgs?.patch || params?.patch
		if (patchContent && typeof patchContent === "string") {
			// Unified diff: --- a/foo or +++ b/foo
			const unifiedDiffMatch = patchContent.match(/^(?:---|\+\+\+)\s+(?:a\/|b\/)?(.+?)(?:\s|$)/m)
			if (unifiedDiffMatch?.[1]) return unifiedDiffMatch[1].trim()

			// Custom format: "Update File: foo"
			const fileMatches = patchContent.match(/(?:Update|Create|Delete)\s+File:\s*(.+)/gm)
			if (fileMatches?.length) {
				const match = fileMatches[0].match(/(?:Update|Create|Delete)\s+File:\s*(.+)/)
				if (match?.[1]) return match[1].trim()
			}
		}

		return undefined
	}

	/**
	 * Create standardized error for autonomous recovery (Phase 2 requirement)
	 */
	private createStructuredError(
		errorType: string,
		message: string,
		details?: Record<string, any>,
		recoverable: boolean = true,
		suggestedAction?: string,
	): HookError {
		return {
			error_type: errorType,
			message,
			details,
			recoverable,
			suggested_action: suggestedAction,
		}
	}

	/**
	 * Format error message with structured JSON for LLM parsing (Phase 2 requirement)
	 */
	private formatErrorForLLM(error: HookError): string {
		const jsonError = JSON.stringify(error, null, 2)
		return `${error.message}\n\n<error_details>\n${jsonError}\n</error_details>`
	}

	/**
	 * Check if workspace has existing code files to analyze
	 * Used to determine if agent should reverse engineer from code or create from prompt
	 */
	private async hasExistingCode(workspaceRoot: string): Promise<boolean> {
		const commonCodeDirs = ["src", "lib", "app", "components", "pages", "scripts", "server", "client"]
		const commonCodeExtensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".go", ".rs", ".cpp", ".c"]

		try {
			// Check common code directories
			for (const dir of commonCodeDirs) {
				const dirPath = path.join(workspaceRoot, dir)
				try {
					const entries = await fs.readdir(dirPath, { withFileTypes: true })
					if (entries.length > 0) {
						return true
					}
				} catch {
					// Directory doesn't exist, continue
				}
			}

			// Check root directory for code files
			const rootEntries = await fs.readdir(workspaceRoot, { withFileTypes: true })
			for (const entry of rootEntries) {
				if (entry.isFile()) {
					const ext = path.extname(entry.name).toLowerCase()
					if (commonCodeExtensions.includes(ext)) {
						return true
					}
				}
			}

			return false
		} catch {
			return false
		}
	}

	/**
	 * Phase 4: Track file hash when file is read (for optimistic locking)
	 */
	trackFileRead(filePath: string, content: string): void {
		const hash = this.dataModel.computeContentHash(content)
		this.fileHashCache.set(filePath, {
			hash,
			timestamp: Date.now(),
		})
		console.log(`[HOOK DEBUG] Tracked file read: ${filePath}, hash: ${hash.substring(0, 8)}...`)
	}

	/**
	 * Phase 4: Validate file hasn't changed since last read (optimistic locking)
	 */
	private async validateFileNotStale(
		filePath: string,
		workspaceRoot: string,
	): Promise<{ valid: boolean; message?: string }> {
		const cached = this.fileHashCache.get(filePath)
		if (!cached) {
			// No cached hash - allow write (first write or cache expired)
			return { valid: true }
		}

		// Check cache TTL
		if (Date.now() - cached.timestamp > this.HASH_CACHE_TTL_MS) {
			// Cache expired - allow write
			this.fileHashCache.delete(filePath)
			return { valid: true }
		}

		// Read current file hash
		try {
			const absolutePath = path.resolve(workspaceRoot, filePath)
			const currentContent = await fs.readFile(absolutePath, "utf-8")
			const currentHash = this.dataModel.computeContentHash(currentContent)

			if (currentHash !== cached.hash) {
				// File has changed - stale!
				const error = this.createStructuredError(
					"stale_file",
					`File ${filePath} has been modified since it was last read. Please re-read the file before making changes.`,
					{
						file_path: filePath,
						expected_hash: cached.hash.substring(0, 16),
						actual_hash: currentHash.substring(0, 16),
						reason: "file_modified_after_read",
					},
					true,
					"Re-read the file using read_file tool, then retry the write operation",
				)

				return {
					valid: false,
					message: this.formatErrorForLLM(error),
				}
			}

			// File is still the same - valid
			return { valid: true }
		} catch (error) {
			// File might not exist (new file) - allow write
			if ((error as any).code === "ENOENT") {
				return { valid: true }
			}
			// Other error - fail open (allow write)
			console.warn(`[HOOK DEBUG] Error validating file hash for ${filePath}:`, error)
			return { valid: true }
		}
	}

	/**
	 * Pre-Hook: Intercept tool execution before it happens
	 * Enforces intent context injection and scope validation
	 *
	 * Per document.md Phase 2: The Gatekeeper - verifies agent has declared a valid intent_id.
	 * If not, blocks execution and returns error message.
	 *
	 * Enhanced: Checks for architecture.md existence to guide agent in establishing intents
	 * before code changes (Plan-First strategy per document.md).
	 *
	 * Phase 4: Also validates optimistic locking (file hasn't changed since read)
	 */
	async preHook(toolName: ToolName, toolUse: ToolUse, task: Task): Promise<HookResult> {
		// DEBUG: Log all hook calls
		console.log(
			`[HOOK DEBUG] preHook called - Tool: ${toolName}, ActiveIntentId: ${(task as any).activeIntentId || "undefined"}`,
		)

		// Check if this is select_active_intent - verify it's not in .intentignore
		if (toolName === "select_active_intent") {
			const params = toolUse.params as any
			const intentId = params?.intent_id as string | undefined

			if (intentId) {
				// Phase 2: Check if intent is in .intentignore
				const isIgnored = await this.dataModel.isIntentIgnored(intentId)
				if (isIgnored) {
					const error = this.createStructuredError(
						"intent_protected",
						`Intent "${intentId}" is protected and cannot be modified. This intent is listed in .orchestration/.intentignore.`,
						{
							intent_id: intentId,
							reason: "intent_in_ignore_list",
						},
						false, // Not recoverable - user must manually remove from ignore list
						"Select a different intent or ask user to remove this intent from .intentignore",
					)

					return {
						shouldProceed: false,
						errorMessage: this.formatErrorForLLM(error),
						structuredError: error,
					}
				}
			}

			return { shouldProceed: true }
		}

		// Special case: create_intent is always allowed (it's a meta-tool for creating intents)
		if (toolName === "create_intent") {
			console.log(`[HOOK DEBUG] create_intent is always allowed (meta-tool for intent management)`)
			return { shouldProceed: true }
		}

		// For all other tools, check if active intent is set
		const activeIntentId = (task as any).activeIntentId as string | undefined
		let activeIntent = (task as any).activeIntent as ActiveIntent | undefined

		// Destructive tools require intent selection (document.md Phase 2 requirement)
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
			console.log(
				`[HOOK DEBUG] Destructive tool detected: ${toolName}, activeIntentId: ${activeIntentId || "undefined"}`,
			)
			if (!activeIntentId) {
				// Check if docs/Architecture.md exists (Plan-First strategy per document.md)
				const archPath = path.join(task.cwd, "docs", "Architecture.md")
				let archExists = false
				try {
					await fs.access(archPath)
					archExists = true
					console.log(`[HOOK DEBUG] docs/Architecture.md exists at: ${archPath}`)
				} catch {
					archExists = false
					console.log(`[HOOK DEBUG] docs/Architecture.md NOT found at: ${archPath}`)
				}

				if (!archExists) {
					console.log(`[HOOK DEBUG] docs/Architecture.md not found - showing error`)
					const error = this.createStructuredError(
						"architecture_missing",
						`docs/Architecture.md is required but not found. Please create docs/Architecture.md with your project architecture and come again.`,
						{
							required_file: "docs/Architecture.md",
							reason: "file_not_found",
							required_action: "create_architecture_file",
							instructions: [
								"Create docs/Architecture.md file in your project root",
								"Document your project structure, directory layout, and intent areas",
								"Then try your operation again",
							],
						},
						true,
						"Create docs/Architecture.md file with project architecture, then try again",
					)

					return {
						shouldProceed: false,
						errorMessage: this.formatErrorForLLM(error),
						structuredError: error,
					}
				}

				// docs/Architecture.md exists but no intent selected
				const intentsData = await this.dataModel.readActiveIntents()
				if (intentsData.active_intents.length === 0) {
					console.log(
						`[HOOK DEBUG] active_intents.yaml is empty - guide agent to create intents from docs/Architecture.md`,
					)
					const error = this.createStructuredError(
						"intents_missing",
						`No active intent selected. docs/Architecture.md exists but active_intents.yaml is empty.`,
						{
							architecture_exists: true,
							architecture_file: "docs/Architecture.md",
							intents_file_empty: true,
							required_action: "create_intents_from_architecture",
							instructions: [
								"Read docs/Architecture.md to understand the project structure",
								"Use create_intent(prompt) to create intents based on docs/Architecture.md content",
								"Create intents for each major area (API, services, types, etc.)",
								"Then call select_active_intent(intent_id) before making code changes",
							],
						},
						true,
						"Read docs/Architecture.md, use create_intent() to create intents based on it, then call select_active_intent(intent_id)",
					)

					return {
						shouldProceed: false,
						errorMessage: this.formatErrorForLLM(error),
						structuredError: error,
					}
				}

				// docs/Architecture.md exists and intents exist, but none selected
				console.log(
					`[HOOK DEBUG] docs/Architecture.md exists, intents exist, but no intent selected - blocking`,
				)
				const error = this.createStructuredError(
					"intent_not_selected",
					"You must cite a valid active Intent ID. Call select_active_intent(intent_id) before making code changes.",
					{
						available_intents_file: ".orchestration/active_intents.yaml",
						available_intents_count: intentsData.active_intents.length,
						available_intent_ids: intentsData.active_intents.map((i) => i.id),
					},
					true,
					`Call select_active_intent(intent_id) with one of the available intent IDs from active_intents.yaml`,
				)

				return {
					shouldProceed: false,
					errorMessage: this.formatErrorForLLM(error),
					structuredError: error,
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
				const intentsData = await this.dataModel.readActiveIntents()
				const error = this.createStructuredError(
					"intent_not_found",
					`Intent "${activeIntentId}" not found in active_intents.yaml. Please select a valid intent ID.`,
					{
						requested_intent_id: activeIntentId,
						available_intent_ids: intentsData.active_intents.map((i) => i.id),
						available_intents_count: intentsData.active_intents.length,
					},
					true,
					`Use select_active_intent(intent_id) with one of the available intent IDs: ${intentsData.active_intents.map((i) => i.id).join(", ")}`,
				)

				return {
					shouldProceed: false,
					errorMessage: this.formatErrorForLLM(error),
					structuredError: error,
				}
			}

			// Validate scope for file-mutating tools
			const fileMutatingTools: ToolName[] = [
				"write_to_file",
				"edit_file",
				"apply_diff",
				"apply_patch",
				"edit",
				"search_replace",
				"search_and_replace",
			]

			if (fileMutatingTools.includes(toolName)) {
				const filePath = this.extractTargetFilePath(toolName, toolUse)

				if (filePath) {
					// Phase 4: Optimistic locking - check if file has changed since read
					const staleCheck = await this.validateFileNotStale(filePath, task.cwd)
					if (!staleCheck.valid) {
						return {
							shouldProceed: false,
							errorMessage: staleCheck.message,
							structuredError: {
								error_type: "stale_file",
								message: staleCheck.message || "File has been modified",
								recoverable: true,
								suggested_action: "Re-read the file and retry",
							},
						}
					}
					const scopeValid = await this.validateScope(activeIntentId, filePath, task.cwd)
					if (!scopeValid.valid) {
						// Check if there's any intent that matches this file path
						const allIntents = await this.dataModel.readActiveIntents()
						let matchingIntent = null

						for (const intent of allIntents.active_intents) {
							const checkScope = await this.validateScope(intent.id, filePath, task.cwd)
							if (checkScope.valid) {
								matchingIntent = intent
								break
							}
						}

						// If no matching intent found, guide agent to create one
						if (!matchingIntent) {
							const archPath = path.join(task.cwd, "docs", "Architecture.md")
							let archExists = false
							try {
								await fs.access(archPath)
								archExists = true
							} catch {
								archExists = false
							}

							if (!archExists) {
								const error = this.createStructuredError(
									"architecture_missing",
									`docs/Architecture.md is required but not found. Please create docs/Architecture.md with your project architecture and come again.`,
									{
										required_file: "docs/Architecture.md",
										file_path: filePath,
										reason: "file_not_found",
										required_action: "create_architecture_file",
										instructions: [
											"Create docs/Architecture.md file in your project root",
											"Document your project structure, directory layout, and intent areas",
											"Then try your operation again",
										],
									},
									true,
									"Create docs/Architecture.md file with project architecture, then try again",
								)

								return {
									shouldProceed: false,
									errorMessage: this.formatErrorForLLM(error),
									structuredError: error,
								}
							}

							// Guide agent to create intent based on file path and docs/Architecture.md
							const inferredScope = this.inferScopeFromFilePath(filePath)
							const error = this.createStructuredError(
								"no_matching_intent",
								`No active intent whose owned scope includes ${filePath}. Create a new intent based on docs/Architecture.md.`,
								{
									file_path: filePath,
									architecture_file: "docs/Architecture.md",
									inferred_scope: inferredScope,
									action: "create_intent",
									instructions: [
										`Read docs/Architecture.md to understand the project structure`,
										`Call create_intent(prompt: "Intent for ${inferredScope}") to create a new intent`,
										`The tool will infer scope, constraints, and acceptance criteria from docs/Architecture.md`,
										`Then call select_active_intent(intent_id) with the newly created intent ID`,
									],
								},
								true,
								`Use create_intent() to create a new intent for ${inferredScope} based on docs/Architecture.md, then select it`,
							)

							return {
								shouldProceed: false,
								errorMessage: this.formatErrorForLLM(error),
								structuredError: error,
							}
						}

						// There is a matching intent, but it's not the selected one
						const error = this.createStructuredError(
							"scope_violation",
							`Scope Violation: ${activeIntentId} is not authorized to edit ${filePath}. Use intent ${matchingIntent.id} instead.`,
							{
								intent_id: activeIntentId,
								intent_name: activeIntent.name,
								file_path: filePath,
								intent_scope: activeIntent.owned_scope,
								matching_intent_id: matchingIntent.id,
								matching_intent_name: matchingIntent.name,
								violation_reason: scopeValid.message,
							},
							true,
							`Call select_active_intent(${matchingIntent.id}) to use the intent that covers ${filePath}`,
						)

						return {
							shouldProceed: false,
							errorMessage: this.formatErrorForLLM(error),
							structuredError: error,
						}
					}

					// UI-blocking authorization (HITL)
					const auth = await this.ensureIntentAuthorized(task, activeIntent, toolName, { filePath })
					if (!auth.approved) {
						const error = this.createStructuredError(
							"user_rejected",
							auth.message || "Operation rejected by user.",
							{
								intent_id: activeIntent.id,
								intent_name: activeIntent.name,
								tool_name: toolName,
								file_path: filePath,
								rejection_reason: "user_denied_authorization",
							},
							false,
							"User must approve the operation or select a different approach",
						)

						return {
							shouldProceed: false,
							errorMessage: this.formatErrorForLLM(error),
							structuredError: error,
						}
					}
				}
			} else if (toolName === "execute_command") {
				const command = (toolUse.params as any).command as string | undefined
				const auth = await this.ensureIntentAuthorized(task, activeIntent, toolName, { command })
				if (!auth.approved) {
					const error = this.createStructuredError(
						"user_rejected",
						auth.message || "Operation rejected by user.",
						{
							intent_id: activeIntent.id,
							intent_name: activeIntent.name,
							tool_name: toolName,
							command: command,
							rejection_reason: "user_denied_authorization",
						},
						false,
						"User must approve the operation or select a different approach",
					)

					return {
						shouldProceed: false,
						errorMessage: this.formatErrorForLLM(error),
						structuredError: error,
					}
				}
			} else {
				// Other destructive tools: still require UI-blocking authorization.
				const auth = await this.ensureIntentAuthorized(task, activeIntent, toolName)
				if (!auth.approved) {
					const error = this.createStructuredError(
						"user_rejected",
						auth.message || "Operation rejected by user.",
						{
							intent_id: activeIntent.id,
							intent_name: activeIntent.name,
							tool_name: toolName,
							rejection_reason: "user_denied_authorization",
						},
						false,
						"User must approve the operation or select a different approach",
					)

					return {
						shouldProceed: false,
						errorMessage: this.formatErrorForLLM(error),
						structuredError: error,
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
			"execute_command",
		]

		if (destructiveTools.includes(toolName) && activeIntentId && success) {
			console.log(`[HOOK DEBUG] postHook - logging trace for tool: ${toolName}, intent: ${activeIntentId}`)
			await this.logTraceEntry(toolName, toolUse, task, activeIntentId, result)

			// Phase 4: Update file hash cache after successful write
			const nativeArgs = (toolUse as any).nativeArgs
			const params = toolUse.params as any
			const filePath = (nativeArgs?.path || nativeArgs?.file_path || params?.path || params?.file_path) as
				| string
				| undefined

			if (filePath) {
				try {
					const absolutePath = path.resolve(task.cwd, filePath)
					const newContent = await fs.readFile(absolutePath, "utf-8")
					this.trackFileRead(filePath, newContent)
					console.log(`[HOOK DEBUG] Updated file hash cache after write: ${filePath}`)
				} catch (error) {
					// File might not exist or be unreadable - ignore
					console.warn(`[HOOK DEBUG] Could not update file hash cache for ${filePath}:`, error)
				}
			}
		} else {
			console.log(
				`[HOOK DEBUG] postHook - skipping trace: tool=${toolName}, intent=${activeIntentId || "none"}, success=${success}`,
			)
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

			// Check if file matches any scope pattern
			for (const scopePattern of intent.owned_scope) {
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
		// Normalize both to forward slashes for consistent matching
		const normalizedFile = filePath.replace(/\\/g, "/")
		const normalizedPattern = pattern.replace(/\\/g, "/")

		// Convert glob pattern to regex
		const regexPattern = normalizedPattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\//g, "\\/")
		const regex = new RegExp(`^${regexPattern}$`)
		return regex.test(normalizedFile)
	}

	/**
	 * Infer scope pattern from file path
	 */
	private inferScopeFromFilePath(filePath: string): string {
		const normalizedPath = path.normalize(filePath).replace(/\\/g, "/")
		const parts = normalizedPath.split("/")

		// If it's in src/, infer the scope based on the directory structure
		if (parts[0] === "src" && parts.length > 1) {
			const dir = parts[1]
			return `src/${dir}/**`
		}

		// Default: use the parent directory pattern
		if (parts.length > 1) {
			const parentDir = parts.slice(0, -1).join("/")
			return `${parentDir}/**`
		}

		// Fallback: just the file's directory
		return path.dirname(normalizedPath).replace(/\\/g, "/") + "/**"
	}

	/**
	 * Log trace entry to agent_trace.jsonl
	 *
	 * FIX: Now correctly extracts file paths from both nativeArgs and params,
	 * handling different param names across tools:
	 * - write_to_file uses "path"
	 * - edit_file, edit, search_replace use "file_path"
	 * - apply_diff uses "path"
	 * - apply_patch extracts paths from the patch content
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

			// FIX: Extract file path from nativeArgs first (typed), then fall back to params
			// Different tools use different parameter names for the file path
			const nativeArgs = (toolUse as any).nativeArgs
			const params = toolUse.params as any

			let filePath = // nativeArgs (preferred - typed)
			(nativeArgs?.path ||
				nativeArgs?.file_path ||
				// params (fallback - stringified)
				params?.path ||
				params?.file_path) as string | undefined

			// If no direct file path (e.g., apply_patch), extract from patch content
			let resolvedFilePath = filePath
			if (!resolvedFilePath) {
				const patchContent = nativeArgs?.patch || params?.patch
				if (patchContent && typeof patchContent === "string") {
					// Try unified diff format first: "--- a/path/to/file.ts" or "+++ b/path/to/file.ts"
					const unifiedDiffMatch = patchContent.match(/^(?:---|\+\+\+)\s+(?:a\/|b\/)?(.+?)(?:\s|$)/m)
					if (unifiedDiffMatch && unifiedDiffMatch[1]) {
						resolvedFilePath = unifiedDiffMatch[1].trim()
					} else {
						// Try custom format: "Update File: path/to/file.ts" or "Create File: path/to/file.ts"
						const fileMatches = patchContent.match(/(?:Update|Create|Delete)\s+File:\s*(.+)/gm)
						if (fileMatches && fileMatches.length > 0) {
							// Use the first file path found
							const match = fileMatches[0].match(/(?:Update|Create|Delete)\s+File:\s*(.+)/)
							if (match && match[1]) {
								resolvedFilePath = match[1].trim()
							}
						}
					}
				}
			}

			if (!resolvedFilePath) {
				console.warn(
					`[HOOK DEBUG] logTraceEntry - no file path found for tool ${toolName}. ` +
						`nativeArgs keys: ${nativeArgs ? Object.keys(nativeArgs).join(", ") : "none"}, ` +
						`params keys: ${params ? Object.keys(params).join(", ") : "none"}`,
				)
				return
			}

			console.log(
				`[HOOK DEBUG] logTraceEntry - tool: ${toolName}, file: ${resolvedFilePath}, intent: ${intentId}`,
			)

			// Read file content to compute hash
			const absolutePath = path.resolve(task.cwd, resolvedFilePath)
			let fileContent = ""
			let oldContent: string | null = null
			let startLine = 1
			let endLine = 1

			// Phase 3: Get old content for mutation classification
			// Try to get from cached hash or read from trace
			try {
				const cached = this.fileHashCache.get(resolvedFilePath)
				if (cached) {
					// We have a cached hash, but we need the actual content for classification
					// For now, we'll read the file and compare
					// In a more sophisticated implementation, we could store content snippets
				}

				fileContent = await fs.readFile(absolutePath, "utf-8")
				const lines = fileContent.split("\n")
				endLine = lines.length

				// If we have line numbers in params, use them
				if (params.start_line !== undefined && params.end_line !== undefined) {
					startLine = parseInt(params.start_line, 10) || 1
					endLine = parseInt(params.end_line, 10) || lines.length
				}

				// Phase 3: Try to get old content from task's diffViewProvider if available
				// This is a best-effort approach - in production, you might want a more robust solution
				if ((task as any).diffViewProvider?.originalContent !== undefined) {
					oldContent = (task as any).diffViewProvider.originalContent
				}
			} catch (readError) {
				console.warn(`[HOOK DEBUG] logTraceEntry - could not read file ${absolutePath}: ${readError}`)
				// File might have been deleted or moved - still log the trace entry
				// Use empty content for hash
			}

			// Extract relevant code block
			const lines = fileContent.split("\n")
			const relevantLines = lines.slice(Math.max(0, startLine - 1), endLine)
			const codeBlock = relevantLines.join("\n")
			const contentHash = this.dataModel.computeContentHash(codeBlock)

			// Phase 3: Classify mutation type
			const classification = this.dataModel.classifyMutation(oldContent, fileContent, resolvedFilePath)
			console.log(
				`[HOOK DEBUG] Mutation classification: ${classification.mutation_class} (${classification.confidence}) - ${classification.reason}`,
			)

			// Get model identifier from task
			const modelId = task.api.getModel().id

			// Build trace entry with Phase 3 enhancements
			const traceEntry = {
				id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				timestamp: new Date().toISOString(),
				tool_name: toolName,
				mutation_class: classification.mutation_class, // Phase 3: Include mutation classification
				vcs: {
					revision_id: gitRevision,
				},
				files: [
					{
						relative_path: resolvedFilePath,
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
			console.log(
				`[HOOK DEBUG] logTraceEntry - trace entry appended for ${resolvedFilePath} under intent ${intentId}`,
			)

			// Update the spatial map as living documentation (sidecar-only; should not affect usability).
			await this.updateIntentMapFromMutation({
				task,
				intentId,
				filePath: resolvedFilePath,
				startLine,
				endLine,
				mutationClass: classification.mutation_class,
				timestamp: traceEntry.timestamp,
			})
		} catch (error) {
			console.error("Failed to log trace entry:", error)
			// Don't throw - logging failures shouldn't break tool execution
		}
	}

	/**
	 * Keep `.orchestration/intent_map.md` updated so it acts as living documentation.
	 * Best-effort: failures should never block tool execution.
	 */
	private async updateIntentMapFromMutation(args: {
		task: Task
		intentId: string
		filePath: string
		startLine: number
		endLine: number
		mutationClass: "AST_REFACTOR" | "INTENT_EVOLUTION"
		timestamp: string
	}): Promise<void> {
		try {
			const mapPath = path.join(this.dataModel.getOrchestrationDir(), "intent_map.md")

			let content = ""
			try {
				content = await fs.readFile(mapPath, "utf-8")
			} catch {
				content = `# Intent Map

This file maps high-level business intents to physical files and AST nodes.

## Intents

`
			}

			// Best-effort intent metadata
			let intentName: string | undefined
			let intentStatus: string | undefined
			const cachedIntent = (args.task as any).activeIntent as ActiveIntent | undefined
			if (cachedIntent?.id === args.intentId) {
				intentName = cachedIntent.name
				intentStatus = cachedIntent.status
			} else {
				const loaded = await this.dataModel.getIntent(args.intentId)
				if (loaded) {
					intentName = loaded.name
					intentStatus = loaded.status
				}
			}

			const sectionTitle = intentName ? `${args.intentId}: ${intentName}` : `${args.intentId}`
			const changeLine = `  - ${args.timestamp}: \`${args.filePath}\` (lines ${args.startLine}-${args.endLine}) — ${args.mutationClass}`

			const headerRegex = new RegExp(`^##\\s+${this.escapeRegExp(args.intentId)}\\b.*$`, "m")
			const match = content.match(headerRegex)

			if (!match || match.index === undefined) {
				const statusLine = intentStatus ? `- **Status:** ${intentStatus}\n` : ""
				const section =
					`\n## ${sectionTitle}\n` +
					`- **Last Updated:** ${args.timestamp}\n` +
					statusLine +
					`- **Recent Changes:**\n` +
					`${changeLine}\n`
				await fs.writeFile(mapPath, content.trimEnd() + section + "\n", "utf-8")
				return
			}

			const sectionStart = match.index
			const afterHeaderIdx = content.indexOf("\n", sectionStart)
			const nextHeaderRel = content.slice(afterHeaderIdx + 1).search(/^##\s+/m)
			const sectionEnd = nextHeaderRel === -1 ? content.length : afterHeaderIdx + 1 + nextHeaderRel

			// Ensure Last Updated exists (insert right after header line)
			const headerLineEnd = afterHeaderIdx + 1
			const sectionSlice = content.slice(sectionStart, sectionEnd)
			if (sectionSlice.includes("- **Last Updated:**")) {
				content =
					content.slice(0, sectionStart) +
					sectionSlice.replace(/^\- \*\*Last Updated:\*\* .*$/m, `- **Last Updated:** ${args.timestamp}`) +
					content.slice(sectionEnd)
			} else {
				content =
					content.slice(0, headerLineEnd) +
					`- **Last Updated:** ${args.timestamp}\n` +
					content.slice(headerLineEnd)
			}

			// Recompute section bounds after possible insertion
			const updatedAfterHeaderIdx = content.indexOf("\n", sectionStart)
			const updatedNextHeaderRel = content.slice(updatedAfterHeaderIdx + 1).search(/^##\s+/m)
			const updatedSectionEnd =
				updatedNextHeaderRel === -1 ? content.length : updatedAfterHeaderIdx + 1 + updatedNextHeaderRel

			const updatedSection = content.slice(sectionStart, updatedSectionEnd)
			if (updatedSection.includes("- **Recent Changes:**")) {
				const rcIdx = content.indexOf("- **Recent Changes:**", sectionStart)
				const insertAt = content.indexOf("\n", rcIdx) + 1
				content = content.slice(0, insertAt) + changeLine + "\n" + content.slice(insertAt)
			} else {
				// Append block within the section
				const statusLine = intentStatus ? `- **Status:** ${intentStatus}\n` : ""
				const addBlock = `\n${statusLine}- **Recent Changes:**\n${changeLine}\n`
				content = content.slice(0, updatedSectionEnd) + addBlock + content.slice(updatedSectionEnd)
			}

			await fs.writeFile(mapPath, content, "utf-8")
		} catch (error) {
			console.warn("[HOOK DEBUG] Failed to update intent_map.md:", error)
		}
	}

	private escapeRegExp(input: string): string {
		return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	}
}
