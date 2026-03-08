import { appendAgentTrace } from "../core/trace/AgentTraceSerializer"

import type { HookResult, TraceHookContext } from "./types"

export async function runTracePostWriteHook(context: TraceHookContext): Promise<HookResult> {
	try {
		await appendAgentTrace({
			workspaceRoot: context.workspaceRoot,
			activeIntentId: context.activeIntentId,
			filePath: context.filePath,
			content: context.content,
			toolName: context.toolName,
		})
		return { ok: true }
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}
