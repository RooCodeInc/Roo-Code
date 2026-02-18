export interface ToolExecutionContext {
	toolName: string
	args: Record<string, any>
	agentId: string
	intentId?: string // Populated after select_active_intent
}

export type PreHook = (ctx: ToolExecutionContext) => Promise<ToolExecutionContext>
export type PostHook = (ctx: ToolExecutionContext, result: any) => Promise<void>
