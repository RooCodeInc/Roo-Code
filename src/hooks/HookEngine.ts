/**
 * Hook Engine - Middleware for Intent-Code Traceability
 *
 * This is the central middleware that intercepts all tool executions to:
 * 1. Enforce intent context injection (Pre-Hook)
 * 2. Validate scope and authorization
 * 3. Log traces and update documentation (Post-Hook)
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"
import { v4 as uuidv4 } from "uuid"
import {
	type HookContext,
	type PreHookResult,
	type PostHookResult,
	type ActiveIntent,
	type AgentTraceEntry,
	type MutationClass,
	classifyTool,
	computeContentHash,
	getOrchestrationDir,
	ensureOrchestrationDir,
	loadActiveIntents,
	saveActiveIntents,
	getIntentById,
	isFileInScope,
	getGitRevision,
} from "./types"

/**
 * Session state for tracking active intent across the conversation
 */
interface SessionState {
	activeIntentId: string | null
	taskId: string
	instanceId: string
	startedAt: string
}

/**
 * The Hook Engine - main middleware for intercepting tool executions
 */
export class HookEngine {
	private static instance: HookEngine | null = null
	private sessionState: SessionState | null = null
	private workspacePath: string = ""

	private constructor() {}

	/**
	 * Get singleton instance
	 */
	static getInstance(): HookEngine {
		if (!HookEngine.instance) {
			HookEngine.instance = new HookEngine()
		}
		return HookEngine.instance
	}

	/**
	 * Initialize the hook engine with workspace context
	 */
	initialize(workspacePath: string, taskId: string, instanceId: string): void {
		this.workspacePath = workspacePath
		this.sessionState = {
			activeIntentId: null,
			taskId,
			instanceId,
			startedAt: new Date().toISOString(),
		}
		console.log(`[HookEngine] Initialized for workspace: ${workspacePath}`)
	}

	/**
	 * Get the current active intent ID
	 */
	getActiveIntentId(): string | null {
		return this.sessionState?.activeIntentId || null
	}

	/**
	 * Set the active intent (called when agent selects an intent)
	 */
	async setActiveIntent(intentId: string): Promise<PreHookResult> {
		if (!this.sessionState) {
			return {
				allowed: false,
				errorMessage: "HookEngine not initialized",
			}
		}

		const intentsData = await loadActiveIntents(this.workspacePath)
		if (!intentsData) {
			return {
				allowed: false,
				errorMessage: "No active_intents.yaml found. Please initialize the orchestration directory.",
			}
		}

		const intent = getIntentById(intentsData, intentId)
		if (!intent) {
			return {
				allowed: false,
				errorMessage: `Intent ID '${intentId}' not found in active_intents.yaml`,
			}
		}

		// Update session state
		this.sessionState.activeIntentId = intentId

		// Update intent status to IN_PROGRESS
		intent.status = "IN_PROGRESS"
		intent.updated_at = new Date().toISOString()
		await saveActiveIntents(this.workspacePath, intentsData)

		// Generate context for injection
		const injectedContext = this.generateIntentContext(intent)

		console.log(`[HookEngine] Active intent set to: ${intentId}`)

		return {
			allowed: true,
			injectedContext,
		}
	}

	/**
	 * Generate the intent context XML block for injection
	 */
	private generateIntentContext(intent: ActiveIntent): string {
		const constraints = intent.constraints.map((c) => `  - ${c}`).join("\n")
		const scope = intent.owned_scope.map((s) => `  - ${s}`).join("\n")
		const acceptance = intent.acceptance_criteria.map((a) => `  - ${a}`).join("\n")

		return `
<intent_context id="${intent.id}" name="${intent.name}" status="${intent.status}">
  <owned_scope>
${scope}
  </owned_scope>
  <constraints>
${constraints}
  </constraints>
  <acceptance_criteria>
${acceptance}
  </acceptance_criteria>
</intent_context>
`.trim()
	}

	/**
	 * Pre-Hook: Called before tool execution
	 */
	async preHook(context: HookContext): Promise<PreHookResult> {
		const { toolName, toolParams, cwd } = context

		// If no active intent is set, block destructive tools
		if (!this.sessionState?.activeIntentId) {
			const classification = classifyTool(toolName)
			if (classification === "DESTRUCTIVE") {
				return {
					allowed: false,
					errorMessage: `Scope Violation: No active intent selected. You must call 'select_active_intent' before performing destructive operations like '${toolName}'.`,
				}
			}
			// Allow safe tools without intent
			return { allowed: true }
		}

		// Check scope for write operations
		if (
			toolName === "write_to_file" ||
			toolName === "edit" ||
			toolName === "search_and_replace" ||
			toolName === "edit_file"
		) {
			const filePath = (toolParams.path as string) || (toolParams.file_path as string)
			if (filePath) {
				const intentsData = await loadActiveIntents(cwd)
				if (intentsData) {
					const intent = getIntentById(intentsData, this.sessionState.activeIntentId)
					if (intent) {
						const isInScope = isFileInScope(filePath, intent.owned_scope)
						if (!isInScope) {
							return {
								allowed: false,
								errorMessage: `Scope Violation: Intent ${this.sessionState.activeIntentId} is not authorized to edit '${filePath}'. Authorized scope: ${intent.owned_scope.join(", ")}`,
							}
						}
					}
				}
			}
		}

		return { allowed: true }
	}

	/**
	 * Post-Hook: Called after successful tool execution
	 */
	async postHook(
		context: HookContext,
		toolResult: string,
		mutationClass: MutationClass = "UNKNOWN",
	): Promise<PostHookResult> {
		const { toolName, toolParams, cwd } = context
		const classification = classifyTool(toolName)

		// Only trace destructive/modifying operations
		if (classification !== "DESTRUCTIVE") {
			return { success: true }
		}

		// Get the file path from tool params
		const filePath = (toolParams.path as string) || (toolParams.file_path as string) || (toolParams.file as string)

		if (!filePath || !this.sessionState?.activeIntentId) {
			return { success: true }
		}

		try {
			// Ensure orchestration directory exists
			await ensureOrchestrationDir(cwd)

			// Read the current file content to compute hash
			const fullPath = path.resolve(cwd, filePath)
			let content = ""
			let startLine = 1
			let endLine = 1

			if (fs.existsSync(fullPath)) {
				content = fs.readFileSync(fullPath, "utf-8")
				const lines = content.split("\n")
				endLine = lines.length

				// For new files, startLine would be 1
				// For edits, we'd need the actual range - for now use entire file
			}

			// Compute content hash
			const contentHash = computeContentHash(content)

			// Get git revision
			const gitRevision = getGitRevision(cwd)

			// Create trace entry
			const traceEntry: AgentTraceEntry = {
				id: uuidv4(),
				timestamp: new Date().toISOString(),
				vcs: {
					revision_id: gitRevision,
				},
				files: [
					{
						relative_path: filePath,
						conversations: [
							{
								url: this.sessionState.taskId,
								contributor: {
									entity_type: "AI",
									model_identifier: "claude-3-5-sonnet", // Would get from actual model
								},
								ranges: [
									{
										start_line: startLine,
										end_line: endLine,
										content_hash: contentHash,
									},
								],
								related: [
									{
										type: "intent",
										value: this.sessionState.activeIntentId,
									},
								],
							},
						],
					},
				],
			}

			// Append to trace file
			const tracePath = path.join(getOrchestrationDir(cwd), "agent_trace.jsonl")
			const traceLine = JSON.stringify(traceEntry) + "\n"
			fs.appendFileSync(tracePath, traceLine, "utf-8")

			console.log(
				`[HookEngine] Traced ${toolName} on ${filePath} with intent ${this.sessionState.activeIntentId}`,
			)

			return {
				success: true,
				traceEntry,
			}
		} catch (error) {
			console.error("[HookEngine] Post-hook error:", error)
			return {
				success: false,
				errorMessage: error instanceof Error ? error.message : String(error),
			}
		}
	}

	/**
	 * Check if a file has been modified since the agent started
	 * Used for optimistic locking in parallel orchestration
	 */
	async checkFileConcurrency(
		filePath: string,
		originalHash: string,
	): Promise<{ stale: boolean; currentHash: string }> {
		const fullPath = path.resolve(this.workspacePath, filePath)

		if (!fs.existsSync(fullPath)) {
			return { stale: false, currentHash: "" }
		}

		const content = fs.readFileSync(fullPath, "utf-8")
		const currentHash = computeContentHash(content)

		return {
			stale: currentHash !== originalHash,
			currentHash,
		}
	}

	/**
	 * Update intent status (for completion or blocking)
	 */
	async updateIntentStatus(intentId: string, status: "COMPLETED" | "BLOCKED"): Promise<void> {
		const intentsData = await loadActiveIntents(this.workspacePath)
		if (!intentsData) return

		const intent = getIntentById(intentsData, intentId)
		if (intent) {
			intent.status = status
			intent.updated_at = new Date().toISOString()
			await saveActiveIntents(this.workspacePath, intentsData)
		}

		if (this.sessionState?.activeIntentId === intentId) {
			this.sessionState.activeIntentId = null
		}
	}

	/**
	 * Clear session state
	 */
	reset(): void {
		this.sessionState = null
		this.workspacePath = ""
	}
}

/**
 * Convenience function to get the HookEngine instance
 */
export function getHookEngine(): HookEngine {
	return HookEngine.getInstance()
}
