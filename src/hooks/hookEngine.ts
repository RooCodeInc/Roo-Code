import { PreHook, PostHook } from "./interfaces"
import { intentHandshakePreHook } from "./preHooks/intentHandshakePreHook"
import { scopeEnforcementPreHook } from "./preHooks/scopeEnforcementPreHook"
import { traceLedgerPostHook } from "./postHooks/traceLedgerPostHook"

export class HookEngine {
	private preHooks: PreHook[]
	private postHooks: PostHook[]

	constructor(private workspaceRoot: string) {
		this.preHooks = [intentHandshakePreHook(workspaceRoot), scopeEnforcementPreHook(workspaceRoot)]
		this.postHooks = [traceLedgerPostHook(workspaceRoot)]
	}
	async onPreToolUse(invocation: any) {
		for (const h of this.preHooks) if (h.onPreToolUse) await h.onPreToolUse(invocation)
	}
	async onPostToolUse(invocation: any, result: any) {
		for (const h of this.postHooks) if (h.onPostToolUse) await h.onPostToolUse(invocation, result)
	}
	async onPreWrite(data: { path: string; intentId: string; mutationClass: string }) {
		for (const h of this.preHooks) if (h.onPreWrite) await h.onPreWrite(data)
	}
	async onPostWrite(data: { path: string; content: string; intentId: string; mutationClass: string }) {
		for (const h of this.postHooks) if (h.onPostWrite) await h.onPostWrite(data)
	}
}
