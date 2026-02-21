export async function runPreHook(toolName: string, args: any) {
	return { allowed: true }
}

export async function runPostHook(toolName: string, result: any) {
	return
}
