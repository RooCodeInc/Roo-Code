import type { HookContext, PreHook, PostHook } from "./types"

export async function runWithHooks(ctx: HookContext, toolFn: (ctx: HookContext) => Promise<unknown>) {
	// Import hooks dynamically to avoid circular module initialization
	const { preHooks, postHooks } = await import("./index")

	for (const h of preHooks as PreHook[]) {
		await h(ctx)
	}

	const result = await toolFn(ctx)

	for (const h of postHooks as PostHook[]) {
		await h(ctx, result)
	}

	return result
}
