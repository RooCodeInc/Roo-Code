import { Task } from "../core/task/Task"

export enum HookType {
	PRE = "pre",
	POST = "post",
}

export interface HookResponse {
	allow: boolean
	reason?: string
}

export interface IToolHook {
	name: string
	type: HookType
	execute(context: HookContext): Promise<HookResponse | void>
}

export interface HookContext {
	task: Task
	toolName: string
	arguments: any
	intentId?: string
	result?: any
	error?: any
	timestamp: string
}
