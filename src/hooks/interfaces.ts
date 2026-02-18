export interface PreHook {
	onPreToolUse?(invocation: any): Promise<void>
	onPreWrite?(data: { path: string; intentId: string; mutationClass: string }): Promise<void>
}
export interface PostHook {
	onPostToolUse?(invocation: any, result: any): Promise<void>
	onPostWrite?(data: { path: string; content: string; intentId: string; mutationClass: string }): Promise<void>
}
