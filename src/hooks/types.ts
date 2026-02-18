export interface HookContext {
	activeIntentId?: string
}

export interface Intent {
	id: string
	name: string
	status: string
	owned_scope: string[]
	constraints: string[]
}
