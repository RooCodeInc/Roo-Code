export class HookEngine {
	private preHooks: PreHook[] = []
	private postHooks: PostHook[] = []

	registerPre(hook: PreHook) {
		this.preHooks.push(hook)
	}

	registerPost(hook: PostHook) {
		this.postHooks.push(hook)
	}

	/**
	 * Wrap a tool execution with pre/post hooks.
	 * `exec` is your existing tool runner: (toolName, args) => result
	 */
	async runTool(
		call: ToolCall,
		exec: (call: ToolCall) => Promise<ToolResult>,
		ctx: HookContext,
	): Promise<ToolResult> {
		for (const hook of this.preHooks) {
			const decision = await hook(call, ctx)
			if (decision.action === "short_circuit") {
				// Even short-circuited results go through post hooks (optional, but useful)
				for (const post of this.postHooks) {
					await post(call, decision.result, ctx)
				}
				return decision.result
			}
		}

		const result = await exec(call)

		for (const post of this.postHooks) {
			await post(call, result, ctx)
		}

		return result
	}
}
