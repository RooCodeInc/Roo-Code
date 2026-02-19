/**
hooks/index.ts
─────────────────────────────────────────────────────────────
Entry point for the Hook System.
─────────────────────────────────────────────────────────────
*/
import { hookEngine, ToolContext, BlockSignal } from "./HookEngine"
// Pre-hooks
import { contextInjector } from "./pre/ContextInjector"
import { intentGatekeeper } from "./pre/IntentGatekeeper"
import { scopeEnforcer } from "./pre/ScopeEnforcer"
import { optimisticLockGuard } from "./pre/OptimisticLockGuard"
// Post-hooks
import { traceLogger } from "./post/TraceLogger"
import { intentMapUpdater } from "./post/IntentMapUpdater"
import { lessonRecorder } from "./post/LessonRecorder"

// ── Registration ───────────────────────────────────────────────
export function registerAllHooks(): void {
	// Pre-hooks (ORDER MATTERS)
	hookEngine.registerPre("ContextInjector", contextInjector)
	hookEngine.registerPre("IntentGatekeeper", intentGatekeeper)
	hookEngine.registerPre("ScopeEnforcer", scopeEnforcer)
	hookEngine.registerPre("OptimisticLockGuard", optimisticLockGuard)
	// Post-hooks
	hookEngine.registerPost("TraceLogger", traceLogger)
	hookEngine.registerPost("IntentMapUpdater", intentMapUpdater)
	hookEngine.registerPost("LessonRecorder", lessonRecorder)
	console.log("[HookSystem] All hooks registered.")
}

// ── Dispatcher Wrapper ─────────────────────────────────────────
export async function dispatchWithHooks(
	toolName: string,
	params: Record<string, unknown>,
	workspacePath: string,
	originalDispatch: (toolName: string, params: Record<string, unknown>) => Promise<unknown>,
	sessionIntentId?: string,
): Promise<{ content: unknown; blocked: boolean; blockReason?: string }> {
	const ctx: ToolContext = {
		toolName,
		params,
		workspacePath,
		intentId: sessionIntentId,
	}

	// ── Run Pre-Hooks ────────────────────────────────────────────
	const preResult = await hookEngine.runPreHooks(ctx)
	if (preResult instanceof BlockSignal) {
		return {
			content: {
				type: "error",
				error: preResult.reason,
				code: preResult.code,
			},
			blocked: true,
			blockReason: preResult.reason,
		}
	}

	// ── Context injection short-circuit ─────────────────────────
	if ((preResult as any).__injectedContext__) {
		await hookEngine.runPostHooks(preResult)
		return {
			content: {
				type: "tool_result",
				content: (preResult as any).__injectedContext__,
			},
			blocked: false,
		}
	}

	// ── Run Original Tool ────────────────────────────────────────
	const toolResult = await originalDispatch(preResult.toolName, preResult.params)

	// ── Run Post-Hooks ───────────────────────────────────────────
	await hookEngine.runPostHooks(preResult)
	return { content: toolResult, blocked: false }
}

// Re-export core types
export { hookEngine } from "./HookEngine"
export type { ToolContext, BlockSignal } from "./HookEngine"
