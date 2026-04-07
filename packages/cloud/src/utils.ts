import type { ExtensionContext } from "vscode"

export function getUserAgent(context?: ExtensionContext): string {
	return `Jabberwock ${context?.extension?.packageJSON?.version || "unknown"}`
}
