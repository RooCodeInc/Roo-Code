import { ToolName } from "@roo-code/types"
import { Task } from "../task/Task"
import { ToolMiddleware, MiddlewareResult } from "./ToolMiddleware"

export class ScopeEnforcementMiddleware implements ToolMiddleware {
	name = "scopeEnforcement"

	async beforeExecute(params: any, task: Task, toolName: ToolName): Promise<MiddlewareResult> {
		const destructiveTools: Array<ToolName> = ["write_to_file", "edit", "apply_diff", "execute_command"]
		if (!destructiveTools.includes(toolName)) {
			return { allow: true }
		}

		const selectedIntentId = task.getSelectedIntentId()
		if (!selectedIntentId) {
			return { allow: false, error: "No active intent selected" }
		}

		const provider = task.providerRef.deref()
		if (!provider) {
			return { allow: false, error: "Provider unavailable" }
		}

		try {
			const intentLoader = provider.getIntentLoader()
			await intentLoader.ensureLoaded()
			const intent = intentLoader.getIntent(selectedIntentId)

			if (!intent) {
				return { allow: false, error: `Intent '${selectedIntentId}' not found` }
			}

			if (toolName === "write_to_file" && params.path) {
				if (intent.owned_scopes?.length) {
					const isAuthorized = intent.owned_scopes.some(
						(scope) => params.path.startsWith(scope) || params.path === scope,
					)

					if (!isAuthorized) {
						return {
							allow: false,
							error: `Scope Violation: ${selectedIntentId} not authorized to edit ${params.path}`,
						}
					}
				}
			}

			return { allow: true }
		} catch (error) {
			return {
				allow: false,
				error: `Error validating scope: ${error instanceof Error ? error.message : String(error)}`,
			}
		}
	}
}
