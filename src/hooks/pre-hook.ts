import path from "path"

import type { HookResult } from "./types"
import { DESTRUCTIVE_TOOLS } from "./types"
import { loadIntentContext, buildConsolidatedIntentContextXml } from "./context-loader"
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
 * - Destructive tools: require active intent; .intentignore exclusion; scope check for write_to_file; optional UI-blocking approval.
 */
export class PreHook {
	private intentIgnoreCache: IntentIgnoreResult | null = null

	constructor(private options: PreHookOptions) {}

	private async getIntentIgnore(): Promise<IntentIgnoreResult> {
		if (this.intentIgnoreCache) return this.intentIgnoreCache
		this.intentIgnoreCache = await loadIntentIgnore(this.options.cwd, this.options.intentIgnorePath)
		return this.intentIgnoreCache
	}

	async intercept(toolName: string, params: Record<string, unknown>): Promise<HookResult> {
		const { cwd, getActiveIntentId, setActiveIntentId } = this.options

		// —— select_active_intent: the Handshake ——
		if (toolName === "select_active_intent") {
			const intentId = typeof params.intent_id === "string" ? params.intent_id.trim() : null
			if (!intentId) {
				return { blocked: true, error: "You must provide a valid intent_id when calling select_active_intent." }
			}
			const xml = await buildConsolidatedIntentContextXml(cwd, intentId)
			if (!xml) {
				return {
					blocked: true,
					error: `You must cite a valid active Intent ID. Intent "${intentId}" was not found in .orchestration/active_intents.yaml.`,
				}
			}
			setActiveIntentId(intentId)
			return { blocked: false, injectResult: xml }
		}

		const isDestructive = (DESTRUCTIVE_TOOLS as readonly string[]).includes(toolName)
		const requireIntent = this.options.requireIntentForDestructiveOnly ? isDestructive : true
		const activeId = getActiveIntentId()

		if (requireIntent) {
			if (!activeId) {
				return {
					blocked: true,
					error: "You must select an active intent first. Call select_active_intent(intent_id) with a valid ID from .orchestration/active_intents.yaml before writing code or running destructive commands.",
				}
			}

			const ignore = await this.getIntentIgnore()
			if (isIntentExcluded(activeId, ignore.excludedIntentIds)) {
				return {
					blocked: true,
					error: formatResponse.toolError(
						`Intent ${activeId} is listed in .intentignore and cannot be modified. Choose another intent or ask the user to update .intentignore.`,
					),
				}
			}

			// Scope and .intentignore path checks for file-writing tools
			const filePathParam =
				toolName === "write_to_file"
					? params.path
					: [
								"edit",
								"search_and_replace",
								"search_replace",
								"edit_file",
								"apply_patch",
								"apply_diff",
						  ].includes(toolName)
						? (params.file_path ?? params.path)
						: undefined
			if (filePathParam) {
				const relPath = String(filePathParam)
				if (isPathTraversal(relPath, cwd)) {
					return {
						blocked: true,
						error: `Path traversal not allowed: "${relPath}" would escape the workspace. Use a path relative to the workspace only.`,
					}
				}
				if (isPathIgnored(relPath, ignore.pathPatterns)) {
					return {
						blocked: true,
						error: formatResponse.toolError(
							`Path "${relPath}" is excluded by .intentignore. You are not authorized to edit it.`,
						),
					}
				}
				const context = await loadIntentContext(cwd, activeId)
				if (context && context.owned_scope.length > 0 && !pathInScope(relPath, context.owned_scope, cwd)) {
					return {
						blocked: true,
						error: formatResponse.toolErrorScopeViolation(activeId, relPath),
					}
				}
			}
		}

		// UI-blocking authorization for destructive tools (e.g. showWarningMessage Approve/Reject)
		if (isDestructive && this.options.confirmDestructive) {
			const approved = await this.options.confirmDestructive(toolName, params)
			if (!approved) {
				return {
					blocked: true,
					error: formatResponse.toolErrorUserRejected(toolName),
				}
			}
		}

		return { blocked: false }
	}
}
