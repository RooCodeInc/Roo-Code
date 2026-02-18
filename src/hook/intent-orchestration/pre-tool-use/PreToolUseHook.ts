/**
 * PreToolUseHook - Pre-tool-use interceptor implementation
 * Handles intent validation, scope enforcement, and context injection
 */

import type { PreHook } from "../HookEngine"
import type { HookContext, PreHookResult } from "../types/HookResult"
import type { IntentDefinition } from "../types/IntentTypes"
import { IntentStore } from "../intent-store/IntentStore"
import { ValidationError } from "../errors/ValidationError"
import { ScopeViolationError } from "../errors/ScopeViolationError"
import { IntentNotSelectedError } from "../errors/IntentNotSelectedError"
import { globMatch } from "../utils/globMatch"

export interface PreToolUseConfig {
	intentStore: IntentStore
	requireIntentForTools: string[]
}

export class PreToolUseHook implements PreHook {
	name = "PreToolUseHook"
	private config: PreToolUseConfig

	constructor(config: PreToolUseConfig) {
		this.config = config
	}

	async execute(context: HookContext): Promise<PreHookResult> {
		const { tool_name, tool_args, intent_id } = context

		// Step 1: Check if intent is selected for tools that require it
		if (this.requiresIntent(tool_name) && !intent_id) {
			return {
				action: "block",
				shouldProceed: false,
				error: new IntentNotSelectedError(undefined, tool_name).message,
			}
		}

		// Step 2: Validate intent exists and is active
		if (intent_id) {
			const intent = this.config.intentStore.getIntentById(intent_id)
			if (!intent) {
				return {
					action: "block",
					shouldProceed: false,
					error: new ValidationError(`Intent '${intent_id}' not found`).message,
				}
			}

			if (intent.status !== "active") {
				return {
					action: "block",
					shouldProceed: false,
					error: new ValidationError(`Intent '${intent_id}' is not active`).message,
				}
			}

			// Step 3: Enforce scope constraints
			const scopeCheck = this.checkScope(tool_name, tool_args, intent)
			if (!scopeCheck.allowed) {
				return {
					action: "block",
					shouldProceed: false,
					error: scopeCheck.error,
				}
			}

			// Step 4: Inject intent context for the first mutation tool
			if (this.isMutationTool(tool_name)) {
				const selectedIntent = this.config.intentStore.getSelectedIntent()
				if (selectedIntent && !selectedIntent.context_injected) {
					this.config.intentStore.markContextInjected()
					return {
						action: "inject",
						shouldProceed: true,
						contextToInject: this.config.intentStore.buildContextBlock(intent_id),
					}
				}
			}
		}

		return {
			action: "allow",
			shouldProceed: true,
		}
	}

	/**
	 * Check if tool requires an active intent
	 */
	private requiresIntent(toolName: string): boolean {
		return this.config.requireIntentForTools.includes(toolName)
	}

	/**
	 * Check if tool is a mutation tool (modifies files)
	 */
	private isMutationTool(toolName: string): boolean {
		const mutationTools = ["write_to_file", "edit_file", "apply_diff", "edit", "search_replace", "apply_patch"]
		return mutationTools.includes(toolName)
	}

	/**
	 * Check if the tool operation is within the intent scope
	 */
	private checkScope(
		toolName: string,
		toolArgs: Record<string, unknown>,
		intent: IntentDefinition,
	): { allowed: boolean; error?: string } {
		// Extract file path from tool args
		const filePath = this.extractFilePath(toolName, toolArgs)
		if (!filePath) {
			return { allowed: true }
		}

		// Check exclusions first
		for (const pattern of intent.scope.exclude) {
			if (globMatch(filePath, pattern)) {
				return {
					allowed: false,
					error: new ScopeViolationError(
						`File '${filePath}' is excluded by scope pattern '${pattern}'`,
						intent.id || "unknown",
						filePath,
						toolName,
					).message,
				}
			}
		}

		// Check inclusions
		for (const pattern of intent.scope.include) {
			if (globMatch(filePath, pattern)) {
				return { allowed: true }
			}
		}

		// Not in any include pattern
		return {
			allowed: false,
			error: new ScopeViolationError(
				`File '${filePath}' is outside the intent scope`,
				intent.id || "unknown",
				filePath,
				toolName,
			).message,
		}
	}

	/**
	 * Extract file path from tool arguments
	 */
	private extractFilePath(toolName: string, toolArgs: Record<string, unknown>): string | null {
		const pathFields = ["path", "file_path", "filePath"]
		for (const field of pathFields) {
			if (toolArgs[field] && typeof toolArgs[field] === "string") {
				return toolArgs[field] as string
			}
		}
		return null
	}
}
