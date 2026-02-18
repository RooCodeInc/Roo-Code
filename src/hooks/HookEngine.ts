import { IHook, ToolCall, HookResult, ToolHookContext } from "./types"

export class HookEngine {
	private preHooks: IHook[] = []
	private postHooks: IHook[] = []
	private context: ToolHookContext

	constructor(context: ToolHookContext) {
		this.context = context
	}

	registerPreHook(hook: IHook): void {
		this.preHooks.push(hook)
	}

	registerPostHook(hook: IHook): void {
		this.postHooks.push(hook)
	}

	async interceptPre(toolCall: ToolCall): Promise<HookResult> {
		for (const hook of this.preHooks) {
			try {
				const result = await hook.execute(toolCall, this.context)
				if (result.blocked) {
					return result
				}
				if (result.enrichedContext) {
					this.context = { ...this.context, ...result.enrichedContext } as ToolHookContext
				}
			} catch (error) {
				console.error(`Pre-Hook ${hook.name} failed safely:`, error)
			}
		}
		return { blocked: false }
	}

	async interceptPost(toolCall: ToolCall, result: unknown): Promise<void> {
		for (const hook of this.postHooks) {
			try {
				await hook.execute(toolCall, this.context, result)
			} catch (error) {
				console.error(`Post-Hook ${hook.name} failed safely:`, error)
			}
		}
	}

	getContext(): ToolHookContext {
		return this.context
	}

	setActiveIntent(intentId: string): void {
		this.context.activeIntentId = intentId
	}
}
