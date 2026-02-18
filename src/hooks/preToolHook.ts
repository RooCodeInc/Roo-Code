let activeIntent: string | null = null

export function setActiveIntent(intentId: string) {
	activeIntent = intentId
}

export async function preToolHook(toolName: string, args: any) {
	if (!activeIntent) {
		return {
			allowed: false,
			reason: "You must cite a valid active Intent ID.",
		}
	}

	// Example scope enforcement
	if (toolName === "deleteFile" && args.path === "/") {
		return { allowed: false, reason: "Root deletion is unsafe" }
	}

	return { allowed: true }
}
