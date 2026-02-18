import { preHook } from "./preHook"
import { postHook } from "./postHook"

export async function runWithHooks(command: string, args: any) {
	// Pre-Hook intercept
	const preResult = await preHook(command, args)
	if (!preResult.allowed) {
		throw new Error(`Blocked by PreHook: ${preResult.reason}`)
	}

	// Execute actual command
	const result = await executeCommand(command, args)

	// Post-Hook intercept
	await postHook(command, args, result)

	return result
}
