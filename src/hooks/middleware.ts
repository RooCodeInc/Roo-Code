import type { HookResult } from "./types"
import type { PreHook } from "./pre-hook"
import { appendAgentTrace } from "./post-hook"

export interface HookMiddlewareOptions {
	preHook: PreHook
	getActiveIntentId: () => string | null
	getCwd: () => string
	/** REQ-ID from Phase 1 - injected into agent_trace related array */
	getReqId?: () => string | undefined
	getSessionLogId?: () => string | undefined
	getModelId?: () => string | undefined
	getVcsRevisionId?: () => string | undefined
}

/**
 * Hook Engine: strict middleware boundary around tool execution.
 * 1. Pre-Hook: intercept, validate intent/scope, optionally inject result for select_active_intent.
 * 2. Execute: delegate to original tool (caller performs this).
 * 3. Post-Hook: on write_to_file success, append to agent_trace.jsonl.
 */
export class HookMiddleware {
	constructor(private options: HookMiddlewareOptions) {}

	/**
	 * Run pre-hook only. Returns HookResult; if blocked, caller must not execute the tool
	 * and should push toolResult with result.error. If injectResult is set, caller should
	 * push that as the tool result (for select_active_intent) and skip calling the real tool.
	 */
	async preToolUse(toolName: string, params: Record<string, unknown>): Promise<HookResult> {
		return this.options.preHook.intercept(toolName, params)
	}

	/**
	 * Run post-hook after a successful write_to_file. Call this from the host after
	 * the file has been written.
	 */
	async postToolUse(toolName: string, params: Record<string, unknown>, _result: unknown): Promise<void> {
		if (toolName !== "write_to_file") return
		const pathParam = params.path
		const contentParam = params.content
		if (typeof pathParam !== "string" || typeof contentParam !== "string") return

		const intentId =
			(typeof params.intent_id === "string" ? params.intent_id.trim() : null) || this.options.getActiveIntentId()
		const mutationClass = (params.mutation_class as "AST_REFACTOR" | "INTENT_EVOLUTION" | "NEW_FILE") ?? "UNKNOWN"

		await appendAgentTrace(this.options.getCwd(), {
			relativePath: pathParam,
			content: contentParam,
			intentId,
			mutationClass,
			reqId: this.options.getReqId?.(),
			sessionLogId: this.options.getSessionLogId?.(),
			modelIdentifier: this.options.getModelId?.(),
			vcsRevisionId: this.options.getVcsRevisionId?.(),
		})
	}
}
