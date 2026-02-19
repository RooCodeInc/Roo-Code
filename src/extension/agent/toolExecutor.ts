import { HookEngine } from "../../hooks/hookEngine" // adjust relative path if needed

export class ToolExecutor {
	private hookEngine: HookEngine
	constructor(private workspaceRoot: string) {
		this.hookEngine = new HookEngine(this.workspaceRoot)
	}

	async execute(invocation: { tool: string; arguments: any }) {
		await this.hookEngine.onPreToolUse(invocation)
		const res = await this.dispatch(invocation) // existing call that actually runs the tool
		await this.hookEngine.onPostToolUse(invocation, res)
		return res
	}

	async dispatch(invocation: { tool: string; arguments: any }): Promise<any> {
		// This should be replaced by actual logic in the base class or injected
		console.log(`Executing tool: ${invocation.tool}`)
		return {}
	}

	async preWriteCheck(args: { path: string; intentId: string; mutationClass: string }) {
		await this.hookEngine.onPreWrite(args)
	}
	async postWriteTrace(args: { path: string; content: string; intentId: string; mutationClass: string }) {
		await this.hookEngine.onPostWrite(args)
	}
}
