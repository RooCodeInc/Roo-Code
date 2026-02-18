import { Intent } from "./types"

export class ScopeEnforcer {
	static isPathAllowed(intent: Intent, filePath: string): boolean {
		return intent.owned_scope.some((pattern) => filePath.startsWith(pattern.replace("/**", "")))
	}
}
