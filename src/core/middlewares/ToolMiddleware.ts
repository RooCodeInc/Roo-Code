import { Task } from "../task/Task"

export interface MiddlewareResult {
	allow: boolean
	error?: string
	modifiedParams?: any
}

export interface ToolMiddleware {
	name: string
	beforeExecute?(params: any, task: Task, toolName: string): Promise<MiddlewareResult>
	afterExecute?(result: any, task: Task, toolName: string): Promise<MiddlewareResult>
}
