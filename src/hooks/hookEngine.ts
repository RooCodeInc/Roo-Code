// src/hooks/hookEngine.ts
export type HookContext = {
	intentId?: string
	toolName?: string
	targetPath?: string
}

export async function runPreLlmHooks(ctx: HookContext) {
	// TODO: load active_intents.yaml and inject intent context
}

export async function runPreToolHooks(ctx: HookContext) {
	// TODO: classify tool, enforce scope, maybe require approval
}

export async function runPostWriteHooks(ctx: HookContext) {
	// TODO: append to agent_trace.jsonl with content hashes
}
