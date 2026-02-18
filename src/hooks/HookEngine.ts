import { PostHook } from "./PostHook"
import { PreHook } from "./PreHook"
export class HookEngine {
	constructor(
		private preHook: PreHook,
		private postHook: PostHook,
	) {}

	async execute(toolName: string, args: any, next: () => Promise<any>) {
		// Pre
		const preResult = await this.preHook.run(toolName, args)

		if (toolName === "select_active_intent") {
			return preResult
		}

		// Execute actual tool
		const result = await next()

		// Post
		await this.postHook.run(toolName, args, result)

		return result
	}
}
