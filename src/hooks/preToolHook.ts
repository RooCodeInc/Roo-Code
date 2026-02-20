let activeIntent: string | null = null

export function setActiveIntent(intentId: string) {
	activeIntent = intentId
}

export async function preToolHook(toolName: string, args: any) {
	// 1. Allow handshake tool without prior intent
	if (toolName === "select_active_intent") {
		return { allowed: true }
	}

	// 2. Enforce intent declaration before any other tool
	if (!activeIntent) {
		return {
			allowed: false,
			reason: "You must cite a valid active Intent ID before using tools.",
		}
	}

	// 3. Example safety policy (failure mode)
	if (toolName === "deleteFile" && args?.path === "/") {
		return {
			allowed: false,
			reason: "Root deletion is unsafe and blocked by policy.",
		}
	}

	// 4. (Phase 2 placeholder) scope enforcement
	// Example:
	// if (!isPathInIntentScope(args.path, activeIntent)) {
	//   return { allowed: false, reason: "Tool target outside intent scope." }
	// }

	return { allowed: true }
}
