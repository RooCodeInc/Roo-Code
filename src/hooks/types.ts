/**
 * Core types for the modular hook system.
 */
export enum HookType {
	PRE = "pre",
	POST = "post",
}

export interface ToolHook {
	name: string
	type: HookType
	execute(...args: any[]): Promise<any>
}
