import * as vscode from "vscode"
import path from "path"

import type { HookResult, IntentContext, MutationClass } from "./types"
import { DESTRUCTIVE_TOOLS } from "./types"
import { loadIntentContext, buildIntentContextXml } from "./context-loader"
import { pathInScope } from "./scope"

export interface PreHookOptions {
	cwd: string
	/** Current intent ID set by select_active_intent (per task/session) */
	getActiveIntentId: () => string | null
	setActiveIntentId: (id: string | null) => void
	/** Optional: path to .intentignore-style patterns (one per line) */
	intentIgnorePath?: string
	/** Require intent for destructive tools only; if false, require for all tools */
	requireIntentForDestructiveOnly?: boolean
}

/**
 * Pre-Hook: intercepts tool execution to enforce intent context and scope.
 * - select_active_intent: load context, return XML, set active intent.
 * - Destructive tools: require active intent; optional HITL; scope check for write_to_file.
 */
export class PreHook {
	constructor(private options: PreHookOptions) {}

	async intercept(toolName: string, params: Record<string, unknown>): Promise<HookResult> {
		const { cwd, getActiveIntentId, setActiveIntentId } = this.options

		// —— select_active_intent: the Handshake ——
		if (toolName === "select_active_intent") {
			const intentId = typeof params.intent_id === "string" ? params.intent_id.trim() : null
			if (!intentId) {
				return { blocked: true, error: "You must provide a valid intent_id when calling select_active_intent." }
			}
			const context = await loadIntentContext(cwd, intentId)
			if (!context) {
				return {
					blocked: true,
					error: `You must cite a valid active Intent ID. Intent "${intentId}" was not found in .orchestration/active_intents.yaml.`,
				}
			}
			setActiveIntentId(intentId)
			const xml = buildIntentContextXml(context)
			return { blocked: false, injectResult: xml }
		}

		const isDestructive = (DESTRUCTIVE_TOOLS as readonly string[]).includes(toolName)
		const requireIntent = this.options.requireIntentForDestructiveOnly ? isDestructive : true

		if (requireIntent) {
			const activeId = getActiveIntentId()
			if (!activeId) {
				return {
					blocked: true,
					error: "You must select an active intent first. Call select_active_intent(intent_id) with a valid ID from .orchestration/active_intents.yaml before writing code or running destructive commands.",
				}
			}

			// Scope enforcement for write_to_file
			if (toolName === "write_to_file" && params.path) {
				const relPath = String(params.path)
				const context = await loadIntentContext(cwd, activeId)
				if (context && context.owned_scope.length > 0 && !pathInScope(relPath, context.owned_scope, cwd)) {
					return {
						blocked: true,
						error: `Scope Violation: ${activeId} is not authorized to edit "${relPath}". Request scope expansion in active_intents.yaml or choose another intent.`,
					}
				}
			}
		}

		// Optional: HITL for destructive tools (can be wired via askApproval in host)
		return { blocked: false }
	}

	/**
	 * Optional: prompt for Human-in-the-Loop approval on destructive actions.
	 * Call this from the host when askApproval is invoked for destructive tools.
	 */
	static async askApprovalDestructive(toolName: string, message: string): Promise<boolean> {
		return new Promise((resolve) => {
			vscode.window
				.showWarningMessage(`Approve destructive action: ${toolName}?`, { modal: true }, "Approve", "Reject")
				.then((choice) => resolve(choice === "Approve"))
		})
	}
}
