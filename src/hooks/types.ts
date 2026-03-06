export interface HookContext {
	workspaceRoot: string
}

export interface HookResult {
	ok: boolean
	error?: string
}

export interface IntentHookContext extends HookContext {
	activeIntentId?: string
}

export interface TraceHookContext extends HookContext {
	activeIntentId: string
	filePath: string
	content: string
	toolName: string
}

export interface OptimisticLockContext extends HookContext {
	expectedHash?: string
	filePath: string
}
