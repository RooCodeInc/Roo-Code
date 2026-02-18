export interface HookContext {
	intentId?: string
	metadata?: Record<string, unknown>
}

export type PreHook = (ctx: HookContext) => Promise<void>

export type PostHook = (ctx: HookContext, result: unknown) => Promise<void>
