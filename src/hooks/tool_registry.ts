// Tool registry: define tools that agents can call. Wire these into the extension host tool system.
import { preHook_SelectActiveIntent, HookEngine } from "./prepost_hooks"

export const TOOL_SELECT_ACTIVE_INTENT = "select_active_intent"

export function registerDefaultTools(hooks: HookEngine) {
	// Register pre-hook for select_active_intent so the middleware can validate and return context
	hooks.registerPreHook<string, any>(TOOL_SELECT_ACTIVE_INTENT, async (intentId, workspaceRoot) => {
		return await preHook_SelectActiveIntent(intentId, workspaceRoot)
	})
}

export type ToolCall = { name: string; args: any[] }

// Example helper the extension host can use to call tools through HookEngine
export async function callTool(hooks: HookEngine, tool: ToolCall, workspaceRoot: string) {
	// Run pre-hooks
	const preResult = await hooks.runPreHooks(tool.name, tool.args[0], workspaceRoot)
	// NOTE: actual tool invocation should happen here (LLM or host logic)
	// For select_active_intent the pre-hook returns the intent context used by the agent.
	// Run post-hooks with a placeholder result if needed.
	await hooks.runPostHooks(tool.name, tool.args[0], preResult, workspaceRoot)
	return preResult
}
