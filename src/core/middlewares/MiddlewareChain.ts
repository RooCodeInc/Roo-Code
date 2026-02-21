import { ToolName } from "@roo-code/types"
import { Task } from "../task/Task"
import { ToolMiddleware, MiddlewareResult } from "./ToolMiddleware"

export class MiddlewareChain {
	private middlewares: ToolMiddleware[] = []

	add(middleware: ToolMiddleware): void {
		this.middlewares.push(middleware)
	}

	async executeBefore(params: any, task: Task, toolName: ToolName): Promise<MiddlewareResult> {
		for (const middleware of this.middlewares) {
			const result = await middleware.beforeExecute?.(params, task, toolName)
			if (result?.allow === false) {
				return result
			}

			if (result?.modifiedParams) {
				params = result.modifiedParams
			}
		}
		return { allow: true }
	}
}
