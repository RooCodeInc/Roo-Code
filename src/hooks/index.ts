import { PreHook, PostHook } from "./types"
import { contextLoader } from "./preHooks/contextLoader"
import { intentValidator } from "./preHooks/intentValidator"
import { traceLogger } from "./postHooks/traceLogger"
import { docUpdater } from "./postHooks/docUpdater"

export const preHooks: PreHook[] = [intentValidator, contextLoader]
export const postHooks: PostHook[] = [traceLogger, docUpdater]

// Function to execute hooks around tool execution
export async function executeWithHooks(toolName: string, args: Record<string, any>, agentId: string) {
	let ctx = { toolName, args, agentId }

	// Run Pre-Hooks
	for (const hook of preHooks) {
		ctx = await hook(ctx)
	}

	// Call the actual tool (placeholder)
	const result = await fakeToolExecution(ctx)

	// Run Post-Hooks
	for (const hook of postHooks) {
		await hook(ctx, result)
	}

	return result
}

// Temporary placeholder for demonstration
async function fakeToolExecution(ctx: any) {
	console.log(`[TOOL] Executing ${ctx.toolName} with args`, ctx.args)
	return { success: true }
}
