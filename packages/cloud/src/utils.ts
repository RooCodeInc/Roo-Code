import type { ExtensionContext } from "vscode"

export function getUserAgent(context?: ExtensionContext): string {
	return `Costrict ${context?.extension?.packageJSON?.version || "unknown"}`
}
