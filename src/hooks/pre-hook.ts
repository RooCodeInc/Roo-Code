import path from "path"

import type { HookResult } from "./types"
import { DESTRUCTIVE_TOOLS } from "./types"
import { loadIntentContext, buildIntentContextXml } from "./context-loader"
import { pathInScope } from "./scope"

/** Block paths that escape workspace (.. or absolute outside cwd). */
function isPathTraversal(relPath: string, cwd: string): boolean {
	const normalized = path.normalize(relPath)
	if (normalized.includes("..")) return true
	const resolved = path.resolve(cwd, relPath)
	return !resolved.startsWith(cwd)
}

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
				// Path traversal: block paths that escape workspace (e.g. .. or absolute)
				if (isPathTraversal(relPath, cwd)) {
					return {
						blocked: true,
						error: `Path traversal not allowed: "${relPath}" would escape the workspace. Use a path relative to the workspace only.`,
					}
				}
				const context = await loadIntentContext(cwd, activeId)
				if (context && context.owned_scope.length > 0 && !pathInScope(relPath, context.owned_scope, cwd)) {
					return {
						blocked: true,
						error: `Scope Violation: ${activeId} is not authorized to edit "${relPath}". Request scope expansion in active_intents.yaml or choose another intent.`,
					}
				}
			}
		}

		// Optional: HITL for destructive tools (wire via askApproval in host / extension)
		return { blocked: false }
	}
}
