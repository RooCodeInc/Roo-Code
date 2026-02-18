import { ToolExecutionContext } from "../types"

export const traceLogger: PostHook = async (ctx, result) => {
	// Placeholder: Log execution; full agent_trace.jsonl implemented in final
	console.log(`[POST-HOOK] Tool ${ctx.toolName} executed for intent ${ctx.intentId}`)
}
