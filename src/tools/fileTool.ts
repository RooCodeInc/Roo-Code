import { HookEngine } from "../hooks/hookEngine"
// Utility to be used within actual file tool implementations
export async function withWriteHook(workspaceRoot: string, args: any, logic: () => Promise<any>) {
	const hook = new HookEngine(workspaceRoot)
	await hook.onPreWrite(args)
	const result = await logic()
	await hook.onPostWrite({ ...args, content: args.content }) // Example
	return result
}
