import { HookContext, HookDecision, PostToolHook, PostToolHookContext, PreToolHook } from "./types"

export class HookEngine {
	private readonly preHooks: PreToolHook[] = []
	private readonly postHooks: PostToolHook[] = []

	registerPreHook(hook: PreToolHook): void {
		this.preHooks.push(hook)
	}

	registerPostHook(hook: PostToolHook): void {
		this.postHooks.push(hook)
	}

	async runPreHooks(context: HookContext): Promise<HookDecision> {
		const mergedPatch: Record<string, unknown> = {}

		for (const hook of this.preHooks) {
			try {
				const decision = await hook.run(context)
				if (!decision.allow) {
					return decision
				}
				if (decision.contextPatch) {
					Object.assign(mergedPatch, decision.contextPatch)
				}
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error)
				return {
					allow: false,
					code: "HOOK_ERROR",
					reason: `pre-hook ${hook.name} failed: ${reason}`,
				}
			}
		}

		return {
			allow: true,
			contextPatch: Object.keys(mergedPatch).length > 0 ? mergedPatch : undefined,
		}
	}

	async runPostHooks(context: PostToolHookContext): Promise<{ errors: string[] }> {
		const errors: string[] = []

		for (const hook of this.postHooks) {
			try {
				await hook.run(context)
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error)
				errors.push(`post-hook ${hook.name} failed: ${reason}`)
			}
		}

		return { errors }
	}
}
