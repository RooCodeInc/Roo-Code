import { preToolHook } from "./preToolHook"
import { postToolHook } from "./postToolHook"
import { setActiveIntent } from "./intentState"

export async function executeWithHooks(toolName: string, tool: { execute: (args: any) => Promise<any> }, args: any) {
	const decision = await preToolHook(toolName, args)

	if (!decision.allowed) {
		throw new Error(decision.reason)
	}

	const result = await tool.execute(args)

	await postToolHook(toolName, result)

	return result
}
