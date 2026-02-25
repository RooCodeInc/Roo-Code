import type { ExtensionContext } from "vscode"

export function getUserAgent(context?: ExtensionContext): string {
	return `Joe-Code ${context?.extension?.packageJSON?.version || "unknown"}`
}
