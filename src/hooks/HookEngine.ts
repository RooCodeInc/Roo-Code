import type { HookContext, HookResult, PreHook, PostHook } from "./types"
import { classifyTool } from "./classifier"
import { buildTraceEntry, computeContentHash, updateActiveIntent, writeTrace } from "./sidecarWriter"

export class HookEngine {
	constructor(
		private readonly orchestrationDir: string,
		private readonly preHooks: PreHook[],
		private readonly postHooks: PostHook[],
	) {}

	public async runWithHooks<T>(
		ctx: HookContext,
		execute: () => Promise<T>,
	): Promise<{ result?: T; hookResult: HookResult }> {
		const enrichedCtx = { ...ctx, category: classifyTool(ctx) }
		for (const pre of this.preHooks) {
			const decision = await pre(enrichedCtx)
			if (!decision.allow) {
				await this.emitPostHooks(enrichedCtx, decision)
				await this.trace(enrichedCtx, decision)
				return { hookResult: decision }
			}
		}

		let resultValue: T | undefined
		let postDecision: HookResult = { allow: true }
		try {
			resultValue = await execute()
			postDecision = { allow: true, message: "ok" }
		} catch (error: any) {
			postDecision = { allow: false, isError: true, message: error?.message ?? String(error) }
		}

		await this.emitPostHooks(enrichedCtx, postDecision)
		await this.trace(enrichedCtx, postDecision)
		return { result: resultValue, hookResult: postDecision }
	}

	private async emitPostHooks(ctx: HookContext, result: HookResult): Promise<void> {
		for (const post of this.postHooks) {
			await post(ctx, result)
		}
	}

	private async trace(ctx: HookContext, result: HookResult): Promise<void> {
		const entry = buildTraceEntry(ctx, result)
		await writeTrace(this.orchestrationDir, entry)
	}
}

// Pre-hook: require active intent for destructive tools
export const requireActiveIntent: PreHook = async (ctx) => {
	if (ctx.category === "destructive" && !ctx.activeIntentId) {
		return { allow: false, isError: true, message: "No active intent selected. Call select_active_intent first." }
	}
	return { allow: true }
}

// Post-hook: update active_intents.yaml when intent present
export const syncActiveIntent: PostHook = async (ctx) => {
	if (ctx.activeIntentId && ctx.cwd) {
		await updateActiveIntent(ctx.cwd.replace(/\\/g, "/"), ctx.activeIntentId)
	}
}

// Pre-hook helper: add content hash if mutationSummary present
export const hashMutation: PreHook = async (ctx) => {
	if (ctx.mutationSummary && !ctx.contentHash) {
		ctx.contentHash = computeContentHash(ctx.mutationSummary)
	}
	return { allow: true }
}
