export async function postToolHook(toolName: string, result: any) {
	console.log(`[POST-HOOK] Tool: ${toolName}`)

	return {
		toolName,
		result,
		timestamp: new Date().toISOString(),
	}
}
