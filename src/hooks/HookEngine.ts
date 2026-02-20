import { IToolHook, HookType, HookContext, HookResponse } from "./types"

/**
 * HookEngine manages the execution of pre and post tool hooks.
 */
export class HookEngine {
	private preHooks: IToolHook[] = []
	private postHooks: IToolHook[] = []

	registerHook(hook: IToolHook) {
		if (hook.type === HookType.PRE) {
			this.preHooks.push(hook)
		} else {
			this.postHooks.push(hook)
		}
	}

	async executePreHooks(context: HookContext): Promise<HookResponse> {
		for (const hook of this.preHooks) {
			const response = await hook.execute(context)
			if (response && !response.allow) {
				return response
			}
		}
		return { allow: true }
	}

	async executePostHooks(context: HookContext): Promise<void> {
		for (const hook of this.postHooks) {
			await hook.execute(context)
		}
	}
}
