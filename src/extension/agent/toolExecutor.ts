import { HookEngine } from "../../hooks/hookEngine" // adjust relative path if needed

export class ToolExecutor {
	private hookEngine = new HookEngine(this.workspaceRoot) // ensure workspaceRoot exists in your class

	async execute(invocation: { tool: string; arguments: any }) {
		await this.hookEngine.onPreToolUse(invocation)
		const res = await this.dispatch(invocation) // existing call that actually runs the tool
		await this.hookEngine.onPostToolUse(invocation, res)
		return res
	}

	async preWriteCheck(args: { path: string; intentId: string; mutationClass: string }) {
		await this.hookEngine.onPreWrite(args)
	}
	async postWriteTrace(args: { path: string; content: string; intentId: string; mutationClass: string }) {
		await this.hookEngine.onPostWrite(args)
	}
}
