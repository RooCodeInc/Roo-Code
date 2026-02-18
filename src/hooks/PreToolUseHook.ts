/**
 * PreToolUseHook - Intercepts BEFORE tool execution
 * Enforces governance rules and validates operations
 */

import { HookContext, HookResult, IntentMetadata } from "./types"
import { ScopeEnforcer } from "./ScopeEnforcer"
import { OptimisticLockManager } from "./OptimisticLockManager"
import { CommandClassifier } from "./CommandClassifier"
import { IntentContextLoader } from "./IntentContextLoader"

export class PreToolUseHook {
	private intentLoader: IntentContextLoader
	private lockManager: OptimisticLockManager

	constructor(workspaceRoot: string, lockManager: OptimisticLockManager) {
		this.intentLoader = new IntentContextLoader(workspaceRoot)
		this.lockManager = lockManager
	}

	/**
	 * Execute pre-tool-use checks
	 * @param context Hook context with tool information
	 * @returns Hook result indicating if tool should proceed
	 */
	async execute(context: HookContext): Promise<HookResult> {
		// Special handling for select_active_intent tool
		if (context.toolName === "select_active_intent") {
			return await this.handleSelectActiveIntent(context)
		}

		// Check if this is a mutating tool
		const isMutatingTool = this.isMutatingTool(context.toolName)

		if (isMutatingTool) {
			// GATEKEEPER: Block writes if no active intent
			if (!context.activeIntentId) {
				return {
					allow: false,
					error: `Intent Gatekeeper: You must select an active intent before modifying files or executing commands.\n\nCall select_active_intent(intent_id) first to load the architectural context for your work.\n\nAvailable intents can be listed with list_active_intents().`,
				}
			}

			// Load active intent metadata
			const intent = await this.intentLoader.loadIntent(context.activeIntentId)
			if (!intent) {
				return {
					allow: false,
					error: `Invalid Intent: Intent "${context.activeIntentId}" not found in active_intents.yaml`,
				}
			}

			// Scope enforcement for file writes
			if (context.toolName === "write_to_file" && context.filePath) {
				const scopeCheck = ScopeEnforcer.checkScope(context.filePath, intent, context.workspaceRoot)
				if (!scopeCheck.allowed) {
					return {
						allow: false,
						error: scopeCheck.error,
					}
				}

				// Optimistic lock check
				const collisionCheck = await this.lockManager.checkForCollision(context.filePath)
				if (collisionCheck.hasCollision) {
					return {
						allow: false,
						error: collisionCheck.error,
					}
				}

				// Record baseline if not already tracked
				if (!this.lockManager.getBaseline(context.filePath)) {
					await this.lockManager.recordBaseline(context.filePath)
				}
			}

			// Command classification for execute_command
			if (context.toolName === "execute_command") {
				const command = context.toolParams.command || ""
				const requiresApproval = CommandClassifier.requiresApproval(command)

				if (requiresApproval) {
					const classification = CommandClassifier.classify(command)
					const description = CommandClassifier.getDescription(classification)

					// Return context for HITL modal
					return {
						allow: true, // Will be gated by existing HITL system
						injectedContext: `⚠️ ${description}\n\nCommand: ${command}\n\nThis command requires human approval before execution.`,
					}
				}
			}
		}

		return { allow: true }
	}

	/**
	 * Handle select_active_intent tool call
	 * @param context Hook context
	 * @returns Hook result with injected intent context
	 */
	private async handleSelectActiveIntent(context: HookContext): Promise<HookResult> {
		const intentId = context.toolParams.intent_id || context.toolParams.intentId

		if (!intentId) {
			return {
				allow: false,
				error: "Missing required parameter: intent_id",
			}
		}

		const intent = await this.intentLoader.loadIntent(intentId)
		if (!intent) {
			const allIntents = await this.intentLoader.loadActiveIntents()
			const intentList = allIntents.map((i) => `  - ${i.id}: ${i.name} (${i.status})`).join("\n")

			return {
				allow: false,
				error: `Intent "${intentId}" not found.\n\nAvailable intents:\n${intentList}`,
			}
		}

		// Update intent status to IN_PROGRESS
		if (intent.status === "PENDING") {
			await this.intentLoader.updateIntentStatus(intentId, "IN_PROGRESS")
		}

		// Construct intent context for LLM injection
		const intentContext = this.intentLoader.constructIntentContext(intent)

		// Load shared brain
		const sharedBrain = await this.intentLoader.loadSharedBrain()
		const sharedBrainContext = sharedBrain ? `\n\n<shared_brain>\n${sharedBrain}\n</shared_brain>` : ""

		return {
			allow: true,
			injectedContext: intentContext + sharedBrainContext,
		}
	}

	/**
	 * Check if tool is mutating (writes files or executes commands)
	 * @param toolName The tool name
	 * @returns true if tool mutates state
	 */
	private isMutatingTool(toolName: string): boolean {
		const mutatingTools = ["write_to_file", "execute_command", "apply_diff", "insert_code_block", "replace_in_file"]
		return mutatingTools.includes(toolName)
	}
}
