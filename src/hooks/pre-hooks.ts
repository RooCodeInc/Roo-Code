export * from "./types"
export * from "./intentPreflightHook"
export * from "./optimisticLockPreWriteHook"

import type { ToolName } from "@roo-code/types"

import { classifyCommand } from "../core/governance/CommandClassifier"
import { enforceIntentScope } from "../core/governance/ScopeEnforcer"
import { showHITLApproval } from "../core/governance/HITLAuthorizer"
import { loadIntentContext as loadIntentContextInternal } from "../core/intent/IntentContextLoader"

interface TaskLike {
	providerRef?: {
		deref?: () => { getState?: () => Promise<unknown> } | undefined
	}
}

// Pre-execution hooks that run before tools
export const preHooks = {
	// Phase 1: Intent validation
	validateIntent: async (task: TaskLike) => {
		const state = await task.providerRef?.deref?.()?.getState?.()
		return !!(state as any)?.activeIntentId
	},

	// Phase 2: Command classification
	classifyCommand: (toolName: string) => classifyCommand(toolName as ToolName),

	// Phase 2: Scope enforcement
	enforceScope: async (
		filePath: string,
		intentId: string,
		cwd: string,
		intentScope?: { files?: string[] } | unknown,
	) => enforceIntentScope(intentId, cwd, intentScope ?? {}, [filePath]),

	// Phase 2: HITL authorization
	authorizeHITL: async (toolName: string, params: unknown) => showHITLApproval(toolName, params),

	// Phase 1: Context loading
	loadIntentContext: async (intentId: string, cwd: string) => loadIntentContextInternal(cwd, intentId),
}
